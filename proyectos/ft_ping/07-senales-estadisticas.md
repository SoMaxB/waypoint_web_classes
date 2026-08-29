# Etapa 7 — Manejo de señales y estadísticas

**Requisito previo:** [06-tiempos-rtt.md](06-tiempos-rtt.md) · **Siguiente:** [08-cli-errores.md](08-cli-errores.md)

---

**Versión llana:** el ping real se ejecuta hasta que lo interrumpes (Ctrl+C), y entonces imprime un
resumen en lugar de morirse sin más.

**`sigaction()` frente a `signal()`:** `sigaction` es la forma más robusta y portable de instalar un
handler — te deja controlar los flags con precisión (por ejemplo, si una syscall interrumpida se
reanuda o no).

**Async-signal-safety:** no llames a funciones no reentrantes (`printf`, `malloc`, …) desde dentro
de un signal handler. El patrón estándar: pon un flag `volatile sig_atomic_t` en el handler, y
compruébalo y actúa desde tu bucle principal.

**Estadísticas que acumular sobre la marcha:** paquetes transmitidos, paquetes recibidos, y cada
valor de RTT individual (necesarios para calcular min/avg/max y **mdev** — desviación media — al
final).

> **Nombres, desglosados** — `SIGINT` = **SIG**nal: **INT**errupt (lo que envía Ctrl+C) ·
> `sig_atomic_t` = un tipo (**t**ype) **atomic**o y seguro frente a señales (**sig**nal), que no
> puede quedar pillado a medio escribir · `SA_RESTART` = flag de **S**ig**a**ction: **RESTART**,
> reanudar la syscall interrumpida · `EINTR` = **E**rror: **INTR**errupted · *reentrante* = seguro
> de volver a llamar mientras una llamada anterior sigue en curso, que es lo que necesita un signal
> handler. Lista completa en [GLOSARIO.md](GLOSARIO.md).

---

## Preguntas de control

<details><summary>P1: ¿Por qué no deberías llamar a printf() directamente dentro de tu handler de SIGINT?</summary>

Los signal handlers pueden interrumpir tu programa en cualquier punto, incluso a mitad de una
llamada no reentrante como un printf en curso. Llamar a printf desde el handler arriesga corromper
estado compartido (como los buffers internos de stdio). El patrón seguro es poner un flag y dejar
que el flujo normal del programa haga la impresión.
</details>

<details><summary>P2: ¿Cuál es la diferencia entre el "RTT medio" y el "mdev" del resumen de ping?</summary>

La media es el promedio de todos los round-trip times. El mdev mide cuánto se desvían los RTT
individuales de esa media — un mdev bajo significa latencia estable; uno alto, latencia con jitter
aunque la media tenga buena pinta.
</details>

---

## Ejercicio

1. Instala SIGINT con `sigaction`. El cuerpo del handler es **exactamente una línea**:
   ```c
   static volatile sig_atomic_t g_stop = 0;
   static void on_sigint(int sig) { (void)sig; g_stop = 1; }
   ```
   Nada más. Ni printf, ni malloc, ni free.
2. **`SA_RESTART` es una decisión real, no un valor por defecto.** Sin él, un `recvfrom()`
   bloqueante devuelve `-1`/`EINTR` cuando llega la señal, que es cómo sales del bucle enseguida.
   Con él, la syscall se reanuda y te quedas bloqueado. Elige a propósito, y en cualquier caso tu
   gestión de errores de `recvfrom` debe tratar `EINTR` como "no es un error real" en lugar de
   salir.
3. Acumula las estadísticas **de forma incremental** — suma corriente y suma de cuadrados, o un
   array que crezca. No supongas un número máximo fijo de paquetes; un ping puede correr días.
   ```
   mdev = sqrt(sum_sq/n - (sum/n)^2)
   ```
   Protégete contra `n == 0` antes de dividir, y recorta a 0 cualquier negativo diminuto bajo la
   raíz (el coma flotante puede producirlo).
4. **Testea el caso de cero respuestas:** haz ping a una dirección inalcanzable y pulsa Ctrl+C de
   inmediato. Debes imprimir `0 packets received, 100% packet loss` y **ninguna** línea de
   min/avg/max — ni `nan` ni un crash por división por cero. Este es el caso que hace segfaultar a
   las implementaciones ingenuas.
5. Prueba: Ctrl+C tras 1 paquete, tras 10, y mientras hay una respuesta en vuelo.

**Terminado cuando:** Ctrl+C imprima siempre un resumen completo y salga limpiamente, incluido el
caso de cero respuestas recibidas.

---

## Lecturas

- `man 2 sigaction` — la página entera; en especial `SA_RESTART` y el campo `sa_mask`
- `man 7 signal-safety` — **la** lista autoritativa de funciones async-signal-safe. Léela y fíjate
  en que `printf` no está
- `man 7 signal` — qué syscalls son interrumpibles, y la semántica de `EINTR`
- `man 2 signal` — lee la sección "Portability", que explica por qué se prefiere `sigaction`
- inetutils-2.0 `ping/ping.c` — su función de `print_stats` / resumen final, para copiar la
  redacción exacta
