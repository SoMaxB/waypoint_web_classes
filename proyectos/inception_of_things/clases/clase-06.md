# Clase 6: Defensa y troubleshooting

## Objetivo

Cerrar el curso integrando todo: defender el proyecto completo **en orden**, saber qué enseñar y justificar en cada parte, y diagnosticar los fallos que un evaluador puede provocar o que ocurren en vivo. Al terminar, pasar de "reproducir comandos" a **explicar el porqué detrás de cada capa**.

## 1. La regla de oro de la defensa

> El evaluador tiene el subject delante y **tu repo**. La evaluación se hace en tu máquina, en vivo. Todo lo que muestres debe salir de ejecutar el repo desde cero.

- **Reproducibilidad por encima de todo:** cada parte tiene un solo comando de arranque, un solo comando de verificación y un solo comando de limpieza. Si "funciona pero no sé por qué", es un riesgo; si "falla pero lo sé diagnosticar", es un punto a favor.
- **No leas de los apuntes:** cada verificación debe poder explicarse con una frase (qué mando y qué espero).
- **Nombra las decisiones de diseño:** en cada parte hay decisiones llamativas (equivalen a "¿por qué está hecho así?" del evaluador).

## 2. Orden recomendado de demostración

```
1. p1   → 2 nodos K3s con Vagrant, prueba de unión
2. p2   → 3 apps + Ingress, prueba del balanceo
3. p3   → K3d + Argo CD + GitHub, prueba v1→v2
4. bonus→ GitLab local, prueba del repoURL + v1→v2 desde GitLab   (si aplica)
```

Es el mismo orden del subject (IV.1 → IV.2 → IV.3 → V). Cada parte **deja el entorno vivo** para la siguiente cuando aplica (bonus reusa el cluster de p3; p2 comparte la IP 110 con p1; pero ojo: p1 y p2 no pueden convivir encendidas si faltan recursos — el README del bonus pide `vagrant destroy -f` de p1/p2 antes de bonus).

| Parte | Qué demostrar | Comando de prueba estrella |
|---|---|---|
| **p1** | 2 VMs, cluster de 2 nodos | `kubectl get nodes -o wide` (2 nodos `Ready`, names lowercase) |
| **p2** | Una IP, 3 apps por Host header | `curl -H "Host: app2.com" http://192.168.56.110` en bucle (balanceo) |
| **p3** | GitOps desde GitHub | `cat deployment.yaml \| grep v1` + `curl localhost:8888` → `v1` |
| **bonus** | GitOps desde GitLab local | `kubectl get application playground -o jsonpath='{.spec.source.repoURL}'` (URL GitLab) |

## 3. Qué enseñar en cada parte (+ justificaciones)

### p1 — K3s y Vagrant

**Qué enseñar:** el Vagrantfile (2 VM, `config.vm.define`, red privada fija, box `generic/ubuntu2204`), el token compartido en vez de copiar el `node-token`, y los flags de K3s.

**Decisiones a justificar:**

- **Token fijo en el Vagrantfile**: el worker se une **sin leer el fichero `node-token`** generado por K3s (`/var/lib/rancher/k3s/server/node-token`). Se define un token igual en ambos y se pasa por variable de entorno.
- **`--flannel-iface` resuelto por IP, no hardcodeado**: el NIC de la red privada se llama distinto según provider (`eth1`, `enp0s8`...), así que se busca la interfaz a partir de la IP fija (`ip -o -4 addr show | grep -w $IP`).
- **`--node-ip`, `--advertise-address`, `--tls-san`, `--write-kubeconfig-mode=644`**: cada flag resuelve un problema real (saber "sin él qué pasa/no funciona").
- **Synced folders deshabilitadas**: los provisioners `file`/`shell` suben lo que el guest necesita; no existe `/vagrant`.

**Verificación:** `vagrant ssh ravazqueS -c "kubectl get nodes -o wide"` → `ravazques` y `ravazquesw`, ambos `Ready`. **No hace falta pedir permiso**: la verificación se hace pidiendo "demuestre 2 nodos".

### p2 — 3 apps + Ingress

