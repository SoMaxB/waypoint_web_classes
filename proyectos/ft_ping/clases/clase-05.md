# Clase 5: recibir y parsear la respuesta

## Objetivo

Hacer que tu programa lea lo que `tcpdump` ya veía. Al terminar debes hacer `recvfrom` sobre el raw socket, saltar la cabecera IP según `IHL`, validar longitudes antes de indexar, filtrar por `type/id/seq` y imprimir una línea `64 bytes from 127.0.0.1: icmp_seq=... ttl=...` con ASan limpio incluso con paquetes truncados o con id equivocado.

## 1. Qué te entrega `recvfrom`

Sobre un raw ICMP no recibes solo ICMP: recibes **el datagrama IP completo** (cabecera IP + payload ICMP). Necesitas una cabecera IP (`struct ip` en `netinet/ip.h`) y su campo **IHL** (Internet Header Length) — longitud de la cabecera IP en palabras de 32 bits de ese paquete concreto (varía con opciones). El payload ICMP empieza en `ihl * 4`.

## 2. Parseo robusto

Valida **antes** de indexar:

1. ¿`n >= sizeof(struct ip)`?
2. ¿`ihl >= 20` (5 palabras)?
3. ¿`n >= ihl + sizeof(struct icmphdr)`?

Solo entonces lees `type/code/id/seq`. Un raw recibe **todo** el ICMP del host, no solo el tuyo — tu filtro `type==ICMP_ECHOREPLY(0) && id==tu_id && seq==esperado` no es cortesía, es obligatorio.

TTL sale de `ip_ttl` de la cabecera IP.

## 3. Notas de la etapa real

Esta clase ya está **terminada** como ciclo de un paquete: un envío, una recepción, una línea, ASan limpio y captura verificada. Quedan carencias conocidas dejadas a propósito para clases posteriores (se anotan para no perderlas):

- `icmp_seq` empieza en 0 (debe ser 1; se cambia con el bucle en la clase 7) — ver "Nota de cierre" de la etapa 5.
- Padding sin inicializar en payload si copias `struct timeval` con `memcpy` (ver clase 6; `valgrind` lo reporta como `uninitialised byte(s)`).
- Cabecera `PING 8.8.8.8 (8.8.8.8) 56(84) bytes...` incompleta (clase 9).
- Sin RTT/timeout/bucle/estadísticas (clases 6-7).

La decodificación de `tcpdump -x` verificada en la etapa (IHL `0x45`, len `0x0054=84`, type `08/00`, id `0x4a06`, seq `0x0000`, checksum delta `0x0800`) confirma orden y aritmética.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué `recvfrom` entrega más?

Esperas 64 bytes ICMP pero `recvfrom` te da 84. ¿Qué son los 20 extra?

<details><summary>Solución</summary>

La cabecera IP (20 bytes sin opciones, `IHL=5`). El kernel entrega el datagrama completo en granulación IP.

</details>

### Ejercicio 2 — ¿por qué no hardcodear 20?

Si siempre saltas 20, ¿qué paquete te rompe?

<details><summary>Solución</summary>

Uno con opciones IP (IHL >5). Tu offset quedaría dentro de la cabecera IP y parsearías basura como si fuera ICMP → lectura fuera de límites o `type` incorrecto.

</details>

### Ejercicio 3 — valida antes de indexar

Implementa el triple `if` de arriba. Rompe a propósito `id` (pon uno equivocado) y confirma que rechazas la respuesta aunque tcpdump la vea.

<details><summary>Solución</summary>

Debe rechazarse: demuestra que el filtro se ejecuta y que el raw recibe replies ajenos. Sin ese filtro, contarías replies de otros pings.

</details>

### Ejercicio 4 — `MSG_TRUNC`

¿Qué significa y por qué compruebas `n` antes de todo?

<details><summary>Solución</summary>

`MSG_TRUNC` = el paquete era mayor que tu buffer y se truncó. Si parseas sin mirar `n`, indexas más allá de lo recibido.

</details>

## Errores frecuentes

- Hardcodear `20` en vez de `ihl*4`.
- No comprobar `n` antes de leer cabeceras → segfault con paquete truncado.
- No filtrar `id/seq` → falsos positivos.
- Usar `ip_hl` sin tener en cuenta `#if __BYTE_ORDER` (campo de bits).
- Confundir `TTL` con "segundos" (son saltos).

## Has aprendido que

- `recvfrom` sobre raw ICMP trae IP + ICMP; el ICMP empieza en `ihl*4`.
- Hay que validar longitudes en orden antes de tocar la cabecera ICMP.
- El raw ve todo el ICMP del host: filtra por `type==0, id==tu, seq==esperado`.
- `ip_hl` varía; 20 es el caso sin opciones, no una constante.
- El ciclo de un paquete con ASan limpio y tcpdump verificado es la definición de terminado de esta clase.

## Preguntas tipo defensa

1. ¿Qué tamaño tiene la cabecera IP y cómo lo sabes para cada paquete concreto?
2. ¿Qué tres validaciones haces antes de leer la cabecera ICMP?
3. ¿Por qué el filtro `id/seq` no es opcional en un raw socket?
4. ¿De dónde sale `ttl` en tu línea impresa?
5. ¿Qué bug deja ver `valgrind` pero ASan no, relacionado con el payload de la etapa posterior?

## Criterio de finalización

- Un ciclo envío→recepción imprime `64 bytes from ... icmp_seq=... ttl=...` correcto.
- ASan limpio con respuesta buena, truncada y con id equivocado (rechazo).
- `tcpdump -x` y tu parseo coinciden campo por campo (IHL, len, type, id, seq, checksum).

## Siguiente clase

La clase 6 mide el RTT: `CLOCK_MONOTONIC`, timestamp en el payload y normalización de acarreo.

## Lecturas

- `man 2 recvfrom` — retorno 0/-1 y `MSG_TRUNC`
- `man 7 raw` — "la cabecera IP siempre viene incluida"
- `/usr/include/netinet/ip.h` — `struct ip` e `ip_hl` con `__BYTE_ORDER`
- **RFC 791** §3.1 — IHL y opciones
