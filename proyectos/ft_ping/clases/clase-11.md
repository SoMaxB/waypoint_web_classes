# Clase 11: flags bonus

## Objetivo

Añadir los flags de `inetutils` sin romper la obligatoria. Al terminar tendrás `-m/-T/-r/-S/-n/-p/-s/-i/-l/-f/-t/-o/-Q/-q` funcionando, con `setsockopt/bind/nanosleep` y `valgrind` limpio, y repetirás el `diff` de la obligatoria tras cada grupo.

> Requisito: la parte obligatoria debe ser perfecta; el subject ignora el bonus si no lo es. `--ip-timestamp` queda aparcado (es `IP_HDRINCL` + cabecera IP manual) hasta confirmar con staff si hace falta; `-w/-W/--ttl` se cubren con `-t/-m/-T`.

## 1. Mapa de flags

| Flag | Qué hace | Toca |
|---|---|---|
| `-m ttl` | `IP_TTL` para unicast | `setsockopt(IPPROTO_IP, IP_TTL)` |
| `-T ttl` | `IP_MULTICAST_TTL` solo para multicast | `setsockopt(IPPROTO_IP, IP_MULTICAST_TTL)` — **distinta** de `-m` |
| `-r` | `SO_DONTROUTE` | `setsockopt(SOL_SOCKET, SO_DONTROUTE)` |
| `-S src` | `bind` a IP local | `bind()` antes de enviar; valida pertenencia a interfaz |
| `-n` | numérico, sin DNS inverso | omitir consulta inversa (más rápido, otro formato) |
| `-p pat` | payload hex del usuario | parsea hex con validación severa (longitud, impar, no-hex) |
| `-s size` | tamaño payload | cuidado MTU/fragmentación; si `< sizeof(timespec)` decide dónde va el timestamp |
| `-f` | flood (solo root) | bucle sin `sleep`; respeta `Ctrl+C` |
| `-l preload` | `preload` de golpe | envía N antes del ritmo normal |
| `-i wait` | intervalo con fracción | `usleep/nanosleep`, no `sleep` |
| `-t timeout` | deadline total | `CLOCK_MONOTONIC` por iteración |
| `-o` | sale tras primera reply | `break` tras recepción válida |
| `-Q` | suprime errores ICMP de tus sondas | filtra impresiones de error |
| `-q` | silencioso (solo cabecera y resumen) | suprime líneas por paquete; prima sobre `-Q/-v` |

`-m` vs `-T`: pasar `-T` a unicast es inofensivo y sin efecto visible — lo esperado, confirma contra la referencia en vez de asumir.

## 2. Orden por grupos (cada uno reutiliza el anterior)

**Grupo 1 — sockopts/config sin bucle:** `-m, -T, -r, -S, -n`
- `-m 1` contra host lejano → `Time Exceeded` que dispara tu rama de la clase 2 con `-v`.
- `-T 1` solo visible contra multicast `224.0.0.0/24`.
- `-S` con `bind` previo; si no es IP local, error limpio no crash.

**Grupo 2 — payload:** `-p, -s`
- `-p` valida longitud límite contra tu buffer antes de copiar.
- `-s 65507/0` casos límite sin crash; resuelve colisión con `timespec`.

**Grupo 3 — ritmo:** `-o, -i, -l, -f, -t`
- Empieza por `-o` (más simple).
- `-i` con `nanosleep`.
- `-f` exige root o niega limpio; prueba solo contra `127.0.0.1`.

**Grupo 4 — supresión:** `-Q, -q`
- `-q` suprime incluso `-v`; `-Q` solo errores de sonda y `-q` prima.

## 3. Regla de no-regresión

**Tras cada grupo repite el `diff` de la clase 9 sin flags.** Si el bonus rompe la salida obligatoria, pierdes el bonus entero en evaluación.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué `-m` y `-T` son dos `setsockopt`?

