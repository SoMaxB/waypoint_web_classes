# Clase 2: sockets, de básicos a raw

## Objetivo

Entender los tres tipos de socket que importan para ping y por qué el raw necesita privilegios. Al terminar debes abrir `socket(AF_INET, SOCK_RAW, IPPROTO_ICMP)`, distinguir `SOCK_DGRAM` vs `SOCK_RAW`, explicar `CAP_NET_RAW` / `ping_group_range` y manejar `EPERM` con un error limpio y sin segfault.

## 1. Repaso `socket(domain, type, protocol)`

- `domain` = familia de direcciones (`AF_INET` = Internet/IPv4).
- `type` = `SOCK_STREAM` (TCP, flujo), `SOCK_DGRAM` (UDP, datagrama), `SOCK_RAW` (acceso directo a IP/ICMP).
- `protocol` = `IPPROTO_ICMP` cuando quieres ICMP.

`SOCK_RAW` + `IPPROTO_ICMP` te da un socket que envía/recibe mensajes ICMP completos; el kernel sigue montando la cabecera IP por ti salvo que actives `IP_HDRINCL`.

## 2. `IP_HDRINCL` y privilegios

- `IP_HDRINCL` (IP Header Included) = "la cabecera IP la construyo yo". No hace falta para el mandatory; sí para el bonus `--ip-timestamp`.
- **Privilegios:** raw sockets necesitan `CAP_NET_RAW` (Capability, Network, Raw) — root, binario setuid-root o `setcap cap_net_raw+ep`. Sin él, `socket` falla con `EPERM`.

Linux moderno tiene una vía sin privilegios `SOCK_DGRAM + IPPROTO_ICMP` si `net.ipv4.ping_group_range` lo permite; está bien saber que existe, pero 42 espera raw socket, así que comprueba tu VM/cluster.

## 3. Por qué el raw es sensible (y por qué ping lo necesita igual)

Un raw socket puede:

1. **Leer correo ajeno:** recibe ICMP de otros procesos en el host — de ahí tu filtro id/seq de la clase 5.
2. **Mentir sobre quién eres:** si construyes la cabecera IP tú, puedes forjar la dirección de origen.
3. **Inyectar tráfico arbitrario/ malformado.**

Ping solo necesita "Echo + Reply", pero el mecanismo que lo concede es tosco y viene con todo lo anterior. Esa es la ironía que explica el `ping_group_range`.

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué hace esta línea?

```c
int fd = socket(AF_INET, SOCK_RAW, IPPROTO_ICMP);
```

Describe `domain/type/protocol` y qué cabecera monta el kernel por ti.

<details><summary>Solución</summary>

Pide a `AF_INET` un raw de `ICMP`. Al enviar solo entregas el payload ICMP; el kernel añade la cabecera IP (`IP_HDRINCL` no está activo).

</details>

### Ejercicio 2 — `SOCK_DGRAM` vs `SOCK_RAW` para ICMP

¿Por qué `SOCK_DGRAM` no es la abstracción correcta aunque "datagrama" suene a ping?

<details><summary>Solución</summary>

`SOCK_DGRAM` delega el encuadre de transporte al kernel (como con UDP). ICMP no es transporte; necesitas `SOCK_RAW` para construir/leer el mensaje ICMP completo tú.

</details>

### Ejercicio 3 — programa de 20 líneas

Escribe un `main` que solo abra el socket, compruebe `-1`, haga `perror` y salga con código distinto de cero si falla.

1. Ejecútalo sin `sudo` → confirma `Operation not permitted` (`EPERM`).
2. Con `sudo` → confirma éxito (0).
3. Mira `cat /proc/sys/net/ipv4/ping_group_range` y anota si `SOCK_DGRAM` ICMP funcionaría sin privilegios.

<details><summary>Solución</summary>

Sin privilegios debe imprimir error limpio y no segfault; con `sudo` éxito. `ping_group_range` típico `0 2147483647` permite dgram sin root, pero no es la vía pedida por 42 — tu ruta de error es la que importa.

</details>

## Errores frecuentes

- Pedir `IPPROTO_ICMP` con `SOCK_STREAM`.
- Olvidar `#include <sys/socket.h>` y confundir `AF_INET` con `PF_INET`.
- Tratar `EPERM` como éxito o crashear en vez de salir controlado.
- No comprobar `socket() == -1` antes de usar el fd en `sendto/recvfrom`.

## Has aprendido que

- `SOCK_RAW + IPPROTO_ICMP` es la combinación pedida; `IP_HDRINCL` es para bonus.
- Raw sockets necesitan `CAP_NET_RAW` (root/setcap); sin él `EPERM`.
- `-n` y `ping_group_range` permiten ICMP sin privilegios en kernels modernos, pero no es la vía de 42.
- La sensibilidad del raw (leer ajeno, spoofing, malformados) explica la restricción.

## Preguntas tipo defensa

1. ¿Qué tres argumentos recibe `socket` y qué ejemplo usa ft_ping?
2. ¿Qué significa `IP_HDRINCL` y cuándo lo necesitarás?
3. ¿Qué es `CAP_NET_RAW` y qué `errno` ves sin ella?
4. ¿En qué se diferencia `SOCK_RAW` de `SOCK_DGRAM` para ICMP?
5. ¿Cómo compruebas en tu entorno si ICMP sin privilegios está permitido?

## Criterio de finalización

- Mismo binario imprime `EPERM` limpio sin `sudo` y 0 con `sudo`, sin segfault.
- Explicas `EPERM` vs éxito y sabes qué dice `ping_group_range` en tu VM.
- Diferencias `IP_HDRINCL` y sabes que no lo necesitas para el mandatory.

## Siguiente clase

La clase 3 construye la cabecera ICMP (type 8/0, `htons` para id/seq) y el algoritmo del Internet checksum verificable sin red.

## Lecturas

- `man 2 socket` — contrato y `errno`
- `man 7 raw` — qué envía/recibe un raw ICMP y `IP_HDRINCL`
- `man 7 ip` — tabla de opciones (`IP_TTL`, `IP_HDRINCL`)
- `man 7 capabilities` — `CAP_NET_RAW`
- `man 8 setcap`
