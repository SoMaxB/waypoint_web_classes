# Inception of Things — Clase 2 / Class 2

> **Tema / Topic:** Vagrant, máquinas virtuales y p1 — *Vagrant, virtual machines and p1*
> **Proyecto:** Inception of Things (IoT) — [subject](https://github.com/<login>/Inception-of-Things_<login>/blob/main/max_docs/en.subject.pdf)

---

<section lang="es">

## Objetivo / Objective (ES)

Entender cómo se crea un **cluster K3s de dos nodos** con Vagrant: qué son Vagrant, provider, box y provisioner; cómo se unen el server y el worker **sin copiar el `node-token` generado por K3s**; significado del pipeline de flags de K3s.

---

## 1. Los ficheros y las capas

```
Vagrant          →  crea y provisiona las VMs   (orquestador de máquinas)
  └─ K3s server  →  control-plane + API server  (<login>S, 192.168.56.110)
  └─ K3s agent   →  worker                      (<login>SW, 192.168.56.111)
```

| Fichero | Rol |
|---|---|
| `srcs/p1/Vagrantfile` | *Receta* declarativa: 2 máquinas, IPs, recursos, provisioners |
| `srcs/p1/scripts/server.sh` | *Cocinado* del server: instalación K3s en modo `server` |
| `srcs/p1/scripts/worker.sh` | Unión del agente: instalación K3s en modo `agent` con `K3S_URL` |

---

## 2. El token del cluster — el truco central

El instalador oficial de K3s en el server **genera un token aleatorio** en `/var/lib/rancher/k3s/server/node-token`. El agente **necesita ese mismo token** para autenticarse. Copiarlo entre máquinas obliga a sincronizarlas (orden, `scp`, carpeta compartida) — frágil e innecesario.

**Solución del repo: fijar el token nosotros** y pasárselo a ambos scripts vía `args`:

```ruby
K3S_TOKEN = "iot-<login>-k3s-token"
```

```ruby
server.vm.provision "shell", path: "scripts/server.sh", args: [SERVER_IP, K3S_TOKEN]
worker.vm.provision "shell", path: "scripts/worker.sh", args: [SERVER_IP, WORKER_IP, K3S_TOKEN]
```

Por qué funciona: el instalador respeta la env **`K3S_TOKEN`** — no genera uno aleatorio, usa el que le pasamos. Server y worker se provisionan con el **mismo valor** → el agente autentica sin copiar ficheros y **no depende del orden de arranque**.

Es un token de laboratorio, **no un secreto real**.

---

## 3. Resolver la interfaz desde la IP — el detalle clave

El nombre de la NIC de la red privada **cambia según el provider** (libvirt → `eth0/eth1`, VirtualBox → `enp0s8`…). Si se escribe a mano, solo funciona en una máquina. Se resuelve desde la IP que **sí conocemos**:

```bash
IFACE="$(ip -o -4 addr show | grep -w "${SERVER_IP}" | awk '{print $2}' | head -n1)"
```

Pipeline: `ip -o -4 addr show` (1 línea por interfaz, solo IPv4) → `grep -w` (exacto, solo la línea con nuestra IP) → `awk '{print $2}'` (nombre de interfaz) → `head -n1` (defensivo). Ese nombre se pasa a K3s como `--flannel-iface`.

---

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
| `--advertise-address` | IP que el **API server anuncia** para conectarse | anuncia IP mala; clientes no llegan |
| `--flannel-iface` | interfaz de la **red de Pods** (CNI) | apunta a la NAT → los nodos no se ven |
| `--tls-san` | IP extra añadida al **certificado** del API server | el worker falla al validar el cert (`x509 … no IP SANs`) |
| `--write-kubeconfig-mode=644` | kubeconfig legible | `vagrant` no puede leer `k3s.yaml` sin sudo |

No se usa `--bind-address`: por defecto el API server también escucha en `127.0.0.1`, y el `kubectl` local del server funciona.

---

## 5. El worker — un solo concepto nuevo

```bash
K3S_URL="https://192.168.56.110:6443" K3S_TOKEN="${TOKEN}" INSTALL_K3S_EXEC="agent \
  --node-ip=192.168.56.111 --flannel-iface=${IFACE}" sh -
```

- `K3S_URL` + token fijo → el instalador crea el servicio **`k3s-agent`** (no `k3s`) y usa el token pasado (no genera otro).
- El agente es "tontito": se conecta a una URL, valida el cert del server y se registra con `--node-ip`. No lleva `--tls-san` ni `--advertise-address`.

---

## Predicción / Ejercicio 2.4 — Diagnosticar "worker NotReady"

`vagrant up` terminó pero `kubectl get nodes` solo muestra `<login>S` Ready; `<login>SW` en `NotReady`. Orden de sospechas — de más probable a más rara:

1. **Flannel / interfaz mal resuelta** — si el worker registró una IP de la NAT (10.0.2.x). Confirmar:
   ```bash
   kubectl get nodes -o wide          # INTERNAL-Pygmalion del worker: 192.168.56.111 o 10.0.2.x?
   journalctl -u k3s-agent -n 50      # errores flannel / tunnel
   ip -o -4 addr show                 # ¿la .111 vive en la misma iface que eligió IFACE?
   ```
2. **Token** — el agente no autentica (401).
   ```bash
   journalctl -u k3s-agent | grep -i token
   ```
3. **Certificado / `--tls-san`** — el agente no valida el cert.
   ```bash
   journalctl -u k3s-agent | grep x509    # "cannot validate certificate for 192.168.56.110"
   ```
4. **Firewall / red** (raro):
   ```bash
   curl -zv 192.168.56.110 6443           # ¿se llega? (curl no valida nada de K8s)
   ```

> **Orden mental:** flannel → token → tls → firewall. La peña **`kubectl get nodes -o wide`** separa "IP mal" de "nodo OK" en un segundo.

---

## Predicción / Ejercicio 2.1 — El token del cluster

**Pregunta:** dos formas de que el worker consiga el token, y sus problemas.

<details class="solution"><summary>Solución</summary>

- **Forma A (sincronizar):** esperar a que el server escriba `/var/lib/.../node-token`, copiarlo (scp/SSH). Problemas: **depende del orden de arranque**, y aquí el synced folder está **desactivado**.
- **Forma B (token fijo):** definir el token en el `Vagrantfile` y pasárselo a ambos scripts. El instalador usa `K3S_TOKEN` en vez de generar uno. **Sin dependencias de orden ni copias.**

</details>

## Predicción / Ejercicio 2.2 — La interfaz de red

| Concepto | Línea | 
|---|---|
| Por qué no hardcodear `eth1` | el nombre cambia según el provenidor (libvirt vs virtualbox) |
| Cómo se resuelve | `ip -o -4 addr show | grep -w IP | awk '{print $2}'` |

---

## Errores frecuentes

- Creer que el worker "pide" el token al server en runtime → el token se pasa **por env constanten en los provisioners**.
- Harcodear la NIC privada en los scripts → se rompe en otro provider.
- Confundir `sys-node-ip` (nodo se presenta al cluster) con `advertise-address` (API server se ofrece).
- Pensar que `--tls-san` es para el **cliente**; en realidad **lista las IPs/hostnamest del API server** en el cert que el agente (y `kubectl` remoto) validan.
- Diagnosticar el worker leyendo el **server**: el logging con `journalctl -u k3s-agent` está en el propio worker.

---

## Has aprendido que

- Vagrant = *receta declarativa* (+ provider, box, provisioner); los modules son ejecución en la VM.
- El `K3S_TOKEN` fijo hace la unión server–worker **sin copiar el token generado** y sin depender del orden.
- La interfaz del flannel** se descubre de la IP, no se hardcodea.
- Cada flag de `server.sh` cubre una capa: registro, anuncio, CNI, cert.
- El actor en `kubectl get notes -o wide` es la IP del worker: si salen 2 Ready, la unión fue limpia.

---

## Preguntas tipo defensa

- ¿Cómo se une `<login>SW` a `<login>S` sin copiar el `node-token`?
- ¿Qué cambiarías para un tercer worker `<login>SW2` con `192.168.56.112`?
- Sin `--tls-san`, ¿qué error verías en el worker y en qué línea está el fix?
- ¿Por qué no se puede hardcodear `eth1` como `--flannel-iface`?
- `kubectl get notes` da el worker `NotReady`; ¿cuál es tu primer comando y por qué?
- ¿Por qué `--write-kubeconfig-mode=644` + el `export` del `.bashrc` evitan el `sudoo`?

---

## Criterio de finalización

Marca cada ítem cuando lo digas "sin apuntes":

- [ ] Explicar cómo Vagrant platea dos Server/Worker máquinas (box, private_network, provisioners, provider).
- [ ] Explicar la unión del worker con el token fijo del `Vagrantfile` (predicción 2.1).
- [ ] Decir de memoria el pipeline `IFACE` y por qué no lo son hardcodeio.
- [ ] Justificar cada flag de `MAX_...` en `server.sh` (node-ip/adv/iface/tls-san/kubeconfig-644).
- [ ] Diagnosticar el worker `NotReady` (orden flannel→token→tls→firewall, con sus comandos).

> Cuando está todo marcado, la Clase 2 está dominada. Siguiente: **CLASE 3 — Kubernetes básico y p2**.
</section>

---

<section lang="en"><h2>Objective</h2>
<p>Understand how a two-node <strong>K3s cluster</strong> is created with Vagrant: Vagrant, providers, boxes, provisioners; how the worker joins <strong>without copying the K3s-generated <code>node-token</code></strong>; and what each K3s flag actually does.</p>

<h2>The joining story – fixed token</h2>
<p>K3s's server installer generates a random token at <code>/var/lib/rancher/k3s/server/node-token</code>. The agent needs that token to authenticate. Copying files between machines is fragile (order dependency, synced folder disabled here). The repo instead <strong>binds a token in the <code>Vagrantfile</code></strong> and passes it to both scripts:</p>
<pre><code>K3S_TOKEN = "iot-&lt;login&gt;-k3s-token"
args: [SERVER_IP, K3S_TOKEN]
args: [SERVER_IP, WORKER_IP, K3S_TOKEN]</code></pre>
<p>The installer honors env <code>K3S_TOKEN</code>, so no random token is generated and no copy is needed.</p>

<h2>NIC resolution &mdash; the hidden detail</h2>
<pre><code>IFACE="$(ip -o -4 addr show | grep -w "${IP}" | awk '{print $2}' | head -n1)"</code></pre>
<p>The private NIC has a provider-dependent name (<code>eth1</code>/<code>enp0s8</code>…). Never hardcode it; resolve it from the IP we fixed ourselves, then feed it to <code>--flannel-iface</code>.</p>

<h2>Server flags</h2>
<table summary="k3s server flags">
<tr><th>Flag</th><th>Job</th></tr>
<tr><td><code>--node-ip</code></td><td>IP the kubelet registers as</td></tr>
<tr><td><code>--advertise-address</code></td><td>IP the API server advertises</td></tr>
<tr><td><code>--flannel-iface</code></td><td>Pod-network / CNI interface</td></tr>
<tr><td><code>--tls-san</code></td><td>extra IP in the API server's certificate</td></tr>
<tr><td><code>--write-kubeconfig-mode=644</code></td><td>readable kubeconfig (no sudo)</td></tr>
</table>

<h2>Worker</h2>
<pre><code>K3S_URL="https://192.168.56.110:6443" K3S_TOKEN="…" INSTALL_K3S_EXEC="agent --node-ip=… --flannel-iface=…" sh -</code></pre>
<p><code>K3S_URL</code> makes the installer create the <code>k3s-agent</code> service using our token. The agent only does: join URL, validate cert, register with <code>--node-ip</code>.</p>

<h2>Exercise 2.4 &mdash; "worker NotReady" diagnosis</h2>
<p>Suspects, most likely first: <strong>flannel/interface</strong>→<strong>token</strong>→<strong>TLS SAN</strong>→<strong>firewall</strong>. Key commands: <code>kubectl get nodes -o wide</code> (is the worker's INTERNAL-IP <code>192.168.56.111</code> or a NAT <code>10.0.2.x</code>?), <code>journalctl -u k3s-agent</code> on the worker itself.</p>

<h2>Frequent mistakes</h2>
<ul>
<li>Thinking the agent "asks" the server for the token → it comes from the fixed Vagrantfile token.</li>
<li>Hardcoding the private NIC in scripts → breaks on another provider.</li>
<li>Confusing <code>--node-ip</code> (register as) vs <code>--advertise-address</code> (announce yourself).</li>
<li>Thinking TLS-SAN is a client-side thing; it's the server's certificate SAN list.</li>
<li>Diagnosing the worker with curl; the answers live in the worker's <code>journalctl -u k3s-agent</code>.</li>
</ul>

<h2>Defense-style questions</h2>
<ul>
<li>How does <code>&lt;login&gt;SW</code> join without copying <code>node-token</code>?</li>
<li>What changes to add a third worker at <code>192.168.56.112</code>?</li>
<li>Without <code>--tls-san</code>, what error appears where?</li>
<li>Why not hardcode <code>--flannel-iface=eth1</code>?</li>
<li>Worker NotReady: first command and why?</li>
<li>Why <code>--write-kubeconfig-mode=644</code> + <code>~/.bashrc</code> export = no sudo?</li>
</ul>

<h2>Completion criterion</h2>
<ul>
<li>[ ] VM topology from the <code>Vagrantfile</code> (provider, private_network, provisioners).</li>
<li>[ ] Worker join with the fixed token (exercise 2.1).</li>
<li>[ ] The <code>IFACE</code> pipeline and why it's not hardcoded.</li>
<li>[ ] Each <code>server.sh</code> flag with its "without it" consequence.</li>
<li>[ ] NotReady diagnosis order with the right commands.</li>
</ul>

<p>When everything is checked, Class 2 is mastered. Next: <strong>Class 3 — Kubernetes basics and p2</strong>.</p>
</section>