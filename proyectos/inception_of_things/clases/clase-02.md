# Clase 2: Vagrant, máquinas virtuales y p1

## Objetivo

Entender cómo se crea un **cluster K3s de dos nodos** con Vagrant: qué son Vagrant, provider, box y provisioner; cómo se unen el server y el worker **sin copiar el `node-token` generado por K3s**, y para qué sirve cada flag del pipeline de instalación. Al terminar, debes poder explicar por qué el token se fija en el `Vagrantfile`, por qué la interfaz de red se resuelve desde la IP y no se hardcodea, y cómo diagnosticar un worker en `NotReady`.

## 1. Los ficheros y las capas

```
Vagrant          →  crea y provisiona las VMs   (orquestador de máquinas)
  └─ K3s server  →  control-plane + API server  (<login>S,  192.168.56.110)
  └─ K3s agent   →  worker                      (<login>SW, 192.168.56.111)
```

| Fichero | Rol |
|---|---|
| `srcs/p1/Vagrantfile` | *Receta* declarativa: 2 máquinas, IPs, recursos y provisioners |
| `srcs/p1/scripts/server.sh` | *Cocinado* del server: instalación K3s en modo `server` |
| `srcs/p1/scripts/worker.sh` | Unión del agente: instalación K3s en modo `agent` con `K3S_URL` |

El `Vagrantfile` declara las máquinas (provider, box, red privada) y Vagrant ejecuta los provisioners en el orden declarado dentro de cada VM.

## 2. El token del cluster — el truco central

El instalador oficial de K3s en el server **genera un token aleatorio** en `/var/lib/rancher/k3s/server/node-token`. El agente **necesita ese mismo token** para autenticarse. Copiarlo entre máquinas obliga a sincronizarlas (orden de arranque, `scp`, carpeta compartida) — frágil e innecesario.

**Solución del repo: fijar el token nosotros** y pasárselo a ambos scripts vía `args`:

```ruby
K3S_TOKEN = "iot-<login>-k3s-token"
```

```ruby
server.vm.provision "shell", path: "scripts/server.sh", args: [SERVER_IP, K3S_TOKEN]
worker.vm.provision "shell", path: "scripts/worker.sh", args: [SERVER_IP, WORKER_IP, K3S_TOKEN]
```

Por qué funciona: el instalador respeta la variable de entorno **`K3S_TOKEN`** — si está presente, no genera uno aleatorio. Server y worker se provisionan con el **mismo valor**, así que el agente autentica sin copiar ficheros y **no depende del orden de arranque**. Es un token de laboratorio, no un secreto real.

## 3. Resolver la interfaz desde la IP — el detalle clave

El nombre de la NIC de la red privada **cambia según el provider** (libvirt → `eth0/eth1`, VirtualBox → `enp0s8`…). Si se escribe a mano, solo funciona en una máquina. Se resuelve desde la IP que **sí conocemos** y fijamos nosotros:

```bash
IFACE="$(ip -o -4 addr show | grep -w "${SERVER_IP}" | awk '{print $2}' | head -n1)"
```

Pipeline: `ip -o -4 addr show` (una línea por interfaz, solo IPv4) → `grep -w` (coincidencia exacta, solo la línea con nuestra IP) → `awk '{print $2}'` (nombre de la interfaz) → `head -n1` (defensivo). Ese nombre se pasa a K3s como `--flannel-iface`.

## 4. Flags del server — para qué sirve cada una

```bash
curl -sfL https://get.k3s.io | K3S_TOKEN="${TOKEN}" INSTALL_K3S_EXEC="server \
  --node-ip=${SERVER_IP} \
  --advertise-address=${SERVER_IP} \
  --flannel-iface=${IFACE} \
  --tls-san=${SERVER_IP} \
  --write-kubeconfig-mode=644" sh -
```

