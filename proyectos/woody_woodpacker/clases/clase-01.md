# Clase 1: formato ELF en profundidad

## Objetivo

Construir el modelo mental del formato ELF64 como dos vistas sobre los mismos bytes. Al terminar debes poder validar un ELF a mano (`\x7fELF`, `ELFCLASS64`, `EM_X86_64`), señalar dónde está el Program Header Table, explicar la diferencia entre sección y segmento, y localizar el rango exacto de `.text` tanto en fichero como en memoria virtual.

## 1. Qué es ELF y sus dos vistas

ELF (Executable and Linkable Format) es el formato que Linux usa para ejecutables (`ET_EXEC` / `ET_DYN` si es PIE), objetos `.o`, librerías `.so` y core dumps. Para woody solo importa **ELF64 ejecutable**.

Idea central: **el mismo fichero tiene dos vistas**:

- **Vista de ejecución (segmentos, Program Headers):** lo que el kernel usa en `execve`. Describe qué trozos del fichero deben mapearse en memoria y con qué permisos.
- **Vista de enlazado (secciones, Section Headers):** lo que el linker/debugger usa para resolver símbolos, depurar y localizar `.text` por nombre. El kernel **la ignora por completo**.

Tu inyección vivirá en la primera; la segunda solo te servirá para encontrar qué bytes cifrar.

## 2. Layout general

```
+---------------------------+
| ELF Header (Elf64_Ehdr)   | <- offset 0, siempre
+---------------------------+
| Program Header Table      | <- lista de segmentos (ejecución)
+---------------------------+
| .text, .data, .rodata...  | <- contenido real
+---------------------------+
| Section Header Table      | <- lista de secciones (enlazado)
+---------------------------+
```

El orden físico puede variar, pero `e_phoff` y `e_shoff` del ELF header te llevan a cada tabla.

## 3. ELF header (`Elf64_Ehdr`, en `<elf.h>`)

| Campo | Qué es |
|---|---|
| `e_ident[16]` | Magic `\x7fELF`, clase (32/64), endianness, versión ABI |
| `e_type` | `ET_EXEC` (fija) o `ET_DYN` (PIE/lib) |
| `e_machine` | `EM_X86_64 = 62`; primera validación obligatoria |
| `e_entry` | Dirección virtual del entry point — **lo que vas a parchear** |
| `e_phoff / e_phnum / e_phentsize` | Dónde y cómo está la Program Header Table |
| `e_shoff / e_shnum / e_shentsize` | Igual para la Section Header Table |
| `e_shstrndx` | Índice de la sección que contiene los nombres de sección |

**Validación obligatoria antes de tocar nada:** `e_ident[EI_MAG0..3] == "\x7fELF"` y `e_ident[EI_CLASS] == ELFCLASS64` y `e_machine == EM_X86_64`. Si falla, error limpio con el mensaje del subject — nunca segfault.

```c
if (memcmp(ehdr->e_ident, ELFMAG, SELFMAG) != 0
 || ehdr->e_ident[EI_CLASS] != ELFCLASS64
 || ehdr->e_machine != EM_X86_64) {
    // File architecture not suported. x86_64 only
}
```

## 4. Program Header Table — tu fuente de verdad

Cada `Elf64_Phdr`:

| Campo | Significado |
|---|---|
| `p_type` | `PT_LOAD` (cargar), `PT_DYNAMIC`, `PT_INTERP`, `PT_NOTE`... Solo `PT_LOAD` te interesa |
| `p_flags` | `PF_R (4) | PF_W (2) | PF_X (1)` |
| `p_offset` | Offset en el fichero |
| `p_vaddr` | Dirección virtual en memoria |
| `p_filesz` | Bytes en el fichero |
| `p_memsz` | Bytes en memoria (puede ser > `p_filesz` por `.bss`, el resto va a ceros) |
| `p_align` | Alineación, en la práctica `0x1000` (página) |

Tipicamente verás `PT_LOAD R+X` (código) y `PT_LOAD R+W` (datos), a veces un tercero `R` para `.rodata`.

### Regla de oro de la alineación

`p_vaddr ≡ p_offset (mod p_align)`. Si rompes esto al crear tu segmento nuevo, el binario puede no cargar — es la causa nº1 de "mi woody crashea".

## 5. Dos estrategias de inyección

**A. Extender el último `PT_LOAD`:** añades stub + datos cifrados justo después del último segmento cargable, ampliando `p_filesz/p_memsz` y añadiendo `PF_X` si hacía falta.

**B. Añadir un nuevo `PT_LOAD`:** necesitas una entrada libre en la tabla o mover la tabla al final para crecer `e_phnum`. Más limpio, más trabajo.

Documenta cuál eliges y por qué; ambas valen si respetan alineación y permisos.

## 6. Secciones — para localizar `.text`

Aunque la carga usa segmentos, para saber **qué cifrar** es más cómodo buscar la sección `.text` por nombre vía `e_shstrndx`.

`Elf64_Shdr` relevantes: `sh_name`, `sh_addr`, `sh_offset`, `sh_size`. Con esto tienes el rango exacto en fichero y en memoria.

> Aviso: un binario stripped puede tener la Section Header Table vacía. Para el mandatory puedes asumir no-stripped, pero menciónalo como limitación en la defensa.

