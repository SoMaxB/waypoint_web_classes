# Clase 5: Bonus — GitLab local

## Objetivo

Entender cómo se cierra el flujo GitOps **sin salir del cluster**: un GitLab CE corriendo dentro de K3d (namespace `gitlab`), desplegado con PVCs, pod único y estrategia `Recreate`; y Argo CD leyendo desde ese **GitLab local** en vez de GitHub. En especial, la práctica del plan: **por qué `localhost:8081` no sirve como `repoURL`** y por qué hay que usar la URL interna del Service.

## 1. Qué pide el bonus

El subject es corto y exige:

- Tu instancia de GitLab debe correr **localmente**.
- Ha de estar **configurada para funcionar con tu cluster**.
- Un **namespace dedicado** llamado `gitlab`.
- **Todo lo de la Parte 3 debe funcionar con tu GitLab local** (el mismo flujo GitOps, pero con GitLab como fuente).
- Carpeta nueva **`bonus`** en la raíz del repo.
- Se espera la **última versión de GitLab** del sitio oficial → `gitlab/gitlab-ce:latest`.

> El bonus solo se evalúa si la parte obligatoria está "flawless" — imperativo tener p1, p2 y p3 impecables antes de defender esto.

## 2. La topología de bonus — ficheros

```
srcs/bonus/
├── scripts/
│   ├── install.sh              ← orquesta: cluster + gitlab.sh + argocd.sh
│   ├── gitlab.sh               ← imagen, deploy, token, proyecto, push de manifests
│   └── argocd.sh               ← Argo CD + Application apuntando al GitLab local
└── confs/
    ├── gitlab.yaml             ← Secret root + 2 PVCs + Deployment + Service
    ├── application.yaml        ← misma idea que p3, pero repoURL = GitLab interno
    └── manifests/              ← la app (v1/v2), se PUSHEAN a GitLab
        ├── deployment.yaml
        └── service.yaml
```

| Fichero | Rol |
|---|---|
| `scripts/install.sh` | Preflight (Docker + RAM), reusa o crea el cluster `iot`, 3 namespaces, llama a `gitlab.sh` y `argocd.sh` |
| `scripts/gitlab.sh` | Toda la parte GitLab vía API: imagen, deploy, esperas, token, proyecto público, push de `manifests/` |
| `scripts/argocd.sh` | Instala/reusa Argo CD y aplica la Application que apunta al GitLab interno |
| `confs/gitlab.yaml` | El "stack" GitLab en YAML: Secret, PVCs, Deployment y Service |
| `confs/application.yaml` | Application con `repoURL: http://gitlab.gitlab.svc.cluster.local/...` |
| `confs/manifests/*` | Los manifests que `gitlab.sh` sube a GitLab bajo `manifests/` |

### Diferencia de arquitectura con p3

```
p3:     GitHub (externo) ──► Argo CD ──► dev
bonus:  GitLab (dentro del cluster) ──► Argo CD ──► dev
        GitLab corre en el MISMO cluster, namespace gitlab
```

El bonus "es p3 + GitLab": **reusa el cluster `iot`** si ya existe (no crea un segundo lab) y **reescribe la misma Application** `playground` cambiando solo el `repoURL`.

## 3. `install.sh` — lo nuevo frente a p3

```bash
MEM_GB=$(awk '/MemTotal/{print $2/1048576}' /proc/meminfo)
[ "$MEM_GB" -lt 8 ] && echo "WARNING: GitLab wants ~4 GiB; close VMs first."
```

- Añade un **aviso de RAM**: GitLab CE es pesado (necesita unos 4 GiB). No aborta, solo advierte.
- **Reutiliza el cluster** en vez de borrarlo:

```bash
if k3d cluster list iot; then k3d cluster start iot; else k3d cluster create iot; fi
k3d kubeconfig merge iot --kubeconfig-switch-context
```

> Esto es deliberado y notable: p3 *borra y recrea* el cluster en cada run; el bonus *lo reusa* porque es "p3 más GitLab", no una infra paralela. `install.sh` no llama a los componentes en línea: **delega** en `gitlab.sh` y luego `argocd.sh` (el orden importa: primero debe existir el repo en GitLab para que Argo CD pueda sincronizar).

