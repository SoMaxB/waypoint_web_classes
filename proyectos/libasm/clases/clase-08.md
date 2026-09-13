# Clase 8: `ft_write`, `ft_read` y `errno`

## Objetivo

Implementar los dos wrappers de syscall que deben **replicar exactamente** el retorno y `errno` de libc. Al terminar debes poder explicar por qué el kernel devuelve `-EBADF`, cómo lo conviertes en `-1` y `errno=9`, por qué necesitas `__errno_location` con `wrt ..plt` y pila alineada, y demostrar con `strace` y tester comparativo que éxito, `count=0`, parcial, EOF y errores reales coinciden con `write(2)`/`read(2)`.

Esta clase cierra la frontera usuario/kernel abierta en la 7.

## 1. Contratos

```c
ssize_t ft_write(int fd, const void *buf, size_t count);
ssize_t ft_read(int fd, void *buf, size_t count);
```

ABI: `rdi=fd, rsi=buf, rdx=count` (ya en registros de syscall), retorno `rax` (`ssize_t`).

Números:

```text
read  = 0
write = 1
```

No es una función de cadenas: `read` no añade `\0`, puede leer ceros binarios.

## 2. Flujo completo

```text
ft_write:
  rax = 1, syscall
  si rax >=0 → ret (éxito, incluso 0)
  si rax <0  → rax = -rax (errno positivo)
               guardar errno
               rax = __errno_location()  // int*
               *rax = errno guardado (32 bits)
               rax = -1, ret

ft_read: igual con rax = 0
```

Rango kernel `-4095..-1`. Para `read/write`, comprobar `rax <0` basta (`jl`/`js`) porque un éxito nunca es negativo; el rango completo importa en defensa.

`syscall` destruye `rcx`/`r11`. No los uses después sin guardar.

## 3. `errno` thread-local y PLT

`errno` no es `int errno` global. En glibc:

```c
int *__errno_location(void); // thread-local
```

En NASM ELF64 PIE:

```nasm
extern __errno_location
call __errno_location wrt ..plt ; rax = int*
mov dword [rax], edi            ; *errno = errno (32 bits)
```

- `wrt ..plt` genera relocación `R_X86_64_PLT32` compatible con PIE (prohibido `-no-pie`).
- Debes preservar el código de error a través del `call` (caller-saved). Usa pila o `rbx/r12-r15` con `push/pop`.
- Escribir `dword` (32 bits), no `qword`: `errno` es `int`.

Alineación: al entrar `rsp%16==8`. `push rax` deja `rsp%16==0` antes de `call`, como exige la ABI. No desequilibres `push`/`pop` antes de `ret`.

## 4. Implementación `ft_write`

```nasm
default rel
section .text
global ft_write
extern __errno_location
ft_write:
    mov     rax, 1
    syscall
    cmp     rax, 0
    jl      .error
    ret
.error:
    neg     rax
    push    rax
    call    __errno_location wrt ..plt
    pop     rdi
    mov     dword [rax], edi
    mov     rax, -1
    ret
section .note.GNU-stack noalloc noexec nowrite progbits
```

`objdump -dr`:

```text
mov $0x1,%eax; syscall; cmp $0x0,%rax; jl error
neg %rax; push %rax; call __errno_location; pop %rdi; mov %edi,(%rax); mov $-1,%rax; ret
reloc R_X86_64_PLT32 __errno_location
```

`nm -g ft_write.o` → `T ft_write, U __errno_location`.

## 5. Implementación `ft_read`

Identica, cambia número:

```nasm
mov rax, 0
syscall
...
```

No conviertas `read` en `strlen`: solo los bytes indicados por el retorno son válidos, y `read` puede devolver menos de `count` (parcial) sin ser error; `0` con `count>0` es `EOF`.

## 6. Verificación

Compilar:

```sh
nasm -f elf64 -g -F dwarf ft_write.s -o ft_write.o
nasm -f elf64 -g -F dwarf ft_read.s -o ft_read.o
cc -Wall -Wextra -Werror -g main.c ft_write.o ft_read.o -o tester
readelf -h tester # Tipo DYN (PIE)
nm -g ft_write.o ft_read.o
objdump -dr ft_*.o
strace -e trace=read,write ./tester
```

Matriz mínima:

| Función | Éxito | Límite | Error/propiedad |
|---|---|---|---|
| `ft_write` | archivo/pipe, 5 bytes =5 | `count=0 →0` | `fd=-1 → -1 errno 9` |
| `ft_read` | archivo/pipe, 5/11 bytes | `count=0 →0`, parcial 11/100 | `fd=-1 → -1 errno 9`, EOF →0 |

Comparar **inmediatamente** retorno y `errno` tras cada par `write`/`ft_write`; cualquier `printf` intermedio cambia `errno`. Usa `strace` para ver syscalls reales.

