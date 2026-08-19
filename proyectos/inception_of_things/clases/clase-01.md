# Clase 1: subject y mapa mental

## Objetivo

Convertir el subject en una matriz de estudio: requisito → fichero real → comando de prueba → concepto. Al terminar debes poder explicar el proyecto completo en dos minutos y ubicar cada parte (`p1`, `p2`, `p3`, `bonus`) en el repo.

## 1. El proyecto en dos minutos

Inception of Things es un recorrido escalonado hacia Kubernetes, de menos a más:

1. **p1 — K3s + Vagrant:** creas 2 máquinas virtuales con Vagrant y montas un cluster K3s de 2 nodos (server + worker).
2. **p2 — K3s + 3 apps:** sobre un solo nodo, despliegas 3 aplicaciones expuestas vía Ingress según el `Host header`.
3. **p3 — K3d + Argo CD:** sin Vagrant, creas un cluster K3d (K3s dentro de Docker) y Argo CD despliega tu app leyendo manifiestos desde GitHub, con 2 versiones intercambiables.
4. **bonus — GitLab local:** el flujo GitOps usa un GitLab dentro del cluster como fuente en vez de GitHub.

Hilo conductor: gestionar VMs (Vagrant) → gestionar un solo nodo (K3s) → gestionar GitOps en un cluster (K3d + Argo CD).

## 2. Requisito → fichero → prueba → concepto

### Parte 1 — K3s y Vagrant (subject IV.1)

| Requisito del subject | Fichero real | Cómo se prueba |
|---|---|---|
| 2 máquinas Vagrant; nombres = login + `S`/`SW` | `p1/Vagrantfile` | `vagrant ssh <login>S -c hostname` |
| IP dedicada: `.110` (Server) y `.111` (SW) | `Vagrantfile` (red privada) | `vagrant ssh <login>S -c "ip a"` |
| SSH sin contraseña | provisioner Vagrant | `vagrant ssh` (no pide pass) |
| K3s en modo controller | `p1/scripts/server.sh` | `kubectl get nodes` en la VM |
| K3s en modo agent | `p1/scripts/worker.sh` | `kubectl get nodes -o wide` → 2 Ready |
| kubectl instalado | `server.sh` | `kubectl config get-contexts` y `kubectl get nodes` |

### Parte 2 — K3s + 3 aplicaciones (IV.2)

| Requisito | Fichero | Prueba |
|---|---|---|
| 1 VM, K3s server | `p2/Vagrantfile` + `scripts/setup.sh` | `kubectl get nodes` |
| app1 según `app1.com` | `confs/app1.yaml` | `curl -H "Host: app1.com" http://192.168.56.110` |
| app2 (3 réplicas) según `app2.com` | `confs/app2.yaml` | `curl -H "Host: app2.com" http://192.168.56.110` |
| app3 por defecto (catch-all) | `confs/app3.yaml` + `ingress.yaml` | `curl http://192.168.56.110` (sin Host) |
| Enrutado por Host | `confs/ingress.yaml` | Ingress sin `host` = default (app3) |

### Parte 3 — K3d + Argo CD (IV.3)

| Requisito | Fichero | Prueba |
|---|---|---|
| Instalar todo (sin sudo) | `p3/scripts/install.sh` | ejecutar el script |
| Namespace `argocd` | installer | `kubectl get ns` |
| Namespace `dev` con la app | installer | `kubectl -n dev get pods` |
| Argo CD lee de GitHub | `confs/application.yaml` (repoURL) | `kubectl get application -n argocd` |
| Cambiar versión v1→v2 desde GitHub | `confs/manifests/deployment.yaml` | `sed` + `git push` + `curl localhost:8888` → `"v2"` |

### Bonus — GitLab local (V)

| Archivo | Rol |
|---|---|
| `scripts/install.sh` | orquesta el clúster + GitLab |
| `scripts/gitlab.sh` | instala GitLab CE |
| `scripts/argocd.sh` | configura Argo CD contra el GitLab |
| `confs/gitlab.yaml` | deployment de GitLab |
| `confs/application.yaml` | Argo apunta a `gitlab.gitlab.svc.cluster.local` |

## 3. Pensar en capas (K3s vs K3d)

La confusión más común de esta clase. Fórmula para no olvidarla:

