# Clase 6: tiempos y RTT

## Objetivo

Medir el tiempo de ida y vuelta con precisión y robustez. Al terminar debes registrar un timestamp al enviar, calcular el RTT al recibir con acarreo correcto, elegir `CLOCK_MONOTONIC` frente al reloj de pared y obtener RTT <1 ms a localhost y dentro de ±30 ms a un host remoto respecto a `ping` del sistema.

## 1. Dónde poner el timestamp

Lo habitual es incrustarlo en los primeros bytes del payload ICMP: al recibir lo copias de vuelta con `memcpy` (no casts por alineamiento) y lo restas contra el "ahora". Alternativa válida: tabla indexada por `sequence`, pero payload es más simple y soporta varios pings en vuelo (flood).

## 2. Qué reloj usar

- `CLOCK_MONOTONIC` (monótono, solo avanza) → para medir duraciones. No le afectan sincronizaciones NTP ni cambios manuales de hora.
- `CLOCK_REALTIME` (pared) → **incorrecto** para RTT; puede saltar atrás y corromper la resta.
- `gettimeofday()` → también es reloj de pared y está desaconsejado para intervalos (ver `man 2 gettimeofday` NOTES).

## 3. Cálculo

```c
double elapsed_ms(const struct timespec *a, const struct timespec *b) {
    // b - a, normaliza tv_nsec si queda negativo
}
```

Extrae constantes al inicio:

```c
#define PING_INTERVAL_SEC  1
#define PING_PAYLOAD_SIZE 56
```

Haz `memcpy` del `timespec` al payload **antes** del checksum; al recibir, `memcpy` inverso. Decide qué hacer si `payload < sizeof(timespec)` (clase de `-s`).

## Predicciones y ejercicios

### Ejercicio 1 — acarreo de nanosegundos

`start = {1, 800000000}`, `end = {2, 100000000}`. ¿Cuánto es `elapsed`? ¿Qué pasa si restas `tv_nsec` sin normalizar?

<details><summary>Solución</summary>

`0.3 s = 300 ms` (1 s + 100 ms - 800 ms = 300 ms). Sin normalizar, `100M-800M = -700M` y sumas segundos sin ajustar → numero negativo o muy grande. Normaliza: si `nsec<0`, `+1e9` y `--sec`.

</details>

### Ejercicio 2 — `CLOCK_MONOTONIC` vs pared

NTP adelanta el reloj 0.5 s entre envío y recepción. ¿Qué RTT verías con cada reloj?

<details><summary>Solución</summary>

Con `MONOTONIC`: valor real (~X ms). Con pared: X ms + 500 ms de salto — totalmente erróneo y fuera de tolerancia ±30 ms.

</details>

### Ejercicio 3 — RTT local vs remoto

Haz ping a `127.0.0.1` y a un host a ~100 ms. Compara tu `time=` con `ping` del sistema simultáneo.

<details><summary>Solución</summary>

Localhost <1 ms; remoto dentro de ±30 ms. Si te desvías x10, confundes ns/µs/ms.

</details>

### Ejercicio 4 — confianza del payload

Un respondedor malicioso devuelve basura en tu timestamp. ¿Qué RTT imprimes? ¿Deberías validar?

<details><summary>Solución</summary>

El ping real lo imprime tal cual; tú debes saber que esa fue tu decisión consciente. Opcional: descarta RTT absurdos con `-v`.

</details>

## Errores frecuentes

- Usar `CLOCK_REALTIME`/`gettimeofday` para intervalos.
- Restar `tv_nsec` sin normalizar el préstamo de segundos.
- Hacer cast del puntero al buffer en lugar de `memcpy` (alineamiento).
- Escribir el timestamp **después** del checksum → el receptor valida un checksum que no incluye el timestamp escrito.
- Métricas con payload menor que `timespec` (colisión con `-s`).

## Has aprendido que

- Se incrusta `timespec` en el payload y se resta con `CLOCK_MONOTONIC`.
- La resta normaliza `tv_nsec` negativo; números sueltos van a `#define`.
- Tolerancia del subject: ±30 ms; `clock_gettime` es suficiente.
- `gettimeofday` está desaconsejado para intervalos.

## Preguntas tipo defensa

1. ¿Por qué `CLOCK_MONOTONIC` y no `REALTIME`?
2. ¿Por qué en el payload y no en una variable local?
3. ¿Cómo normalizas el acarreo de `tv_nsec`?
4. ¿Qué payload usará tu RTT y qué pasa si `-s` lo hace demasiado pequeño?
5. ¿Qué haces si el timestamp que vuelve es basura?

## Criterio de finalización

- Tests de `elapsed_ms` con acarreo (1 s, 999999999 ns, préstamo) pasan.
- RTT localhost <1 ms y remoto dentro de ±30 ms del ping del sistema.
- Timestamp copiado con `memcpy` antes del checksum, sin cast.

## Siguiente clase

La clase 7 detiene el bucle con `SIGINT` (Ctrl+C), respeta async-signal-safety y calcula estadísticas `min/avg/max/mdev` incluso con cero respuestas.

## Lecturas

- `man 2 clock_gettime` — `CLOCK_MONOTONIC` vs `REALTIME` vs `MONOTONIC_RAW`
- `man 7 time` — diferencia conceptual entre relojes
- `man 2 gettimeofday` — sección NOTES
- inetutils-2.0 `ping/ping_common.c` — cómo guarda/resta su timestamp
