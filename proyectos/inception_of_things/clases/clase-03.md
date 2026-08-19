# Clase 3: Kubernetes básico y p2

## Objetivo

Entender cómo **Kubernetes ejecuta tres aplicaciones en una sola VM** y las expone con un único **Ingress** que enruta según la cabecera `Host`. Al terminar, debes poder explicar qué son un ConfigMap, un Deployment, un ReplicaSet y un Pod, cómo se pegan con labels y selectors, qué aporta un Service `ClusterIP`, cómo decide Traefik por `Host`, y cómo demostrar el balanceo de las 3 réplicas de `app2` siguiendo `curl -H "Host: app2.com" http://192.168.56.110` desde el host hasta un Pod.

## 1. La topología de p2 — ficheros

```
srcs/p2/
├── Vagrantfile
├── scripts/setup.sh
└── confs/
    ├── app1.yaml     (1 réplica)
    ├── app2.yaml     (3 réplicas)
    ├── app3.yaml     (1 réplica, catch-all)
    └── ingress.yaml
```

| Fichero | Rol |
|---|---|
| `Vagrantfile` | 1 VM (`<login>S`, `192.168.56.110`), sin worker ni token: cluster de un nodo |
| `scripts/setup.sh` | Instala K3s y aplica los manifiestos con esperas (`rollout status`) |
| `confs/app{1,2,3}.yaml` | Cada app: ConfigMap + Deployment + Service |
| `confs/ingress.yaml` | Enrutado por `Host`: `app1.com`→app1, `app2.com`→app2, sin host→app3 |

### El `Vagrantfile`

Lo nuevo frente a p1 es el **orden de los provisioners** (se ejecutan en el orden declarado):

```ruby
server.vm.provision "file",   source: "confs", destination: "/home/vagrant/confs"
server.vm.provision "shell",  path: "scripts/setup.sh", args: [SERVER_IP]
```

El provisioner `file` sube la carpeta por **SCP** (igual en ambos providers, al contrario que el synced folder). Los manifiestos ya están dentro cuando corre el script.

### `setup.sh`

```bash
until kubectl get nodes --no-headers 2>/dev/null | grep -q .; do sleep 3; done
kubectl wait --for=condition=Ready node --all --timeout=180s
kubectl apply -R -f "${CONFS}"                 # -R = recursivo
for app in app1 app2 app3; do
  kubectl rollout status "deploy/${app}" --timeout=180s
done
until kubectl -n kube-system get deploy traefik; do sleep 3; done
kubectl -n kube-system rollout status deploy/traefik --timeout=180s
```

Las esperas importan: K3s devuelve el control **antes** de que el API server esté listo (`--no-headers`), y Traefik se instala como un Job de Helm en el primer arranque. Sin ellas el `vagrant up` "termina bien" pero el `curl` falla.

## 2. Anatomía de `appN.yaml` — 3 objetos por fichero

Cada `appN.yaml` son **tres documentos YAML** separados por `---`, siempre el mismo patrón:

```
┌─ ConfigMap  appN-nginx   configuración de nginx (incluye la página web)
├─ Deployment appN         cuántos Pods y con qué imagen
└─ Service    appN         IP/nombre estable + balanceo entre Pods
```

### ConfigMap — la configuración es la página

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app1-nginx
data:
  default.conf: |
    server {
        listen 80;
        location / { return 200 "<h1>Hello from app1</h1>...pod: $hostname</p>"; }
    }
```

- El bloque `server` es la conf de nginx. Con `return 200` no hace falta imagen propia ni volumen con HTML.
- **Cada clave del `data` = un fichero.** Al montarse en `/etc/nginx/conf.d`, `default.conf` aparece como `/etc/nginx/conf.d/default.conf`, justo el directorio que nginx lee al arrancar.
- `$hostname` es **variable de nginx** → hostname del contenedor → **nombre del Pod** (`app2-6f9f6f7b57-abcde`). Por eso la respuesta muestra *qué* Pod contestó.

### Deployment → ReplicaSet → Pod

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: app2, labels: { app: app2 } }
spec:
  replicas: 3                      # app2=3; app1 y app3=1
  selector:
    matchLabels: { app: app2 }     # qué Pods gestiona
  template:
    metadata:
      labels: { app: app2 }        # DEBE coincidir con el selector
    spec:
      containers:
        - name: app2
          image: nginx:1.27-alpine
          ports: [{ containerPort: 80 }]
          volumeMounts: [{ name: conf, mountPath: /etc/nginx/conf.d }]
      volumes:
        - name: conf
          configMap: { name: app2-nginx }
```

El Deployment **no crea Pods directamente**: crea un ReplicaSet, y este mantiene el número exacto de Pods vivos:

```
Deployment (replicas: 3)
  └─ ReplicaSet (mantiene 3)
       ├─ Pod app2-xxx
       ├─ Pod app2-yyy
       └─ Pod app2-zzz
```

