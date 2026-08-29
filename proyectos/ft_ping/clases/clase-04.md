# Clase 4: construir, resolver y enviar

## Objetivo

Hacer que el primer Echo salga por el cable. Al terminar debes resolver un FQDN/IPv4 con `getaddrinfo` (una sola vez, sin inversa en el retorno), construir el paquete ICMP con tu checksum, enviarlo con `sendto` sin puerto y confirmar con `tcpdump` que la request y su reply existen — todavía sin recibir en tu programa.

## 1. Resolver el destino

`getaddrinfo()` convierte texto (hostname/IP) en `sockaddr` útil para `sendto`.

- El subject exige FQDN sin "resolución inversa en el retorno": resuelve al arrancar y no vuelvas a consultar DNS al tratar cada respuesta.
- Usa `hints.ai_family = AF_INET`, `hints.ai_socktype = SOCK_RAW`. Comprueba retorno contra `0`; los errores no van por `errno` sino por `gai_strerror()` (un `perror` aquí no tiene sentido). Libera siempre con `freeaddrinfo()`.

```c
struct addrinfo hints = {0}, *res;
hints.ai_family = AF_INET;
hints.ai_socktype = SOCK_RAW;
if (getaddrinfo(dest, NULL, &hints, &res) != 0) { /* gai_strerror */ }
```

Prueba `127.0.0.1`, `google.com` y `not.a.real.host.invalid` (este último debe dar error limpio, no segfault ni leak).

## 2. `sendto` sobre raw ICMP

No hay puerto: ICMP no lo tiene. Solo `sockaddr_in` con IP de destino.

```c
sendto(sockfd, &icmp, len, 0, res->ai_addr, res->ai_addrlen);
```

Devuelve bytes enviados o `-1`. El kernel monta la cabecera IP; tú solo entregas ICMP.

## 3. Construir el paquete

1. Buffer para icmphdr + payload (p. ej. patrón `0x00..ff` o timestamp).
2. `type=ICMP_ECHO(8), code=0, id=htons(pid), sequence=htons(seq)`.
3. Rellenar payload.
4. `checksum = 0` durante el cálculo, luego `checksum(buf,len)`.
5. `sendto`.

Usa `htons` para `id/seq`; la red es big-endian.

## Predicciones y ejercicios

### Ejercicio 1 — ¿cuándo se resuelve?

Un compañero propone resolver el hostname en cada iteración del bucle "por si cambia". ¿Qué dice el subject y qué harás?

<details><summary>Solución</summary>

Una sola vez al arrancar. Resolver por paquete es innecesario y contradice "sin resolución en el retorno". Reutiliza la `res` del inicio.

</details>

### Ejercicio 2 — `gai_strerror` vs `perror`

`getaddrinfo` falla y haces `perror("getaddrinfo")` → imprime `Success`. ¿Por qué?

<details><summary>Solución</summary>

`getaddrinfo` no pone `errno`; devuelve su propio código. Usa `gai_strerror(ret)`. `perror` solo vale tras syscalls que sí tocan `errno`.

</details>

### Ejercicio 3 — primer paquete en el cable (solo enviar)

Construye el paquete de la clase 3, calcula checksum y haz `sendto`. En otra terminal `sudo tcpdump -n icmp`. ¿Qué debes ver?

<details><summary>Solución</summary>

Tu request y su reply emparejados en tcpdump, aunque tu programa no lea aún. Si ves request sin reply, casi seguro es checksum u orden de bytes incorrectos — el receptor descarta en silencio.

</details>

### Ejercicio 4 — fuga de `addrinfo`

Olvidas `freeaddrinfo` en la ruta de error de `sendto`. ¿Cómo lo cazas?

<details><summary>Solución</summary>

`valgrind --leak-check=full` en cada fila de la tabla de entradas adversas; debe quejarse de `getaddrinfo` sin liberar.

</details>

## Errores frecuentes

- Resolver con `inet_pton` solo y no soportar FQDN, o al revés.
- Usar `perror` tras `getaddrinfo`.
- No llamar `freeaddrinfo` en todas las salidas (también en error).
- Olvidar `htons` en `id/seq` → el reply no casa con tu filtro posterior.
- Pasar puerto en `sockaddr_in` (ICMP no lo usa).

## Has aprendido que

- `getaddrinfo` + `hints AF_INET/SOCK_RAW` resuelve FQDN/IPv4 una sola vez; errores por `gai_strerror`; libera con `freeaddrinfo`.
- `sendto` sobre raw ICMP no lleva puerto; el kernel añade la IP.
- El checksum a cero antes de calcularlo y `htons` son los bugs más comunes detectables por ausencia de reply en `tcpdump`.

## Preguntas tipo defensa

1. ¿Con qué `hints` llamas a `getaddrinfo` y cómo reportas su error?
2. ¿Por qué se resuelve solo al arrancar y qué prohíbe el subject en el retorno?
3. ¿Qué devuelve `sendto` y cómo lo compruebas?
4. ¿Por qué ICMP no necesita puerto y qué campos hacen su papel?
5. ¿Cómo demuestra `tcpdump` que tu checksum es correcto?

## Criterio de finalización

- `127.0.0.1`, FQDN y hostname inválido se comportan bien (éxito, éxito, error limpio sin leak).
- `tcpdump -n icmp` muestra tu request y su reply emparejados.
- `valgrind` sin leaks en la ruta feliz y en la de error.

## Siguiente clase

La clase 5 cierra el ciclo: `recvfrom` + salto de cabecera IP por IHL + validación antes de indexar + filtro `id/seq`.

## Lecturas

- `man 3 getaddrinfo` — `hints`, `gai_strerror`, `freeaddrinfo`
- `man 2 sendto` — retorno y `errno`
- `man 7 ip` — `sockaddr_in`, `INADDR_*`
- `man 3 inet_ntop` — imprimir la IP resuelta para la cabecera `PING ...`
