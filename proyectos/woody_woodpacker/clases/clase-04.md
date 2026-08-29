# Clase 4: syscalls directas x86-64

## Objetivo

Hacer que el stub hable con el kernel sin libc, usando la instrucción `syscall`. Al terminar debes escribir un stub standalone que haga `mprotect → write("....WOODY....") → jmp` (o `exit` en pruebas) con argumentos y alineación correctos, y verificarlo con `strace` y `gdb` paso a paso.

## 1. Por qué no hay libc en el stub

El stub son bytes crudos inyectados; no pasa por el linker ni resuelve `write@plt`. Para escribir, cambiar permisos o terminar, debe pedirlo al kernel directamente.

## 2. Mecanismo `syscall`

```asm
mov rax, <número>
mov rdi, <arg1>
mov rsi, <arg2>
mov rdx, <arg3>
mov r10, <arg4>   ; r10, no rcx
mov r8,  <arg5>
mov r9,  <arg6>
syscall            ; resultado en rax
```

Números clave (x86-64, `<asm/unistd_64.h>`):

| Syscall | Nº | Args |
|---|---|---|
| `read` | 0 | `rdi=fd, rsi=buf, rdx=count` |
| `write` | 1 | `rdi=fd, rsi=buf, rdx=count` |
| `open` | 2 | `rdi=path, rsi=flags, rdx=mode` |
| `close` | 3 | `rdi=fd` |
| `mmap` | 9 | `rdi=addr, rsi=len, rdx=prot, r10=flags, r8=fd, r9=off` |
| `mprotect` | 10 | `rdi=addr, rsi=len, rdx=prot` |
| `munmap` | 11 | `rdi=addr, rsi=len` |
| `exit` | 60 | `rdi=código` |

Retorno: `rax` con resultado; si está entre `-1` y `-4095` (como signed), es `-errno`. En asm crudo no hay `errno`, comparas tú.

## 3. `write` sin libc

```asm
section .rodata
msg: db "....WOODY....", 0x0a
msg_len: equ $ - msg

section .text
mov rax, 1
mov rdi, 1
lea rsi, [rel msg]   ; rip-relativo
mov rdx, msg_len
syscall
```

Usa siempre `lea [rel etiqueta]`.

## 4. `mprotect` — la pieza clave

El `.text` suele ser `R-X`. Para descifrar in situ:

```asm
mov rax, 10
mov rdi, <addr_alineada_a_pagina>
mov rsi, <len>
mov rdx, 7          ; PROT_READ|PROT_WRITE|PROT_EXEC
syscall
```

`addr` debe estar alineada a `0x1000`: redondea hacia abajo y ajusta `len` para cubrir todo el rango. Flujo típico: `mprotect(RWX) → bucle descifrado → mprotect(RX) → write → jmp orig_entry`. El segundo `mprotect` no es estrictamente obligatorio pero es más correcto.

## 5. Bucle de descifrado (esqueleto)

```asm
; rdi = ptr datos, rcx = len
decrypt_loop:
    mov al, [rdi]
    xor al, <keystream byte>
    mov [rdi], al
    inc rdi
    loop decrypt_loop   ; dec rcx, jnz
```

Cámbiale el `xor` por tu algoritmo real; la estructura del bucle es la misma.

## 6. `exit` para pruebas aisladas

```asm
mov rax, 60
xor rdi, rdi
syscall
```

No lo usas en el flujo normal (termina en `jmp`), pero es útil para probar el stub standalone.

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué registro rompe la syscall `mprotect`?

Haces `mov rcx, <len>` y `mov r10, rcx` antes de `syscall`. ¿Por qué no `mov rcx, <len>` directo como 4º arg?

<details><summary>Solución</summary>

Porque `syscall` destruye `rcx` (lo usa para guardar `rip` de retorno) y `r11`. El 4º arg de syscall es `r10`; si lo pones en `rcx` el kernel no lo ve.

</details>

### Ejercicio 2 — alineación de `mprotect`

Tu `.text` empieza en `p_vaddr = 0x401023`, len `0x1234`. ¿Qué pasas a `mprotect`?

<details><summary>Solución</summary>

`addr = 0x401000` (redondeo hacia abajo a página) y `len = 0x1234 + (0x401023-0x401000) = 0x1257` redondeado hacia arriba a página si quieres cubrir páginas completas: `0x2000`. Pasar `0x401023` directo da `EINVAL`.

</details>

### Ejercicio 3 — stub standalone mínimo

Escribe un stub que solo haga `mprotect` identidad (sin cifrar), `write` del banner y `exit(0)`. Ensámblalo, ejecútalo con `strace` y verifica orden y args.

<details><summary>Solución</summary>

Debe verse `mprotect(0x..., 4096, PROT_READ|PROT_WRITE|PROT_EXEC)=0`, `write(1, "....WOODY....\n", 14)=14`, `exit(0)`. Si ves `EPERM` o `EFAULT`, revisa alineación y `lea [rel]`.

</details>

### Ejercicio 4 — `strace` vs expectativa

`strace ./woody` muestra `mprotect` con `addr=0x7f...` y `len=0x2000`. ¿De dónde sale `0x7f...` si tu `p_vaddr` era `0x400000`?

<details><summary>Solución</summary>

Es la dirección real tras ASLR (PIE). El kernel eligió una base aleatoria; tu stub calculó la addr como `orig_base + offset` o usó la addr ya reubicada. Lo importante es que sea la del segmento que contiene `.text`, en esa ejecución concreta.

</details>

## Errores frecuentes

- Usar `rcx` en vez de `r10` para el 4º arg.
- Pasar addr no alineada a `mprotect` → `EINVAL`.
- Usar dirección absoluta para `msg` → falla con PIE.
- Olvidar que `syscall` destruye `rcx/r11` y asumir que siguen intactos.
- Dejar `mprotect` con `RWX` en lugar de restaurar `RX` (menos grave, pero defendible).

## Has aprendido que

- El stub usa `syscall` con `rax=num, rdi/rsi/rdx/r10/r8/r9`.
- `write(1, buf, len)` y `mprotect(addr,len,7)` son tus dos syscalls críticas.
- `mprotect` exige página alineada; hay que redondear.
- `rip`-relativo es obligatorio para datos.
- `strace` es tu oráculo de "qué hizo realmente" vs "qué creías que haría".

## Preguntas tipo defensa

1. ¿Qué registros destruye `syscall` y qué implica para el 4º argumento?
2. ¿Por qué `mprotect` falla si `addr` no está alineada?
3. ¿Cómo imprimes `....WOODY....` sin libc y por qué `lea [rel]`?
4. ¿Cuál es el flujo `mprotect → descifrado → mprotect → write → jmp` y por qué ese orden?
5. ¿Cómo depuras el stub con `strace` y `gdb stepi`?

## Criterio de finalización

- Stub standalone ensambla, se extrae con `objcopy` y `strace` muestra `mprotect/write/exit` con args correctos.
- Explicas sin mirar el código por qué `r10` y por qué alineas.
- Distingues el caso PIE (addr con ASLR) del `ET_EXEC`.

## Siguiente clase

La clase 5 elige el algoritmo que el stub descifrará: por qué un XOR fijo no vale y cómo implementar RC4 con clave de `/dev/urandom`.

## Lecturas

- `man 2 write`, `man 2 mprotect`, `man 2 mmap` — prototipos y `errno`.
- `asm/unistd_64.h` o `ausyscall x86_64 --dump` — tabla de números.
- `strace(1)` y `gdb` `stepi` / `info registers`.