## Predicciones y ejercicios

### Ejercicio 1: registros write

`write(1, buf=0x6000, 5)` → ¿`rax/rdi/rsi/rdx` antes de `syscall`?

<details><summary>Solución</summary>

```text
rax=1, rdi=1, rsi=0x6000, rdx=5; syscall destruye rcx/r11
```

</details>

### Ejercicio 2: flujo EBADF

`write(-1, buf, 5)` → kernel `-9`.

<details><summary>Solución</summary>

```text
syscall rax=-9 → jl .error → neg rax (9) → push → call __errno_location
→ pop rdi (9) → mov dword [rax], edi → rax=-1 → ret
libc y ft: ret -1 errno 9
```

</details>

### Ejercicio 3: count cero

`write(fd_valido, buf, 0)` y `read(fd_valido, buf, 0)` → ¿retorno?

<details><summary>Solución</summary>

```text
Ambos 0, éxito, errno no tocado. No es error.
```

</details>

### Ejercicio 4: lectura parcial

Archivo 11 bytes, `read(fd, buf, 100)` → ¿retorno?

<details><summary>Solución</summary>

```text
11, no error. Solo buf[0..10] válido. Siguiente read → 0 (EOF).
```

</details>

### Ejercicio 5: errno 32 bits

¿Por qué `mov dword [rax], edi` y no `mov [rax], rdi`?

<details><summary>Solución</summary>

```text
errno es int (32 bits). mov qword escribiría 8 bytes y pisaría memoria.
```

</details>

### Ejercicio 6: PLT

¿Qué hace `wrt ..plt`?

<details><summary>Solución</summary>

```text
Genera relocación PLT32 compatible con PIE. Sin él, el linker daría
relocación incompatible con PIE (prohibido -no-pie).
```

</details>

### Ejercicio 7: pila

Al entrar `rsp%16==8`. ¿Por qué `push rax` antes de `call`?

<details><summary>Solución</summary>

```text
push deja rsp%16==0, que es lo que exige la ABI antes de call.
call empuja 8 y deja callee en 8, equilibrado tras pop+ret.
```

</details>

## Errores frecuentes

- Usar `rcx` para 4º arg de syscall (es `r10`).
- Creer que `syscall` preserva `rcx/r11`.
- `extern int errno` en vez de `__errno_location`.
- Escribir `qword` en `errno`.
- Olvidar `wrt ..plt` o romper PIE con `-no-pie`.
- No preservar `errno` a través de `call` (caller-saved).
- Desalinear pila (`push` sin `pop`).
- Tratar `count=0` o parcial como error.
- Comparar `errno` tras `printf` intermedio.

## Has aprendido que

- `ft_write`/`ft_read` son wrappers: `rax=número → syscall → rax`.
- Éxito `>=0`, error `-errno` en `[-4095,-1]`, `jl .error` basta aquí.
- `neg rax → push → call __errno_location wrt ..plt → mov dword [rax],edi → -1`.
- `errno` es thread-local, 32 bits, `wrt ..plt`, pila alineada.
- `strace` ve syscalls; `write(-1)=-1 EBADF` es `rax=-9` decorado.
- `count=0 →0`, parcial no es error, `0` con `count>0` es EOF.

## Preguntas tipo defensa

1. ¿Qué número pones en `rax` para `read`/`write`?
2. ¿Qué registros destruye `syscall`?
3. ¿Qué devuelve el kernel en éxito/error?
4. ¿Cómo traduce la libc `-9`?
5. ¿Por qué `__errno_location` y no `int errno`?
6. ¿Qué hace `wrt ..plt`?
7. ¿Por qué `push rax` antes de `call`?
8. ¿Por qué `dword [rax], edi`?
9. ¿Qué devuelve `write(fd, buf, 0)`?
10. ¿Qué significa `read` parcial y `EOF`?
11. ¿Cómo verificas PIE y `T ft_write`?

## Criterio de finalización

La clase está completa cuando puedes:

- Escribir ambos `.s` de memoria con flujo completo y explicar cada registro.
- Explicar `neg/push/call/pop/mov dword/-1` y alineación.
- Pasar matriz comparativa `write`/`read` (éxito, 0, parcial, EOF, fd=-1) con igualdad de `ret` y `errno` vs libc.
- Demostrar `readelf -h` DYN, `nm T`, `objdump R_X86_64_PLT32`, `strace`.

## Siguiente clase

Clase 9: `ft_strdup` — `malloc`, preservación de puntero a través de `call`, alineación y ownership; copia independiente sin fugas.

## Lista de lecturas

- `man 2 read`, `man 2 write` — 0, parcial, EOF, errores.
- `man 3 errno` — thread-local.
- `man 2 syscall` — números, convención, `rcx/r11`.
- `man 1 strace`, `man 1 readelf`, `man 1 nm`.
