# Etapa 5 — Recibir y parsear la respuesta

**Requisito previo:** [04-construir-enviar.md](04-construir-enviar.md) · **Siguiente:** [06-tiempos-rtt.md](06-tiempos-rtt.md)

---

**Versión llana:** como estás sobre un raw socket, `recvfrom()` no te entrega solo el mensaje ICMP:
te entrega el *paquete IP completo*, cabecera IP incluida, envolviendo esa respuesta ICMP.

**Parsear la cabecera IP:** necesitas un struct para la cabecera IP (`struct ip` en `netinet/ip.h`,
o el tuyo propio), y en concreto su campo **IHL** — **I**nternet **H**eader **L**ength. Te dice
cuántas palabras de 32 bits mide la cabecera IP *de ese paquete concreto* (varía cuando hay
opciones IP presentes), para que sepas exactamente dónde empieza el payload ICMP.

**Reconocer tu propia respuesta:** después de saltarte la cabecera IP, parsea los bytes restantes
como tu struct de cabecera ICMP, comprueba type/code, y compara el identifier y el sequence number
con lo que enviaste — confirmando que es realmente una respuesta a *tu* petición, y no el ping de
otro proceso ni un paquete perdido.

> **Nombres, desglosados** — `recvfrom` = **rec**ei**v**e **from** (recibir de; también te devuelve
> la dirección del emisor) · **IHL** = **I**nternet **H**eader **L**ength · **TTL** = **T**ime
> **T**o **L**ive (cuenta *saltos*, no segundos — cada router lo decrementa) · `ICMP_ECHOREPLY` =
> la constante del type **ECHO REPLY** de ICMP, valor 0 · `MSG_TRUNC` = **M**e**S**sa**G**e
> **TRUNC**ated, el flag que significa "el paquete era mayor que tu buffer y el resto se ha
> perdido" · **RTT** = **R**ound-**T**rip **T**ime. Lista completa en [GLOSARIO.md](GLOSARIO.md).
>
> **"Datagrama"** aquí significa simplemente un paquete autocontenido, por oposición a un flujo
> continuo. **"Granularidad"** significa el tamaño de la unidad con la que trabajas — un raw socket
> trabaja con paquetes enteros.

---

## Preguntas de control

<details><summary>P1: ¿Por qué recvfrom() te entrega más de lo que esperabas del mensaje ICMP?</summary>

Un raw socket ICMP recibe con granularidad de capa IP: obtienes el datagrama IP completo (cabecera
+ payload), no un flujo ya filtrado por la capa de transporte. El mensaje ICMP está después de la
cabecera IP, no ocupa el buffer entero.
</details>

<details><summary>P2: ¿Por qué no puedes suponer que la cabecera IP mide siempre exactamente 20 bytes?</summary>

La longitud de la cabecera IP es variable por culpa de los campos opcionales. El campo IHL da la
longitud real en palabras de 32 bits de ese paquete concreto — codificar 20 bytes a fuego rompe
con cualquier paquete que lleve opciones.
</details>

---

## Ejercicio

Cierra el ciclo: un envío, una recepción, una línea impresa.

1. Haz `recvfrom()` sobre un buffer holgadamente mayor que cualquier paquete esperado. **Comprueba
   la longitud devuelta antes de tocar nada** — parsear una lectura corta como si fuera una cabecera
   IP completa es una lectura fuera de límites directa.
2. Extrae el IHL: `ip_hl * 4` te da el desplazamiento en bytes. Imprímelo. En una respuesta normal
   será 20; fíjate en que lo has *calculado*, no supuesto.
3. **Valida antes de indexar.** En este orden: ¿es `n >= sizeof(struct ip)`? ¿es `ihl >= 20`? ¿es
   `n >= ihl + sizeof(struct icmphdr)`? Solo entonces leas la cabecera ICMP. Saltarte cualquiera de
   estas es un crash que la evaluación encontrará.
4. Filtra: `type == ICMP_ECHOREPLY (0)`, `id == tu id`, `seq == el esperado`. **Rompe el filtro del
   id a propósito** (pon un id equivocado a fuego) y confirma que rechazas correctamente la
   respuesta — eso demuestra que el filtro se ejecuta de verdad.
5. Imprime una sola línea parecida a
   `64 bytes from 127.0.0.1: icmp_seq=1 ttl=64` (el TTL sale del campo `ip_ttl` de la cabecera IP).
   El RTT llega en la Etapa 6.
6. Ejecútalo con ASan contra localhost y contra un host real.

**Terminado cuando:** un ciclo de ping completo se imprima correctamente, y ASan esté limpio tanto
con una respuesta buena como con una truncada o con id equivocado.

> **Trampa:** en Linux el raw socket entrega *todos* los paquetes ICMP que recibe el host, no solo
> los tuyos. Tu filtro no es una cortesía opcional: sin él imprimirás las respuestas de otros
> procesos.

