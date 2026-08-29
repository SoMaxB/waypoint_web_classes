# Etapa 10 (Bonus) — Flags adicionales

**Requisito previo:** [09-salida-makefile.md](09-salida-makefile.md) — **y una parte obligatoria que
pase por completo.** El subject condiciona la evaluación del bonus a una parte obligatoria perfecta;
lo que hagas aquí no cuenta para nada si algo de lo anterior está incompleto.

**Actualizado para tu conjunto real de flags.** `--ip-timestamp` queda aparcado (pendiente de
confirmar con un miembro del staff que no hace falta para el bonus completo) y se eliminan `-w`,
`-W` y el alias largo `--ttl` — tu diseño cubre lo mismo con `-t`, `-m` y `-T`. Si el staff confirma
que `--ip-timestamp` sí hace falta, vuelve aquí y se añade un Grupo 5 para ello.

---

| Flag | Qué hace | Enlaza con |
|---|---|---|
| `-f` | Modo flood — dispara el siguiente paquete lo más rápido posible (solo root) | Estructura del bucle, Etapas 4/7 |
| `-l preload` | Envía `preload` paquetes de golpe antes de asentarse en el ritmo normal | Desacople envío/recepción, Etapas 4/5 |
| `-i wait` | Intervalo personalizado entre paquetes — admite fracciones de segundo | Temporización, Etapa 6; sustituye el intervalo fijo |
| `-m ttl` | Fija el TTL de IP en tus paquetes **unicast** salientes | Nueva sockopt: `IP_TTL` |
| `-n` | Solo numérico — omite el DNS inverso, imprime IPs en crudo | Resolución, Etapa 4 |
| `-o` | Termina con éxito tras la primera respuesta | Lógica de bucle/salida, Etapa 7 |
| `-Q` | Suprime los mensajes de *error* ICMP provocados por tus propias sondas | Reporte de errores, Etapa 7 |
| `-q` | Silencioso — suprime toda línea por paquete, imprime solo el arranque y el resumen | `print_stats`, Etapa 7 |
| `-r` | Saltarse el enrutado — `SO_DONTROUTE`, enviar directamente a un host de una red conectada | Nueva sockopt |
| `-p pattern` | Rellena el payload con un patrón hexadecimal dado por el usuario en vez de los datos por defecto | Payload, Etapa 2 |
| `-S src_addr` | Vincula el socket a una dirección de origen local concreta antes de enviar | Nuevo: `bind()` sobre un socket raw |
| `-s packetsize` | Tamaño de payload personalizado — valores grandes pueden provocar fragmentación IP | Concepto nuevo: MTU/fragmentación |
| `-T ttl` | Fija el TTL de IP específicamente para destinos **multicast** | Nueva sockopt: `IP_MULTICAST_TTL` — distinta de la de `-m` |
| `-t timeout` | Deadline total en segundos — sale al alcanzarlo, sin importar cuántos paquetes lleve | Lógica de bucle/salida, Etapa 7 |

> **Nombres, desglosados** — `IPPROTO_IP` = nivel de **IP** **PROTO**col: **IP** (el argumento de
> `setsockopt` que dice "a qué capa pertenece esta opción") · `setsockopt` = **set** **sock**et
> **opt**ion · `SO_DONTROUTE` = **S**ocket **O**ption: **DON'T ROUTE** · `IP_TTL` = **IP** **T**ime
> **T**o **L**ive (cuenta *saltos*, no segundos) · `IP_MULTICAST_TTL` = **IP** **MULTICAST** **T**ime
> **T**o **L**ive — el límite de saltos que se aplica solo a los paquetes enviados a una dirección
> multicast · `bind()` = fijar un socket a una dirección local concreta antes de usarlo, en lugar de
> dejar que el kernel elija una automáticamente · **MTU** = **M**aximum **T**ransmission **U**nit,
> el paquete más grande que transporta un enlace (~1500 bytes en Ethernet). Si lo superas, el
> paquete se parte — eso es la *fragmentación*. Lista completa en [GLOSARIO.md](GLOSARIO.md).

**`-m` y `-T` no son el mismo mando, aunque los dos digan "TTL".** `-m` fija `IP_TTL`, que rige
todo paquete unicast ordinario que envíes. `-T` fija `IP_MULTICAST_TTL`, una sockopt totalmente
distinta que el kernel solo consulta cuando el destino es una dirección multicast
(224.0.0.0–239.255.255.255). Pasar `-T` contra un host unicast normal es inofensivo pero no tiene
efecto visible — eso es lo esperado, no un bug, y merece la pena confirmarlo contra el
comportamiento real de la implementación de referencia en ese caso, en lugar de asumirlo.

---

## Preguntas de control

<details><summary>P1: ¿Por qué -m y -T necesitan dos llamadas a setsockopt distintas si ambas se describen como "TTL"?</summary>

Controlan el límite de saltos para dos clases de destino distintas. `IP_TTL` (`-m`) se aplica al
tráfico unicast ordinario; `IP_MULTICAST_TTL` (`-T`) es una opción separada que el kernel solo
aplica cuando el destino es una dirección multicast. Fijar una no toca la otra — un ping unicast
con solo `-T` fijado sigue usando el TTL por defecto para su transmisión real.
</details>

<details><summary>P2: ¿Por qué puede -s tocar un concepto que la parte obligatoria nunca te obliga a ver?</summary>

