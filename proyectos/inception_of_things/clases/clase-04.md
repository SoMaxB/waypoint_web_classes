# Clase 4: K3d, Argo CD y GitOps con p3

## Objetivo

Entender cómo se despliega una aplicación **desde GitHub sin tocar el cluster**: K3d vs K3s, los namespaces `argocd` y `dev`, la **Application CRD** de Argo CD (`repoURL`, `targetRevision`, `path`, `destination`), el sync automático con `prune` y `selfHeal`, por qué el install de Argo CD necesita `--server-side`, y sobre todo **por qué cambiar `deployment.yaml` solo en local no basta**.

## 1. La topología de p3 — ficheros

```
srcs/p3/
├── scripts/
│   └── install.sh            ← único script: cluster + Argo CD + Application
└── confs/
    ├── application.yaml      ← la "orden" de Argo CD (se aplica al cluster)
    └── manifests/            ← la app que Argo CD vigila (vive en GitHub)
        ├── deployment.yaml   (wil42/playground:v1 o v2)
        └── service.yaml
```

| Fichero | Rol |
|---|---|
| `scripts/install.sh` | Preflight Docker, instala `kubectl`/`k3d`/`argocd` en `~/.local/bin`, recrea el cluster `iot`, crea namespaces, instala Argo CD y aplica la Application |
| `confs/application.yaml` | CRD `Application`: le dice a Argo CD qué repo vigilar, qué path y en qué namespace desplegar |
| `confs/manifests/deployment.yaml` | Manifiesto de la app (con `image: wil42/playground:v1`) — **este es la fuente de verdad de Argo CD** |
| `confs/manifests/service.yaml` | Service `ClusterIP` que expone el puerto 8888 dentro del cluster |

### La diferencia de arquitectura frente a p1 y p2

```
p1/p2:  Vagrant + VM(generic/ubuntu2204) + K3s dentro de la VM
p3:     Docker + K3d (K3s dentro de un contenedor) + Argo CD + un repo GitHub
```

Nada de esto corre en una VM: `install.sh` se ejecuta **en el host**. No hace falta `sudo` porque las herramientas se instalan en `~/.local/bin`; el único requisito previo es **Docker arrancado y accesible** (`docker info`).

## 2. K3s vs K3d — la pregunta que el subject obliga a saber

| | K3s | K3d |
|---|---|---|
| Qué es | Distribución ligera de Kubernetes, 1 binario | **K3s corriendo dentro de Docker** (cada nodo es un contenedor) |
| Para qué | Correr un cluster real en una máquina (o VM) | Tener un cluster rápido y desechable **en desarrollo** |
| Runtime | Procesos nativos en el SO | Contenedores Docker orquestados por k3d |
| Nodos | Metal/VM: server y agentes | Contenedores `k3d-iot-server-0`, `...-agent-0` |
| Sysadmin | Instalación con script de K3s | `k3d cluster create` |

> K3d no es "otra Kubernetes": es **K3s empaquetado en contenedores Docker**. El cluster que ves con `kubectl get nodes` es el mismo K3s que en p1/p2, pero sin VM: lo que el subject pide es que sepas **cuándo usar cada uno**.

## 3. El flujo completo de p3

```
  GitHub (repo público, manifiestos en srcs/p3/confs/manifests, tag v1/v2)
                  │
     Argo CD pollea el repo cada ~3 min  (sync automático)  ── o sync manual
                  ▼
   Argo CD (namespace argocd)
     └─ Application CRD "playground"  ──sync──►  aplica manifests al cluster
                  ▼
   K3d cluster "iot" · namespace dev
     ├─ Deployment playground  (wil42/playground:v1|v2)
     └─ Service    playground  (ClusterIP, 8888)
                  ▲
      kubectl -n dev port-forward svc/playground 8888:8888
```

El punto clave de GitOps: **nadie aplica manifiestos a mano**. El cluster se "declara en Git" y Argo CD se encarga de que la realidad coincida con esa declaración.

