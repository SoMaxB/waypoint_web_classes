# Toolchain de ensamblador y extracción de shellcode

*Guía de estudio para woody_woodpacker (42) — de un `.asm` a bytes puros inyectables*

## 1. El problema concreto

Escribir el stub en NASM/GAS os da un fichero fuente. Pero lo que necesitáis inyectar en el ELF son **bytes de máquina puros** (shellcode), sin cabeceras ELF propias, sin símbolos, sin nada — solo las instrucciones ya ensambladas, listas para copiarse tal cual dentro de vuestro binario `woody`. Esta guía cubre cómo llegar de uno a otro de forma fiable.

## 2. Elegir ensamblador: NASM vs GAS

- **NASM**: sintaxis Intel (`mov rax, 1`), más legible para la mayoría, sintaxis de macros propia. Recomendado si no tenéis ya experiencia fuerte con GAS del common core.
- **GAS (GNU Assembler, vía `as` o inline en C con `__asm__`)**: sintaxis AT&T (`movq $1, %rax`), se integra más directamente en un `Makefile` típico de proyecto en C con `cc`, y es lo que produce `objdump -d` por defecto (útil para comparar visualmente).

Cualquiera de los dos es válido para el proyecto; elegid el que domine mejor la persona encargada del stub, y sed consistentes durante todo el proyecto para no mezclar sintaxis en la documentación.

## 3. Pipeline típico con NASM

```bash
nasm -f elf64 stub.asm -o stub.o     # ensamblar a objeto ELF64 reubicable
ld stub.o -o stub_test                # (opcional) enlazar para probarlo standalone
objcopy -O binary -j .text stub_test stub.bin   # extraer SOLO los bytes de .text, sin cabeceras
```

`objcopy -O binary` es la herramienta clave: convierte un ELF (que tiene headers, secciones, etc.) en un volcado binario plano de una sección concreta — exactamente los bytes que queréis copiar dentro de vuestro `woody`.

## 4. Pipeline equivalente con GAS

```bash
as stub.s -o stub.o
ld stub.o -o stub_test
objcopy -O binary -j .text stub_test stub.bin
```

Mismo resultado final, mismo uso de `objcopy`.

## 5. Verificar que el shellcode extraído es correcto

Antes de fiaros del `stub.bin`, comprobad que al volver a desensamblarlo da lo que esperabais:

```bash
objdump -D -b binary -m i386:x86-64 stub.bin
```

`-b binary` le dice a `objdump` que no es un ELF, sino bytes crudos; `-m i386:x86-64` fuerza la arquitectura para que interprete los bytes correctamente. Comparad instrucción a instrucción con vuestro `.asm` original.

## 6. El problema de las direcciones al ensamblar standalone

Cuando ensambláis y enlazáis el stub como programa independiente para probarlo, el linker le asigna una dirección de carga por defecto (normalmente algo como `0x400000` para `ET_EXEC` no-PIE). Pero cuando lo inyectéis dentro de `woody`, va a vivir en una dirección distinta (la que vosotros calculéis al construir el nuevo segmento). Por eso es crítico que **todo el direccionamiento dentro del stub sea relativo** (`rip`-relativo para acceder a datos como el string `....WOODY....` o la clave embebida; direcciones calculadas dinámicamente para el salto de vuelta, no un `jmp` a una dirección hardcodeada en tiempo de ensamblado). Si usáis `lea reg, [rel etiqueta]` correctamente, el shellcode extraído funciona igual sin importar a qué dirección lo copiéis después — esto es justo lo que hace que sea "position-independent".

## 7. Cómo pasar la clave/longitud de datos al stub sin recompilar el ensamblador

Como la clave de cifrado es distinta cada vez que ejecutáis `woody_woodpacker` (aleatoria vía `/dev/urandom`), no tiene sentido tenerla hardcodeada en el `.asm`. Dos enfoques comunes:

- **Placeholder + parcheo binario**: dejáis en el `.asm` una zona reservada de tamaño fijo (ej. 16 bytes a cero) en una posición conocida dentro del `stub.bin` ya ensamblado, y desde el programa host en C, después de ensamblar una única vez, sobrescribís esos bytes con la clave real antes de inyectar el stub en cada ejecución. Esto significa: **ensambláis el stub una sola vez** (podéis incluso dejar `stub.bin` como recurso ya generado, o generarlo en cada `make`), y el host en C solo hace *patching* de bytes en offsets conocidos.
- **Tabla de offsets documentada**: llevad un registro claro (comentado en el propio `.asm` y en vuestra documentación de equipo) de en qué offset dentro de `stub.bin` cae cada placeholder (clave, longitud de datos a descifrar, dirección de entry point original) para que el lado C sepa exactamente dónde escribir.

Este es exactamente el "contrato entre los dos lados" que os recomendamos fijar por escrito antes de programar en la guía general del proyecto — aquí es donde se concreta a nivel de bytes.

## 8. Integración en el Makefile

El sujeto exige un Makefile con "las reglas de compilación apropiadas" si hacéis parte en ensamblador. Ejemplo de esqueleto de reglas (adaptad nombres):

```makefile
STUB_ASM   = stub.asm
STUB_OBJ   = stub.o
STUB_ELF   = stub_test
STUB_BIN   = stub.bin

$(STUB_BIN): $(STUB_ASM)
	nasm -f elf64 $(STUB_ASM) -o $(STUB_OBJ)
	ld $(STUB_OBJ) -o $(STUB_ELF)
	objcopy -O binary -j .text $(STUB_ELF) $(STUB_BIN)

woody_woodpacker: main.c elf_utils.c crypto.c $(STUB_BIN)
	cc -Wall -Wextra -Werror main.c elf_utils.c crypto.c -o woody_woodpacker
```

Idealmente, `stub.bin` se genera como parte de la compilación (`make` sin argumentos lo produce automáticamente como dependencia), y luego vuestro código C lo incluye (por ejemplo, embebiéndolo con `xxd -i stub.bin > stub_bytes.h` para generar un array de bytes en C, o leyéndolo en runtime desde disco — la primera opción es más robusta para la entrega, ya que no depende de que el fichero `.bin` esté presente en el sistema del corrector).

## 9. Ejercicio recomendado

Antes de escribir una sola línea del stub "de verdad", haced el ciclo completo con un stub trivial (por ejemplo, uno que solo imprima "hola" y haga `exit(0)`): ensambladlo, extraedlo con `objcopy`, desensambladlo de vuelta con `objdump -b binary`, y comprobad que coincide. Automatizad este ciclo en el Makefile desde el principio — descubrir un error en el pipeline de build a mitad de proyecto, cuando el stub ya es complejo, es mucho más costoso que descubrirlo con un stub de una línea.
