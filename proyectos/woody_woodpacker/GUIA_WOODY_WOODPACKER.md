# Guía de aprendizaje y desarrollo de woody_woodpacker

Esta guía traduce el `en.subject.pdf` v2.1 a un itinerario práctico en C/ensamblador para Linux x86-64. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

El objetivo no es copiar un packer línea por línea, sino entender el formato ELF64, cómo el kernel carga un binario, la ABI System V, las syscalls directas y el ciclo completo inyección → cifrado → descifrado en runtime hasta poder explicar cada decisión durante la defensa.

## 1. Qué exige exactamente el proyecto

### Parte obligatoria

Debes entregar un ejecutable llamado `woody_woodpacker` que:

| Requisito del subject | Qué significa en la práctica |
|---|---|
| Un único parámetro: fichero ELF 64 bits | Validar magic `\x7fELF`, `EI_CLASS == ELFCLASS64`, `e_machine == EM_X86_64` |
| Si es 32 bits | Imprimir exactamente `File architecture not suported. x86_64 only` (con la errata del subject) y salir limpio |
| Al ejecutar `./woody_woodpacker <bin>` | Generar un fichero `woody`, imprimir `key_value: <hex>` en stdout |
| Clave | Generada lo más aleatoriamente posible (`/dev/urandom`, no `rand()/time`) |
| Algoritmo | Libre, pero un ROT/XOR trivial con clave fija corta no cuenta como avanzado |
| Al ejecutar `./woody` | Imprimir primero `....WOODY....\n` y luego comportamiento idéntico al original (misma salida, mismo código de retorno, nunca crashear) |
| Makefile | Con reglas apropiadas; si hay ensamblador, con reglas de compilación de `.asm` → `.o` → `.bin` |

### Reglas que pueden invalidar la entrega

- Solo `open, close, exit, lseek, mmap, munmap, mprotect, perror, strerror, syscall` + familia `printf` + tu libft. Otras funciones solo con justificación para bonus.
- Solo se evalúa lo que esté dentro del repositorio entregado.
- La ejecución de `woody` nunca puede crashear, incluso con ficheros retorcidos.

### Bonus

Solo se corrige si la parte obligatoria es excelente:
- Soporte 32 bits, clave parametrizada, optimización del algoritmo en ensamblador, formatos PE/Mach-O, compresión del binario.

## 2. Entorno objetivo y herramientas

- Sistema: Linux x86-64, ELF64.
- Lenguaje: C (+ NASM/GAS opcional para el stub).
- Formato: ELF64, ABI System V AMD64.

| Herramienta | Uso |
|---|---|
| `readelf -h/-l/-S` | Inspeccionar headers, segmentos y secciones |
| `objdump -d/-D -b binary` | Desensamblar y verificar shellcode |
| `objcopy -O binary -j .text` | Extraer bytes puros del stub |
| `xxd`, `hexdump` | Ver bytes crudos y offsets |
| `strace` | Ver `mprotect/write/mmap` del binario empaquetado |
| `gdb` | `break *<e_entry>`, `stepi`, `info registers`, `info proc mappings` |
| `nasm -f elf64` / `as` / `ld` | Toolchain del stub |
| `file`, `cat /proc/sys/kernel/randomize_va_space` | Detectar PIE/ASLR |

## 3. Modelo mental mínimo

### ELF tiene dos vistas

- **Vista de ejecución (segmentos, Program Headers):** lo que el kernel usa en `execve`. Cada `PT_LOAD` se mapea con `mmap` a `p_vaddr` con `p_flags` (R/W/X). Solo esto determina si tu stub se carga y se ejecuta.
- **Vista de enlazado (secciones, Section Headers):** lo que el linker/debugger usa. Útil para localizar `.text` por nombre, pero el kernel la ignora. Un binario stripped puede no tenerla completa.

### `execve` → primera instrucción

`fork+execve` → kernel valida ELF → para cada `PT_LOAD` hace `mmap(p_offset → p_vaddr, p_filesz/p_memsz, p_flags)` → si hay `PT_INTERP` carga el dynamic linker → prepara pila (`argc/argv/envp/auxv`) → salta a `e_entry` (que es `_start`, no `main`).

### ABI System V

6 primeros args en `rdi,rsi,rdx,rcx,r8,r9` (syscall usa `r10` para el 4º), retorno en `rax`, caller-saved `rax,rcx,rdx,rsi,rdi,r8-r11` y callee-saved `rbx,rbp,r12-r15`. `rsp` debe quedar como lo dejó el kernel; para volver al original usa `jmp`, no `call`; alinea la pila a 16 antes de cualquier `call`.

### Stub sin libc

El stub no puede resolver `write@plt`. Usa `syscall` directa: `rax=número, rdi/rsi/rdx/r10/r8/r9=args, syscall`. Para descifrar necesita `mprotect` (addr alineada a página) y direccionamiento `rip`-relativo para funcionar con PIE/ASLR.

## 4. Estrategias de inyección

**A. Extender el último `PT_LOAD`:** ampliar `p_filesz/p_memsz` y añadir `PF_X` si hacía falta. Simple, pero cuida el solapamiento y la alineación `p_vaddr ≡ p_offset (mod 0x1000)`.

**B. Añadir un nuevo `PT_LOAD`:** necesitas hueco en la Program Header Table o moverla al final. Más limpio, más reescritura.

Ambas válidas; documenta y defiende tu elección.

## 5. Cifrado

