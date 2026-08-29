# Glosario de woody_woodpacker

Este documento reúne las siglas, estructuras, funciones y herramientas que aparecen durante el proyecto. No hace falta memorizarlo de una vez: úsalo como referencia mientras lees código o haces ejercicios.

## ELF y carga

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| ELF | Executable and Linkable Format | Formato de fichero binario de Linux para ejecutables, objetos, librerías y core dumps. |
| `ET_EXEC` | Executable file | Tipo ELF de ejecutable de dirección fija (no-PIE). |
| `ET_DYN` | Shared object / PIE | Tipo ELF para PIE y librerías; direcciones relativas a base de carga. |
| `EM_X86_64` | Machine x86-64 (62) | Valor de `e_machine` que debes validar. |
| `Elf64_Ehdr` | ELF64 Header | Cabecera al inicio del fichero: magic, tipo, máquina, `e_entry`, offsets de tablas. |
| `Elf64_Phdr` | Program Header | Entrada de la Program Header Table: describe un segmento. |
| `Elf64_Shdr` | Section Header | Entrada de la Section Header Table: describe una sección. |
| `PT_LOAD` | Segment type LOAD | Segmento que el kernel mapea en memoria con `mmap`. Solo estos importan para la ejecución. |
| `PF_R/W/X` | Page Flags Read/Write/Execute | Permisos de segmento (4/2/1). |
| `p_vaddr` | Virtual address | Dirección virtual donde se mapea el segmento. |
| `p_offset` | File offset | Offset en el fichero donde empieza el segmento. |
| `p_filesz` | File size | Bytes del segmento en el fichero. |
| `p_memsz` | Memory size | Bytes que ocupa en memoria (puede ser > `p_filesz` por `.bss`, el resto se rellena a cero). |
| `p_align` | Alignment | Normalmente 0x1000; debe cumplirse `p_vaddr ≡ p_offset (mod p_align)`. |
| `e_entry` | Entry point | Dirección virtual de la primera instrucción (`_start`, no `main`). Lo parcheas para apuntar al stub. |
| `PT_INTERP` | Interpreter segment | Si existe, el kernel carga primero el dynamic linker (`ld-linux-x86-64.so.2`). |
| `.text` | Code section | Sección con código ejecutable; habitualmente lo que cifras. |
| `.data/.bss/.rodata` | Data sections | Datos, BSS (ceros), y solo-lectura. |
| Stripped | Sin símbolos | Binario sin tabla de símbolos/secciones completa. |

## ABI y registros

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| ABI | Application Binary Interface | Contrato binario: cómo se pasan args, quién preserva qué, alineación de pila. |
| `rdi,rsi,rdx,rcx,r8,r9` | Argument registers (función C) | Orden de paso de los 6 primeros args enteros/punteros en llamada C. |
| `r10` | 4th syscall arg | En `syscall` el 4º arg va en `r10`, no en `rcx` (la instrucción `syscall` usa `rcx` internamente). |
| `rax` | Return / syscall number | Retorno de función y número de syscall; `al` es su byte bajo. |
| Caller-saved | Volátil | `rax,rcx,rdx,rsi,rdi,r8,r9,r10,r11`: una función puede destruirlos. |
| Callee-saved | Preservado | `rbx,rbp,r12-r15`: si los usas, debes guardarlos y restaurarlos. |
| `rsp` | Stack pointer | Debe quedar como lo dejó el kernel; desalineándolo crasheas. |
| `rip`-relativo | RIP-relative addressing | `lea reg, [rel etiqueta]`: direccionamiento relativo a la IP, funciona con ASLR/PIE. |
| `jmp` vs `call` | Jump vs Call | Para volver al `e_entry` original usa `jmp` (no `call`, que empuja basura en la pila). |