- **K3s = K8s ligero en una VM** (p1, p2).
- **K3d = K3s dentro de un contenedor Docker** (p3).

No son versiones distintas de Kubernetes: **ambos corren K3s**. Lo que cambia es *dónde se ejecuta*. K3d te quita Vagrant de encima.

## Predicciones y ejercicios

### Ejercicio 1: el mapa en 2 minutos

Sin mirar apuntes, contesta en voz alta: ¿qué hace cada parte (`p1`, `p2`, `p3`, `bonus`) y qué herramienta es la protagonista de cada una?

<details>
<summary>Solución</summary>

- `p1` → **Vagrant** crea 2 VMs con **K3s** (server + worker).
- `p2` → **K3s** (1 nodo) ejecuta 3 apps y las expone con **Ingress**.
- `p3` → **K3d** (K3s en Docker) + **Argo CD** desplegando desde **GitHub**.
- `bonus` → **GitLab local** reemplaza a GitHub como fuente GitOps.

Esperado: poder decir esto de corrido en 2 minutos.

</details>

### Ejercicio 2: requisito → fichero

Para cada requisito del subject, responde sin mirar las tablas: ¿qué fichero del repo lo implementa y con qué comando se prueba?

<details>
<summary>Solución</summary>

- 2 VMs con nombres `<login>S`/`<login>SW` → `p1/Vagrantfile`; se prueba con `vagrant ssh <login>S -c hostname`.
- app3 por defecto → es la Ingress **sin `host`** en `p2/confs/ingress.yaml`; se prueba con `curl http://192.168.56.110`.
- Argo CD leyendo de GitHub → `p3/confs/application.yaml` (campo `repoURL`); se prueba con `kubectl get application -n argocd`.
- GitOps con GitLab local → `bonus/confs/application.yaml` apuntando a `gitlab.gitlab.svc.cluster.local`.

</details>

## Errores frecuentes

- Confundir **K3d con una versión** distinta de Kubernetes → es "dónde corre", no "qué versión".
- No respetar la estructura de carpetas del subject (raíz `p1`/`p2`/`p3`/`bonus`, dentro `scripts/` y `confs/`).
- Creer que app3 es un DNS → **app3 es la Ingress sin `host`**, el catch-all.
- Olvidar que el cambio de versión en p3 lo hace **el usuario en GitHub**, y Argo CD lo detecta y sincroniza.

## Has aprendido que

- El **subject es la fuente de verdad**; la estructura del repo lo refleja tal cual.
- La parte obligatoria es escalonada y debe hacerse **en orden** (`p1` → `p2` → `p3`); el bonus solo se evalúa si la obligatoria es flawless.
- Las **tres herramientas clave** del curso son **Vagrant**, **K3s/Kubernetes** y **K3d + Argo CD**.
- Cómo localizar en el repo el fichero que implementa cada requisito y cómo probarlo vivo.

## Preguntas tipo defensa

1. ¿Cómo cambiarías la versión de la app en p3 de forma automática?
2. ¿En qué capa difería p1/p2 de p3? ¿Es K3d una distribución distinta?
3. ¿Cómo se decide app1/app2/app3 con una sola IP (`192.168.56.110`)?
4. ¿Qué carpetas y subcarpetas exige el subject en la raíz del repo?

## Criterio de finalización

La clase está dominada cuando puedes, sin apuntes:

- Explicar qué resuelve cada parte en total (problema → componente).
- Nombrar los comandos que levantan y verifican `p1`, `p2`, `p3` y `bonus`.
- Decir qué fichero del repo mantendría el comportamiento principal de cada parte.
- Identificar un fallo típico de cada fase y cómo se diagnosticaría.

## Siguiente clase

La clase 2 baja a la primera capa real: Vagrant, máquinas virtuales y la parte 1. Verás cómo se crea un cluster K3s de dos nodos, con `Vagrantfile`, `server.sh` y `worker.sh`, y cómo se une el worker al server sin copiar el `node-token`.

## Lista de lecturas

- Subject de Inception of Things — la fuente normativa del proyecto.
- K3s docs — arquitectura: nodos server y agent (worker) y cómo se une un nodo.
- K3d docs — qué hace k3d por dentro (cluster en Docker) y en qué se diferencia de K3s.
- Vagrant docs — máquinas múltiples y provisionamiento por shell (la base de p1).
