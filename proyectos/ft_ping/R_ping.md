# ft_ping — Ruta de aprendizaje

Estudio a fondo de todos los conceptos, incluidos los fundamentos de sockets.
Alcance: parte obligatoria + flags bonus.

Cada archivo de etapa es autónomo: primero la explicación en lenguaje llano, después los términos
precisos que verás en las cabeceras, las man pages y los RFC. Cada etapa termina con **preguntas de
control** (las respuestas están ocultas en bloques `<details>` — intenta responder antes de
desplegarlas), un **ejercicio práctico** y una **lista de lecturas**.

**Trabaja un archivo cada vez.** No abras la siguiente etapa hasta que el ejercicio de la actual
funcione.

**Los acrónimos siempre se desglosan.** Cada constante, flag y abreviatura se desglosa letra por
letra la primera vez que aparece, y está recogida en **[GLOSARIO.md](GLOSARIO.md)** — incluidas
traducciones en lenguaje llano de expresiones como "inject arbitrary IP-level traffic" o
"demultiplexing". Si algún término aparece en estos apuntes sin explicación, es un fallo: le
corresponde estar en el glosario.

> **Sobre la terminología:** los términos técnicos se mantienen en inglés a propósito (`raw socket`,
> `checksum`, `payload`, `SOCK_RAW`). Es lo que vas a leer en las man pages, en los RFC y en el
> subject de 42, y lo que vas a decir en voz alta durante la evaluación. La explicación va en
> castellano; el vocabulario técnico, no.

## Etapas

| # | Archivo | Tema |
|---|---|---|
| 0 | [00-que-hace-ping.md](00-que-hace-ping.md) | Qué hace ping realmente y dónde encaja ICMP en la pila |
| 1 | [01-sockets.md](01-sockets.md) | Sockets, de lo básico a los raw sockets; privilegios |
| 2 | [02-protocolo-icmp.md](02-protocolo-icmp.md) | Cabecera ICMP, echo request/reply, otros tipos |
| 3 | [03-checksum.md](03-checksum.md) | El algoritmo del Internet checksum |
| 4 | [04-construir-enviar.md](04-construir-enviar.md) | Construcción del paquete, resolución, `sendto()` |
| 5 | [05-recibir-parsear.md](05-recibir-parsear.md) | `recvfrom()`, parseo de la cabecera IP, filtrado de respuestas |
| 6 | [06-tiempos-rtt.md](06-tiempos-rtt.md) | Timestamps, `clock_gettime`, RTT |
| 7 | [07-senales-estadisticas.md](07-senales-estadisticas.md) | `sigaction`, async-signal-safety, estadísticas |
| 8 | [08-cli-errores.md](08-cli-errores.md) | Parseo de argumentos, gestión robusta de errores |
| 9 | [09-salida-makefile.md](09-salida-makefile.md) | Formato exacto de salida, reglas del Makefile |
| 10 | [10-flags-bonus.md](10-flags-bonus.md) | Flags bonus y los conceptos que arrastran |

## Orden de construcción sugerido

1. **Etapas 0–3** — solo conceptos, sin código. Ten claro el modelo de la cabecera ICMP y el
   checksum antes de escribir nada.
2. **Etapas 4–5** — un único ciclo send/receive que funcione, todavía sin bucle. Objetivo: un ping
   correcto a un host conocido (por ejemplo `127.0.0.1` o tu gateway local).
3. **Etapas 6–7** — conviértelo en un bucle real: medición de RTT, resumen al pulsar Ctrl+C.
4. **Etapas 8–9** — parseo de argumentos, endurecimiento frente a errores, formato de salida exacto
   y pulido del Makefile.
5. **Etapa 10** — flags bonus, solo cuando la parte obligatoria pase por completo (el subject
   condiciona la evaluación del bonus a una parte obligatoria perfecta).

## Lecturas generales

- **RFC 792** — Internet Control Message Protocol (la especificación completa; es corta)
- **RFC 1071** — Computing the Internet Checksum
- **RFC 791** — Internet Protocol (formato de la cabecera IP, opciones)
- `man 7 raw`, `man 7 ip`, `man 7 socket`, `man 2 socket`
- Código fuente de inetutils-2.0 — la implementación de referencia contra la que te evalúan