## 4. `gitlab.sh` — todo el ciclo GitLab automatizado

### La imagen

```bash
if ! docker image inspect gitlab/gitlab-ce:latest; then docker pull ... ; fi
k3d image import gitlab/gitlab-ce:latest -c iot
```

- La imagen se baja **en el host** (Docker local) y luego se **importa al cluster K3d**. Así, si se borra el cluster, no se vuelve a descargar la imagen (~3.5 GB).
- "Latest" cumple la "última versión oficial" del subject.

### El deploy y la espera

```bash
kubectl apply -f confs/gitlab.yaml
kubectl -n gitlab rollout status deploy/gitlab --timeout=1800s
```

`--timeout=1800s` (30 min): el primer arranque de GitLab corre reconfigure completo + migraciones de base de datos.

### Port-forward temporal

```bash
kubectl -n gitlab port-forward svc/gitlab 8081:80 &   # puerto libre dinámico
```

El script se comunica con **su propio cluster** a través de un port-forward **temporal** (lo mata con `trap` al salir). Nadie publica GitLab en el host: todo se hace vía API local.

### Token de API para root

```bash
PAT=$(kubectl -n gitlab exec deploy/gitlab -- gitlab-rails runner "...")
kubectl -n gitlab create secret generic gitlab-api-token --from-literal=token=$PAT ...
```

- Se crea un **personal access token** para `root` con `gitlab-rails runner` (consola Ruby de Rails dentro del pod).
- Scopes: `api` y `write_repository` (crear el proyecto y poder hacer push).
- Se guarda en un **Secret** de Kubernetes → las siguientes ejecuciones **reusan** el token en vez de crear otro. Esto convierte el script en idempotente.

### El proyecto público, creado por API

```bash
curl -X POST -H "PRIVATE-TOKEN: $PAT" "$API/projects"
     -d name=... -d path=... -d visibility=public
```

- Crea `root/Inception-of-Things_<login>` con `visibility=public`.
- Público es obligatorio: **Argo CD clonará sin credenciales** (recordar: no hay repo URL con password en la Application).

### Push de los manifests (v1)

```bash
mkdir WORK/manifests && cp confs/manifests/*.yaml WORK/manifests/
git init -b main; git add -A; git commit -m "IoT app manifests (v1)"
git push "http://oauth2:$PAT@127.0.0.1:$PORT/root/Inception-of-Things_<login>.git" main
```

- Crea un repo local temporal, copia SOLO los dos manifests de `confs/manifests/` y hace **push a GitLab** con el token como credencial `oauth2`.
- Se suben bajo `manifests/` — exactamente el `path` que la Application vigilará.
- La rama es `main` explícita (la Application usa `targetRevision: main`).

> **Implicación clave (gotcha del plan):** los manifests de `bonus/confs/manifests/` que ves en el repo **no son la fuente de verdad** — son la plantilla local que el script copia y *empuja* a GitLab. Cambiar el YAML local después del install **no** cambia nada hasta que vuelvas a ejecutar el script o hagas push a GitLab tú mismo.

## 5. `gitlab.yaml` — el stack GitLab en YAML

Cuatro objetos (con `---`):

### Secret `gitlab-root`

```yaml
stringData:
  password: "Iot-Kubernetes-2026"
```

La contraseña inicial de `root`; se inyecta al pod vía `env` (`GITLAB_ROOT_PASSWORD`). Local only: GitLab no se publica fuera del cluster.

### PVCs — persistencia

```yaml
gitlab-config   1Gi   ReadWriteOnce
gitlab-data    12Gi   ReadWriteOnce
```

- GitHub está fuera; aquí GitLab ES los datos. Si el pod muere o el cluster se apaga, el repo, la config y la BD deben seguir existiendo → **PVCs** (K3d provisiona volúmenes locales automáticamente).
- `config` → `/etc/gitlab` (configuración) · `data` → `/var/opt/gitlab` (DB, repos, gitaly).
- Los `logs` van a un `emptyDir` (efímeros) y `/dev/shm` es un `emptyDir medium: Memory` de 256 MiB (PostgreSQL necesita más de los 64 MiB por defecto).