## Predicciones y ejercicios

Cada ejercicio debe hacerse **antes** de mirar la solución. Escribe, compila cuando toque y verifica contra `readelf`.

### Ejercicio 1 — ¿qué mira el kernel?

Te dan un ELF con 3 `PT_LOAD` y 12 secciones. El kernel necesita mapearlo en memoria. ¿Qué tabla recorre?

<details><summary>Solución</summary>

La Program Header Table. Las secciones le son irrelevantes; podría no haber ninguna y el binario seguiría ejecutándose.

</details>

### Ejercicio 2 — ¿por qué `p_vaddr % 0x1000 == p_offset % 0x1000`?

Si tu nuevo segmento empieza en offset `0x1234` de fichero y le asignas `p_vaddr = 0x401234`, ¿cumple la regla con `p_align = 0x1000`? ¿Y con `0x401000`?

<details><summary>Solución</summary>

`0x1234 % 0x1000 = 0x234`. `0x401234 % 0x1000 = 0x234` → cumple. `0x401000 % 0x1000 = 0x0` → **no** cumple; el kernel mapea por páginas y quedaría desalineado.

</details>

### Ejercicio 3 — leer `e_entry` a mano

Compila el `sample.c` del subject, ejecuta `readelf -h sample` y anota `Entry point address`. Ejecuta `readelf -l sample` y localiza en qué `PT_LOAD` cae. ¿Tiene `PF_X`?

<details><summary>Solución</summary>

Debe caer dentro del `PT_LOAD` con `R E` (a veces `R` solo para el header, pero el que contiene `e_entry` es `R E`). Si no tiene `PF_X`, el kernel lo mapeó ejecutable; si tu stub apuntara a un `PT_LOAD` sin `X`, el `jmp` daría segfault por NX.

</details>

### Ejercicio 4 — volcado a mano (en pareja)

Compilad `sample.c`, y sin mirar `readelf`, rellenad en papel: `e_entry`, todos los `p_vaddr/p_offset/p_filesz/p_memsz/p_flags` de cada `PT_LOAD`, y el rango de `.text` (`sh_addr/sh_offset/sh_size`). Luego verificad con `readelf -h/-l/-S`.

<details><summary>Solución</summary>

Es un ejercicio de completar tabla; no hay respuesta única porque depende del binario. Terminado cuando podéis explicarle al otro cada valor sin dudar y `readelf` confirma.

</details>

## Errores frecuentes

- Validar solo el magic y olvidar `EI_CLASS` o `e_machine` → aceptas un ELF32 y crasheas al castear a `Elf64_Ehdr`.
- Confundir `p_filesz` con `p_memsz` y copiar `p_memsz` bytes desde el fichero (lees más allá del EOF, el resto es zero-fill del kernel, no bytes en disco).
- Crear un segmento nuevo con `p_align = 0x1000` pero `p_vaddr` sin el resto de `p_offset` → `execve` falla o el segmento se mapea mal.
- Asumir que `.text` empieza donde termina el segundo `PT_LOAD` sin usar `sh_offset/sh_addr`.
- Tratar la Section Header Table como obligatoria para la ejecución.

## Has aprendido que

- Un ELF tiene dos vistas: segmentos (kernel, `execve`) y secciones (linker/debug).
- El ELF header está en offset 0 y apunta a ambas tablas.
- Solo `PT_LOAD` se mapea en memoria; `p_flags` decide R/W/X.
- `p_vaddr ≡ p_offset (mod p_align)` es obligatorio.
- `e_entry` es la dirección de `_start` y es lo que parchearás.
- `.text` se localiza vía Section Headers; un stripped puede no tenerlas.

## Preguntas tipo defensa

1. ¿Qué dos tablas describe el ELF header y cuál usa el kernel?
2. ¿Por qué rompe la ejecución que `p_vaddr` y `p_offset` no compartan el mismo resto módulo `p_align`?
3. ¿Qué diferencia hay entre `p_filesz` y `p_memsz` y qué hace el kernel con la diferencia?
4. ¿Por qué tu stub debe estar dentro de un `PT_LOAD` con `PF_X`?
5. ¿Cómo localizas el rango exacto de `.text` en fichero y en memoria?

## Criterio de finalización

- Validación `magic + ELFCLASS64 + EM_X86_64` sin crash para ficheros válidos e inválidos.
- Con `readelf -h/-l/-S` puedes señalar `e_entry`, cada `PT_LOAD` y el rango de `.text` sin mirar el código.
- Explicas sin dudar las dos estrategias de inyección y la regla de alineación.

## Siguiente clase

La clase 2 sigue la vida del binario después del parseo: qué hace el kernel en `execve`, cómo mapea cada `PT_LOAD` con `mmap`, qué es `PT_INTERP` y qué encuentra el proceso en la pila al llegar a `e_entry`.

## Lecturas

- `man 5 elf` y `/usr/include/elf.h` — definiciones reales de `Elf64_Ehdr/Phdr/Shdr`.
- `readelf(1)` — `readelf -h/-l/-S` sobre cualquier binario del sistema.
- `objdump -d` y `xxd` — verificar offsets a mano después de `readelf`.
