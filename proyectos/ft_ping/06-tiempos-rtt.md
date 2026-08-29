# Etapa 6 — Tiempos y RTT

**Requisito previo:** [05-recibir-parsear.md](05-recibir-parsear.md) · **Siguiente:** [07-senales-estadisticas.md](07-senales-estadisticas.md)

---

**Versión llana:** registra un timestamp al enviar, otro cuando llega la respuesta, y réstalos. Esa
diferencia es el **RTT** — **R**ound-**T**rip **T**ime.

**Dónde poner el timestamp de envío:** lo habitual es incrustarlo directamente en el payload ICMP —
así, al recibir, lo extraes y lo restas contra el "ahora", sin necesidad de llevar aparte una tabla
de timestamps indexada por sequence number (aunque eso también es válido).

**Precisión:** en general se prefiere `clock_gettime(CLOCK_MONOTONIC, ...)` sobre `gettimeofday()`
para medir tiempo transcurrido, porque no le afectan los ajustes del reloj de pared (sincronización
NTP, cambios manuales de hora) a mitad de la medición.

> **Nombres, desglosados** — `CLOCK_MONOTONIC` = un reloj *monótono*, es decir, que solo crece y
> nunca salta hacia atrás. `CLOCK_REALTIME` = la fecha y hora reales de pared, que *sí* pueden
> saltar. NTP = **N**etwork **T**ime **P**rotocol, justo lo que provoca esos saltos.
> Lista completa en [GLOSARIO.md](GLOSARIO.md).

**Tolerancia:** el subject permite un margen de ±30 ms en la línea del RTT respecto a la
implementación de referencia — no sobreingenieres más allá de lo que `clock_gettime` te da de forma
natural.

---

## Preguntas de control

<details><summary>P1: ¿Por qué CLOCK_MONOTONIC es en general mejor que el reloj de pared para el RTT?</summary>

El reloj de pared puede saltar hacia delante o hacia atrás por sincronización NTP o por un ajuste
manual mientras tu programa se ejecuta, corrompiendo el cálculo del tiempo transcurrido.
CLOCK_MONOTONIC solo avanza, y a ritmo constante, lo que lo hace seguro para medir duraciones.
</details>

<details><summary>P2: ¿Por qué incrustar el timestamp en el payload en lugar de en una variable local?</summary>

Puede haber varios pings en vuelo a la vez (especialmente en modo flood). Atar el timestamp al
paquete concreto hace que, cuando llegue su respuesta, puedas calcular el RTT de ese paquete exacto
sin una tabla aparte indexada por sequence number.
</details>

---

## Ejercicio

1. Escribe `double elapsed_ms(const struct timespec *start, const struct timespec *end)`. Gestiona
   bien el acarreo de los nanosegundos (`tv_nsec` puede quedar negativo — normalízalo). Testéala con
   timespecs construidos a mano: 1 s exacto, 999999999 ns, y un par que obligue al acarreo.
2. Extrae ahora las constantes de timeout e intervalo, antes de que se multipliquen:
   ```c
   #define PING_INTERVAL_SEC   1
   #define PING_PAYLOAD_SIZE  56
   ```
   Cualquier número suelto en tu código de tiempos es un bug de mantenimiento esperando a pasar.
3. Copia con `memcpy` un `struct timespec` a los primeros bytes del payload antes de calcular el
   checksum. Al recibir, cópialo de vuelta con `memcpy` (no hagas cast del puntero al buffer —
   alineamiento). Réstalo contra el ahora.
4. **Contrasta con la realidad:** haz ping a localhost — el RTT debería quedar muy por debajo de
   1 ms. Haz ping a un host a unos 100 ms y compara tu número con el `ping` del sistema ejecutándose
   a la vez. Tienes ±30 ms de margen; si te desvías por un factor de 10, has confundido ns/µs/ms.
5. **Frontera de confianza:** el payload vuelve desde la red. Un respondedor hostil o defectuoso
   puede devolver basura en esos bytes, dando un RTT absurdo. Decide qué haces — el ping real
   simplemente lo imprime, pero tú deberías *saber* que esa fue tu decisión.

**Terminado cuando:** el RTT de localhost sea inferior a un milisegundo, el de un host remoto quede
dentro de ±30 ms del ping del sistema, y el test del acarreo pase.

---

## Lecturas

- `man 2 clock_gettime` — `CLOCK_MONOTONIC` frente a `CLOCK_REALTIME` frente a
  `CLOCK_MONOTONIC_RAW`
- `man 7 time` — la diferencia conceptual entre los relojes; es corto y merece la pena
- `man 2 gettimeofday` — lee la sección NOTES, que explica por qué se desaconseja para intervalos
- inetutils-2.0 `ping/ping_common.c` — mira cómo guarda y resta su timestamp la implementación de
  referencia; es contra su salida contra la que te evalúan