### Service — IP/name estable, balancea

```yaml
apiVersion: v1
kind: Service
metadata: { name: app2 }
spec:
  selector: { app: app2 }      # labels de los Pods a los que sirve
  ports:
    - port: 80                 # puerto del Service
      targetPort: 80           # puerto del contenedor (nginx)
```

Sin `type`, es **`ClusterIP`**: IP interna al cluster, no accesible desde fuera directamente. **El Service no enruta por Host** — solo selecciona y balancea. El acceso exterior lo da el Ingress.

## 3. Labels y selectors — el pegamento

Tres sitios con la misma etiqueta `app: app2`:

```
Deployment.spec.selector.matchLabels.app        = app2   ← qué Pods gestiona
Deployment.spec.template.metadata.labels.app   = app2   ← etiqueta de los Pods creados
Service.spec.selector.app                       = app2   ← a qué Pods manda tráfico
```

Si el `selector` del Service no coincide con los labels reales de los Pods, el Service queda con la lista de **Endpoints vacía** → el objeto existe pero "no sirve a nadie".

## 4. Ingress y Traefik — el enrutado por Host

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: apps }
spec:
  ingressClassName: traefik
  rules:
    - host: app1.com      → service app1     # regla NOMBRADA
    - host: app2.com      → service app2
    - http:               → service app3     # regla SIN host = default backend (catch-all)
```

- **Quién enruta:** Traefik, el Ingress controller que K3s instala de serie (expuesto en el puerto 80 del nodo vía *servicelb*).
- **La clave del subject:** una regla **sin `host`** actúa de *default backend*. "Any other Host → app3".
- **Sin DNS:** todos los curls van a `192.168.56.110`; Traefik decide por la cabecera `Host`. El `/etc/hosts` del host solo sirve para probar desde el navegador.

## 5. El viaje completo de una petición (la práctica del plan)

```
curl -H "Host: app2.com" http://192.168.56.110
  │
  ├─ 1. El host abre TCP a 192.168.56.110:80 (IP fija, sin DNS)
  ├─ 2. Entra por el servicelb de K3s (klipper) → Traefik
  ├─ 3. Traefik lee Host: app2.com → regla del Ingress → Service app2:80
  ├─ 4. Service app2 (ClusterIP) → kube-proxy elige 1 de sus 3 Endpoints (IPVS)
  └─ 5. nginx del Pod responde "pod: app2-xxxx-yyyy" ($hostname)