### Deployment — pod único y `Recreate`

```yaml
replicas: 1
strategy:
  type: Recreate
```

- **`Recreate`** y no `RollingUpdate`: los PVCs son **single-writer** (un solo pod a la vez). Con RollingUpdate, el pod nuevo arrancaría antes de que el viejo muera, y ambos montarían el mismo disco → corrupción. `Recreate` mata el pod actual *antes* de crear el nuevo.
- Env omnibus:
  - `external_url 'http://gitlab.gitlab.svc.cluster.local'` → GitLab se configura para responder a la **URL interna del Service**, no a `localhost`.
  - `nginx['listen_https'] = false` → HTTP plano dentro del cluster.
  - `monitoring_whitelist = ['0.0.0.0/0']` → las probes de Kubernetes vienen de la IP del nodo y `/-/health` solo escucha en localhost por defecto: hay que abrirlo o las probes fallan.
  - Se apagan componentes sobrantes (prometheus, registry, kas) para un solo nodo.

### Probes — `startupProbe`, `readinessProbe`

```yaml
startupProbe:  /-/health  periodSeconds 10  failureThreshold 120
readinessProbe:/-/health  periodSeconds 15  failureThreshold 6
```

- El primer boot tarda mucho → **startupProbe** tolerante (hasta 120×10s = 20 min de margen antes de que el kubelet empiece a matar).
- La **readiness** decide cuándo el Service envía tráfico; sin ella, un GitLab aún migrando no recibiría el pull de Argo CD.
- `resources: memory 2Gi` → justifica el aviso de RAM del install.

### Service

```yaml
selector: app: gitlab
port: 80 → targetPort: http
```

`ClusterIP` estándar. Es **este** Service quien da el nombre DNS interno al resto del cluster.

## 6. La práctica del plan — por qué NO `localhost:8081`

La Application:

```yaml
source:
  repoURL: http://gitlab.gitlab.svc.cluster.local/root/Inception-of-Things_<login>.git
  targetRevision: main
  path: manifests
```

Dos motivos clave por los que el `repoURL` **no puede** ser `http://localhost:8081`:

1. **Dónde corre Argo CD:** Argo CD es un pod **dentro del cluster** (namespace `argocd`). `localhost` dentro de ese pod es el propio pod, no el host y no el cluster. Aunque publicaras GitLab en el host, el pod de Argo CD no tiene "host" — su red es la del cluster.
2. **Qué resuelve `localhost:8081`:** el port-forward solo existe en **tu** máquina (y en el proceso `kubectl port-forward`). No es direccionable desde otros pods, no es estable, y muere cuando cierras el comando.

Por eso GitLab da su `external_url` a `http://gitlab.gitlab.svc.cluster.local` (apartado 5): es el **nombre DNS de su propio Service**, que Kubernetes resuelve dentro de cualquier pod del cluster. Argo CD "habla" con GitLab usando la red interna del cluster, sin pasar por el host ni por ningún puerto.

```
kubectl -n argocd get application playground -o jsonpath='{.spec.source.repoURL}'
# http://gitlab.gitlab.svc.cluster.local/root/Inception-of-Things_<login>.git
```

> El port-forward `8081` solo existe para que el `install.sh` (que corre en el host) pueda usar la **API de GitLab** durante la instalación y para que tú abras la UI en `http://localhost:8081` desde el navegador. El tráfico de GitOps (repo → Argo CD) no lo usa en absoluto.

## 7. `argocd.sh` — Argo CD lee del GitLab local

```bash
kubectl apply --server-side -n argocd -f https://.../argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-repo-server --timeout=300s
kubectl -n argocd rollout status deploy/argocd-server      --timeout=300s
kubectl apply -f confs/application.yaml
```