**Qué enseñar:** los 3 objetos de cada `appN.yaml` (ConfigMap = configuración/página, Deployment → ReplicaSet → Pod, Service ClusterIP), labels/selectors, y la regla del Ingress **sin host** para app3.

**Decisiones a justificar:**

- **La página vive en un ConfigMap de nginx** (`return 200` + `$hostname`): no hace falta imagen propia ni volumen con HTML, y `$hostname` muestra el nombre del Pod → prueba el balanceo.
- **Ingress sin `host` = default backend** (app3, "any other Host"): no es un fallo ni DNS, es el diseño que pide el subject.
- **app2 con 3 réplicas** (subject: "una con 3 réplicas"); las demás con 1.
- **Las esperas del script**: `kubectl wait node` y `rollout status` porque K3s devuelve el control antes de estar listo y Traefik se instala con un Job de Helm en el arranque.

**Verificación:** bucle de curls a `app2.com` y mostrar que cambia el pod en cada respuesta (round-robin real vía kube-proxy, no "configurado").

### p3 — K3d + Argo CD + GitHub

**Qué enseñar:** K3s vs K3d, el cluster `iot` recreado desde cero, los namespaces `argocd`/`dev`, la Application CRD (`source`/`destination`/`syncPolicy`) y el desplegable v1→v2.

**Decisiones a justificar:**

- **K3d en vez de K3s**: cluster desechable dentro de Docker, reproducción en un minuto; el subject p3 pide "without Vagrant".
- **`kubectl apply --server-side`** para instalar Argo CD: las CRDs grandes superan el límite de 262144 bytes de la anotación `last-applied-configuration`.
- **`--dry-run=client -o yaml | kubectl apply -f -`** para namespaces: hace el `create` idempotente.
- **`prune` + `selfHeal`**: Git manda; borrar en Git limpia el cluster, editar a mano se revierte.
- **Los manifests de la app viven en el repo remoto** (GitOps): editar local no despliega.

**Verificación (la más visual):** cambiar `v1` → `v2` en `deployment.yaml`, push, sync manual (`patch --operation`) y `curl localhost:8888` devuelve `v2`; `kubectl get application -n argocd` muestra `Synced`/`Healthy`.

### bonus — GitLab local

**Qué enseñar:** GitLab como pod dentro de K3d (namespace `gitlab`), PVCs + `Recreate`, la automatización vía API en `gitlab.sh` y la Application con el repoURL interno.

**Decisiones a justificar:**

- **`repoURL` = DNS del Service** (`gitlab.gitlab.svc.cluster.local`) **y no `localhost:8081`**: Argo CD corre dentro del cluster; el port-forward solo existe en tu host. (Pregunta estrella.)
- **`strategy: Recreate`**: PVCs `ReadWriteOnce` → un solo escritor; `RollingUpdate` montaría el mismo disco en dos pods.
- **Idempotencia**: extrae y reusa el token de API de un Secret; reusa el cluster `iot` en vez de recrearlo. "Parte 3 más GitLab", no un segundo lab.
- **`gitlab.sh` hace todo por API** (token con Rails runner, proyecto público, push de manifests): sin clicks en la UI.

**Verificación:** imprimir el `spec.source.repoURL` de la Application y cambiar v1→v2 **desde GitLab** (clone + push) para ver el mismo flujo sin GitHub.

## 4. Cómo se cambia el comportamiento principal (por parte)

| "Si quisiera..." | Fichero que tocar |
|---|---|
| ...otro hostname de VM | `p1/Vagrantfile` (LOGIN) · `p2/Vagrantfile` |
| ...otra IP de red privada | `p1`/`p2` Vagrantfile (SERVER_IP) |
| ...cambiar 3 réplicas a 5 en p2 | `p2/confs/app2.yaml` (`spec.replicas`) |
| ...una app con más/otra imagen | `p2/confs/appN.yaml` (Deployment) |
| ...más reglas de Host | `p2/confs/ingress.yaml` |
| ...otra app además de playground en p3 | `p3/confs/manifests/*` + repo remoto |
| ...degradar/actualizar la app | `p3` o `bonus` `confs/manifests/deployment.yaml` (tag `v1`/`v2`) y **push** |
| ...que Argo CD mire otra rama | `application.yaml` (`targetRevision`) |
| ...cambiar el origen de GitOps (GitHub↔GitLab) | la Application: `spec.source.repoURL` (+ `path`) |
| ...más espacio de GitLab | `bonus/confs/gitlab.yaml` (PVC sizes) |