Un compañero hace `setsockopt(IP_TTL)` para ambos. ¿Qué observa con unicast + `-T 1`?

<details><summary>Solución</summary>

Nada cambia: `-T` toca `IP_MULTICAST_TTL`, no `IP_TTL`. Con destino `8.8.8.8` (unicast) debe comportarse como sin flag; si usaste `IP_TTL`, lo rompiste.

</details>

### Ejercicio 2 — `-p deadbeef` con longitud impar

Usuario pasa `ABC`. ¿Qué haces?

<details><summary>Solución</summary>

Error limpio "odd length" sin copiar nada. Longitud impar no es medio byte.

</details>

### Ejercicio 3 — interacción `-s` y timestamp

`-s 5` es menor que `sizeof(timespec)=16`. ¿Dónde pones el timestamp de RTT?

<details><summary>Solución</summary>

Decide explícitamente: o deshabilitas RTT para ese tamaño, o adaptas el payload, pero nunca escribas fuera de `5` ni rompas el cálculo.

</details>

### Ejercicio 4 — `-q` vs `-v`

Usuario pasa `-q -v` y espera ver líneas verbose. ¿Qué hace `inetutils`?

<details><summary>Solución</summary>

Prima `-q`: sin líneas por paquete, solo cabecera y resumen. Verifica contra `ping-ref` con `-q -v` en lugar de adivinar.

</details>

## Errores frecuentes

- Tratar `IP_TTL` y `IP_MULTICAST_TTL` como alias.
- Parsear `-p` sin acotar longitud → overflow.
- No manejar `-s` pequeño para timestamp.
- `-f` sin comprobar root o sin respetar `Ctrl+C`.
- No repetir `diff` obligatorio tras cada grupo → regresión silenciosa.

## Has aprendido que

- `-m` es `IP_TTL`, `-T` es `IP_MULTICAST_TTL`; son sockopts distintas.
- `-S` es `bind`, `-r` es `SO_DONTROUTE`, `-n` omite inversa.
- `-p` y `-s` tocan payload con validación de límites.
- Ritmo (`-i/-l/-f/-t/-o`) es control de bucle con `CLOCK_MONOTONIC` o `nanosleep`.
- `-q` prima sobre `-v/-Q`; todo grupo debe revalidar la obligatoria.

## Preguntas tipo defensa

1. ¿Qué sockopts tocan `-m` y `-T` y cuándo es visible cada una?
2. ¿Qué validas en `-p` antes de copiar al payload?
3. ¿Cómo manejas `-s` pequeño con el timestamp de RTT?
4. ¿Qué syscalls usas para `-i` fraccional y para `-S`?
5. ¿Qué pruebas de no-regresión haces tras cada grupo bonus?

## Criterio de finalización

- Cada grupo pasa con `valgrind` limpio y `diff` obligatorio intacto.
- `ping-ref` y `ft_ping` coinciden en comportamiento flag por flag (incluida la no-acción de `-T` en unicast).
- Puedes justificar por qué `IP_HDRINCL` y `--ip-timestamp` se aparcaron.

## Siguiente clase

No hay siguiente: la auditoría de la clase 10 más este bonus te dejan con `ft_ping` completo y defendible. Si el staff confirma `--ip-timestamp`, añadir Grupo 5 con `IP_HDRINCL` y cabecera IP manual (RFC 791 §3.1).

## Lecturas

- `man 7 ip` — `IP_TTL`, `IP_MULTICAST_TTL`, `IP_HDRINCL`, `IP_OPTIONS`
- `man 2 bind`, `man 2 setsockopt`, `man 7 socket` (`SO_DONTROUTE`)
- `man 3 usleep` / `man 2 nanosleep`
- **RFC 791** §3.2 (fragmentación para `-s`), §3.1 (opciones para `--ip-timestamp`)
- `man 8 ping` y `inetutils-2.0 ping/ping.c` — semántica de cada flag
