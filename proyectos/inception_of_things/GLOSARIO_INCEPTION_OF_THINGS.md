# Glosario de Inception of Things

Este documento reúne las siglas, herramientas y conceptos que aparecen durante el proyecto. No hace falta memorizarlo de una vez: úsalo como referencia mientras lees el subject, el repo o haces ejercicios.

## Virtualización e infraestructura

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| Vagrant | Vagrant (nombre propio) | Herramienta que declara y levanta máquinas virtuales de forma reproducible a partir de un `Vagrantfile`. Es la base de `p1` y `p2`. |
| Vagrantfile | Vagrant File | Archivo que describe las VMs: box, provider, red privada y provisioners. La infraestructura entera de `p1` vive en `p1/Vagrantfile`. |
| box | Caja de VM | Imagen base de sistema operativo sobre la que Vagrant clona la VM. Se elige en el `Vagrantfile` con `config.vm.box`. |
| provider | Proveedor | Backend que ejecuta las VMs (por ejemplo VirtualBox). Define cómo Vagrant crea y apaga las máquinas. |
| provisioner | Aprovisionador | Paso de configuración que corre dentro de la VM después de crearla (`file` para subir ficheros, `shell` para ejecutar scripts). Sustituyen a las Synced folders. |
| VM | Virtual Machine | Máquina virtual: una de las cajas que levanta Vagrant. |
| red privada | Red privada | Subred `192.168.56.x` que solo ven las VMs: `192.168.56.110` para el server y `192.168.56.111` para el worker. |
| `<login>S` / `<login>SW` | Login + Server / ServerWorker | Hostnames exigidos por el subject: el server y el worker se nombran con tu login de 42. |
| Synced folders | Carpetas sincronizadas | Mecanismo de Vagrant que monta la carpeta del host dentro de la VM (`/vagrant`). Las desactiva el proyecto: los provisioners `file`/`shell` suben lo necesario. |
| port-forward | Reenvío de puertos | Publica un puerto interno en el host: `8080:443` para la UI de Argo CD o `8888:8888` para la app. |