## 5. Troubleshooting — los 7 escenarios del plan

Cada escenario: síntoma → diagnóstico en orden → causa → arreglo. **Prioridad 1: mirar eventos y status antes de "reinstalar todo".**

### El worker de p1 no aparece como `Ready`

```
síntoma: kubectl get nodes  →  ravazquesw  NotReady / falta el nodo
```

```bash
vagrant ssh ravazqueS  -c "kubectl get nodes -o wide"
vagrant ssh ravazqueSW -c "systemctl status k3s-agent"        # ¿arrancó?
vagrant ssh ravazqueSW -c "journalctl -u k3s-agent -n 50"      # ¿por qué falla?
```

- **¿No existe el nodo?** el agente no llegó a registrarse → mirar logs de `k3s-agent`; token incorrecto → `403/401 (Bootstrap already done?)` en journal.
- **¿Existe pero `NotReady`?** el kubelet no está listo → IP/interface mal (`--node-ip` no coincide con la red privada, o `--flannel-iface` apunta a `eth0`/NAT en vez de a la privada).
- **¿`connection refused` al API server desde el worker?** la IP del server no es alcanzable por la red privada o no se usó `--tls-san`.

### `kubectl` da `connection refused` (o el API server no responde)

- En p1/p2: ¿VM viva? (`vagrant status`, `vagrant up`) ¿K3s corriendo? (`systemctl status k3s`). ¿`KUBECONFIG` apunta a `/etc/rancher/k3s/k3s.yaml`? ¿El certificado válido para la IP? (`--tls-san`).
- En p3/bonus: ¿cluster `iot` existe? (`k3d cluster list`) ¿contexto correcto? (`kubectl config current-context` — `k3d kubeconfig merge ... --kubeconfig-switch-context`). ¿Docker arriba? (sin Docker, el cluster K3d no arranca).

```bash
vagrant status                        # p1/p2: ¿VMs Running?
k3d cluster list                       # p3/bonus: ¿existe iot?
kubectl config current-context         # ¿estoy contra el cluster esperado?
docker info                            # p3/bonus: base de K3d
```

### p2 devuelve 404

```
síntoma: curl -H "Host: appX.com" http://192.168.56.110 → 404
```

```bash
kubectl describe ingress apps          # ¿existe la regla para ese Host?
kubectl get ingress -o yaml            # ¿faltó el catch-all (regla sin host)?
```

- **404 = regla que falta** (no backend roto). Host sin `host` en el Ingress y sin default → Traefik no sabe a dónde; 404 es su respuesta honesta.

### p2 devuelve 502 o 503

```bash
kubectl get pods -o wide               # ¿Pods Running? ¿CrashLoop?
kubectl get endpoints                  # ¿el Service tiene IPs detrás?
kubectl describe svc appX              # selector del Service
kubectl -n kube-system rollout status deploy/traefik
```

- **502 = el backend existe pero falla** (Pods rotos, imagen no disponible, Traefik aún instalándose). **503 = el backend no existe** (Service sin Endpoints: selector que no coincide con ningún Pod). Regla mental: `404 regla` · `502 backend roto` · `503 sin endpoints`.

### Argo CD queda en `OutOfSync` o `ComparisonError`

```bash
kubectl -n argocd get application playground -o yaml   # status.operationState, conditions
kubectl -n argocd get application playground            # Sync/Health compacto
kubectl logs -n argocd deploy/argocd-repo-server --tail=50
```

- **`OutOfSync`** = cambio en el repo aún no aplicado (normal tras un push sin sync manual) → `kubectl -n argocd patch application playground --type merge -p '{"operation":{"sync":{"revision":"HEAD"}}}'` o esperar el poll (~3 min).
- **`ComparisonError`** = Argo CD no puede **leer** el repo: `repoURL` mal, `path` que no existe (ojo: relativo a la raíz del repo), rama mal (p3 usa `HEAD`, bonus `main`), repo privado sin credenciales, o el repo (GitLab bonus) no está aún sano. → arreglar `application.yaml` y reaplicar.

