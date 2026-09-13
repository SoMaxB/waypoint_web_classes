# Clase 7: interfaz de syscalls

## Objetivo

Entender la frontera entre usuario y kernel: qué hace la instrucción `syscall`, qué registros usa, qué números corresponden a `read`/`write`, y cómo el kernel señaliza errores con retornos negativos que la libc traduce a `-1` y `errno`. Al terminar debes poder predecir los registros antes de `syscall`, distinguir una syscall vista en `strace` de su wrapper C, y explicar por qué `read(fd,buf,0)` devuelve `0` y no es un error.

Esta clase no implementa todavía `ft_read`/`ft_write`; prepara la clase 8.

## 1. Función C ≠ syscall

Tu `ft_write` será una función (ABI System V) que dentro ejecuta una syscall:

```text
C llama:     ft_write(1, buf, 5)   // rdi=1, rsi=buf, rdx=5
ft_write:    rax = 1 (número de write)
             syscall
             // rax = retorno del kernel
             // si rax <0 → errno = -rax, rax = -1
             ret
```

Los argumentos `rdi/rsi/rdx` ya llegan en los registros correctos para la syscall; no hay que moverlos. El número va en `rax`.

Syscall destruye `rcx` y `r11` (el kernel guarda `rip` y `rflags` ahí). Si los necesitas después, guárdalos.

## 2. Convenciones comparadas

| Elemento | Función System V | Syscall Linux x86-64 |
|---|---|---|
| Número | — | `rax` |
| Args 1-3 | `rdi, rsi, rdx` | `rdi, rsi, rdx` |
| Args 4-6 | `rcx, r8, r9` | `r10, r8, r9` |
| Retorno | `rax` | `rax` |
| Destruidos | `rax, rcx, rdx, rsi, rdi, r8-r11` | `rcx, r11` (+ `rax` con retorno) |

Números que importan aquí:

```text
read  = 0
write = 1
```

Tabla completa: `ausyscall --dump` o `/usr/include/asm/unistd_64.h`. No memorices más.

`syscall` es la instrucción que cruza a modo kernel. No es `int 0x80` (32 bits) ni `call`.

## 3. Qué devuelve el kernel

El kernel no conoce `errno`. Devuelve:

```text
rax >= 0          → éxito: bytes leídos/escritos
rax in [-4095,-1] → error: -errno (ej. -9 = -EBADF)
```

¿Por qué `-4095`? Porque el espacio de direcciones de usuario nunca incluye `0xfffffffffffff001..ffffffffffffffff`; el kernel aprovecha esa zona para señalar errores sin colisionar con punteros/errores válidos. Para `read`/`write`, un éxito nunca cae en esa zona, así que `test rax,rax / js .error` funciona en la práctica, aunque la comprobación completa es `cmp rax, -4095` unsigned.

La libc traduce:

```c
long ret = syscall(...);
if (ret < 0 && ret >= -4095) { errno = -ret; return -1; }
return ret;
```

`errno` es `thread-local`. En glibc no es `int errno` global sino `__errno_location() -> int*`. Declarar `extern int errno` compila pero rompe hilos y no es lo que corrige el subject. Usarás:

```nasm
extern __errno_location
call __errno_location wrt ..plt  ; rax = int*
mov  dword [rax], edi            ; *errno = error positivo de 32 bits
```

Necesitas `wrt ..plt` para PIE (prohibido `-no-pie`). Y debes preservar el código de error a través del `call` (caller-saved).

## 4. `strace`: ver la realidad

`strace` muestra **syscalls**, no wrappers:

```sh
strace -e trace=read,write,openat,close ./demo
```

Salida real de la demo de clase:

```text
write(1, "hola\n", 5) = 5
write(-1, "hola\n", 5) = -1 EBADF (Bad file descriptor)
read(0, "", 0) = 0
openat(AT_FDCWD, "/tmp/...", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 3
write(3, "hola\n", 5) = 5
read(3, "hola\n", 5) = 5
```

Observa:

- `write(-1,...)` no imprime nada: el kernel devuelve `-9`, strace lo decora como `EBADF`.
- `read(0, "", 0) = 0` no es error aunque `count=0`. libc también devuelve `0`.
- `read` sobre pipe/archivo puede devolver menos de `count` (lectura parcial) y no es error; `0` significa EOF.

Distinguir wrapper vs syscall explica por qué tu `ft_write` debe replicar el **wrapper**, no el valor crudo del kernel.

## 5. Qué significa `count = 0`

```text
write(fd, buf, 0) → 0  (nada que escribir, éxito)
read(fd, buf, 0)  → 0  (nada que leer, éxito, aunque fd sea válido)
```

No es error. Un `read` que devuelve `0` con `count>0` sí significa EOF. Un `read`/`write` que devuelve `-1` con `errno` es error real.

## Predicciones y ejercicios

### Ejercicio 1: registros antes de syscall

Para `write(1, "Hi\n", 3)` con `buf` en `0x6000`:

1. ¿Qué valor pones en `rax, rdi, rsi, rdx` antes de `syscall`?
2. ¿Qué registros destruye `syscall`?

<details><summary>Solución</summary>

```text
rax = 1 (número de write)
rdi = 1 (fd)
rsi = 0x6000 (buf)
rdx = 3 (count)
syscall destruye rcx y r11 (y deja retorno en rax).
Si necesitabas rcx, lo habrías guardado.
```

</details>

### Ejercicio 2: error EBADF