| Flag | Qué hace | Sin ella… |
|---|---|---|
| `--node-ip` | IP con la que el kubelet se **registra como nodo** | se registra con la NAT `10.0.2.x`; server y worker son mundos separados → flannel roto |
| `--advertise-address` | IP que el **API server anuncia** para que otros se conecten | anuncia una IP incorrecta; los clientes no llegan |
| `--flannel-iface` | interfaz de la **red de Pods** (CNI) | apunta a la NAT → los nodos no se ven |
| `--tls-san` | IP extra añadida al **certificado** del API server | el worker falla al validar el cert (`x509: cannot validate certificate … no IP SANs`) |
| `--write-kubeconfig-mode=644` | kubeconfig legible | `vagrant` no puede leer `k3s.yaml` sin sudo |

No se usa `--bind-address`: por defecto el API server también escucha en `127.0.0.1`, y el `kubectl` local del server funciona.

## 5. El worker — un solo concepto nuevo

```bash
K3S_URL="https://192.168.56.110:6443" K3S_TOKEN="${TOKEN}" INSTALL_K3S_EXEC="agent \
  --node-ip=192.168.56.111 --flannel-iface=${IFACE}" sh -
```

- `K3S_URL` + token fijo → el instalador crea el servicio **`k3s-agent`** (no `k3s`) y usa el token pasado (no genera otro).
- El agente es "tontito": se conecta a una URL, valida el certificado del server y se registra con `--node-ip`. No lleva `--tls-san` ni `--advertise-address`.

## Predicciones y ejercicios

1. **El token del cluster.** Da dos formas de que el worker consiga el token del server y los problemas de cada una.

<details><summary>Solución</summary>

- **Forma A (sincronizar):** esperar a que el server escriba `/var/lib/rancher/k3s/server/node-token` y copiarlo (scp/SSH). Problemas: **depende del orden de arranque**, y aquí la carpeta compartida (synced folder) está desactivada.
- **Forma B (token fijo):** definir el token en el `Vagrantfile` y pasárselo a ambos scripts como `args`. El instalador respeta `K3S_TOKEN` en vez de generar uno aleatorio. **Sin dependencias de orden ni copias.**

</details>

2. **La interfaz de red.** ¿Por qué no se puede hardcodear `eth1` como `--flannel-iface`, y cómo se resuelve en su lugar?

<details><summary>Solución</summary>

El nombre de la NIC privada depende del provider (libvirt → `eth0/eth1`, VirtualBox → `enp0s8`…), así que un valor fijo solo funciona en una máquina. En su lugar se descubre desde la IP que sí conocemos:

```bash
IFACE="$(ip -o -4 addr show | grep -w "${SERVER_IP}" | awk '{print $2}' | head -n1)"
```

</details>

3. **`--tls-san`.** ¿Qué error verías en el worker si el `server.sh` no pasara `--tls-san`, y cuál es el fix?

<details><summary>Solución</summary>

El agente no validaría el certificado del API server porque la IP `192.168.56.110` no está en sus SANs:

```bash
journalctl -u k3s-agent | grep x509
# x509: cannot validate certificate for 192.168.56.110 because it doesn't contain any IP SANs
```

El fix es añadir `--tls-san=${SERVER_IP}` al `INSTALL_K3S_EXEC` del server (y rehacer el cluster o el certificado). `--tls-san` no es una opción del cliente: lista las IPs/hostnames que el API server **incluye en su certificado** para que el agente (y un `kubectl` remoto) las validen.

</details>

4. **Diagnosticar "worker NotReady".** `vagrant up` terminó pero `kubectl get nodes` solo muestra `<login>S` Ready; `<login>SW` está `NotReady`. Orden de sospechas, de más probable a más rara:

<details><summary>Solución</summary>

1. **Flannel / interfaz mal resuelta** — si el worker registró una IP de la NAT (`10.0.2.x`). Confirmar:
   ```bash
   kubectl get nodes -o wide        # INTERNAL-IP del worker: 192.168.56.111 o 10.0.2.x?
   journalctl -u k3s-agent -n 50    # errores flannel / tunnel
   ip -o -4 addr show               # ¿la .111 vive en la misma iface que eligió IFACE?
   ```
2. **Token** — el agente no autentica (401):
   ```bash
   journalctl -u k3s-agent | grep -i token
   ```