## Kubernetes y K3s

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| K3s | K3s (nombre propio) | Distribución ligera de Kubernetes, certificada, pensada para edge y VMs. Es lo que se instala en `p1` y `p2`. |
| K3s server | Servidor K3s | Nodo que corre el control-plane y el API server (puerto `6443`; aquí también ejecuta cargas). Arranca con el servicio `k3s`. |
| K3s agent | Agente K3s | Nodo worker puro: se une al cluster con la URL del server y un token. Arranca con el servicio `k3s-agent`. |
| nodo | Node | Una máquina (física, VM o contenedor) que forma parte del cluster. El subject exige 2 nodos en `p1`. |
| worker | Trabajador | Nodo que solo ejecuta Pods, sin control-plane. En `p1` es `<login>SW`. |
| token de unión | Join token | Secreto que permite a un agent unirse al server API. El proyecto lo fija en `K3S_TOKEN` para que el worker no dependa de copiar `node-token`. |
| API server | Servidor API | Punto de entrada de todas las peticiones de Kubernetes (el único que habla con todos). Los clientes se conectan a `https://<IP>:6443`. |
| kubectl | Kube control | Cliente de línea de comandos de Kubernetes: `kubectl get nodes`, `kubectl apply`, `kubectl describe`… |
| kubeconfig | Config de kube | Fichero con credenciales, cluster y contexto para `kubectl`; en el server vive en `/etc/rancher/k3s/k3s.yaml`. |
| namespace | Espacio de nombres | Partición lógica del cluster: `default`, `argocd`, `dev`, `gitlab`… Aísla recursos y permisos. |
| recurso / objeto | Resource / Object | Cualquier cosa declarada a la API (Pod, Service, Ingress…). Cuando se "aplica", se crea/modifica un recurso. |
| Pod | Vaina | Unidad mínima desplegable: uno o más contenedores que comparten red. Se crea a través de un Deployment. |
| Deployment | Despliegue | Recurso que declara la imagen, las replicas y la estrategia de actualización. Es el "qué quiero" de una app. |
| ReplicaSet | Conjunto de réplicas | Recurso intermedio que el Deployment controla para mantener exactamente N Pods vivos. |
| replicas | Réplicas | Número de Pods idénticos que mantiene un Deployment. En `p2`, `app2` usa 3 para enseñar balanceo. |
| ConfigMap | Mapa de configuración | Recurso que guarda configuración no sensible (variables de entorno, contenido de páginas). Aquí define qué sirve cada `appN`. |
| label | Etiqueta | Par clave/valor pegado a un recurso, ej. `app: app2`. Es como un "post-it" para agrupar objetos. |
| selector | Selector | Criterio `label` usado por un recurso (Service, Deployment) para elegir a sus Pods. Si no coincide, el Service no encuentra backend. |
| Service | Servicio | Dirección estable que expone un grupo de Pods y reparte el tráfico entre ellos aunque sus IPs cambien. |
| ClusterIP | IP de cluster | Tipo de Service con una IP virtual interna, solo visible dentro del cluster. Es el Service estándar, p. ej. el de `p2` y los de Argo CD. |
| Endpoints | Puntos finales | Lista de IPs de Pods que un Service ha seleccionado. Sin Endpoints, el Service responde 503. |
| Ingress | Entrada | Recurso que expone servicios HTTP/HTTPS hacia fuera con reglas de ruta. En `p2` es el que decide a qué app va cada petición. |
| Traefik | Traefik (nombre propio) | Controlador de Ingress que instala K3s por defecto. Recibe el tráfico, lee la regla y enruta. |
| Host header | Cabecera Host | Cabecera HTTP con el nombre al que pides (`app1.com`, `app2.com`…). El Ingress la usa para elegir backend en `p2`. |
| catch-all / default | Atrapa-todo | Regla del Ingress **sin** `host`: recibe cualquier host que no tenga regla propia. En `p2` es `app3`. Un 404 significa que esta regla falta. |
| probe | Sonda | Comprobación de salud del kubelet al contenedor: `startupProbe` tolera arranques lentos, `readinessProbe` decide cuándo servir tráfico, `livenessProbe` reinicia. |
| PVC | PersistentVolumeClaim | Petición de almacenamiento persistente que puede montar un Pod. GitLab usa 2. |
| PV | PersistentVolume | Volumen persistente real que satisface un PVC. Con K3d se provisionan localmente de forma automática. |
| ReadWriteOnce | Lectura/escritura única | Modo de acceso de un volumen: un solo nodo/pod a la vez puede escribirlo. |
| Recreate | Recrear | Estrategia de Deployment que mata el Pod actual **antes** de crear el siguiente. Necesaria para un único escritor sobre un PVC. |
| RollingUpdate | Actualización por rodajas | Estrategia por defecto que crea el Pod nuevo primero y elimina el viejo después. Rompería los PVCs de GitLab. |
| rollout status | Estado de despliegue | Comando `kubectl rollout status deploy/…` que espera a que el Deployment termine de actualizarse. K3s devuelve el control antes de estar listo. |

## Docker y K3d

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| Docker | Docker (nombre propio) | Motor de contenedores. En este proyecto es la base para `p3`: todo K3d corre dentro de Docker. |
| imagen | Image | Plantilla inmutable con el sistema y la app de un contenedor (ej. `nginx:alpine` o la imagen de `v1`/`v2`). |
| contenedor | Container | Proceso aislado ejecutado a partir de una imagen. Un Pod ejecuta uno o más contenedores. |
| K3d | K3s in Docker | K3s ejecutado *dentro* de contenedores Docker, con mapeo de puertos al host. Es el cluster de `p3` (no hay Vagrant). |
| mapeo de puertos | Port mapping | K3d publica puertos del cluster al host: `8080:443` (UI Argo) y `8888:8888` (app). |