### GitLab tarda demasiado o reinicia

```bash
kubectl -n gitlab get pods              # ¿Starting / CrashLoopBackOff?
kubectl -n gitlab logs deploy/gitlab --tail=50
kubectl -n gitlab describe pod gitlab-xxx   # eventos: ¿OOM? ¿migraciones?
free -h; docker info                   # ¿RAM/Docker suficiente?
```

- Primer boot = reconfigure + migraciones (10-20 min; el `rollout status` espera 30 min). Sobreesperar es normal, **no es un bug**.
- Reinicios por **OOMKilled** → falta RAM (el script avisa por debajo de 8 GiB). Reinicios por probes → revisar `monitoring_whitelist` (si `/-/health` da 403/404, el kubelet nunca ve al pod Ready).
- Reusar el cluster: si `k3d cluster start iot` tras un stop, GitLab tarda varios minutos en volver a estar healthy.

### Docker no responde

```bash
docker info                            # ¿Daemon reachable?
systemctl status docker                # ¿servicio arriba?
sudo systemctl start docker            # si está parado
sudo usermod -aG docker $USER          # si error de permisos → cerrar sesión
```

- p3 y bonus **requieren** Docker; sin él `k3d cluster create` falla. El preflight de `install.sh` ya avisa con mensajes orientativos. Los errores de permisos son del grupo `docker` (re-login).

## Predicciones y ejercicios

1. **Worker NotReady.** El worker de p1 existe como nodo pero está `NotReady`. Nombra las 3 causas más probables y cómo probarlas sin reinstalar.

<details><summary>Solución</summary>

1. **Interface equivocada en Flannel** (`--flannel-iface` sobre el NIC de NAT en vez de la red privada) → el pod network no converge. Mirar `journalctl -u k3s-agent` y verificar la IP: `ip -o -4 addr show`.
2. **`--node-ip` que no coincide con el rango de la red privada** → el kubelet se registra con una IP inalcanzable para el server.
3. **Recursos mínimos** (1 CPU/1 GiB, o el host saturado) → el kubelet no termina de arrancar.

Prueba sin reinstalar: `vagrant ssh ravazqueSW -c "systemctl status k3s-agent"` + logs; en el server `kubectl describe node ravazquesw` para ver las conditions/mensajes; `kubectl get node ravazquesw -o yaml` para ver `NodeAddresses` y `kubeletReady`.

</details>

2. **404 vs 502 vs 503 en p2.** Un evaluador te pide: "rompe un selector y muéstrame qué pasa". ¿Qué comando y qué respuesta esperas?

<details><summary>Solución</summary>

Cambiar `Service.spec.selector` a una label que ningún Pod tiene y reaplicar:

```bash
kubectl -n dev edit svc app2   # selector.app: app2 → app2-wrong
curl -H "Host: app2.com" http://192.168.56.110   # 503 Service Unavailable
kubectl get endpoints app2      # Endpoints vacío (la prueba definitiva)
kubectl get pods -l app=app2    # confirmar que los Pods NO llevan esa label
```

Es 503 (backend no existe), no 502. Recordar: `prune`/`selfHeal` no aplican en p2 (no hay Argo CD): el cambio a mano **permanece** hasta que restaures el selector — es el contraste perfecto con p3.

</details>

3. **502 con pods Running.** En p2 todos los pods están `Running` y el Service tiene Endpoints, pero `curl app1.com` devuelve 502. ¿Qué revisas?

<details><summary>Solución</summary>

502 = "hay backend pero falla el enrutado/proxy". Primero a **Traefik**: `kubectl -n kube-system rollout status deploy/traefik` y logs (`kubectl -n kube-system logs deploy/...`). Si Traefik acabó de instalarse, puede tardar en `Ready`. Segundo, comprobar que el `targetPort` coincide con el puerto del contenedor (`port` del Service vs `containerPort`): un desajuste da 502 porque el proxy fija el backend pero el Pod no escucha en ese puerto. Tercero, verificar que el pod responde internamente: `kubectl exec deploy/app1 -- wget -qO- http://localhost/`.