Evita XOR con clave fija repetida (es el ROT descartado). Recomendado: RC4/stream cipher con KSA+PRGA (mismo bucle cifra/descifra, keystream no repetitivo) o un cifrado por bloques simplificado si quieres más ambición. Clave vía `/dev/urandom`, embebida en el stub (placeholder parcheado por el host en C). Menciona debilidades reales de RC4 y por qué no son críticas aquí (uso de un solo blob, clave de un solo uso).

## 6. PIE y ASLR

`ET_EXEC` = direcciones absolutas; `ET_DYN` = PIE, direcciones relativas a base aleatoria. Todo el direccionamiento del stub debe ser relativo (`lea [rel]`); el salto de vuelta es un offset, nunca una dirección absoluta hardcodeada. Preserva `e_type` del original en `woody`.

## 7. Orden de implementación recomendado

1. Parser ELF que valida magic/clase/arch y vuelca `e_entry` y `PT_LOAD`.
2. Prueba de inyección sin cifrado: añade un segmento o extiende uno y haz que el nuevo `e_entry` apunte a un stub que solo hace `write("....WOODY....")` + `jmp` al original. Verifica con `readelf -l` y `gdb`.
3. Añade `mprotect` y un bucle de descifrado identidad.
4. Sustituye por el algoritmo real (RC4) y la clave aleatoria.
5. Cierra cifrado: cifra `.text` en el host, descifra in situ en el stub, restaura permisos.
6. Endurece errores: 32 bits, no-ELF, sin permisos, sin argumentos, etc.
7. Matriz de pruebas (PIE/no-PIE, estático/dinámico, con/sin args, gcc/clang).
8. Solo entonces, bonus.

## 8. Programa de clases interactivas

Cada sesión sigue el formato general: repaso, explicación con modelo mental, predicciones, ejercicio, implementación conjunta, depuración real, preguntas tipo defensa, resumen y tarea. Itinerario **conceptos primero, código después**: las primeras clases construyen el modelo mental (ELF, carga, ABI) antes de escribir inyección; al final se cierra con toolchain, PIE y auditoría.

- **Clase 1:** formato ELF en profundidad — header, segmentos vs secciones, validación. Resultado: explicar y volcar `e_entry` y `PT_LOAD` de cualquier binario.
- **Clase 2:** cómo carga el kernel un ELF (`execve`, `PT_INTERP`, pila inicial). Resultado: predecir qué mapea el kernel y dónde cae `e_entry`.
- **Clase 3:** ABI System V x86-64 — registros, preservación, alineación, `jmp` vs `call`. Resultado: stub que preserva el estado y vuelve limpio.
- **Clase 4:** syscalls directas — `write`, `mprotect`, `exit`, convención `r10`. Resultado: stub standalone que hace `mprotect→write→exit` sin libc.
- **Clase 5:** algoritmos de cifrado — por qué no ROT, RC4, generación de clave. Resultado: programa C que cifra/descifra y verifica con `diff`.
- **Clase 6:** toolchain ensamblador y shellcode — NASM/GAS, `objcopy`, placeholders. Resultado: `stub.bin` extraído y verificado con `objdump -b binary`.
- **Clase 7:** PIE, ASLR y direccionamiento — `ET_EXEC` vs `ET_DYN`, `rip`-relativo. Resultado: woody funciona con binarios PIE y no-PIE y carga base aleatoria.
- **Clase 8:** testing, debugging y defensa — matriz de pruebas, protocolo `strace/diff`, errores obligatorios. Resultado: parte obligatoria cerrada y defendible.

## 9. Auditoría de la parte obligatoria

No empieces bonus hasta poder responder afirmativamente:

- `make`, `clean`, `fclean`, `re` funcionan y un segundo `make` no hace trabajo innecesario.
- El ejecutable se llama exactamente `woody_woodpacker` y genera exactamente `woody`.
- Imprime `key_value: ...` con clave de `/dev/urandom` y `....WOODY....` al ejecutar `woody`.
- Rechaza 32 bits con el mensaje exacto del subject sin crashear.
- Maneja sin crash: sin args, multi args, no-ELF, sin permisos de lectura/escritura.
- `woody` es idéntico en comportamiento al original (`diff <(./orig) <(./woody | tail -n +2)`, `echo $?`, `strace -f` comparativo).
- Puedes explicar `p_align`, `mprotect` alineado, `rip`-relativo, por qué `jmp`, y por qué tu algoritmo no es un ROT.
- Puedes reconstruir la lógica sin depender de una solución memorizada.

## 10. Cómo pedir la siguiente clase

Puedes iniciar con:

```
Empecemos la clase 1 de woody_woodpacker. No asumo conocimientos previos de ELF.
```

En sesiones posteriores indica qué código has escrito y qué no entiendes. El profesor debe pedirte predicciones y explicaciones, no pegar la solución.

## 11. Referencias

- `en.subject.pdf`, woody_woodpacker v2.1: especificación normativa.
- `man 5 elf`, `/usr/include/elf.h`: estructuras `Elf64_Ehdr/Phdr/Shdr`.
- `man 2 execve`, `man 2 mmap`, `man 2 mprotect`: carga y permisos.
- System V AMD64 ABI (x86-64 ABI): convención de llamada y alineación.
- `man 2 syscall`, `asm/unistd_64.h`, `ausyscall --dump`: números de syscall.
- Herramientas: `readelf(1)`, `objdump(1)`, `objcopy(1)`, `strace(1)`, `gdb(1)`.
- RFC de cifrado/stream ciphers: descripción de RC4 (KSA/PRGA) a nivel conceptual.