## 4. `install.sh` sección a sección

### Preflight — Docker obligatorio

```bash
[ -x docker ] || exit                      # ¿está instalado?
docker info   || exit                      # ¿el daemon responde?
```

K3d **no funciona sin Docker**: cada nodo del cluster es un contenedor. Los errores de permisos se arreglan con `sudo usermod -aG docker $USER` y volver a iniciar sesión.

### Tooling sin sudo en `~/.local/bin`

```bash
kubectl  ← descargado   de dl.k8s.io (versión stable)
k3d      ← instalador oficial de k3d
argocd   ← CLI binario de argo-cd releases (solo útil para sync/login opcional)
export PATH="${BIN}:${PATH}"
```

Nada necesita paquetes del sistema: todo termina en `HOME/.local/bin`, así el evaluador solo necesita Docker.

### El cluster, desde cero

```bash
k3d cluster delete iot  >/dev/null 2>&1 || true
k3d cluster create iot  --wait
```

Cada ejecución **borra y recrea** el cluster (estado conocido, reproducible). `--wait` espera a que el cluster esté listo antes de seguir.

### Namespaces

```bash
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace dev    --dry-run=client -o yaml | kubectl apply -f -
```

- `argocd` → el controlador (componentes de Argo CD).
- `dev` → la aplicación (donde aterrizan los manifiestos de GitHub).
- El `--dry-run=client -o yaml | apply -f -` convierte el comando en **idempotente**: se puede repetir sin error.

### Argo CD, instalar con `--server-side`

```bash
kubectl apply --server-side -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-repo-server --timeout=300s
kubectl -n argocd rollout status deploy/argocd-server      --timeout=300s
```

- El `install.yaml` es el manifiesto oficial: instala todos los componentes Argo CD en el namespace `argocd`.
- **Por qué `--server-side`:** `kubectl apply` normal anota cada objeto con la configuración aplicada (`last-applied-configuration`), y esa anotación tiene un **límite de 262144 bytes**. Los CRDs de Argo CD (los tipos `Application` y `AppProject`) superan ese tamaño en metadatos; con `--server-side` el servidor gestiona la reconciliación en el propio modelo de Kubernetes y se evita el límite.
- Las dos esperas son los componentes que importan para el sync del repo: `argocd-repo-server` (lee el Git) y `argocd-server` (API + UI).

### La Application — el corazón GitOps

```bash
kubectl apply -f "${CONFS}/application.yaml"
```

Esto **no es** un manifiesto de la app: le dice a Argo CD **qué repo vigilar, en qué path y hacia dónde sincronizar**. A partir de aquí es el propio controller quien despliega.

### Esperar el primer sync

```bash
for _ in $(seq 1 60); do
  SYNC="$(kubectl -n argocd get application playground -o jsonpath='{.status.sync.status}' ...)"
  HEALTH="$(kubectl -n argocd get application playground -o jsonpath='{.status.health.status}' ...)"
  [ "${SYNC}" = "Synced" ] && [ "${HEALTH}" = "Healthy" ] && break
  sleep 5
done
```

Lee el **status de la Application** hasta que queda `Synced` y `Healthy` — la señal de que Argo CD ya aplicó los manifests desde GitHub.

### Info final

- Imprime el password de admin (`argocd-initial-admin-secret`, en base64).
- Recuerda los dos port-forwards: UI (`8080:443`) y app (`8888:8888`).
- Avisa si `~/.local/bin` no está en el `PATH`.

## 5. La Application CRD, campo a campo

`confs/application.yaml` **no se lee desde Git** (aunque vive en el repo): se aplica una vez al cluster y es la declaración de intenciones de Argo CD.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: playground
  namespace: argocd        # el controller vive aquí