## Argo CD y GitOps

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| GitOps | Git Operations | Filosofía donde Git es la única fuente de verdad: nadie toca el cluster a mano; una herramienta converge el cluster al estado del repo. |
| Argo CD | Argo CD (nombre propio) | Herramienta GitOps que vigila un repo (`repoURL` + `path`) y sincroniza el cluster con su estado. Corre en el namespace `argocd`. |
| Application CRD | Aplicación | Recurso propio de Argo CD que declara qué repo leer, dónde aplicar y cómo sincronizar. El archivo es `confs/application.yaml`. |
| repoURL | Repo URL | De dónde lee Argo CD los manifiestos (GitHub en `p3`, GitLab interno en el bonus). |
| targetRevision | Revisión objetivo | Rama, commit o tag a seguir; `HEAD` = rama por defecto. |
| path | Ruta | Subcarpeta del repo donde están los manifiestos, relativa a la raíz del repo. |
| destination | Destino | Cluster y namespace donde Argo CD aplica. En `p3`: el cluster local y `dev`. |
| syncPolicy | Política de sync | Cómo y cuándo sincroniza. Con `automated`, Argo CD sincroniza solo al detectar cambio. |
| automated | Automatizado | Modo de la Application que sincroniza automáticamente; con `prune` y `selfHeal` además limpia y revierte. |
| prune | Poda | Borra del cluster los recursos que ya no existen en Git "deshace lo que dejas de declarar". |
| selfHeal | Autocuración | Revierte cambios hechos a mano en el cluster para volver al estado de Git. |
| Synced | Sincronizado | Estado de la Application: el cluster coincide con el repo. |
| OutOfSync | Desincronizado | Estado de la Application: hay intención distinta en el repo aún no aplicada. No es rotura: un sync o el poll (~3 min) la resuelven. |
| ComparisonError | Error de comparación | Argo CD no puede **leer** el repo: `repoURL` mal, `path` inexistente, rama incorrecta o repo privado sin credenciales. Sí es rotura. |
| polling | Sondeo | Argo CD consulta el repo en intervalos para detectar cambios; no es tiempo real ni necesita webhooks. |
| sync manual | Sync manual | Forzar la sincronización: `kubectl -n argocd patch application playground --type merge -p '{"operation":{"sync":{"revision":"HEAD"}}}'`. |
| SSA / `--server-side` | Server-Side Apply | Modo de `kubectl apply` que declara los cambios con el ownership del servidor. Argo CD lo usa porque gestiona recursos propios (CRDs) sin conflicto. |
| CRD | Custom Resource Definition | Tipo de recurso nuevo que añade un proyecto al cluster. Application es una CRD de Argo CD. |
| namespace `dev` | Namespace dev | Namespace donde el subject pide que Argo CD despliegue la app de `p3`. |

## Red y DNS internos

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| DNS interno | Internal DNS | Resolución de nombres dentro del cluster, no visible desde el host. |
| svc.cluster.local | Service cluster.local | Dominio interno: un Service se resuelve como `<nombre>.<namespace>.svc.cluster.local`, ej. `gitlab.gitlab.svc.cluster.local`. |
| FQDN | Fully Qualified Domain Name | Nombre completo e interno del Service: la URL que sí puede usar Argo CD como `repoURL` en el bonus. |
| localhost | Host local | Tu propia máquina. Nunca sirve como `repoURL` de Argo CD: Argo corre dentro del cluster y no ve tu host. |

## GitLab bonus

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| GitLab CE | GitLab Community Edition | Autocracia de GitLab de código abierto, sin coste. Corre como un pod en el namespace `gitlab`. |
| omnibus | Omnibus | Paquete todo-en-uno de GitLab: app, subsistema, BD y config en una sola instalación (aquí, en un único pod). |
| token de API | API token | Token de `root` con scopes `api` y `write_repository`; permite a un script crear el proyecto y hacer push sin darle la contraseña. |
| proyecto público | Public project | Repo `root/Inception-of-Things_<login>` creado con `visibility=public` para que Argo CD lo lea sin credenciales. |
| UI de GitLab | Interfaz GitLab | Panel web en `localhost:8081` vía port-forward; solo la usas tú, Argo no depende de él. |

## Aplicación y verificación

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| v1 / v2 | Versiones 1 y 2 | Las dos versiones etiquetables que exige el subject para `p3`; cambiando `deployment.yaml` en el repo y haciendo push la app cambia de versión. |
| puerto 8888 | Puerto 8888 | Puerto expuesto por K3d donde se sirve la app; se comprueba con `curl http://localhost:8888/`. |
| curl | Client URL | Cliente HTTP de línea de comandos, el veredicto del proyecto: `curl -H "Host: app2.com" http://192.168.56.110`. |
| 404 | Not Found | Falta la regla/backend: en `p2` es una regla de Ingress que no está (sin catch-all). |
| 502 | Bad Gateway | El backend existe pero falla (Pod roto, Traefik aún arrancando o `port`/`containerPort` que no coinciden). |
| 503 | Service Unavailable | El backend no existe: un Service sin Endpoints (selector que no coincide con ningún Pod). |
| journalctl | Journal control | Logs del sistema de una VM: `journalctl -u k3s-agent` muestra por qué el worker no se une. |

## Regla de lectura

Cuando aparezca un concepto nuevo, pregúntate:

1. ¿Qué pide exactamente el subject sobre esto?
2. ¿Qué fichero del repo lo implementa (`p1/`, `p2/`, `p3/` o `bonus/`)?
3. ¿Qué comando lo levanta y qué comando lo verifica?
4. ¿Qué fallo típico le pasa y cómo se diagnostica?

Esta secuencia evita intentar entender todas las siglas de una vez y te prepara para la defensa.