## Syscalls y kernel

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `syscall` | System call | Instrucción x86-64 que entra al kernel; convención `rax=num, rdi/rsi/rdx/r10/r8/r9=args`. |
| `write` (1) | Write | `rdi=fd, rsi=buf, rdx=count`. Para imprimir `....WOODY....`. |
| `mprotect` (10) | Memory protect | `rdi=addr (alineada a página), rsi=len, rdx=prot(RWX)`. Necesaria para descifrar in situ una región `R-X`. |
| `mmap` (9) | Memory map | Mapeo de memoria; el kernel lo usa internamente para `PT_LOAD`. |
| `exit` (60) | Exit | `rdi=código`. Útil en tests del stub. |
| `execve` | Execute program | Syscall que el kernel usa para cargar el ELF: valida headers y mapea `PT_LOAD`. |
| `auxv` | Auxiliary vector | Pares clave/valor en la pila inicial (`AT_PHDR`, `AT_ENTRY`, `AT_PAGESZ`...). |
| NX | No-eXecute | Protección que impide ejecutar una página sin `PF_X`. Por eso ajustas permisos. |

## Cifrado

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| ROT | Rotation | Cifrado trivial por desplazamiento; explícitamente descartado como "avanzado". |
| XOR | Exclusive OR | Operación base de muchos stream ciphers; sola con clave fija corta es trivial por análisis de frecuencia. |
| RC4 | Rivest Cipher 4 | Stream cipher con KSA+PRGA que genera keystream no repetitivo; recomendado por equilibrio dificultad/defendibilidad. |
| KSA | Key Scheduling Algorithm | Fase de RC4 que permuta `S[256]` con la clave. |
| PRGA | Pseudo-Random Generation Algorithm | Fase de RC4 que genera el keystream byte a byte (`i,j` sobre `S`). |
| Keystream | Flujo de clave | Bytes pseudoaleatorios que se hacen XOR con los datos; cifrar y descifrar son la misma operación. |
| `/dev/urandom` | Random device | Fuente de bytes con entropía del kernel; genera la clave de un solo uso. |
| Payload/Blob | Datos cifrados | Rango de bytes (típicamente `.text`) que el host cifra y el stub descifra. |

## Toolchain y formatos

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| NASM | Netwide Assembler | Ensamblador Intel syntax (`-f elf64`). |
| GAS | GNU Assembler | Ensamblador AT&T syntax (`as`). |
| `objcopy -O binary` | Object copy | Extrae bytes puros de `.text` a `stub.bin` (shellcode inyectable). |
| `objdump -D -b binary` | Object dump | Vuelve a desensamblar `stub.bin` para verificarlo. |
| Shellcode | Código inyectable | Bytes de máquina puros sin headers, listos para copiar al ELF. |
| Placeholder | Hueco reservado | Zona a cero en `stub.bin` que el host parchea con clave/longitud/e_entry. |
| `xxd -i` | Hex dump to C | Genera un array C desde `stub.bin` para embeberlo. |
| `ld` | Linker | Enlaza `stub.o` a ELF de prueba standalone. |
| PIE | Position Independent Executable | `ET_DYN` con direcciones relativas; por defecto en gcc/clang modernos. |
| ASLR | Address Space Layout Randomization | El kernel elige la base de carga aleatoria para PIE; observado con `info proc mappings`. |

## Herramientas de verificación

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `readelf -h/-l/-S` | Read ELF | Vuelca header, segmentos y secciones. |
| `strace` | System call trace | Muestra `mprotect/write/exit` reales del binario empaquetado. |
| `gdb` | GNU Debugger | `break *addr`, `stepi`, `info registers`, `info proc mappings`. |
| `file` | File type | Dice `ELF 64-bit LSB executable, x86-64` y si es PIE. |
| `cat -A`, `diff` | Verify output | Compara `./original` vs `./woody | tail -n +2` y códigos de retorno. |
| ASan/Valgrind | Sanitizers | Detectan accesos fuera de límites en el host (no en el stub). |

## Regla de lectura

Cuando leas una función o estructura nueva, pregúntate:

1. ¿Qué campo o registro toca y en qué orden?
2. ¿Qué dirección/offset lee o escribe y con qué permisos?
3. ¿Es una dirección absoluta o relativa a base? ¿Necesito `rip`-relativo?
4. ¿Puede fallar? ¿Cómo se detecta y cómo se sale sin crashear?
