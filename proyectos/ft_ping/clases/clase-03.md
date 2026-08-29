# Clase 3: cabecera ICMP y el Internet checksum

## Objetivo

Dominar la estructura del mensaje Echo y el algoritmo que garantiza su integridad. Al terminar debes rellenar un `struct icmphdr` con `type/code/identifier/sequence`, manejar correctamente `htons/ntohs`, implementar el Internet checksum (RFC 1071) y verificarlo sin red contra una captura real y con tests de acarreo y longitud impar.

## 1. Cabecera ICMP Echo

```
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Type      |     Code      |          Checksum            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Identifier          |        Sequence Number       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Data (payload)                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- Echo Request: `type=8, code=0`. Echo Reply: `type=0, code=0`.
- `identifier` = habitualmente `PID` del emisor → filtra tus replies entre los de otros procesos en el mismo host.
- `sequence` incremental → detecta pérdidas y reorden.
- `payload` = bytes arbitrarios (timestamp, patrón).

`struct icmphdr` en `netinet/ip_icmp.h`: `type` (1B), `code` (1B), `checksum` (2B), `un.echo.id` (2B), `un.echo.sequence` (2B). Otros tipos que debes no-crashear: Destination Unreachable (3), Time Exceeded (11, para bonus `-T/--ttl`), Redirect (5). Con `-v` se informan, no se aborta.

## 2. Orden de bytes

`htons` = host to network short, `ntohs` = inverso. Red = big-endian, x86 = little-endian. `id` y `sequence` (2B) necesitan `htons` al enviar y `ntohs` al recibir; `type/code` (1B) no.

## 3. El Internet checksum (RFC 1071)

Suma todas las palabras de 16 bits del mensaje ICMP (trata el buffer como `uint16_t`), reintroduce el acarreo que se sale de 16 bits (end-around carry) y aplica complemento a uno (`~`).

Reglas:

- Pon a cero el campo `checksum` antes de calcularlo.
- Si el buffer es impar, trata el último byte suelto como byte alto con byte bajo 0.
- Para validar: calcula checksum, escríbelo, recalcula sobre todo el buffer → debe dar `0`.

> Lectura de dos bytes como `uint16_t` vía cast puede chocar con strict-aliasing/alineamiento. Portátil: leer dos bytes y combinarlos o `memcpy` a `uint16_t`.

## Predicciones y ejercicios

### Ejercicio 1 — `sizeof(struct icmphdr)`

```c
printf("%zu\n", sizeof(struct icmphdr));
```

¿Cuánto esperas? ¿Qué pasa si obtienes 16 por padding?

<details><summary>Solución</summary>

Espera 8. Si ves más, hay padding por alineación o estás incluyendo payload. Usa el struct del sistema o define el tuyo `__attribute__((packed))` y verifica con hexdump.

</details>

### Ejercicio 2 — hexdump antes de checksum

Rellena `type=8,code=0,id=getpid(),seq=1,checksum=0` y vuelca el buffer byte a byte. Compara con `tcpdump -x icmp` de `ping -c 1` real. ¿Qué debe cuadrar?

<details><summary>Solución</summary>

Los 8 primeros bytes tras la cabecera IP deben coincidir campo por campo en posición y orden de bytes salvo checksum y payload. Si id/seq aparecen bytes-swapped, te falta `htons`.

</details>

### Ejercicio 3 — implementa y testea el checksum

Escribe `uint16_t checksum(const void *buf, size_t len)` y prueba:

1. Propiedad autoverificable: calcula, escribe en el campo, recalcula sobre todo → `0`.
2. Longitud impar (7 y 9 bytes) bajo `valgrind/-fsanitize=address` (off-by-one clásico).
3. Contra captura real: pon checksum a 0 y reproduce el valor capturado.
4. Buffer todo `0` y todo `0xff`.

<details><summary>Solución</summary>

Los 5 casos deben pasar y ASan/valgrind limpios. El caso impar confirma que no lees un byte más allá; la captura confirma orden y acarreo.

</details>

### Ejercicio 4 — identifier

Varios procesos hacen ping al mismo destino desde el mismo host. ¿Para qué sirve `identifier`?

<details><summary>Solución</summary>

Para filtrar replies: cada instancia solo procesa paquetes con su propio `id` (PID). Sin ese filtro, el raw socket te entregaría replies ajenos y los contarías como tuyos.

</details>

## Errores frecuentes

- No poner a cero `checksum` antes de calcularlo → incluye basura.
- Olvidar `htons` en `id/seq` → bytes cruzados pero tcpdump lo delata.
- No manejar el byte impar → lectura fuera de límites (ASan no siempre lo pilla, valgrind sí si lee sin inicializar).
- Cast `char*` → `uint16_t*` sin `memcpy` → aliasing/alineamiento.
- Validar solo buffers pares y creer que el checksum funciona.

## Has aprendido que

- Echo Request 8/0 y Reply 0/0; otros tipos se informan con `-v`, no se aborta.
- `id` (PID) y `seq` multiplexan; van con `htons/ntohs`.
- Checksum = suma de palabras 16b + end-around carry + `~`; el campo a cero durante el cálculo; impar → padding con 0.
- El test "escribe y recalcula → 0" es el oráculo sin red.
- El raw entrega todo ICMP del host → filtrar por `id/seq` es obligatorio.

## Preguntas tipo defensa

1. ¿Qué valores tienen `type/code` en Request y Reply y qué otros tipos conoces?
2. ¿Qué campos necesitan `htons` y por qué?
3. ¿Describe el algoritmo del checksum en una frase?
4. ¿Por qué pones a cero el campo antes de calcular?
5. ¿Cómo tratas el byte impar y cómo verificas que no lees fuera de límites?

## Criterio de finalización

- `checksum()` pasa los 5 tests (autoverificable, impar 7/9 con ASan limpio, captura real, todo-0, todo-0xff).
- Tu hexdump de 8 bytes coincide con `tcpdump -x icmp` salvo checksum/payload.
- Explicas sin mirar código por qué el filtro `id/seq` no es opcional.

## Siguiente clase

La clase 4 resuelve el destino (`getaddrinfo` + FQDN sin inversa), construye el paquete con tu checksum y lo pone en el cable con `sendto`, confirmándolo con `tcpdump`.

## Lecturas

- **RFC 792** entero — formatos de type 3, 11, 5, no solo Echo
- **RFC 1071** §1 y §4.1 — algoritmo y C de referencia
- `/usr/include/netinet/ip_icmp.h` — `struct icmphdr` real
- `man 3 htons` / `man 3 endian`
- `man 1 valgrind` / `-fsanitize=address`