`write(-1, buf, 10)` → kernel devuelve `-9`.

1. ¿Qué debe devolver `ft_write`?
2. ¿Qué debe valer `errno`?

<details><summary>Solución</summary>

```text
ft_write devuelve -1, errno = 9 (EBADF positivo).
Flujo: rax=-9 → neg rax (9) → guardar → call __errno_location
       → mov dword [rax], 9 → mov rax,-1 → ret
```

</details>

### Ejercicio 3: count cero

`read(fd_valido, buf, 0)`:

1. ¿Qué devuelve el kernel?
2. ¿Qué devuelve la libc y qué vale `errno`?

<details><summary>Solución</summary>

```text
Kernel devuelve 0, libc devuelve 0, errno no se toca (queda como estaba).
No es error. El tester debe comparar ret==0, no errno.
```

</details>

### Ejercicio 4: thread-local

¿Por qué `extern int errno` es incorrecto y `__errno_location` es correcto?

<details><summary>Solución</summary>

```text
errno es thread-local y puede ser macro. En glibc, __errno_location()
devuelve int* del hilo actual. Declarar int errno global rompería hilos
y el linker podría no resolver la relocación PIE.
```

</details>

### Ejercicio 5: lectura parcial

Lees 100 bytes de un archivo de 40 bytes con `read(fd, buf, 100)`:

1. ¿Qué devuelve `read`?
2. ¿Es error?

<details><summary>Solución</summary>

```text
Devuelve 40. No es error. El llamador debe usar solo buf[0..39].
Siguientes read devolverán 0 (EOF).
```

</details>

### Ejercicio 6: strace vs wrapper

`strace` muestra `write(-1, ..., 5) = -1 EBADF`. ¿Qué valor viste realmente en `rax` al salir de `syscall` antes del wrapper?

<details><summary>Solución</summary>

```text
rax = -9 (0xfffffffffffffff7). El wrapper lo convierte a -1 y pone
errno=9. strace decora el -9 como EBADF para legibilidad.
```

</details>

### Ejercicio 7: predicción con demo

Antes de ejecutar `strace -e trace=read,write ./demo` de la clase, predice líneas para `write(1,"hola\n",5)` y `write(-1,"hola\n",5)`.

<details><summary>Solución</summary>

```text
write(1, "hola\n", 5) = 5
write(-1, "hola\n", 5) = -1 EBADF (Bad file descriptor)
La primera es éxito (5), la segunda error negativo decorado.
```

</details>

## Errores frecuentes

- Confundir número de syscall (`rax=1`) con `fd` (`rdi=1`): ambos son 1 en `write(1,...)` pero son registros distintos.
- Usar `rcx` para 4º argumento de syscall (es `r10`).
- Creer que `syscall` preserva `rcx`/`r11`.
- Comparar `rax < 0` con `jl` signed sin entender el rango `-4095`.
- Hacer `extern int errno` en lugar de `__errno_location`.
- Escribir `errno` como 64 bits (`mov [rax], rdi`) en lugar de 32 (`mov dword [rax], edi`).
- Olvidar `wrt ..plt` y romper PIE.
- No preservar el código de error a través de `call __errno_location`.
- Pensar que `read(...,0)==0` es error o que `read` siempre llena el buffer.

## Has aprendido que

- Función C y syscall son capas distintas con convenciones distintas.
- `read=0`, `write=1` en `rax`; args `rdi,rsi,rdx`; destruidos `rcx,r11`.
- El kernel devuelve `-errno` en `[-4095,-1]`; la libc traduce a `-1` + `errno` positivo.
- `errno` es thread-local vía `__errno_location` y `wrt ..plt` para PIE.
- `strace` muestra syscalls, no wrappers.
- `count=0` → `0`, no error; `read` parcial no es error; `0` con `count>0` es EOF.

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre una función C y una syscall?
2. ¿Qué registros usas para `write(1, buf, 5)` antes de `syscall`?
3. ¿Qué destruye `syscall`?
4. ¿Qué números son `read` y `write`?
5. ¿Qué devuelve el kernel en éxito y en error?
6. ¿Por qué el rango `-4095`?
7. ¿Cómo traduce la libc un error del kernel?
8. ¿Por qué `__errno_location` y no `int errno`?
9. ¿Qué hace `wrt ..plt`?
10. ¿Qué muestra `strace -e trace=write`?
11. ¿Qué significa `read(...,0)=0`?

## Criterio de finalización

La clase está completa cuando puedes:

- Escribir los registros de una `write`/`read` antes de `syscall` y decir qué destruye.
- Explicar el flujo `rax negativo → -rax → __errno_location → -1`.
- Distinguir `errno` thread-local y `wrt ..plt`.
- Predecir la salida de `strace` para éxito, `EBADF` y `count=0`.
- Explicar por qué `read` parcial y `count=0` no son errores.

## Siguiente clase

Clase 8: implementar `ft_write` y `ft_read` con el flujo completo de éxito/error, `__errno_location`, preservación de `errno` y verificación comparativa contra libc con `fd=-1`, pipes y `count=0`.

## Lista de lecturas

- `man 2 syscall` — números, convención y retornos.
- `man 2 read`, `man 2 write` — `0` para `count=0`, parcial, EOF.
- `man 3 errno` — thread-local, `errno` como macro.
- `man 1 strace` — `-e trace=read,write`.
- Intel SDM Vol.2 `SYSCALL` — destruye `rcx/r11`.