spec:
  project: default         # qué AppProject (política) la gestiona
  source:                  # ← DE DÓNDE mirar
    repoURL: https://github.com/<login>/Inception-of-Things_<login>.git
    targetRevision: HEAD   # rama/commit a seguir (HEAD = default)
    path: srcs/p3/confs/manifests
  destination:             # ← DÓNDE aplicar
    server: https://kubernetes.default.svc   # el propio cluster
    namespace: dev
  syncPolicy:              # ← CUÁNDO y CÓMO sync
    automated:
      prune: true          # borra del cluster lo que borras en Git
      selfHeal: true       # revierte cambios hechos a mano en el cluster
    syncOptions:
      - CreateNamespace=true   # crea el ns destino si no existe
```

| Campo | Qué decide | Analogía vigente |
|---|---|---|
| `source.repoURL` | Qué repo Git vigila Argo CD | "de dónde saco la receta" |
| `source.path` | Qué subcarpeta del repo usa | "qué receta de este libro" |
| `source.targetRevision` | Qué rama/commit — `HEAD` | "sigue la última versión" |
| `destination.namespace` | Dónde crea los objetos | "en qué cocina la aplico" |
| `destination.server` | Qué cluster — el suyo (`kubernetes.default.svc`) | "en esta cocina" |
| `automated.prune` | ¿Borrar lo que ya no está en Git? | "retira lo que sobra" |
| `automated.selfHeal` | ¿Deshacer ediciones manuales? | "la receta manda por encima de mis manos" |

> La práctica del subject de p3 pide **solo esto**: dos namespaces, una app en `dev` desplegada por Argo CD desde GitHub, y que cambiar el **tag de la imagen en Git** basta para desplegar.

## 6. Continuous deployment — v1 → v2

1. El `deployment.yaml` **existe en dos sitios**: en el repo (GitHub) y en el cluster (copiado por Argo CD). **Git es la fuente de verdad**, la copia del cluster es un reflejo.
2. Cambias el tag en tu repo y haces push:

```bash
sed -i 's|playground:v1|playground:v2|' srcs/p3/confs/manifests/deployment.yaml
git add + commit + push
```

3. Argo CD **pollea** el repo cada ~3 minutos y ve el cambio → aplica → crea un Deployment con la imagen `v2` (rollout: el pod viejo va saliendo, entra el nuevo).
4. Si no quieres esperar al poll, ordenas un sync manual:

```bash
kubectl -n argocd patch application playground --type merge \
  -p '{"operation":{"sync":{"revision":"HEAD"}}}'
