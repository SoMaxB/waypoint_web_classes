# Clase 7: manejo de señales y estadísticas

## Objetivo

Hacer que `Ctrl+C` produzca un resumen en lugar de una muerte silenciosa. Al terminar debes instalar `SIGINT` con `sigaction`, respetar async-signal-safety con un flag `volatile sig_atomic_t`, manejar `SA_RESTART/EINTR` conscientemente y acumular estadísticas incrementales (`min/avg/max/mdev`) sin dividir por cero.

## 1. `sigaction` vs `signal`

`sigaction` es portable y te deixa controlar flags. El handler debe ser **exactamente una línea**:

```c
static volatile sig_atomic_t g_stop = 0;
static void on_sigint(int sig) { (void)sig; g_stop = 1; }
```

Nada de `printf/malloc/free` dentro: no son async-signal-safe y pueden corromper `stdio` si interrumpen una llamada en curso.

## 2. `SA_RESTART` es una decisión

- Sin `SA_RESTART`: `recvfrom` bloqueante devuelve `-1/EINTR` → sales del bucle enseguida.
- Con `SA_RESTART`: la syscall se reanuda y te quedas bloqueado.

Elige a propósito y en cualquier caso tu gestión de `recvfrom` debe tratar `EINTR` como "no error real".

## 3. Estadísticas incrementales

Paquetes `tx/rx`, y cada RTT para `min/avg/max/mdev` (desviación media):

```
mean = sum/n
mdev = sqrt(sum_sq/n - (sum/n)^2)
```

No asumas máximo de paquetes; el ping puede correr días. Protégete de `n==0` antes de dividir y recorta a 0 cualquier negativo diminuto bajo la raíz por error de coma flotante.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué no `printf` en el handler?

Tu handler hace `printf("interrumpido\n"); g_stop=1;`. Puede intercalar con un `printf` del bucle principal. ¿Qué puede corromperse?

<details><summary>Solución</summary>

Buffers internos de `stdio` compartidos. Si el handler interrumpe a mitad de `printf`, ambos tocan el mismo buffer → corrupción y posible deadlock.

</details>

### Ejercicio 2 — `EINTR`

Bucle con `recvfrom` sin `SA_RESTART`. Pulsan `Ctrl+C` durante el bloqueo. ¿Qué retorna `recvfrom` y qué haces?

<details><summary>Solución</summary>

`-1` con `errno==EINTR`. No es fallo: compras que `g_stop` ya es 1 y sales limpio hacia `print_stats`, no por `perror`.

</details>

### Ejercicio 3 — caso cero respuestas

Haz ping a una IP inalcanzable y pulsa `Ctrl+C` enseguida. ¿Qué debe imprimir y qué no debe hacer?

<details><summary>Solución</summary>

`0 packets received, 100% packet loss` y **ninguna** línea `min/avg/max` — ni `nan` ni segfault por `sum/n` con `n==0`.

</details>

### Ejercicio 4 — mdev

Con RTTs `10, 20, 30` ms, calcula `mean` y `mdev` con la fórmula. ¿Qué indica `mdev`?

<details><summary>Solución</summary>

`mean=20`, `mdev≈8.16`. `mdev` bajo = latencia estable; alto = jitter aunque la media sea buena.

</details>

## Errores frecuentes

- Llamar `printf`/`malloc` en el handler.
- Olvidar `volatile sig_atomic_t`.
- Tratar `EINTR` como error fatal.
- Dividir por cero con `n==0`.
- Acumular solo `sum` y perder `sum_sq` para `mdev`.

## Has aprendido que

- `sigaction` + flag `sig_atomic_t` es el patrón seguro; `SA_RESTART` decide si `recvfrom` se reanuda o da `EINTR`.
- `EINTR` no es error; `printf` en handler corrompe `stdio`.
- Estadísticas se acumulan con `sum` y `sum_sq`; `mdev = sqrt(...)`, protegido contra `n==0`.

## Preguntas tipo defensa

1. ¿Por qué `sigaction` y no `signal`?
2. ¿Qué es async-signal-safety y por qué `printf` no lo es?
3. ¿Qué hace `SA_RESTART` en tu `recvfrom`?
4. ¿Cómo calculas `mdev` sin guardar todos los RTT?
5. ¿Qué imprime tu programa con cero replies y por qué no divide por cero?

## Criterio de finalización

- `Ctrl+C` tras 1, 10 y 0 replies imprime resumen correcto y sale limpio.
- `EINTR` se maneja sin `perror`; handler de una línea.
- Prueba con `n==0` no crashea y no imprime `nan`.

## Siguiente clase

La clase 8 pone la CLI y el endurecimiento: parser `-v/-?`, helpers centralizados y tabla de entradas adversas con `valgrind` limpio.

## Lecturas

- `man 2 sigaction` — `SA_RESTART`, `sa_mask`
- `man 7 signal-safety` — lista autoritativa de funciones seguras
- `man 7 signal` — syscalls interrumpibles y `EINTR`
- `man 2 signal` — "Portability" y por qué se prefiere `sigaction`
- inetutils-2.0 `ping/ping.c` — `print_stats`