Enviar un payload lo bastante grande como para que el paquete IP resultante supere la MTU de la red
puede provocar fragmentación IP — un comportamiento de capa inferior que la parte obligatoria nunca
te exige pensar. Merece la pena conocerlo conceptualmente aunque tu implementación no gestione el
reensamblado a mano.
</details>

---

## Ejercicio

Impleméntalos en este orden — cada grupo reutiliza la estructura del anterior, y los dos primeros
grupos no requieren tocar tu bucle de envío/recepción en absoluto.

**Grupo 1 — sockopts puras y configuración (sin tocar el bucle):** `-m`, `-T`, `-r`, `-S`, `-n`
- `-m 1` contra un host lejano debería producir una respuesta **Time Exceeded** — tu ruta de
  robustez de la Etapa 2 disparándose por fin de verdad. Confirma que la informas y sigues
  ejecutando.
- `-T 1` solo tiene efecto visible contra un destino multicast — pruébalo ahí, y confirma por
  separado que no altera el comportamiento unicast contra un host normal.
- `-S` necesita una llamada a `bind()` sobre tu socket raw, usando la dirección de origen parseada,
  antes de empezar a enviar. Decide qué pasa si la dirección no es una de las interfaces propias de
  la máquina — `bind` fallará, y ese fallo tiene que traducirse en un error limpio, no en un crash.
- `-n` debe omitir por completo la consulta inversa (verifícalo: tiene que ser *más rápido*, no solo
  tener otro formato).

**Grupo 2 — cambios en el payload:** `-p`, `-s`
- `-p` parsea **hexadecimal proporcionado por el usuario desde argv**. Valida con severidad: rechaza
  caracteres no hexadecimales, rechaza cadenas de longitud impar, y acota la longitud contra tu
  buffer de payload. Parsear sin límite directamente a un buffer fijo es el desbordamiento clásico
  aquí — escribe primero la comprobación de longitud.
- `-s 65507` (el máximo de IPv4, ver lectura de la Etapa 9/10) y `-s 0` son ambos casos límite.
  Ninguno puede provocar un crash. Ojo con la interacción de `-s` con el timestamp de la Etapa 6: si
  el payload es menor que `sizeof(struct timespec)` no tienes dónde meterlo — decide qué haces y
  gestiónalo.

**Grupo 3 — ritmo y control del bucle:** `-o`, `-i`, `-l`, `-f`, `-t`
- Empieza por `-o` — es el más simple de este grupo: sal del bucle justo después de la primera
  respuesta exitosa en lugar de esperar a Ctrl+C.
- `-i` sustituye tu intervalo fijo, y necesita admitir **fracciones de segundo** — `sleep()` solo
  acepta segundos enteros, así que aquí es donde pasas a `usleep()` o `nanosleep()`.
- `-l` envía `preload` paquetes de golpe antes de asentarse en el ritmo normal marcado por `-i`.
- `-f` (flood) requiere root o debe negarse limpiamente — y aun así debe respetar Ctrl+C. Pruébalo
  solo contra `127.0.0.1`; inundar un host que no es tuyo es algo con lo que conviene tener cuidado.
- `-t` es un deadline **total**, independiente del número de paquetes — mide el tiempo transcurrido
  en reloj de pared (el enfoque de `CLOCK_MONOTONIC` de la Etapa 6) y sal al superarlo. Una
  comprobación por iteración entre envíos es precisión suficiente para esto; no necesitas
  `select`/`poll` salvo que quieras precisión de menos de un segundo.

**Grupo 4 — supresión de salida:** `-Q`, `-q`
- `-q` suprime **toda** línea por paquete (incluido lo que `-v` imprimiría normalmente) pero
  mantiene la línea de arranque y el resumen final.
- `-Q` suprime solo las respuestas de *error* ICMP provocadas por tus propias sondas — las
  respuestas de eco normales se siguen imprimiendo. No tiene sentido si `-q` ya está activo; decide
  y documenta qué pasa si se pasan ambos a la vez (el ping real da prioridad a `-q` — merece la pena
  confirmarlo contra la referencia en lugar de asumirlo).

**`--ip-timestamp` (aparcado):** no lo intentes hasta confirmar con el staff si hace falta. Si
resulta que sí: es una *opción* de la cabecera IP (RFC 791 §3.1), no algo expuesto vía un simple
`setsockopt`, así que implica activar `IP_HDRINCL` y construir la cabecera IP tú mismo —
notablemente más trabajo que cualquiera de los flags anteriores. Avísalo pronto si el staff confirma
que entra, porque cambia tu estimación de tiempo para el bonus.

**Terminado cuando:** cada grupo pase con valgrind limpio y el diff de salida de la parte
obligatoria de la Etapa 9 siga siendo idéntico sin pasar ningún flag. **Repite el diff de la Etapa 9
después de cada grupo** — que el trabajo del bonus haga regresión en la salida obligatoria es la
forma habitual de perder el bonus entero.

---

## Lecturas

- `man 7 ip` — `IP_TTL`, `IP_MULTICAST_TTL`, `IP_HDRINCL`, `IP_OPTIONS`
- `man 2 bind` — para `-S`
- `man 3 usleep` / `man 2 nanosleep` — para las fracciones de segundo de `-i`
- `man 7 socket` — `SO_DONTROUTE`
- **RFC 791** §3.2 "Fragmentation and Reassembly" — para `-s`; §3.1 "Options" si `--ip-timestamp`
  termina entrando en el alcance
- `man 8 ping` — la semántica de referencia de cada uno de estos flags; reproduce su comportamiento
- inetutils-2.0 `ping/ping.c` — su tratamiento de opciones, para la paridad de formato de salida
