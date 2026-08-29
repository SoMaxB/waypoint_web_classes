# Metodología de testing, depuración y defensa

*Guía de estudio para woody_woodpacker (42) — cómo saber que funciona de verdad, y cómo defenderlo*

## 1. Por qué esta guía existe aparte de las demás

Las guías anteriores os dan el conocimiento para *construir* el proyecto. Esta os da el proceso para *verificar* que lo que construisteis cumple de verdad el requisito más duro del enunciado: *"en ningún caso el programa cifrado puede crashear"* y *"la ejecución debe ser totalmente idéntica al binario original"*. Eso no se comprueba "a ojo" ejecutándolo una vez y viendo que imprime `Hello, World!` — necesitáis un proceso sistemático.

## 2. Matriz de casos de prueba

No os limitéis al `sample.c` del enunciado. Antes de dar el mandatory por terminado, probad contra binarios que cubran estas variables, cruzadas cuando sea posible:

| Variable | Casos a cubrir |
|---|---|
| Tipo de binario | `ET_EXEC` (no-PIE) y `ET_DYN` (PIE) — ver guía de PIE/ASLR |
| Enlazado | Estático (`-static`) y dinámico (con libc compartida) |
| Tamaño del código | Un binario trivial (`sample.c`) y uno más grande (con varias funciones, bucles, llamadas a syscalls propias) |
| Comportamiento en runtime | Un programa que solo imprime algo y sale, y otro que lee `argv`/`stdin`, para comprobar que la pila y el entorno llegan intactos |
| Argumentos al ejecutar `woody` | Sin argumentos, con varios argumentos, verificando que `argc`/`argv` le llegan igual que al original |
| Compilador de origen | Si tenéis tiempo, probad binarios compilados con `gcc` y con `clang` — pequeñas diferencias de layout pueden revelar asunciones incorrectas en vuestro parser |

## 3. Protocolo de verificación por cada binario probado

Para cada binario de prueba, seguid siempre la misma secuencia y documentadla (aunque sea en un fichero de notas del repo, no hace falta que sea formal):

1. **Baseline**: ejecutad el original, capturad su salida y código de retorno (`./original; echo $?`).
2. **Empaquetado**: ejecutad `./woody_woodpacker original`, verificad que imprime la clave y que no hay errores.
3. **Verificación estática del `woody` generado**: `readelf -h woody`, `readelf -l woody` — comprobad que el `e_entry` apunta a vuestro stub, que hay un segmento nuevo o extendido con los permisos esperados, y que la Program Header Table sigue siendo internamente consistente (offsets, alineación).
4. **Ejecución del empaquetado**: `./woody`, comprobad que imprime primero `....WOODY....` y luego exactamente la misma salida que el baseline, y el mismo código de retorno (`echo $?`).
5. **Comparación automatizada**: `diff <(./original) <(./woody | tail -n +2)` (descartando la primera línea del banner) para detectar cualquier diferencia de salida sin tener que comparar a ojo.
6. **`strace` comparativo**: `strace -f ./original` vs `strace -f ./woody` — las syscalls que hace el programa **después** de que vuestro stub le devuelva el control deberían ser idénticas a las del original (más las vuestras al principio: `mprotect`, `write` del banner).

## 4. Depuración cuando algo falla: de fuera hacia dentro

Cuando `woody` crashea o se comporta distinto, resistid la tentación de meteros directamente en el stub con `gdb` a ciegas. Id de fuera hacia dentro:

1. **¿Es un problema de ELF mal formado?** `readelf -l woody` — buscad alineaciones rotas (`p_vaddr` y `p_offset` sin el mismo resto módulo `p_align`), segmentos solapados, o un `e_entry` que no cae dentro de ningún `PT_LOAD` ejecutable.
2. **¿Es un problema de que el kernel ni siquiera llega a ejecutar vuestro stub?** Poned un breakpoint directamente en la dirección de `e_entry` nueva (`gdb`, `break *0x...`, sacada de `readelf -h woody`) y comprobad que `gdb` para ahí. Si no para, el problema es de carga (permisos, offset), no de lógica del stub.
3. **¿Es un problema dentro del stub?** Con el breakpoint anterior confirmado, `stepi` instrucción a instrucción, comprobando `info registers` en cada paso contra lo que esperabais (especialmente antes y después del `mprotect`, y antes del `jmp` final).
4. **¿Es un problema en el salto de vuelta?** Poned un segundo breakpoint en la dirección del `e_entry` **original** (la del binario sin empaquetar) y comprobad que efectivamente llegáis ahí, con los registros y la pila en el estado esperado (ver guía de ABI).
5. **¿Es un problema después del salto, ya en código "normal"?** Si llegáis bien al entry point original pero el programa se comporta distinto más adelante (por ejemplo, falla al leer `argv`), sospechad de la pila: algo que empujasteis en el stub y no desapilasteis correctamente.

## 5. Errores obligatorios a manejar (no solo el caso feliz)

El sujeto pide gestión de errores robusta ("incluso en casos de uso retorcido o incorrecto"). Lista mínima a probar explícitamente:

- Ningún argumento, o más de un argumento.
- Fichero que no existe / sin permisos de lectura.
- Fichero que existe pero no es un ELF (ej. un `.txt`).
- ELF válido pero de 32 bits (el ejemplo del propio enunciado: debe dar el mensaje de arquitectura no soportada, sin crashear).
- ELF de arquitectura distinta a x86-64 (ARM, etc., si tenéis alguno a mano).
- Fichero sin permisos de escritura en el directorio de salida (no debería crashear al intentar escribir `woody`, debe dar un error legible).
- Binario ya empaquetado previamente (¿qué pasa si le pasáis un `woody` ya generado como input? No es obligatorio soportarlo, pero sí debe fallar de forma controlada, no con un segfault).

## 6. Protocolo de defensa — lo que probablemente os van a preguntar

Preparad respuestas concretas (no genéricas) a esto, entre los dos, antes de la evaluación:

- **"¿Por qué este algoritmo de cifrado y no otro?"** — tened lista la comparación XOR trivial vs. vuestra elección (ver guía de algoritmos de cifrado).
- **"Enséñame en `readelf`/`objdump` exactamente qué habéis cambiado respecto al binario original."** — practicad hacer esto en vivo, señalando el segmento nuevo/extendido y el `e_entry` modificado.
- **"¿Qué pasa si...?"** — os van a pedir que probéis en vivo algún caso límite de la lista de la sección 5. Tenedlos ya probados de antemano, no improvisados.
- **"Explícame instrucción por instrucción qué hace vuestro stub."** — cada uno de los dos debería poder explicar la parte del otro, no solo la propia (recordad que sois pareja, no dos proyectos independientes cosidos juntos).
- **"¿Por qué usáis `jmp` y no `call` para volver?"** / **"¿Por qué `rip`-relativo?"** — preguntas directas de ABI/PIE que aparecen en las guías 3 y 7.
- **"¿Qué garantiza que el binario resultante sea bit a bit ejecutable-idéntico al original tras descifrar?"** — deberíais poder mostrar el `diff`/`strace` comparativo de la sección 3 en vivo.

## 7. Ejercicio recomendado

Una semana antes de la fecha de evaluación, hacedos una "defensa simulada" entre los dos: uno hace de corrector y el otro defiende, luego cambiáis. Usad la lista de preguntas de la sección 6 literalmente. Si alguno se atasca explicando la parte del otro, es la señal de que toca sentaros juntos a repasar esa parte del código antes de la evaluación real.
