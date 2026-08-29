# Clase 2: cómo carga el kernel un ELF (`execve`)

## Objetivo

Entender qué hace el kernel desde `execve("./woody")` hasta la primera instrucción en `e_entry`. Al terminar debes poder explicar por qué el kernel solo mira segmentos, cómo `mmap`ifica cada `PT_LOAD`, qué cambia cuando hay `PT_INTERP`, y por qué el salto de vuelta del stub debe ir a `_start` y no a `main`.

## 1. De `execve` a `rip = e_entry`

1. El shell hace `fork() + execve("./woody", argv, envp)`.
2. El kernel lee el ELF header, valida magic y arquitectura.
3. Para cada `PT_LOAD`, hace el equivalente a `mmap(p_offset, p_filesz → p_vaddr, p_flags)`. Si `p_memsz > p_filesz` (`.bss`), rellena a ceros.
4. Si hay `PT_INTERP` (típicamente `/lib64/ld-linux-x86-64.so.2`), carga **el intérprete** y le da el control a él primero; el linker resuelve librerías y luego salta a `e_entry`.
5. Prepara la pila: `argc`, `argv[]`, `envp[]` y el **auxiliary vector** (`auxv`: `AT_PHDR`, `AT_ENTRY`, `AT_PAGESZ`...).
6. `rip = e_entry` (o el del intérprete, que acabará saltando ahí).

## 2. Consecuencias para tu packer

- **Solo importan los `PT_LOAD`.** Si tu stub no está en uno ejecutable, nunca se mapeará como código.
- **Alineación a página no es opcional:** el kernel mapea páginas de 4 KiB; `p_vaddr/p_offset` deben compartir resto módulo `p_align`.
- **`p_memsz > p_filesz` es zero-fill, no un bug.** Si extiendes un segmento, respeta que la cola es memoria a ceros, no bytes que copias del fichero.
- **Permisos reales R/W/X:** si metes el código cifrado en `R-X`, necesitarás `mprotect` en runtime para descifrar in situ.
- **Con `PT_INTERP`:** kernel → dynamic linker → tu stub (si parcheaste `e_entry`) → `_start` original → `main`. Guarda el `e_entry` **original** antes de parchear.

## 3. El entry point no es `main`

`e_entry` apunta a `_start` (`crt1.o`), que inicializa la libc y luego llama a `main`. Cuando guardas "entry original", guardas `_start` — y está bien: quieres que el arranque ocurra exactamente igual que sin packer.

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué pasa si el stub no está en un `PT_LOAD`?

Colocas tu stub justo después del EOF, fuera de todo `PT_LOAD`, y cambias `e_entry` para que apunte ahí. ¿Se ejecuta?

<details><summary>Solución</summary>

No. El kernel solo mapea lo descrito por `PT_LOAD`. Esos bytes extra nunca se cargan; `rip` apuntaría a memoria no mapeada → segfault inmediato.

</details>

### Ejercicio 2 — ¿por qué necesitarás `mprotect`?

El `.text` original vive en un `PT_LOAD` con `R E` (sin `W`). Tu stub quiere sobrescribirlo descifrando. ¿Qué pasa sin `mprotect`?

<details><summary>Solución</summary>

Falta permiso de escritura en esas páginas (`PF_W` no está). Escribir ahí da `SIGSEGV` por violación de NX/W^X. Con `mprotect(addr,pagesz,PROT_READ|PROT_WRITE|PROT_EXEC)` añades `W` temporalmente.

</details>

### Ejercicio 3 — gdb sobre `sample`

```bash
gdb ./sample
(gdb) info file
(gdb) break *<e_entry>   # sácalo de readelf -h
(gdb) run
(gdb) x/5i $pc
```

¿Las primeras instrucciones son de `main` o de `_start`?

<details><summary>Solución</summary>

Son de `_start` (código de arranque de la libc que prepara `argc/argv` y llama a `__libc_start_main`). `main` aparece después en el backtrace.

</details>

### Ejercicio 4 — `strace` comparativo

`strace ./sample` vs `strace ./woody`. ¿Qué syscalls extra ves al inicio de `woody`?

<details><summary>Solución</summary>

Las de tu stub: `mprotect` (para descifrar) y `write(1, "....WOODY....\n")`, antes de que el flujo normal del programa original continúe. El resto después del salto debe ser idéntico.

</details>

## Errores frecuentes

- Asumir que las secciones son necesarias para ejecutar; el kernel las ignora.
- Olvidar que `p_memsz > p_filesz` implica memoria a ceros y sumar `p_memsz` al offset de fichero.
- Cambiar `e_entry` sin guardar el original → el salto de vuelta no tiene a dónde ir.
- No tener en cuenta `PT_INTERP` y saltar a la dirección del intérprete en vez de a `_start`.

## Has aprendido que

- `execve` mapea cada `PT_LOAD` como `mmap(p_offset → p_vaddr)` con `p_flags`.
- `p_memsz > p_filesz` se rellena a ceros.
- Con `PT_INTERP`, el dynamic linker se ejecuta antes que `e_entry`.
- La pila inicial contiene `argc/argv/envp/auxv`; el kernel la deja lista para `_start`.
- `e_entry` es `_start`, no `main`; ahí debes saltar de vuelta.
- Sin `PT_LOAD` ejecutable que contenga el stub, no hay ejecución.

## Preguntas tipo defensa

1. ¿Qué hace el kernel con cada `PT_LOAD` durante `execve`?
2. ¿Por qué un stub fuera de todo `PT_LOAD` nunca se ejecuta aunque cambies `e_entry`?
3. ¿Qué es `PT_INTERP` y cómo afecta el flujo kernel → linker → tu stub → `_start`?
4. ¿Qué contiene la pila cuando `rip` llega a `e_entry`?
5. ¿Por qué `e_entry` no es `main` y por qué eso determina tu salto de vuelta?

## Criterio de finalización

- Con `readelf -l` identificas a qué `PT_LOAD` pertenece `e_entry` y sus permisos.
- Con `gdb` pones un breakpoint en `e_entry` y verificas que caes en `_start`.
- Explicas el camino completo `execve → mmap de PT_LOAD → (PT_INTERP) → pila → e_entry` sin mirar apuntes.

## Siguiente clase

La clase 3 entra en la ABI System V: cómo deben convivir tu stub y el código original en registros y pila para que el salto de vuelta sea indistinguible del arranque normal.

## Lecturas

- `man 2 execve`, `man 2 mmap`, `man 2 mprotect`.
- `man 7 vdso` / `man 7 auxv` — el auxiliary vector que el kernel deja en la pila.
- `gdb` `info file`, `info proc mappings`, `x/i $pc`.