- **Idempotente:** si `argocd-server` ya existe, lo reusa (no re-instala).
- Reusa `--server-side` por la razón de p3 (límite de 262144 bytes de las CRDs).
- Al aplicar `application.yaml`, la Application `playground` ya existente (si venías de p3) **reescribe su `repoURL`** al GitLab interno: eso es exactamente lo que pide el bonus ("todo lo de p3 debe funcionar con tu GitLab").
- Espera `Synced` + `Healthy` leyendo el status de la Application.

## 8. El flujo completo (la foto de memoria)

```
        [dentro del cluster iot · K3d]
GitLab pod (ns gitlab)              Argo CD (ns argocd)
  ├─ PVC: config+data (persisten)      └─ Application "playground"
  └─ Service gitlab 80/http                 │  repoURL = gitlab.gitlab... git
       │ DNS interno                         │  path: manifests · dest: dev
       │ http://gitlab.gitlab.svc...         ▼
       └────────────►  Argo CD clona/pollea ─►  sync ─►  Deployment+Service → ns dev
                                                          │
                                              port-forward 8888:8888 → curl → v1/v2

[en el host, solo para instalar/ver]
  kubectl port-forward svc/gitlab 8081:80  →  navegador http://localhost:8081
```

## 9. Diagnóstico rápido

| Síntoma en bonus | Causa | Primer comando |
|---|---|---|
| GitLab no arranca / CrashLoop | Migración lenta en el primer boot | `kubectl -n gitlab logs deploy/gitlab` + `kubectl -n gitlab get pods` |
| Rollout timeout tras 30 min | RAM insuficiente / imagen sin cache | `kubectl -n gitlab describe pod gitlab-...` (eventos) · comprobar `free -h` |
| Application `ComparisonError` | GitLab aún no responde, repo vacío, o rama incorrecta | `kubectl get application playground -n argocd -o yaml` |
| Application `OutOfSync` y no avanza | Push a GitLab no hecho / poll sin pasar | `kubectl -n gitlab port-forward ...` + git pull del repo en local |
| `curl` 8888 no responde | Port-forward 8888 cerrado | `kubectl -n dev port-forward svc/playground 8888:8888` |
| UI GitLab 502/503 en localhost:8081 | El servicio no ha pasado readiness | `kubectl -n gitlab get pods` (Ready?) |
| Pérdida de datos al borrar cluster | Los PVC persisten mientras el cluster exista; al borrarlo, los volúmenes K3d se van. Las secrets (token/root pass) también. | `kubectl get pvc -n gitlab` antes de `k3d cluster delete` |
| Tras crear cluster nuevo, token/root viejo | `kubectl create secret ...` en cada run crea una Secret nueva SOLO si la anterior no existe válida | re-ejecutar `./scripts/install.sh` (idempotente) |

> Para la defensa: el chequeo canónico de que "Argo CD lee de GitLab" es imprimir el `spec.source.repoURL` de la Application (apartado 6).

## Predicciones y ejercicios

1. **La práctica oficial del plan.** ¿Por qué `localhost:8081` no sirve como `repoURL` para Argo CD, y por qué debe usarse la URL interna del Service?

<details><summary>Solución</summary>

Argo CD corre dentro del cluster como un pod en el namespace `argocd`. Para él, `localhost` es su propio pod; y el `8081` ni siquiera existe fuera del comando `kubectl port-forward` que corriste en el host. `http://localhost:8081` es direccionable solo donde se ejecuta el port-forward (tu máquina), no desde el pod.

La URL interna `http://gitlab.gitlab.svc.cluster.local` es el **nombre DNS del Service `gitlab` en el namespace `gitlab`**. Kubernetes lo resuelve desde cualquier pod del cluster y apunta directo al Service (ClusterIP) → al pod de GitLab. Además es **estable**: no depende de un puerto publicado, de `/etc/hosts` ni de que un port-forward esté activo. El port-forward `8081` solo lo usan el instalador (para la API) y tu navegador (para la UI).

</details>

2. **PVC y `Recreate`.** ¿Por qué el Deployment de GitLab usa `strategy: Recreate` con `replicas: 1`, y qué pasaría con `RollingUpdate`?