```

5. Compruebas el resultado:

```bash
curl http://localhost:8888/
# {"status":"ok", "message": "v2"}
```

> **Por qué "cambiar solo en local no basta":** el `deployment.yaml` local es un borrador; Argo CD solo lee el **remoto**. Mientras el commit no se suba, el repo que vigila Argo CD no cambia y no hay nada que sincronizar. GitOps = el cluster converge hacia lo que hay en **el repo remoto**, no hacia tu disco.

## 7. Diagnóstico rápido

| Síntoma en p3 | Causa | Primer comando |
|---|---|---|
| `Application` **OutOfSync** | El repo tiene un cambio que Argo CD aún no aplica (normal justo tras un push sin sync manual) | `kubectl get application playground -n argocd` |
| **ComparisonError** en la Application | `repoURL` erróneo, `path` inexistente, repo privado sin credenciales, repo apuntando a rama mal | `kubectl get application playground -n argocd -o yaml` (status.operationState) |
| App **no aparece** en `dev` | Application sin `Synced`, o ns mal escrito en `destination`, o sync fallido | `kubectl get application -n argocd` + `kubectl get pods -n dev` |
| `playground` no responde en 8888 | Port-forward cerrado, Service sin endpoints, pod CrashLoop | `kubectl -n dev get pods` / `kubectl -n dev get endpoints` |
| Pods de Argo CD **CrashLoop / Pending** | Cluster recién creado sin `--wait`, o falta de recursos en Docker | `kubectl -n argocd get pods` |
| Argo CD queda en **HealthMissing** | Aplicación aún demasiado nueva (status todavía no calculado) | esperar + `kubectl get application -n argocd` |
| El evaluador quiere repetir todo | `install.sh` ya borra y recrea el cluster | `./scripts/install.sh` |

Fallo "bonito" de GitOps para defender: editar el Pod/Deployment **a mano** con `kubectl edit` y ver cómo `selfHeal` lo revierte solo en el siguiente poll (3 min).

## Predicciones y ejercicios

1. **La práctica oficial del plan.** ¿Por qué cambiar `deployment.yaml` solo en local **no** despliega nada, y por qué Argo CD necesita leer el cambio del remoto?

<details><summary>Solución</summary>

Porque Argo CD **no mira tu disco**: su Application apunta a un `repoURL` concreto y sincroniza contra el estado de ese repo. Tu `deployment.yaml` local es solo la fuente para hacer un commit. Hasta que el commit no viaja al remoto (`git push`), el contenido que Argo CD compara sigue igual → no ve ningún cambio → no sync. Y aunque lo viera, solo aplica manifiestos que vienen del `path` indicado en el repo, no ficheros locales.

```bash
git add + commit                  # prepara el borrador
git push                          #  ← aquí el cambio entra en la fuente de verdad
kubectl get application -n argocd # Synced vs OutOfSync
```

</details>

2. **Por qué `--server-side`.** ¿Por qué `kubectl apply` normal podría fallar al instalar Argo CD, y qué hace `--server-side`?

<details><summary>Solución</summary>

`kubectl apply` clásico guarda la configuración aplicada en la anotación `kubectl.kubernetes.io/last-applied-configuration`, limitada a **262144 bytes**. Los CRDs de Argo CD (`Application`, `AppProject`) tienen esquemas enormes que superan ese límite → aplicar falla. Con `--server-side` el API server asume la reconciliación (campo `managedFields`) y el límite de la anotación deja de importar.

</details>

3. **La Application no se lee de Git.** ¿La `application.yaml` de p3 la aplica Argo CD? Justifica.

<details><summary>Solución</summary>

No. Es el **cliente** quien la aplica (`kubectl apply -f confs/application.yaml`, paso 4.6 del script). Es un objeto CRD `Application` que **configura** a Argo CD: le dice qué repo y path vigilar y hacia qué namespace. Argo CD ejecuta lo que ese objeto indica, pero **no** puede verse a sí mismo leyéndolo de Git — sin la Application aplicada, Argo CD está instalado pero no sabe qué desplegar.

</details>

4. **`selfHeal` en acción.** Un evaluador ejecuta `kubectl -n dev scale deploy playground --replicas=5` y espera 5 pods. ¿Qué pasa realmente?

<details><summary>Solución</summary>

La Application tiene `automated.selfHeal: true`, así que Argo CD considera el estado del cluster como "deriva" frente a Git (donde `replicas: 1`) y **lo revierte** en el siguiente ciclo (≤3 min por el poll). Puede que veas brevemente 5 pods y luego vuelvan a 1. La prueba es que Git manda: la edición manual no sobrevive. (La misma lógica protegería borrar el Deployment: `prune`/`selfHeal` lo restauran.)

</details>

5. **La pregunta girada de defensa.** "Después de un `git push` la app nunca cambia de versión. ¿Qué compruebas?"

<details><summary>Solución</summary>

1. Que el push fue al repo correcto (`git remote -v`) y la rama coincide con `targetRevision` (`HEAD` → la rama por defecto).
2. Estado de la Application: `kubectl get application playground -n argocd` ↔ `OutOfSync`/`ComparisonError`.
3. Si está `OutOfSync`, Argo CD aún no ha hecho el poll → sync manual con el `patch --operation`. Si `ComparisonError`, revisar `repoURL`, `path` y credenciales.
4. Si `Synced` pero la imagen vieja, ver el rollout: `kubectl -n dev rollout status deploy/playground` y el tag: `kubectl get deploy playground -n dev -o jsonpath='{.spec.template.spec.containers[0].image}'`.

</details>

6. **Namespaces y destino.** ¿Qué pasaría si `destination.namespace: dev` no existiera y la Application no tuviera `CreateNamespace=true`?

<details><summary>Solución</summary>

La sincronización fallaría: Argo CD no puede crear un Deployment en un namespace que no existe. Por eso el script crea `dev` explícitamente *y* la Application añade `syncOptions: [CreateNamespace=true]` — doble garantía. El error aparecería en `status.operationState.message` tipo `namespaces "dev" not found`.

</details>

## Errores frecuentes

- Confundir `application.yaml` con un manifiesto de la app: es la **configuración de Argo CD**, se aplica al cluster.
- Creer que editar el `deployment.yaml` local ya despliega → no, falta `git push` (y el poll de Argo CD).
- Escribir `repoURL`/`path` mal → `ComparisonError`. El path es **relativo a la raíz del repo**: `srcs/p3/confs/manifests`.
- Aplicar los manifests de la app a mano con `kubectl apply` y luego "no entender por qué se revierten" → es `selfHeal`, el cluster manda a Git.
- Instalar Argo CD con `kubectl apply` normal → falla por el límite de las anotaciones; se necesita `--server-side`.
- Olvidar el port-forward: el Service es `ClusterIP`, no hay IP pública de la app en p3 — se accede con `port-forward`.
- Tratar de usar el cluster de p1/p2: p3 es un cluster **K3d** distinto; los contextos de `kubectl` son diferentes.
- No saber distinguir K3s de K3d (pregunta expresa del subject).

## Has aprendido que

- **K3d = K3s dentro de Docker**: cluster desechable para desarrollo; K3s nativo para metal/VM.
- **GitOps**: nadie toca el cluster a mano; Git (`repoURL` + `path`) es la fuente de verdad y Argo CD hace converger el cluster.
- **Application CRD**: `source` (de dónde) + `destination` (dónde) + `syncPolicy` (cuándo y con qué garantías).
- **`--server-side`** evita el límite de anotación del `kubectl apply` para los CRDs grandes de Argo CD.
- **Cambiar el tag en Git y push** es el desplegable; el poll (~3 min) o el sync manual (`patch --operation`) materializan el cambio.
- **`prune`** limpia lo borrado en Git y **`selfHeal`** revierte ediciones manuales — dos pruebas vivas de GitOps en la defensa.

## Preguntas tipo defensa

1. ¿Cuál es la diferencia entre K3s y K3d, y por qué p3 usa K3d?
2. ¿Quién aplica `application.yaml` y contra qué lo hace?
3. ¿Dónde están los manifiestos *reales* de la app y quién los lee?
4. Cambias `image: v1` a `v2`: detalla, en orden, qué pasa hasta que `curl` devuelve v2.
5. ¿Qué pasa si alguien edita el cluster a mano con `kubectl edit`? ¿Y con qué comando lo demuestras?
6. ¿Por qué `kubectl apply --server-side` para Argo CD y no el clásico?
7. ¿Con qué comando fuerzas el sync sin esperar los 3 minutos?
8. ¿Cómo accedes a la app si el Service es ClusterIP?

## Criterio de finalización

Marca cada ítem cuando lo digas "sin apuntes":

- Distinguir K3s vs K3d y decir qué necesita p3 (Docker) y qué no necesita (Vagrant/VM).
- Explicar el flujo: GitHub → Argo CD → Application CRD → namespace dev → Deployment/Service.
- Nombrar los 4 campos de la Application y qué decide cada uno.
- Explicar por qué `--server-side` es obligatorio para los CRDs de Argo CD.
- Justificar por qué "cambiar en local no basta" y qué hace falta (`git push` + poll/sync manual).
- Demostrar GitOps con `selfHeal`/`prune` (editas a mano → Argo CD lo revierte).

## Siguiente clase

La clase 5 cubre el **bonus: GitLab local** — cómo se cierra el flujo GitOps sin salir del cluster: un GitLab CE corriendo dentro de K3d con PVCs, y Argo CD leyendo desde el GitLab local en vez de GitHub.