3. **Certificado / `--tls-san`**:
   ```bash
   journalctl -u k3s-agent | grep x509
   ```
4. **Firewall / red** (raro):
   ```bash
   curl -zv 192.168.56.110 6443     # ¿se llega al puerto? (curl no valida nada de K8s)
   ```

**Orden mental: flannel → token → tls → firewall.** El primer comando siempre es `kubectl get nodes -o wide`: separa "IP mal registrada" de "nodo ok" en un segundo.

</details>

## Errores frecuentes

- Creer que el worker "pide" el token al server en runtime → el token se pasa **por entorno constante** (`K3S_TOKEN`) en los provisioners.
- Hardcodear la NIC privada en los scripts → se rompe al cambiar de provider.
- Confundir `--node-ip` (el nodo se presenta al cluster) con `--advertise-address` (el API server se ofrece a los clientes).
- Pensar que `--tls-san` es para el **cliente**; en realidad lista las IPs/hostnames del **API server** en el certificado que el agente (y `kubectl` remoto) validan.
- Diagnosticar el worker leyendo el **server**: los logs que importan (`journalctl -u k3s-agent`) están en el propio worker.
- Tirar abajo y rehacer el cluster sin mirar antes `kubectl get nodes -o wide` y los logs del agente.

## Has aprendido que

- Vagrant = *receta declarativa* (provider, box, red privada) + *provisioners* = ejecución dentro de la VM.
- El `K3S_TOKEN` fijo hace la unión server–worker **sin copiar el token generado** y sin depender del orden de arranque.
- La interfaz del flannel **se descubre de la IP**, no se hardcodea.
- Cada flag de `server.sh` cubre una capa: registro (`--node-ip`), anuncio (`--advertise-address`), red de Pods (`--flannel-iface`), certificado (`--tls-san`), acceso (`--write-kubeconfig-mode`).
- La prueba en `kubectl get nodes -o wide` es la IP del worker: si ambas IPs son las privadas (`.110`/`.111`), la unión fue limpia.
- El diagnóstico de un worker `NotReady` sigue el orden flannel → token → tls → firewall.

## Preguntas tipo defensa

1. ¿Cómo se une `<login>SW` a `<login>S` sin copiar el `node-token`?
2. ¿Qué cambiarías para un tercer worker `<login>SW2` con `192.168.56.112`?
3. Sin `--tls-san`, ¿qué error verías en el worker y en qué línea está el fix?
4. ¿Por qué no se puede hardcodear `eth1` como `--flannel-iface`?
5. `kubectl get nodes` da el worker `NotReady`; ¿cuál es tu primer comando y por qué?
6. ¿Por qué `--write-kubeconfig-mode=644` más el `export` del `.bashrc` evitan el `sudo`?
7. ¿Qué diferencia a `--node-ip` de `--advertise-address`?

## Criterio de finalización

Marca cada ítem cuando lo digas "sin apuntes":

- Explicar cómo plantea Vagrant las dos máquinas (box, `private_network`, provisioners, provider).
- Explicar la unión del worker con el token fijo del `Vagrantfile` (ejercicio 1).
- Decir de memoria el pipeline `IFACE` y por qué no se hardcodea.
- Justificar cada flag de `server.sh` (`node-ip`/`advertise-address`/`flannel-iface`/`tls-san`/`write-kubeconfig-mode-644`) con su consecuencia "sin ella".
- Diagnosticar el worker `NotReady` en el orden flannel→token→tls→firewall, con sus comandos.

## Siguiente clase

La clase 3 entra en **Kubernetes básico y p2**: deployments, servicios, replicas e Ingress; cómo una sola IP (`192.168.56.110`) sirve tres aplicaciones según la cabecera `Host`.

## Lista de lecturas

- K3s docs — flags del server (`--disable`, `--flannel-iface`) y del agent (`K3S_URL`, `K3S_TOKEN`).
- K3s docs — el token del cluster y por qué el worker no necesita copiarlo a mano.
- `man 1 ip` — de la IP a la interfaz de red (`ip -4 addr`): la resolución de `IFACE`.