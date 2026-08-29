# Syscalls directas en x86-64

*Guía de estudio para woody_woodpacker (42) — cómo hablar con el kernel sin libc desde el stub*

## 1. Por qué el stub no puede usar libc

Vuestro stub se inyecta como **bytes crudos** dentro del binario empaquetado; no pasa por el linker, no tiene tabla de símbolos, no puede resolver `write@plt` ni nada de eso. Si necesita escribir en pantalla, cambiar permisos de memoria o terminar el programa, tiene que pedírselo directamente al kernel mediante la instrucción `syscall`. Esto es justo lo que ya sabéis hacer con `syscall()` en C del common core, solo que ahora lo escribís vosotros mismos en ensamblador.

## 2. Mecanismo de la instrucción `syscall`

```asm
mov rax, <número de syscall>
mov rdi, <arg1>
mov rsi, <arg2>
mov rdx, <arg3>
mov r10, <arg4>   ; ojo: r10, no rcx (syscall usa rcx internamente)
mov r8,  <arg5>
mov r9,  <arg6>
syscall
; resultado en rax
```

El número de syscall (`rax`) se define en `<asm/unistd_64.h>` (o consultad `ausyscall x86_64 --dump` / la tabla de syscalls de x86-64). Los que necesitaréis casi seguro:

| Syscall     | Número (x86-64) | Argumentos                                              |
|-------------|------------------|-----------------------------------------------------------|
| `write`     | 1                | `rdi`=fd, `rsi`=buf, `rdx`=count                         |
| `mmap`      | 9                | `rdi`=addr, `rsi`=len, `rdx`=prot, `r10`=flags, `r8`=fd, `r9`=offset |
| `mprotect`  | 10               | `rdi`=addr, `rsi`=len, `rdx`=prot                        |
| `munmap`    | 11               | `rdi`=addr, `rsi`=len                                    |
| `exit`      | 60               | `rdi`=código de salida                                   |
| `open`      | 2                | `rdi`=path, `rsi`=flags, `rdx`=mode                      |
| `read`      | 0                | `rdi`=fd, `rsi`=buf, `rdx`=count                         |
| `close`     | 3                | `rdi`=fd                                                  |

## 3. Convención de retorno y manejo de error

`rax` contiene el resultado. Si es un valor negativo (interpretado como entero con signo, típicamente entre -1 y -4095), es un código de error negado (`-errno`), igual que hace la libc internamente antes de setear la variable global `errno`. En asm crudo no tenéis `errno`; si os hace falta comprobar error, comparad `rax` contra 0 y ramificad manualmente.

## 4. `write` — imprimir `....WOODY....\n` sin libc

```asm
; rdi = 1 (stdout), rsi = puntero al string, rdx = longitud
section .rodata
msg: db "....WOODY....", 0x0a
msg_len: equ $ - msg

section .text
mov rax, 1        ; syscall write
mov rdi, 1         ; fd = stdout
lea rsi, [rel msg] ; dirección del string (rip-relativa, importante si el binario es PIE)
mov rdx, msg_len
syscall
```

Usad direccionamiento `rip`-relativo (`lea reg, [rel etiqueta]`) para que funcione sin importar en qué dirección haya cargado el kernel vuestro segmento — imprescindible si el binario resultante es PIE o si no controlláis la dirección de carga final.

## 5. `mprotect` — la pieza clave para poder descifrar in situ

El segmento donde vive vuestro código cifrado probablemente tiene permisos `R-X` (lectura + ejecución, sin escritura — es lo normal para un segmento de código, y es buena práctica de seguridad que el kernel os lo dé así). Para poder sobrescribir esos bytes con la versión descifrada, necesitáis pedir permiso de escritura temporalmente:

```asm
; mprotect(addr, len, PROT_READ|PROT_WRITE|PROT_EXEC)
mov rax, 10          ; syscall mprotect
mov rdi, <addr>       ; debe estar alineado a página
mov rsi, <len>
mov rdx, 7            ; PROT_READ(1) | PROT_WRITE(2) | PROT_EXEC(4)
syscall
```

⚠️ `addr` debe estar alineado al tamaño de página (normalmente 0x1000) — si vuestro segmento cifrado no empieza exactamente en un límite de página, tenéis que redondear `addr` hacia abajo al múltiplo de página anterior y ajustar `len` en consecuencia para cubrir todo el rango.

Flujo típico del stub:
1. `mprotect` para añadir `PROT_WRITE` a la región cifrada.
2. Bucle de descifrado (leer byte/bloque cifrado, aplicar el algoritmo inverso, escribir el resultado en el mismo sitio).
3. `mprotect` de nuevo para dejar los permisos como estarían en el binario original (típicamente quitar `PROT_WRITE`, dejando solo `R-X`) — no es estrictamente obligatorio para que funcione, pero es más correcto y más defendible.
4. `write` del banner `....WOODY....` (podéis hacerlo antes del descifrado, como pide el enunciado, para indicar "esto está cifrado" incluso si técnicamente ya lo estáis descifrando ahí mismo).
5. `jmp` al entry point original.

## 6. Bucle de descifrado — ejemplo con XOR simple (adaptad al algoritmo real que elijáis)

```asm
; rdi = puntero a datos, rcx = longitud, la clave está en algún buffer conocido
decrypt_loop:
    mov al, [rdi]
    xor al, <byte de clave correspondiente>
    mov [rdi], al
    inc rdi
    loop decrypt_loop   ; decrementa rcx y salta si rcx != 0
```

Esto es solo ilustrativo de la mecánica (leer, transformar, escribir, avanzar puntero). Recordad que el enunciado pide algo más sofisticado que un XOR/ROT fijo para que cuente como "algoritmo avanzado" en la evaluación — pero la estructura del bucle en asm es la misma independientemente del algoritmo elegido.

## 7. `exit` — terminar sin pasar por libc (si hiciera falta en algún punto de prueba)

```asm
mov rax, 60   ; syscall exit
xor rdi, rdi  ; código de salida 0
syscall
```

No debería haceros falta en el flujo normal (el stub termina con un `jmp` al entry point original, que es el que eventualmente llama a `exit`), pero es útil tenerlo a mano mientras depuráis el stub de forma aislada.

## 8. Herramientas para verificar lo que generáis

```bash
strace ./woody          # ver exactamente qué syscalls hace en runtime, en orden
objdump -d woody         # comprobar que el stub ensambla a lo que creéis que ensambla
gdb ./woody
(gdb) break *<addr_stub>
(gdb) stepi               # ejecutar instrucción a instrucción dentro del stub
(gdb) info registers      # comprobar valores de registros en cada paso
```

`strace` es especialmente valioso aquí: os deja ver la secuencia real de `mprotect`/`write`/etc. que hace vuestro binario empaquetado, comparado con lo que esperabais escribir.

## 9. Ejercicio recomendado

Antes de integrarlo en el packer completo, escribid el stub como un **binario standalone independiente** (ensambladlo y enlazadlo con `ld`, sin libc, con su propio `_start`) que haga exactamente la secuencia `mprotect` → bucle de "descifrado" (probad primero con una identidad, sin cifrar nada) → `write` del banner → `exit`. Ejecutadlo con `strace` y comprobad que las syscalls y sus argumentos son los que esperabais. Solo cuando esto funcione de forma aislada tiene sentido inyectarlo dentro del ELF real.
