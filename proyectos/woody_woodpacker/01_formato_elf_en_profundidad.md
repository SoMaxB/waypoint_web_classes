# Formato ELF en profundidad

*Guía de estudio para woody_woodpacker (42) — enfocada en ELF64*

## 1. Qué es ELF y por qué os importa

ELF (Executable and Linkable Format) es el formato de fichero binario usado en Linux para:
- Ejecutables (`ET_EXEC`, `ET_DYN` si es PIE)
- Objetos reubicables (`.o`)
- Librerías compartidas (`.so`)
- Core dumps

Para woody_woodpacker solo os importa el caso **ejecutable ELF64**. La idea central que hay que interiorizar:

> Un ELF tiene dos "vistas" distintas sobre los mismos bytes: la **vista de enlazado** (secciones, usada por el linker y por herramientas de depuración) y la **vista de ejecución** (segmentos, usada por el kernel al hacer `execve`). Vosotros vais a trabajar sobre la vista de ejecución.

## 2. Estructura general de un fichero ELF64

```
+---------------------------+
| ELF Header                |  <- describe el fichero, apunta al resto
+---------------------------+
| Program Header Table      |  <- lista de segmentos (vista de EJECUCIÓN)
+---------------------------+
| .text, .data, .rodata...  |  <- contenido real (código, datos)
| .bss, .symtab, .strtab... |
+---------------------------+
| Section Header Table      |  <- lista de secciones (vista de ENLAZADO)
+---------------------------+
```

El orden físico puede variar, pero el ELF Header siempre está al principio (offset 0), y contiene los offsets hacia las otras dos tablas.

## 3. El ELF Header (`Elf64_Ehdr`)

Definido en `<elf.h>`. Campos clave:

| Campo         | Qué es                                                                 |
|---------------|-------------------------------------------------------------------------|
| `e_ident[16]` | Magic number `\x7fELF`, clase (32/64 bits), endianness, versión ABI    |
| `e_type`      | `ET_EXEC` (ejecutable estático de dirección fija) o `ET_DYN` (PIE/lib) |
| `e_machine`   | Arquitectura, debe ser `EM_X86_64` (62) — es vuestra primera validación |
| `e_entry`     | **Dirección virtual del entry point.** Esto es lo que vais a parchear   |
| `e_phoff`     | Offset en el fichero donde empieza la Program Header Table             |
| `e_shoff`     | Offset donde empieza la Section Header Table                           |
| `e_phentsize` / `e_phnum` | Tamaño de cada entrada / número de entradas de program headers |
| `e_shentsize` / `e_shnum` | Igual pero para section headers                                |
| `e_shstrndx`  | Índice de la sección que contiene los nombres de las secciones          |

**Comprobación obligatoria antes de nada:** `e_ident[EI_MAG0..3] == "\x7fELF"`, `e_ident[EI_CLASS] == ELFCLASS64`, `e_machine == EM_X86_64`. Si falla cualquiera, error limpio (no crash).

## 4. Program Header Table — lo que realmente usaréis

Cada entrada es un `Elf64_Phdr`, y describe un **segmento**: un trozo del fichero que el kernel debe mapear en memoria tal cual.

| Campo      | Qué es                                                                |
|------------|-------------------------------------------------------------------------|
| `p_type`   | `PT_LOAD` (cargar en memoria), `PT_DYNAMIC`, `PT_INTERP`, `PT_NOTE`... |
| `p_flags`  | Permisos: `PF_R` (4), `PF_W` (2), `PF_X` (1) — combinables            |
| `p_offset` | Offset en el **fichero** donde empieza este segmento                  |
| `p_vaddr`  | Dirección **virtual** donde se mapea en memoria                       |
| `p_paddr`  | Dirección física (irrelevante en Linux de usuario, normalmente = vaddr) |
| `p_filesz` | Tamaño del segmento dentro del fichero                                |
| `p_memsz`  | Tamaño que ocupa en memoria (puede ser mayor que `p_filesz`, ej. `.bss`) |
| `p_align`  | Alineación requerida — **en la práctica, tamaño de página (0x1000)**  |

Solo `PT_LOAD` os interesa para inyectar el stub. Normalmente veréis:
- Un `PT_LOAD` con `PF_R | PF_X` (segmento de código: `.text`, `.plt`...)
- Un `PT_LOAD` con `PF_R | PF_W` (segmento de datos: `.data`, `.bss`...)
- Otros como `PT_LOAD` para `.rodata` en binarios modernos con separación de permisos

### Regla de oro de la alineación

`p_vaddr ≡ p_offset (mod p_align)`. Es decir, si vuestro segmento nuevo empieza en el offset de fichero `X`, su dirección virtual debe tener el mismo resto módulo 0x1000 que `X`. Si rompéis esto, el binario resultante puede no cargar o cargar mal — es la fuente número uno de "mi woody crashea" en este proyecto.

## 5. Dos estrategias de inyección (y sus trade-offs)

**A. Extender el último `PT_LOAD`**
Añadís vuestro stub + datos cifrados justo después del último segmento cargable, ampliando su `p_filesz`/`p_memsz` y (si hace falta) dándole permiso de ejecución. Más simple, pero puede chocar con el segmento siguiente si no dejáis margen, y si el segmento no tenía `PF_X`, tendréis que añadirlo (revisad implicaciones si el binario usa NX estricto).

**B. Añadir un nuevo segmento `PT_LOAD`**
Necesitáis una entrada libre en la Program Header Table, o mover la tabla entera a un sitio nuevo (al final del fichero, por ejemplo) para poder añadir una entrada más. Más "limpio" conceptualmente, un poco más de trabajo de reescritura.

Cualquiera de las dos es válida; documentad bien cuál elegís y por qué para la defensa.

## 6. Secciones (vista de enlazado) — para localizar `.text`

Aunque el *loading* usa segmentos, para saber **qué bytes cifrar** (el código, típicamente `.text`) es más cómodo mirar la Section Header Table (`Elf64_Shdr`), buscando la sección `.text` por nombre (usando `e_shstrndx` para resolver la tabla de strings de nombres de sección).

Campos relevantes de `Elf64_Shdr`: `sh_name`, `sh_addr` (dirección virtual), `sh_offset` (offset en fichero), `sh_size`. Con esto sabéis exactamente qué rango de bytes, tanto en fichero como en memoria, corresponde al código a cifrar.

⚠️ Aviso: un binario *stripped* puede no tener Section Header Table completa. Para el mandatory podéis asumir binarios no stripped, pero mencionadlo como limitación conocida en la defensa (o gestionadlo como bonus/robustez extra).

## 7. Herramientas para practicar (hacedlo antes de programar)

```bash
readelf -h binario      # ELF header
readelf -l binario      # Program headers (segmentos)
readelf -S binario      # Section headers (secciones)
objdump -d binario       # Disassembly
xxd binario | less       # Bytes crudos, para verificar offsets a mano
```

**Ejercicio recomendado en pareja:** coged el `sample.c` del enunciado, compiladlo, y entre los dos rellenad a mano (en papel) los valores de `e_entry`, todos los `p_vaddr`/`p_offset`/`p_filesz`/`p_memsz`/`p_flags` de cada `PT_LOAD`, y el rango de `.text`. Si sois capaces de explicarle esa tabla al otro sin mirar `readelf`, estáis listos para programar el parser.
