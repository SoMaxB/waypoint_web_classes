# Clase 8: testing, debugging y defensa

## Objetivo

Convertir "parece que funciona" en "puedo demostrar que cumple `ejecución idéntica, nunca crashea`". Al terminar debes tener una matriz de pruebas, un protocolo de verificación por binario, un método de depuración de fuera hacia dentro y respuestas ensayadas para la defensa.

## 1. Por qué esta clase existe

Las anteriores te dan cómo construir; esta te da cómo **verificar** el requisito más duro: *"en ningún caso el programa cifrado puede crashear"* y *"ejecución totalmente idéntica"*. Una ejecución de `Hello, World!` no lo demuestra.

## 2. Matriz de casos

Cruza estas variables:

| Variable | Casos |
|---|---|
| Tipo binario | `ET_EXEC` (-no-pie) y `ET_DYN` (PIE) |
| Enlazado | Dinámico y estático (`-static`) |
| Tamaño | `sample` trivial y binario con varias funciones/bucles |
| Comportamiento | Solo imprime vs lee `argv`/`stdin` (pila intacta) |
| Args de `woody` | Sin args, con args, verifica `argc/argv` |
| Compilador | `gcc` y `clang` (layouts distintos) |

## 3. Protocolo por cada binario

1. **Baseline:** `./original; echo $?` → guarda salida y retorno.
2. **Empaquetado:** `./woody_woodpacker original` → verifica `key_value:` y sin error.
3. **Estática:** `readelf -h/-l woody` → `e_entry` apunta al stub, `PT_LOAD` nuevo/extendido con `R+X`, alineación correcta.
4. **Ejecución:** `./woody; echo $?` → primero `....WOODY....`, luego misma salida y retorno.
5. **Diff:** `diff <(./original) <(./woody | tail -n +2)` → vacío.
6. **`strace` comparativo:** `strace -f ./original` vs `strace -f ./woody` → syscalls tras el salto idénticas + tus `mprotect/write` iniciales.

## 4. Depuración de fuera hacia dentro

Si `woody` crashea:

1. **¿ELF mal formado?** `readelf -l woody` → alineación rota, solapamiento, `e_entry` fuera de `PT_LOAD X`.
2. **¿Ni siquiera llega al stub?** `gdb` `break *<nuevo e_entry>` → ¿para?
3. **¿Dentro del stub?** `stepi` + `info registers` (antes/después de `mprotect`, antes del `jmp`).
4. **¿Salto de vuelta?** breakpoint en `e_entry` original → ¿llegas con pila/regs esperados?
5. **¿Después del salto?** Si vuelves bien pero falla `argv`, sospecha de `rsp` sucia.

## 5. Errores obligatorios (deben fallar limpio, no segfault)

- Sin args / multi args.
- Fichero inexistente / sin permisos de lectura.
- No-ELF (`.txt`).
- ELF32 → `File architecture not suported. x86_64 only`.
- ELF de otra arch (ARM).
- Sin permiso de escritura para crear `woody`.
- Input ya empaquetado (`woody` como input) → error controlado.

## 6. Protocolo de defensa

Ensaya entre los dos:

- "¿Por qué este algoritmo y no otro?" (XOR vs tu elección).
- "Enséñame en `readelf/objdump` qué cambiasteis."
- Casos límite de la sección 5 en vivo.
- "Explica instrucción por instrucción el stub."
- "¿Por qué `jmp` no `call`? ¿Por qué `rip`-relativo?"
- "¿Qué garantiza idéntica ejecución bit a bit tras descifrar?" (`diff`/`strace`).

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué diff esperas?

`./original` imprime `42\n` y `./woody` imprime `....WOODY....\n42\n`. ¿Qué `diff` haces y qué esperas?

<details><summary>Solución</summary>

`diff <(./original) <(./woody | tail -n +2)` → vacío. Sin `tail -n +2` el diff muestra `....WOODY....` como diferencia esperada, no un bug.

</details>

### Ejercicio 2 — ¿por qué `strace -f`?

Binario dinámico con `fork`. ¿Por qué no `strace` sin `-f`?

<details><summary>Solución</summary>

Sin `-f` solo trazas el padre; con `-f` sigues también hijos y el dynamic linker. Para comparar el flujo tras el salto necesitas ver todo.

</details>

### Ejercicio 3 — defensa simulada

Uno hace de corrector: pide `readelf -l woody` y señala el segmento nuevo, luego pide `gdb break *orig_entry` y `stepi`. El otro defiende sin mirar código.

<details><summary>Solución</summary>

Si alguno se atasca explicando la parte del otro, repasad juntos antes de la evaluación — la pareja defiende como unidad.

</details>

### Ejercicio 4 — caso cero respuestas

En ft_ping sería "ping inalcanzable", aquí es "binario que no hace nada". ¿Tu `mprotect` + descifrado funciona igual?

<details><summary>Solución</summary>

Sí: descifras el rango aunque el programa luego no haga `write`. `woody` debe seguir imprimiendo `....WOODY....` y salir con el mismo código, aunque el original no imprima nada.

</details>

## Errores frecuentes

- Probar solo con `sample` y creer que es general.
- Comparar `diff` sin descartar el banner.
- Depurar directamente con `stepi` sin mirar `readelf -l`.
- No probar casos de error hasta la defensa.
- No ensayar en pareja el relato de `readelf/objdump`.

## Has aprendido que

- La matriz debe cubrir PIE/no-PIE, estático/dinámico, tamaños, args y compiladores.
- El protocolo Baseline → Empaquetado → Estática → Ejecución → Diff → `strace` es tu definición de terminado.
- La depuración va de fuera (ELF) hacia dentro (stub) y luego hacia el salto.
- Hay una lista cerrada de casos de error que deben fallar limpio.
- La defensa se ensaya con preguntas concretas y en vivo.

## Preguntas tipo defensa

1. ¿Qué matriz de pruebas cubre tu parte obligatoria y por qué cada eje?
2. ¿Qué compruebas con `readelf -l woody` antes de ejecutar?
3. ¿Cómo depuras un `woody` que crashea de forma intermitente con PIE?
4. ¿Qué casos de error debes manejar y con qué mensaje?
5. ¿Cómo demuestras ejecución idéntica con `diff` y `strace`?

## Criterio de finalización

- Para cada binario de la matriz, el protocolo de 6 pasos pasa (diff vacío, ret idéntico, `strace` tras salto idéntico).
- Todos los casos de error de la sección 5 fallan con mensaje legible sin segfault.
- Defensa simulada en pareja: cada uno explica el stub del otro y señala cambios en `readelf` en vivo.

## Siguiente clase

No hay siguiente clase obligatoria; el siguiente paso es el bonus solo si todo lo anterior es perfecto: 32 bits, clave parametrizada, optimización en asm, PE/Mach-O o compresión.

## Lecturas

- Esta guía completa (relee 01-07) y el `en.subject.pdf` §V-VII.
- `strace(1)`, `gdb(1)`, `readelf(1)`, `objdump(1)`, `diff(1)`, `tail(1)`.
- Matriz y protocolo impresos — llévalos a la defensa.
