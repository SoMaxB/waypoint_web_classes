# PIE, ASLR y direccionamiento

*Guía de estudio para woody_woodpacker (42) — por qué "la dirección" nunca es un número fijo*

## 1. `ET_EXEC` vs `ET_DYN`: dos mundos distintos

El campo `e_type` del ELF header os dice cuál de los dos casos tenéis delante:

- **`ET_EXEC`** (ejecutable no-PIE, "de dirección fija"): todas las direcciones virtuales del fichero (`p_vaddr` de cada segmento, `e_entry`, direcciones de símbolos) son **absolutas y reales**. El kernel siempre lo carga exactamente en esas direcciones. Es el caso más simple para razonar y para depurar.
- **`ET_DYN`** (PIE — Position Independent Executable, o una librería compartida): las direcciones del fichero son **relativas a una base de carga** (`load base`) que el kernel elige en tiempo de ejecución, típicamente de forma aleatoria por ASLR (Address Space Layout Randomization). La dirección real en memoria de algo es `load_base + p_vaddr_del_fichero`.

Desde hace años, gcc/clang generan binarios PIE **por defecto** en la mayoría de distribuciones Linux, así que es muy probable que os encontréis `ET_DYN` constantemente al probar con binarios "normales", no solo en casos especiales.

## 2. Por qué esto afecta a vuestro programa host (C)

Cuando parseáis el ELF y calculáis "dónde va a caer" vuestro nuevo segmento o el offset del entry point original, **todo lo que leéis del fichero (`p_vaddr`, `e_entry`) son valores relativos a la base si el binario es PIE**. Esto no cambia cómo calculáis vuestras propias direcciones nuevas (seguís trabajando sobre offsets de fichero y direcciones virtuales dentro del mismo esquema relativo), pero sí es importante para:

- No asumir nunca que `e_entry` es una dirección "típica" como `0x400000` — en PIE suele ser un valor bajo relativo (ej. `0x1050`), que solo tiene sentido sumado a la base de carga real en tiempo de ejecución.
- Si el binario es `ET_EXEC` en vez de `ET_DYN`, las mismas fórmulas siguen funcionando porque, matemáticamente, es como si la base de carga fuera 0 — pero comprobad `e_type` y no deis por hecho ningún caso.

## 3. Por qué esto afecta a vuestro stub (asm)

El stub se copia dentro del mismo fichero ELF, así que se beneficia de la misma reubicación automática que hace el kernel al cargar todo el binario: si es PIE, tanto el código original como vuestro stub se cargan juntos en la misma base aleatoria, y las distancias *relativas* entre ellos (offsets) siguen siendo las que calculasteis en el fichero. Por eso insistimos en guías anteriores en usar:

- `lea reg, [rip + offset]` en vez de direcciones absolutas para acceder a datos dentro del propio stub (string del banner, clave embebida).
- Un `jmp` calculado como offset relativo al `e_entry` original (guardado como dirección de fichero, no como número mágico) para volver al arranque normal.

Si hacéis esto correctamente, vuestro stub funciona igual de bien tanto si el binario resultante acaba siendo cargado en `0x555555554000` como en cualquier otra base aleatoria — no necesitáis saber la base real en ningún momento, solo trabajar en relativo.

## 4. Un matiz importante: ¿es `woody` en sí PIE o no?

Aquí hay una decisión de diseño que debéis tomar conscientemente: cuando generáis `woody`, ¿mantenéis el mismo `e_type` que el original, o lo forzáis a algo distinto? Lo correcto para cumplir "la ejecución debe ser idéntica" es **preservar el `e_type` original** — si el binario que os dieron era PIE, `woody` también debe serlo (y comportarse con ASLR real), y si era `ET_EXEC`, `woody` también. No tenéis motivo para cambiarlo, y cambiarlo podría alterar sutilmente el comportamiento (por ejemplo, algunas protecciones de seguridad del binario dependen de si es PIE).

## 5. Cómo comprobarlo y probarlo en la práctica

```bash
readelf -h binario | grep Type      # EXEC (Executable file) vs DYN (Shared object file... o PIE executable)
file binario                          # también lo indica de forma legible
```

Para observar ASLR en acción:

```bash
cat /proc/sys/kernel/randomize_va_space   # 2 = ASLR completo activado (normal en Linux moderno)
gdb ./woody
(gdb) run
(gdb) info proc mappings   # ver la base de carga real de esta ejecución concreta
(gdb) kill
(gdb) run                   # ejecutar de nuevo...
(gdb) info proc mappings   # ...la base debería haber cambiado si es PIE
```

Si veis que la base de carga cambia entre ejecuciones y vuestro `woody` sigue funcionando igual en ambas, es una buena señal de que el direccionamiento relativo del stub está bien hecho. Si crashea en una ejecución sí y en otra no, es una señal casi segura de que hay una dirección absoluta hardcodeada en algún sitio del stub.

## 6. Checklist rápido para depurar problemas relacionados con PIE

- [ ] ¿Comprobáis `e_type` explícitamente en vuestro parser, o asumís siempre `ET_EXEC`?
- [ ] ¿Todas las referencias a datos dentro del stub usan `rip`-relativo?
- [ ] ¿El salto de vuelta al entry point original se calcula como offset dentro del fichero/segmento, no como dirección absoluta fija?
- [ ] ¿Habéis probado explícitamente con al menos un binario PIE y uno no-PIE (podéis forzar no-PIE con `-no-pie` en gcc/clang) para confirmar que ambos casos funcionan?

## 7. Ejercicio recomendado

Compilad el mismo `sample.c` del enunciado dos veces: una normal (PIE por defecto) y otra con `-no-pie`. Comparad con `readelf -h` los valores de `e_type` y `e_entry` entre ambos. Empaquetad los dos con vuestro `woody_woodpacker` y comprobad que ambos siguen funcionando igual que sus originales — es la prueba más directa de que vuestro manejo de direcciones es realmente robusto y no solo "funciona por casualidad" con el caso que más habéis probado.
