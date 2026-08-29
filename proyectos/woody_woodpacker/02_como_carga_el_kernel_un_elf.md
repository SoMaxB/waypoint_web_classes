# Cómo carga el kernel un ELF (`execve`)

*Guía de estudio para woody_woodpacker (42) — por qué el binario se ejecuta como se ejecuta*

## 1. Por qué necesitáis entender esto

El parser de ELF os dice *qué hay* en el fichero. Esta parte os dice *qué hace el kernel con ello*, que es lo que determina si vuestro binario modificado se ejecuta igual que el original o revienta. La regla que vais a comprobar una y otra vez durante el proyecto es: **el kernel solo mira la Program Header Table. Las secciones, los símbolos, todo eso, le da absolutamente igual.**

## 2. El camino de `execve` a "primera instrucción ejecutada"

Cuando alguien hace `./woody`:

1. El shell hace `fork()` + `execve("./woody", argv, envp)`.
2. El kernel lee el ELF header del fichero, valida el magic number y la arquitectura.
3. El kernel recorre la Program Header Table y, **para cada entrada `PT_LOAD`**, hace algo equivalente a un `mmap`:
   - Mapea `p_filesz` bytes desde `p_offset` del fichero a la dirección virtual `p_vaddr`.
   - Si `p_memsz > p_filesz` (típico en el segmento de datos por culpa de `.bss`), rellena el resto con ceros hasta `p_memsz`.
   - Aplica los permisos de `p_flags` (R/W/X) a esas páginas.
4. Si hay un segmento `PT_INTERP`, el kernel en realidad carga **el intérprete** (normalmente `/lib64/ld-linux-x86-64.so.2`, el dynamic linker) y le pasa el control a él primero, no directamente a vuestro `e_entry`. El dynamic linker resuelve las librerías dinámicas (`libc.so`, etc.) y **luego** salta a `e_entry`.
5. Se prepara la pila inicial: `argc`, `argv[]`, `envp[]`, y el **auxiliary vector** (`auxv`) — un conjunto de pares clave/valor que el kernel deja en la pila con información como `AT_PHDR` (dirección de la Program Header Table en memoria), `AT_ENTRY`, `AT_PAGESZ`, etc. El dynamic linker y la libc los usan al arrancar.
6. Finalmente, la CPU salta a `e_entry` (o al entry point del intérprete si lo hay), con `rip = e_entry`.

## 3. Consecuencias directas para vuestro proyecto

- **Solo os importan los `PT_LOAD`.** Si vuestro stub no está dentro de un segmento `PT_LOAD` marcado como ejecutable, el kernel nunca lo mapeará como código ejecutable y no se llegará a ejecutar (o dará *segfault* por permisos).
- **La alineación a página no es opcional.** El kernel mapea páginas completas (típicamente 4 KB). Por eso `p_vaddr` y `p_offset` deben coincidir módulo `p_align`: el kernel calcula la dirección de inicio de página a partir de `p_vaddr`, y necesita que el offset del fichero "cuadre" con eso.
- **`p_memsz > p_filesz` es zero-fill, no un bug.** Si estáis extendiendo un segmento existente añadiendo vuestro stub al final, tenéis que respetar que la parte "extra" de memoria (si la hay) se pone a cero — no podéis simplemente sumar bytes sin pensar en qué offset de memoria caen.
- **Permisos R/W/X reales.** Si el segmento donde metéis el código cifrado no tiene `PF_X`, no se ejecutará nada ahí (protección NX del hardware). Si vuestro stub necesita escribir sobre una región marcada solo `R-X` para descifrarla in situ, **por eso necesitáis `mprotect` en runtime** (lo veréis en la guía de syscalls): el kernel os dio esos permisos al cargar, pero podéis pedir cambiarlos después.
- **Si hay `PT_INTERP` / es un binario dinámico**, el orden de ejecución real es: kernel → dynamic linker → vuestro stub (si parcheáis `e_entry`) → entry point original de la libc (`_start`) → `main`. Aseguraos de que vuestro salto de "vuelta" apunta al `e_entry` **original** del binario (antes de que vosotros lo modificarais), no al del intérprete.

## 4. El "entry point" no es `main`

Un malentendido común: `e_entry` no apunta a `main()`, apunta a `_start` (símbolo definido por el runtime de C, en `crt1.o`), que hace el setup de la libc (inicializar `argc`/`argv`, registrar `__libc_csu_init`, etc.) y **luego** llama a `main`. Esto es relevante porque:

- Cuando guardáis "el entry point original" para saltar de vuelta desde vuestro stub, estáis saltando a `_start`, no a `main` — y eso está bien, es justo lo que queréis: que el arranque normal del binario ocurra exactamente igual que si nunca hubiera pasado por vuestro packer.

## 5. Ejercicio práctico recomendado

Con `gdb` sobre un binario simple (el `sample` del enunciado):

```bash
gdb ./sample
(gdb) info file          # veréis las secciones y sus direcciones
(gdb) break *<e_entry>   # poned un breakpoint en la dirección de e_entry (sacada con readelf -h)
(gdb) run
(gdb) x/5i $pc           # ver las primeras instrucciones ejecutadas realmente
```

Comprobad que la dirección donde para el breakpoint coincide con `e_entry` de `readelf -h`, y que las primeras instrucciones son código de arranque de la libc (`_start`), no vuestro `main`. Repetid el ejercicio explicándoos mutuamente qué está pasando en cada paso — es la mejor forma de detectar si alguno de los dos tiene un hueco conceptual antes de que os cueste horas de debugging más adelante.
