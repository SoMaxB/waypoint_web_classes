# Clase 6: toolchain de ensamblador y extracción de shellcode

## Objetivo

Convertir tu stub `.asm` en bytes puros inyectables (shellcode) de forma reproducible. Al terminar debes ensamblar con NASM o GAS, extraer el shellcode con `objcopy`, verificarlo con `objdump -b binary`, gestionar placeholders para clave/longitud/entry y tener una regla de `Makefile` que lo genere automáticamente.

## 1. El problema concreto

Tu stub fuente necesita convertirse en **bytes de máquina puros**, sin headers ELF, símbolos ni relocaciones — solo instrucciones listas para copiar dentro de `woody`. Esa conversión es el pipeline de esta clase.

## 2. NASM vs GAS

- **NASM** (Intel `mov rax,1`, macros propias) — más legible para la mayoría; recomendado si no vienes fuerte de GAS.
- **GAS** (AT&T `movq $1, %rax`, `as`/`cc`) — se integra con `Makefile` C y es lo que `objdump -d` muestra por defecto.

Elige uno y sé consistente.

## 3. Pipeline NASM

```bash
nasm -f elf64 stub.asm -o stub.o
ld stub.o -o stub_test          # opcional, para probar standalone
objcopy -O binary -j .text stub_test stub.bin  # solo .text
```

`objcopy -O binary` es la clave: te da el volcado plano de la sección.

## 4. Pipeline GAS

```bash
as stub.s -o stub.o
ld stub.o -o stub_test
objcopy -O binary -j .text stub_test stub.bin
```

Mismo resultado.

## 5. Verificar el shellcode

```bash
objdump -D -b binary -m i386:x86-64 stub.bin
```

`-b binary` indica bytes crudos; `-m i386:x86-64` fuerza la arquitectura. Compara instrucción a instrucción con tu `.asm`.

## 6. Direcciones al ensamblar standalone

Cuando enlazas el stub como programa independiente, `ld` le da una base por defecto (p. ej. `0x400000`). En `woody` vivirá en otra dirección. Por eso todo debe ser relativo (`rip`-relativo para datos, offset para el salto). Si usas `lea [rel]` correctamente, el `stub.bin` funciona en cualquier dirección — es position-independent.

## 7. Clave/longitud sin recompilar el asm

La clave cambia en cada ejecución, no puede estar hardcodeada. Dos enfoques:

- **Placeholder + parcheo:** reserva 16 bytes a cero en posición conocida del `stub.bin`; el host en C los sobrescribe con la clave real antes de inyectar. Ensamblas el stub **una sola vez**.
- **Tabla de offsets documentada:** anota en el `.asm` y en el C en qué offset cae cada placeholder (clave, len, orig_entry) — el contrato entre los dos lados.

## 8. Integración en el Makefile

```makefile
STUB_ASM = stub.asm
STUB_OBJ = stub.o
STUB_ELF = stub_test
STUB_BIN = stub.bin

$(STUB_BIN): $(STUB_ASM)
	nasm -f elf64 $(STUB_ASM) -o $(STUB_OBJ)
	ld $(STUB_OBJ) -o $(STUB_ELF)
	objcopy -O binary -j .text $(STUB_ELF) $(STUB_BIN)

woody_woodpacker: main.c elf_utils.c crypto.c $(STUB_BIN)
	cc -Wall -Wextra -Werror main.c elf_utils.c crypto.c -o woody_woodpacker
```

Ideal: `stub.bin` como dependencia de `make` sin args; el C lo embebe con `xxd -i stub.bin > stub_bytes.h` o lo lee en runtime (la primera es más robusta para corregir).

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué hace `objcopy -j .text`?

Sin `-j .text`, tu `stub.bin` pesa el doble y `objdump -b binary` muestra headers ASCII. ¿Qué extrajo?

<details><summary>Solución</summary>

Sin `-j .text` extrajiste todo el ELF (headers + secciones). Con `-j .text` solo los bytes de la sección `.text`. Los headers no son instrucciones; inyectarlos rompería el `PT_LOAD`.

</details>

### Ejercicio 2 — verifica un stub trivial

Haz un stub que solo imprima `"hola"` y `exit(0)`. Ensámblalo, extrae `stub.bin`, desensambla de vuelta y compáralo.

<details><summary>Solución</summary>

`objdump -b binary` debe mostrar las mismas 5-6 instrucciones que tu `.asm` (mov, lea, syscall). Si ves `call` con dirección absoluta, te falta `rel`.

</details>

### Ejercicio 3 — placeholder

Reserva `key_placeholder: times 16 db 0` en el asm. Después de generar `stub.bin`, ¿en qué offset cae? ¿Cómo lo encuentra el C?

<details><summary>Solución</summary>

Usa `objdump -d stub.o` para ver el offset del símbolo en la sección, o anótalo manualmente. El C lo usa como `stub_bin[off] = key[i]`; documenta el contrato en ambos lados.

</details>

### Ejercicio 4 — `xxd -i` vs lectura en runtime

Tu `woody_woodpacker` lee `stub.bin` de disco en cada ejecución. El corrector no tiene ese fichero. ¿Qué pasa? ¿Alternativa?

<details><summary>Solución</summary>

Falla por fichero no encontrado. Mejor embeber con `xxd -i stub.bin > stub.h` y compilar los bytes dentro del binario — no depende del filesystem en evaluación.

</details>

## Errores frecuentes

- Olvidar `-j .text` y extraer headers.
- Usar `mov rsi, msg` en vez de `lea rsi, [rel msg]`.
- Hardcodear clave y recompilar el asm en cada ejecución en vez de placeholder.
- No verificar con `objdump -b binary` y descubrir el bug tras la inyección.
- No hacer `stub.bin` dependencia del `Makefile` → `make` no lo regenera al cambiar el asm.

## Has aprendido que

- `nasm/ld/objcopy` (o `as/ld/objcopy`) te da shellcode puro.
- `objdump -D -b binary -m i386:x86-64` verifica el shellcode.
- Todo direccionamiento debe ser `rip`-relativo para ser PIC.
- Placeholders + parcheo evitan recompilar el asm por cada clave.
- El Makefile debe generar `stub.bin` automáticamente.

## Preguntas tipo defensa

1. ¿Qué hace `objcopy -O binary -j .text` y por qué no vale sin `-j`?
2. ¿Cómo verificas que `stub.bin` contiene exactamente tu stub?
3. ¿Por qué `lea [rel]` es obligatorio para PIE?
4. ¿Cómo pasas la clave al stub sin recompilar el asm?
5. ¿Cómo integras la generación de `stub.bin` en el Makefile?

## Criterio de finalización

- Pipeline completo con stub trivial funciona y `objdump -b binary` coincide con el `.asm`.
- Stub con placeholder genera `stub.bin` que el host parchea correctamente (lo compruebas imprimiendo los 16 bytes antes de inyectar).
- `make` genera `stub.bin` sin intervención manual y lo embebe.

## Siguiente clase

La clase 7 explica por qué esa PIC es necesaria: PIE vs `ET_EXEC`, ASLR y cómo comprobar que tu direccionamiento relativo sobrevive a bases de carga aleatorias.

## Lecturas

- `nasm(1)`, `as(1)`, `ld(1)`, `objcopy(1)`, `objdump(1)`.
- `xxd(1)` y generación de headers.
- GNU Make manual — reglas de dependencias.