<details><summary>Solución</summary>

Los PVCs se montan con `ReadWriteOnce` (un solo pod puede escribirlos a la vez). `RollingUpdate` crea el pod nuevo **antes** de eliminar el viejo: dos pods desplegados a la vez, ambos montando el mismo `gitlab-config`+`gitlab-data` → escrituras concurrentes → corrupción de la configuración/base de datos de GitLab. `Recreate` elimina primero el pod actual y solo entonces crea el siguiente, garantizando un único escritor en todo momento. `replicas: 1` es coherente con eso: GitLab es un monolito omnibus en un solo pod.

</details>

3. **¿Por qué el token y el proyecto los hace `gitlab.sh`?** En p3 la fuente es GitHub y no configuras nada con tokens. ¿Qué obliga aquí a crear token y proyecto por API y no en la UI?

<details><summary>Solución</summary>

GitLab corre dentro del cluster y el subject exige que **todo funcione por sí solo** ("everything you did in Part 3 must work with your local GitLab"). Nada de clicks: para que Argo CD sincronice hace falta 1) un repo existente (`root/Inception-of-Things_<login>`) y 2) poder escribir en él (push de `manifests/`). El token de `root` (scopes `api` + `write_repository`) se genera con el Rails runner y se guarda en un Secret para ser reutilizado en ejecuciones siguientes; el proyecto público se crea con un `POST` a `/api/v4/projects`. Todo reproducible y sin dependencia de la UI.

</details>

4. **Cambiar una versión en el bonus.** Editas `bonus/confs/manifests/deployment.yaml` a `v2` en tu repo local. ¿Despliega algo? ¿Cómo lo harías correctamente?

<details><summary>Solución</summary>

No despliega nada. En p3 el manifest *era* la fuente (Argo lo lee de GitHub); en bonus la fuente es **el repo dentro de GitLab**, al que `gitlab.sh` subió una copia. Editar el fichero local solo cambia la plantilla que el script copiará la próxima vez.

La vía correcta (la del README): clonar `http://oauth2:$TOKEN@127.0.0.1:8081/root/Inception-of-Things_<login>.git`, editar `manifests/deployment.yaml` a `v2` y hacer `git push`; o volver a lanzar `./scripts/install.sh` (que copia el YAML local y lo empuja). Luego, poll (~3 min) o sync manual (`patch --operation`), y `curl localhost:8888` → `{"message": "v2"}`.

</details>

5. **La pregunta girada de defensa.** "¿Cómo demuestro que Argo CD usa GitLab y no GitHub?"

<details><summary>Solución</summary>

Comando directo sobre la Application:

```bash
kubectl -n argocd get application playground -o jsonpath='{.spec.source.repoURL}{"\n"}'
# http://gitlab.gitlab.svc.cluster.local/root/Inception-of-Things_<login>.git
```

Complemento: mostrar que el proyecto vive dentro del cluster (`kubectl get pods -n gitlab` con el pod `gitlab-...` Running), que los pods en `dev` existen (`kubectl -n dev get pods`), y que un cambio hecho **en GitLab** (web UI o clone+push) se refleja en `curl http://localhost:8888`. La cadena completa demuestra "Part 3 funcionando con GitLab local".

</details>

6. **El puerto del Service y `targetPort: http`.** El Service de GitLab declara `port: 80` y `targetPort: http`. ¿Qué es `http` y por qué funciona?

<details><summary>Solución</summary>

`http` es el **nombre** del port del contenedor declarado en el Deployment (`ports: [{ name: http, containerPort: 80 }]`). En lugar de repetir el número, `targetPort` puede referirse al nombre: Kubernetes resuelve el puerto por nombre automáticamente. Ventaja: si cambiara el `containerPort` del contenedor, el Service no necesita edición. En la práctica es lo mismo que `targetPort: 80`.

</details>

## Errores frecuentes