</details>

4. **Argo CD OutOfSync "para siempre".** Cambié v1→v2 en el repo, el push fue bien, pero `kubectl get application` muestra `OutOfSync` y nunca pasa. ¿Qué hago en orden?

<details><summary>Solución</summary>

1. Comprobar que el push llegó **al repo correcto y a la rama correcta** (`git remote -v`; `targetRevision` = `HEAD` en p3 → rama default, `main` en bonus). Un push a una rama que Argo no mira = eterno OutOfSync.
2. Forzar el sync: `kubectl -n argocd patch application playground --type merge -p '{"operation":{"sync":{"revision":"HEAD"}}}'`.
3. Mirar `status.operationState` en `-o yaml` para ver el error del último intento (mensajes de git, del manifests deseado...).
4. Si sigue, `argocd app get playground -n argocd` (CLI) suele dar la diff y el error con más contexto; y `kubectl logs argocd-repo-server`.

Regla mental: `OutOfSync` con intención ≠ rotura; es Argo diciendo "hay estado deseado distinto". Rotura sería `ComparisonError`.

</details>

5. **Demo GitOps con `selfHeal`.** Muéstrame que Argo CD "manda" en el cluster. ¿Qué hago y qué debería pasar?

<details><summary>Solución</summary>

1. `kubectl -n dev scale deploy playground --replicas=5` (o `kubectl edit`).
2. Esperar al siguiente ciclo de Argo (≤ ~3 min): `kubectl get deploy playground -n dev -w` (verás 5 → vuelta a 1).
3. Autoridad de diagnóstico: la Application es `Synced` y `selfHeal: true` → el controlador revierte la deriva a lo que Git dice (`replicas: 1`).

En el mismo momento puedes demostrar `prune`: borra el Deployment desde el cluster y Argo lo recrea; borra un objeto del repo remoto y Argo lo elimina del cluster. Git es la única fuente de verdad.

</details>

6. **La pregunta abierta de "estructura del repo".** ¿Por qué p1/p2 tienen Vagrantfile, p3/bonus no, y por qué `confs` y `scripts` separados?

<details><summary>Solución</summary>

- **Vagrantfile solo en p1/p2**: el subject obliga a VMs (Vagrant) en las partes 1 y 2; p3 y el bonus van **sin Vagrant** (K3d sobre Docker, "without this time"), solo scripts. Mantenerlos separados deja ver esa frontera de arquitectura.
- **`scripts` vs `confs`**: scripts = *comportamiento* (instalación, esperas, API); confs = *declaración* (YAML de los objetos). El subject exige ambas carpetas ("Any scripts you need... The configuration files in a confs folder") y facilita el copy/paste de manifiestos a un repo GitOps (p3/bonus) sin arrastrar lógica.
- **`srcs/` raíz**: el subject pide `p1`, `p2`, `p3`, `bonus` en la raíz del repo; este repo los agrupa bajo `srcs/` respetando esos cuatro nombres (la defensa muestra `find -maxdepth 2`).

</details>

7. **La demo "todo desde cero".** El evaluador pide levantar todo de nuevo. ¿En qué orden y qué depende de qué?

<details><summary>Solución</summary>

1. **p1** (VMs server+worker) → `vagrant up --provider=libvirt` (o virtualbox) desde `srcs/p1`. Verificar 2 nodos. `vagrant destroy -f` al terminar si siguen p2/bonus (recursos).
2. **p2** (1 VM) → `vagrant up` desde `srcs/p2`. Verificar curls por Host. `vagrant destroy -f` antes de bonus (RAM).
3. **p3** (host, Docker) → `./scripts/install.sh` (borra y recrea `iot`). Verificar ns + app + v1.
4. **bonus** (host, Docker) → `./scripts/install.sh` (reusa `iot` si existe, crea ns `gitlab`, instala/reusa Argo). Verificar repoURL + v1→v2 desde GitLab.