---

## Lecturas

- `man 2 recvfrom` — semántica del valor de retorno, en especial los casos `0` y `-1`, y `MSG_TRUNC`
- `man 7 raw` — relee el párrafo de "la cabecera IP siempre viene incluida" ahora que te importa
- `/usr/include/netinet/ip.h` — el `struct ip` real; fíjate en que `ip_hl` es un campo de bits y su
  posición depende del endianness (lee el bloque `#if __BYTE_ORDER`)
- **RFC 791** §3.1 — el diagrama de la cabecera IP, en concreto IHL y Options

---

## Nota de cierre de la Etapa 5 — qué sigue difiriendo del `ping` real

La Etapa 5 está **terminada**: un envío, una recepción, una línea impresa, verificada contra una
captura de `tcpdump`. Lo de abajo son carencias conocidas, dejadas a propósito para etapas
posteriores. Se anotan aquí para que no se pierdan de aquí a la evaluación.

### 1. `icmp_seq` empieza en 0, el ping real empieza en 1

`main.c` inicializa `int seq = 0;` y el primer paquete sale con `sequence = htons(0)`, así que la
salida dice `icmp_seq=0`. El `ping` real numera su primer paquete como **1** — todas las salidas
de referencia, todos los ejemplos del man y la propia salida de muestra del subject empiezan en
`icmp_seq=1`.

El arreglo es un carácter (`int seq = 1;`), pero hazlo **cuando llegue el bucle de envío en la
Etapa 7**, no ahora: el bucle es donde `seq` empieza a incrementarse, y cambiar el inicializador
aislado ahora significa tocarlo dos veces.

Fíjate en que nada del camino de recepción necesita cambiar: `sent_seq` llega como parámetro
desde `main` y se compara en crudo, así que sigue lo que `main` envíe.

### 2. Se está filtrando padding sin inicializar hacia la red

Visible en la captura. `fill_payload()` hace `memcpy(pkt->payload, &tv, sizeof tv)` con
`struct timeval tv` como variable local. En macOS/arm64 `struct timeval` mide 16 bytes: 8 de
`tv_sec`, 4 de `tv_usec` y **4 bytes de padding**. `gettimeofday()` escribe los dos primeros
campos y deja el padding intacto, así que los bytes 12–15 del payload son lo que hubiera en la
pila:

```
0x0020:  0000 0000 5120 0600 0100 0000 1011 1213
                             ^^^^^^^^^ basura de la pila, enviada a 8.8.8.8
```

El `memset(&pkt, 0, sizeof pkt)` de `main` no ayuda: el `memcpy` sobrescribe después esos bytes
puestos a cero con el padding. ASan no lo detecta (es una *lectura* sin inicializar, no un acceso
fuera de límites); valgrind sí lo reporta como *"syscall param socketcall.sendto(msg) points to
uninitialised byte(s)"*, y algunos evaluadores pasan valgrind.

Arreglo: `struct timeval tv = {0};` antes de la llamada a `gettimeofday()`.

### 3. A la línea de cabecera le falta el contador de bytes

Ahora mismo: `PING 8.8.8.8 (8.8.8.8)`
Ping real: `PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.`

Es cosmético, pero el subject pide que la salida se parezca a la real. Va con el resto del trabajo
de salida en la Etapa 9.

### 4. Aplazado a propósito (no son bugs)

- **Sin RTT** — `time=X ms` necesita leer de vuelta el timestamp de envío desde el payload. Etapa 6.
- **Sin timeout** — una respuesta que nunca casa se queda bloqueada en `recvfrom` para siempre. Es
  el comportamiento *correcto* para la Etapa 5 y es exactamente lo que demuestra la prueba del id
  roto; el timeout llega con el bucle de la Etapa 6.
- **Un solo paquete** — sin bucle de envío cada segundo, sin manejador de `SIGINT`, sin bloque
  final de estadísticas. Etapas 6 y 7.

### Verificado en esta etapa

Descodificado de la captura `tcpdump -x` de un intercambio real con 8.8.8.8:

| Campo | Valor | Comprobación |
|---|---|---|
| IHL | `0x45` → 5 → 20 bytes | calculado, no supuesto |
| Longitud total | `0x0054` = 84 = 20 + 64 | cuadra con `bytes_read` |
| Type ICMP | `08` petición / `00` respuesta | el filtro casa con 0 |
| id | `0x4a06` = 18950 | idéntico en ambos sentidos |
| seq | `0x0000` | idéntico en ambos sentidos |
| Checksum | `0x1f36` → `0x2736` | la diferencia es exactamente `0x0800`, el cambio de type — la aritmética es correcta |
| Relleno del payload | empieza `10 11 12 13` en el offset 16 | coincide con el patrón del ping real |
