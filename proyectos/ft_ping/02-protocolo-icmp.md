# Etapa 2 — El protocolo ICMP a fondo

**Requisito previo:** [01-sockets.md](01-sockets.md) · **Siguiente:** [03-checksum.md](03-checksum.md)

---

**Versión llana:** un mensaje ICMP es un sobre — un "type" (qué clase de mensaje es), un "code"
(un submotivo más específico), un checksum para verificar la integridad, y después datos propios
del mensaje.

**Mensajes Echo:** Echo Request = type `8`, code `0`. Echo Reply = type `0`, code `0`.

## Campos propios de Echo

- **Identifier** — tradicionalmente el **PID** (**P**rocess **ID**entifier, el número que el sistema
  asigna a tu programa en ejecución) del proceso emisor. Permite que tu ping distinga sus propias
  respuestas de las de otro proceso que esté haciendo ping a la vez en el mismo host.
- **Sequence number** — se incrementa con cada paquete enviado. Permite detectar pérdidas y
  reordenamientos.
- **Payload** — bytes arbitrarios; se suelen usar para llevar un timestamp y/o un patrón de relleno.

**Estructura** (`struct icmphdr` en `netinet/ip_icmp.h`): `type` (1B), `code` (1B), `checksum`
(2B), `un.echo.id` (2B), `un.echo.sequence` (2B).

> **Nombres, desglosados** — `icmphdr` = ICMP **h**ea**d**e**r** · `un` = **un**ion (un mismo hueco
> de memoria reutilizado para los campos de distintos tipos de mensaje) · `htons` = **h**ost **to**
> **n**etwork **s**hort, `ntohs` = **n**etwork **to** **h**ost **s**hort. "Short" significa un
> número de 2 bytes; estas funciones cambian por qué extremo empieza, porque redes y máquinas no
> siempre coinciden. Lista completa en [GLOSARIO.md](GLOSARIO.md).

**Otros tipos ICMP que conviene conocer** (para robustez y para el bonus): Destination Unreachable
(type 3), Time Exceeded (type 11 — directamente relevante para el bonus `-T`/`--ttl`), Redirect
(type 5). Si recibes uno de estos en lugar de un Echo Reply, el ping real lo informa: no se cae.

---

## Preguntas de control

<details><summary>P1: ¿Para qué sirve el campo identifier, si las direcciones IP ya identifican quién habla con quién?</summary>

Varios procesos — incluso varias instancias de ping — pueden estar haciendo ping al mismo destino
desde la misma máquina simultáneamente. El identifier (tradicionalmente el PID del emisor) permite
a cada instancia filtrar las respuestas entrantes y quedarse solo con sus propios paquetes.
</details>

<details><summary>P2: ¿Qué debería hacer ft_ping si recibe un Time Exceeded en lugar de un Echo Reply?</summary>

No caerse. El subject es explícito: el programa nunca puede terminar de forma inesperada. Debe
informar de la situación (para esto existe justamente `-v`) y seguir ejecutándose, sin tratarlo
como fatal.
</details>

---

## Ejercicio

Todavía sin entrada/salida de red — se trata de que los bytes sean correctos.

1. Escribe un struct `t_icmp_packet` (o usa `struct icmphdr` + un array de payload) y haz
   `printf("%zu\n", sizeof(...))`. Confirma que la cabecera ocupa exactamente **8 bytes**. Si no es
   así, tienes un problema de padding: averigua por qué.
2. Rellena type=8, code=0, id=`getpid()`, seq=1, checksum=0. Haz un hexdump del buffer byte a byte:
   ```c
   for (size_t i = 0; i < sizeof(pkt); i++) printf("%02x ", ((unsigned char *)&pkt)[i]);
   ```
3. Compara ese hexdump con una captura real de `tcpdump -x icmp` de un `ping -c 1` del sistema. Los
   primeros 8 bytes después de la cabecera IP deben cuadrar campo por campo (el checksum y el
   payload diferirán).
4. **Comprobación de orden de bytes:** `id` y `sequence` ocupan varios bytes. ¿Cuáles necesitan
   `htons()`? Escribe tu respuesta y luego verifícala contra la captura — un orden de bytes
   equivocado es el bug más común de ft_ping y es invisible hasta que comparas hexdumps.

**Terminado cuando:** los bytes de type/code/id/seq de tu hexdump coincidan con los de un ping real,
en las mismas posiciones y con el mismo orden de bytes.

---

## Lecturas

- **RFC 792** — esta vez léelo entero. Fíjate en los formatos de Destination Unreachable (type 3),
  Time Exceeded (type 11) y Redirect (type 5), no solo en Echo
- `/usr/include/netinet/ip_icmp.h` — lee el `struct icmphdr` real y las constantes `ICMP_*` de tu
  máquina
- `man 3 htons` / `man 3 endian` — conversión de orden de bytes
- Registro **IANA** (**I**nternet **A**ssigned **N**umbers **A**uthority) **ICMP Parameters** — la
  lista autoritativa de type/code. IANA mantiene la numeración oficial de protocolos, puertos y
  tipos ICMP