```

El balanceo físico lo hace **kube-proxy** (tablas IPVS/iptables del nodo), no el Service. Repitiendo el curl se ve el round-robin:

```bash
for i in 1 2 3 4 5 6; do curl -s -H "Host: app2.com" http://192.168.56.110 | grep pod; done
# pod: app2-6f9f6f7b57-abcde   ← cambia de Pod en cada petición
# pod: app2-8c2f8d5a4b-qwert
```

## 6. Diagnóstico rápido

| Síntoma en p2 | Causa | Primer comando |
|---|---|---|
| **404** | Host sin regla y sin catch-all (regla que falta) | `kubectl describe ingress apps` |
| **502** | Pods no `Ready`/CrashLoop, o Traefik aún instalándose | `kubectl get pods -o wide` + `kubectl -n kube-system rollout status deploy/traefik` |
| **503** | Service sin Endpoints (selector no coincide) | `kubectl get endpoints` |
| `curl` no responde | VM apagada / K3s sin arrancar / puerto sin publicar | `vagrant up` · `systemctl status k3s` · Tarea |

Regla mental: **rule missing → 404** · **backend falla → 502** · **backend no existe → 503**.

## Predicciones y ejercicios

1. **`$hostname` y la prueba del balanceo.** ¿Qué valor toma `$hostname` en la página servida por nginx, y por qué sirve para demostrar el balanceo de `app2`?

<details><summary>Solución</summary>

`$hostname` es una **variable de nginx** que resuelve al hostname del contenedor. En Kubernetes ese hostname **es el nombre del Pod**, que el ReplicaSet genera único: `app2-6f9f6f7b57-abcde`. Como las 3 réplicas tienen pods con nombres distintos, al repetir el curl cambia el nombre en la respuesta → esa es la prueba viva de que el Service reparte entre las 3.

```bash
for i in 1 2 3 4 5 6; do curl -s -H "Host: app2.com" http://192.168.56.110 | grep pod; done
```

</details>

2. **Service con selector roto.** Si el `Service app2` tuviera `selector: { app: app2-wrong }` (etiqueta que ningún Pod tiene), ¿qué vería el usuario y con qué comando se comprueba?

<details><summary>Solución</summary>

El Service queda con la lista de **Endpoints vacía** → el objeto existe pero no sirve a nadie.

```bash
kubectl get endpoints app2      # ENDPOINTS vacío  ← la prueba definitiva
kubectl describe svc app2       # ver el selector
kubectl get pods -l app=app2    # ¿los Pods tienen esa label?
```

El usuario recibe **503 Service Unavailable** (no 502): el 503 es "el servicio existe pero no tiene Pods"; el 502 sería "sí hay backend, pero falla".

</details>

3. **El enrutado sin DNS y el 404.** ¿Dónde vive la distinción entre `app1.com` y "cualquier otra cosa" si la IP es siempre la misma? ¿Y por qué una regla sin catch-all daría 404?

<details><summary>Solución</summary>

- La IP solo decide **a qué máquina llega**; la distinción vive en la **cabecera HTTP `Host`** que Traefik lee y compara con las reglas del Ingress. No hay DNS en el `curl`.
- Si no hay regla para ese `Host` **y no existe la regla sin host**, Traefik responde **404**: no hay ninguna regla que gestione ese nombre. El catch-all convierte "404 potencial" en app3.

</details>

4. **Ver el balanceo.** ¿Qué dos comandos muestran que los 3 Pods de `app2` existen y que el Service los conoce?

<details><summary>Solución</summary>

```bash
kubectl get pods -o wide          # 3 Pods de app2 (names únicos)
kubectl get endpoints app2        # IPs tras el Service app2 (3 endpoints)
```

Los pods los mantiene el ReplicaSet; la lista de IPs la publica el Service en `Endpoints`; kube-proxy la programa en iptables/IPVS para el balanceo.

</details>

5. **La pregunta girada de defensa.** "`app1.com` funciona pero un Host inventado cae en app3. ¿Está mal el DNS? ¿Añadiría una regla?"

<details><summary>Solución</summary>

No es un fallo, es el **diseño del subject**: "any other Host → app3". No hay DNS en juego con `curl` (IP fija + cabecera). **No** se añade la regla — el catch-all (regla sin `host`) es justo lo que pide el requisito; añadirla rompería "todo lo no contemplado va a app3". Es una regla de *default backend*, no un bug.

</details>

## Errores frecuentes

- Confundir `port` (puerto del Service) con `targetPort` (puerto del contenedor).
- Creer que el **Service** enruta por Host → no, enruta el **Ingress**; el Service solo selecciona y balancea.
- Pensar que `$hostname` es una variable del shell → es de nginx, y vale el nombre del Pod.
- Selector del Service que no coincide con los labels de la plantilla del Deployment → Service sin Endpoints → 503.
- Creer que app3 es un DNS → es la **regla de Ingress sin `host`**.
- Diagnosticar 404/502/503 sin mirar primero `kubectl get endpoints` y `kubectl describe ingress`.

## Has aprendido que

- Cada `appN.yaml` = **3 objetos**: ConfigMap (config = página) + Deployment (replicas) + Service (clusterIP + label selector).
- **Deployment → ReplicaSet → Pods**: `replicas: 3` mantiene 3 Pods vivos con nombres únicos (aparecen en `$hostname`).
- **Labels y selectors** son el pegamento; el Service debe apuntar a la etiqueta real de los Pods o queda vacío.
- **Ingress (Traefik)** decide por cabecera `Host`; la regla sin `host` es el default backend (app3).
- **404** = regla que falta · **502** = backend que falla · **503** = backend sin endpoints.
- kube-proxy (IPVS/iptables) ejecuta el balanceo entre las réplicas de un Service.

## Preguntas tipo defensa

1. ¿Cómo enruta una única IP (`192.168.56.110`) a 3 aplicaciones distintas?
2. ¿Por qué cambia `$hostname` en `app2` y no en `app1`?
3. ¿Qué pasa si el `selector` del Service no coincide con los labels de los Pods, y cómo lo compruebas?
4. ¿Cómo demuestras el balanceo de `app2` ante el evaluador?
5. ¿Cuál es la causa de un 404, un 502 y un 503 en p2?
6. ¿Por qué los curls no necesitan DNS pero el navegador sí (`/etc/hosts`)?
7. ¿Qué cambiarías para que `app2` tuviera 5 réplicas?

## Criterio de finalización

La clase queda completada cuando puedes, sin apuntes:

- Explicar los 3 objetos de `appN.yaml` y por qué la plantilla del Pod replica los labels del selector.
- Seguir la cadena `curl → servicelb → Traefik → Ingress → Service → kube-proxy → Pod` de memoria.
- Diagnosticar el Service vacío (503) con `kubectl get endpoints`.
- Distinguir 404 (regla que falta) vs 502 (Pods rotos/Traefik) vs 503 (sin endpoints).
- Explicar el default backend / catch-all y la prueba del balanceo con las 3 réplicas.

## Siguiente clase

La clase 4 empieza p3 y cambia la orquestación: **K3d, Argo CD y GitOps**, cómo se despliega una aplicación desde GitHub mediante Argo CD con los conceptos de namespaces, Application CRD, `repoURL` y `syncPolicy.automated`.