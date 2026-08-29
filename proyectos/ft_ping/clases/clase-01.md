# Clase 1: qué hace ping y modelo ICMP

## Objetivo

Construir el modelo mental de qué hace `ping` realmente y dónde encaja ICMP en la pila. Al terminar debes poder explicar el subject completo, describir el formato Echo Request/Reply (type 8/0, code 0, identifier/sequence/payload), señalar por qué no usa TCP/UDP y anticipar qué significa "FQDN sin resolución inversa en el retorno".

## 1. Versión llana: "¿estás ahí?"

Tu máquina envía un paquete diminuto que dice "¿estás ahí?" a otra máquina. Si es alcanzable, esa máquina responde "sí, aquí estoy". Mides la ida y vuelta.

Eso no es TCP ni UDP: es ICMP — **Internet Control Message Protocol** — protocolo número 1, que viaja directamente sobre IP (Internet Protocol), sin puertos, sin conexión. Por eso no puedes abrir un `socket STREAM` como con un chat o un navegador: necesitas un socket que te deje fabricar/leer paquetes a nivel IP.

## 2. Dónde encaja en la pila

```
Aplicación:  ft_ping (tú)
Transporte:  — no hay TCP/UDP aquí —
Red:         ICMP (type/code/checksum/identifier/sequence/payload)
             IP (direccionamiento, TTL, IHL)
Enlace:      Ethernet / Wi-Fi
```

ICMP es capa de red, no de transporte. No hay "puerto ICMP". El `identifier` (típicamente el PID) y el `sequence` hacen el papel de "a qué conversación pertenece esto".

## 3. Qué exige exactamente el subject

- Ejecutable `ft_ping`, `Makefile` con `all/clean/fclean/re`, toda `libc` + `printf` permitidas.
- Opciones `-v` (verboso: muestra errores de paquete sin abortar; cambia el TTL para forzarlo) y `-?` (ayuda).
- Un único destino IPv4 (literal `127.0.0.1` o FQDN `example.com`). FQDN se resuelve una vez al arrancar, **sin resolución inversa** en el camino de retorno del paquete.
- Nunca crashear (segfault/bus error/double free) — ni siquiera con entradas adversas.
- Salida con la indentación de `inetutils-2.0` (`ping -V`), salvo línea de RTT y DNS inverso (exentas). Tolerancia ±30 ms.
- Referencia de comportamiento: `inetutils-2.0`, no el `ping` del sistema ni sus fuentes.

## 4. Siglas desglosadas (primera aparición)

ICMP = Internet Control Message Protocol · IP = Internet Protocol · TCP = Transmission Control Protocol · UDP = User Datagram Protocol · RFC = Request For Comments (son los estándares) · RTT = Round-Trip Time · FQDN = Fully Qualified Domain Name · DNS = Domain Name System. Glosario completo en `GLOSARIO_FT_PING.md`.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué no vale un socket TCP?

Un compañero propone `socket(AF_INET, SOCK_STREAM, 0)` y `connect()` al destino para "hacer ping". ¿Qué falla conceptualmente?

<details><summary>Solución</summary>

TCP es transporte orientado a conexión con puertos. ICMP es red sin puertos. No hay dónde conectar: necesitas `SOCK_RAW + IPPROTO_ICMP` para fabricar el mensaje ICMP tú mismo; `SOCK_STREAM` te da un flujo TCP, no un sobre ICMP.

</details>

### Ejercicio 2 — RTT extremo a extremo

Envías un Echo Request a `8.8.8.8` y vuelves a recibirlo 42 ms después. ¿Qué incluye ese número? ¿Es solo "tiempo en el cable"?

<details><summary>Solución</summary>

Es ida + vuelta completa: colas en ambos hosts, enrutado intermedio, procesado del reply en el destino. Por eso dos pings seguidos al mismo host pueden variar (jitter).

</details>

### Ejercicio 3 — observación sin código

Todavía sin `sendto`. Ejecuta `ping -c 3 127.0.0.1` y lee cada campo en voz alta. Luego en otra terminal `sudo tcpdump -i any -n icmp` mientras haces ping. Deberías ver pares `ICMP echo request / echo reply`.

<details><summary>Solución</summary>

Cada línea de tcpdump muestra `IP origen > destino: ICMP echo request, id X, seq Y, length Z`. El `id` y `seq` se repiten en el reply; `length` incluye header ICMP + payload. Anota: bytes del mensaje ICMP, `id` y `seq` — vuelven en la clase 2/3.

</details>

## Errores frecuentes

- Pensar que ICMP tiene puertos.
- Confundir RTT con "solo ida".
- Creer que `ping` necesita "llamar a la librería ping".
- Olvidar que el subject prohíbe usar el `ping` del sistema o sus fuentes, incluso como referencia de código.
- Asumir que FQDN implica resolver en cada paquete (es una sola vez).

## Has aprendido que

- `ping` es ICMP Echo Request (type 8) → Echo Reply (type 0), ambos code 0.
- ICMP va sobre IP, sin puertos; identifier/sequence multiplexan.
- El subject exige `ft_ping`, `-v/-?`, un IPv4/FQDN, FQDN sin inversa, y nunca crashear.
- La referencia de formato es `inetutils-2.0`, no el `ping` del sistema.
- RTT es ida+vuelta con tolerancia ±30 ms.

## Preguntas tipo defensa

1. ¿Qué tipo/code tiene un Echo Request y un Echo Reply?
2. ¿Por qué `ping` no puede usar `SOCK_STREAM` o `SOCK_DGRAM` normal?
3. ¿Qué significa "FQDN sin resolución en el retorno" en una frase?
4. ¿Qué dos líneas están exentas de la exigencia de indentación exacta?
5. ¿Qué parte del subject determina qué se evalúa y qué no (repositorio entregado, VM Debian)?

## Criterio de finalización

- Explicas el subject sin mirar el PDF y señalas en una salida `ping -c 1` cada campo (`PING ... 56(84) bytes`, `64 bytes from ... icmp_seq=... ttl=... time=...`).
- Señalas en `tcpdump -n icmp` quién envió cada paquete y por qué es request vs reply.
- Diferencias ICMP/IP/TCP/UDP en la pila y justificas por qué `ping` es raw socket.

## Siguiente clase

La clase 2 abre el socket: `socket(AF_INET, SOCK_RAW, IPPROTO_ICMP)`, `CAP_NET_RAW` vs `ping_group_range`, y el manejo elegante de `EPERM`.

## Lecturas

- **RFC 792**, apartado "Echo or Echo Reply Message" — una página.
- `man 8 ping` — descripción y opciones.
- `man 1 tcpdump` — `-n` y expresiones.