Dependencias: p1 y p2 **no** dependen de nada previo (se levantan solas); p3 no necesita las VMs; el bonus asume Docker y puede reusar el cluster dejado por p3. Con p1/p2 encendidas + Docker + bonus => memoria justa: el README del bonus pide destruir las VMs primero.

</details>

## Errores frecuentes en defensa

- **Confundir p3 y bonus en la demo**: si vas a defender bonus, haz el flujo v1→v2 **desde GitLab**, no reusando GitHub.
- **Correr p1/p2 a la vez que bonus**: la RAM se agota y GitLab muere por OOM; destruye las VMs.
- **No tocar el repo en p3**: "cambiar en local" en la defensa no despliega; hay que hacer push (o sync manual del cambio ya subido).
- **Diagnosticar sin mirar status/events**: `kubectl describe` y `journalctl` contestan antes que reinstalar.
- **Leer de apuntes**: si el evaluador pide "muéstrame dónde está el token", saber decir "en el Vagrantfile de p1, y lo paso como variable de entorno" sin abrir el fichero.
- **Creer que el 404 es DNS**: en p2 no hay DNS; es falta de regla en el Ingress (o catch-all).
- **No justificar balances de p3/bonus**: la demo v1→v2 tiene que terminar en el `curl` mostrando el tag nuevo, no en "intenté el sync".

## Has aprendido que

- La defensa es **reproducibilidad en vivo**: un comando de arranque, uno de verificación y uno de limpieza por parte, explicables en una frase.
- El orden de demo ideal es p1 → p2 → p3 → bonus (el mismo del subject), con atención a recursos entre VMs y bonus.
- Cada parte tiene **decisiones llamativas** listas para justificar (token fijo, ingress catch-all, `--server-side`, repoURL interno + `Recreate`).
- Los 7 escenarios de troubleshooting tienen **un primer comando pactado**: nada de reinstalar sin mirar status/logs.
- `404`=regla · `502`=backend roto · `503`=sin endpoints serán casi seguro preguntados.
- En GitOps, `OutOfSync` es intención (syncable) y `ComparisonError` es rotura (hay que arreglar el source).

## Preguntas tipo defensa (cerrar el curso)

1. Explica la diferencia entre K3s, K3d y kubectl, y cuándo usas cada uno.
2. ¿Por qué el worker de p1 se une sin copiar el `node-token`?
3. Una IP (`192.168.56.110`) sirve 3 apps en p2: ¿cómo?
4. ¿Cómo demuestras el balanceo de p2 y qué hay detrás (kube-proxy)?
5. ¿Por qué `kubectl apply --server-side` en p3 y no el clásico?
6. ¿Qué es GitOps y qué campo de la Application lo define realmente? (`repoURL` + `path` + syncPolicy)
7. `selfHeal` vs `prune`: ¿qué hace cada uno y cómo lo demuestras?
8. ¿Por qué `localhost:8081` no puede ser el repoURL del bonus?
9. Diagnostica: notas `NotReady`, `404/502/503`, `OutOfSync/ComparisonError`, GitLab `CrashLoop`, Docker parado.
10. ¿Cuál es el primer comando que corres ante cada uno de esos síntomas?

## Criterio de finalización

Marca cada ítem cuando lo digas "sin apuntes":

- Defender cada parte en orden con su comando de prueba (p1→bonus).
- Justificar las ~4 decisiones de diseño por parte (token, catch-all/Recreate, `--server-side`, repoURL interno).
- Diagnosticar los 7 escenarios con su primer comando (worker NotReady, connection refused, 404/502/503, OutOfSync/ComparisonError, GitLab lento, Docker).
- Distinguir `OutOfSync` (intención) de `ComparisonError` (rotura).
- Hacer la demo v1→v2 tanto en p3 (GitHub) como en bonus (GitLab) hasta ver el `curl` con el tag nuevo.
- Explicar el flujo completo de tráfico en p2 y el flujo GitOps en p3/bonus sin mirar los ficheros.

## Siguiente clase

Con la clase 6 cierras las 6 clases del plan. Para el repaso final antes de la defensa, relee `clase-01.md` (mapa mental) y esta clase (diagnóstico).