- Intentar usar `localhost:8081` como `repoURL` de Argo CD (es la pregunta estrella: Argo está dentro del cluster, no ve tu host).
- Pensar que los manifests de `bonus/confs/manifests/` son la fuente de verdad → solo son la plantilla que `gitlab.sh` copia y **empuja** a GitLab.
- No entender por qué `Recreate`: dos pods con el mismo PVC `ReadWriteOnce` a la vez = corrupción de datos.
- Olvidar `monitoring_whitelist`: las probes kubelet fallan en `/-/health` porque GitLab por defecto solo escucha en localhost, y el pod nunca pasa Ready.
- Cambiar el YAML local tras el install y esperar un despliegue → hay que volver a correr el script o hacer push a GitLab.
- Creer que el bonus "es otra Parte 3" con GitHub → el bonus **reescribe** la misma Application para leer de GitLab.
- Esperar rapidez: primer boot de GitLab son 10-20 min (imagen ~3.5 GB + migraciones), y 8 GB de RAM son mínimos.
- Confundir el port-forward (tu navegador/instalador) con la ruta GitOps del tráfico (solo red interna del cluster).

## Has aprendido que

- El bonus es **"p3 + GitLab local"**: mismo cluster `iot`, mismos namespaces `argocd`/`dev`, y uno nuevo `gitlab`.
- **GitLab corre como pod** dentro de K3d con 2 PVCs, `Recreate`, pod único y probes tolerantes al primer boot.
- La fuente de GitOps se cambia **solo en el `repoURL`** de la Application: de GitHub a `gitlab.gitlab.svc.cluster.local`.
- `gitlab.sh` automatiza todo por **API** (token Rails runner, proyecto público, push de manifests) y guarda el token en un Secret para idempotencia.
- El nombre DNS interno del Service es la forma correcta de que Argo CD hable con GitLab; el port-forward es solo para instalación/UI.
- Las probes: `startupProbe` aguanta el boot largo; `readinessProbe` decide cuándo el Service sirve tráfico.
- Chequeo de defensa: `kubectl get application playground -o jsonpath='{.spec.source.repoURL}'`.

## Preguntas tipo defensa

1. ¿Por qué el bonus reusa el cluster `iot` en vez de crear otro?
2. ¿Cómo desplegarías GitLab de forma persistente (PVCs) y por qué `Recreate`?
3. ¿Por qué `localhost:8081` no puede ser el `repoURL` de Argo CD?
4. ¿Qué exactamente "pone en funcionamiento" Argo CD con GitLab? (`gitlab.sh` → repo con `manifests/` → Application con `repoURL` interno)
5. ¿Cómo demuestras que Argo CD lee del GitLab local y no de GitHub?
6. Si cierras el port-forward 8081, ¿sigue funcionando el GitOps de Argo CD? ¿Por qué?
7. ¿Para qué sirven los 3 namespaces y qué componente vive en cada uno?
8. ¿Qué pasa con la aplicación si editas solo el YAML local de `bonus/confs/manifests/`?

## Criterio de finalización

Marca cada ítem cuando lo digas "sin apuntes":

- Explicar la arquitectura: GitLab como pod en K3d, `argocd`/`dev`/`gitlab`, todo en el cluster `iot`.
- Justificar los PVCs y la estrategia `Recreate` (ReadWriteOnce, un solo escritor).
- Explicar la práctica estrella: por qué el `repoURL` es el DNS del Service y no `localhost:8081`.
- Recitar el flujo de `gitlab.sh`: imagen → deploy → wait → token → proyecto público → push manifests (v1).
- Demostrar el cambio v1→v2 desde GitLab y el chequeo del repoURL.
- Diagnosticar `ComparisonError` / pod GitLab no Ready / app sin sync.

## Siguiente clase

La clase 6 cierra el curso: **Defensa y troubleshooting** — el orden de demostración del proyecto completo, qué enseñar y justificar en cada parte, y cómo diagnosticar los fallos que un evaluador puede provocar.

## Lista de lecturas

- GitLab (omnibus) docs — la imagen Docker de GitLab CE y su arranque.
- Kubernetes docs — PersistentVolumes y PersistentVolumeClaims para los datos de GitLab.
- Argo CD docs — repositorios y credenciales; por qué `repoURL` es el DNS del Service.
