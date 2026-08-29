# Clase 7: PIE, ASLR y direccionamiento

## Objetivo

Entender por qué "la dirección" nunca es un número fijo en binarios modernos. Al terminar debes distinguir `ET_EXEC` vs `ET_DYN`, explicar cómo ASLR elige la base de carga, por qué todo tu stub debe ser `rip`-relativo y cómo verificar con `gdb mappings` que tu packer funciona con PIE y no-PIE.

## 1. `ET_EXEC` vs `ET_DYN`

| `e_type` | Qué es | Direcciones del fichero |
|---|---|---|
| `ET_EXEC` | Ejecutable fijo (no-PIE) | Absolutas, reales |
| `ET_DYN` | PIE / librería | Relativas a una base que el kernel elige en `execve` |

`gcc/clang` generan PIE por defecto hace años; te encontrarás `ET_DYN` casi siempre.

```
dirección_real = base_de_carga + p_vaddr_del_fichero
```

Si el binario es `ET_EXEC`, es como si la base fuese 0.

## 2. Para tu programa host (C)

Todo lo que lees (`p_vaddr`, `e_entry`) es relativo a base si es PIE. No asumas `0x400000`. Las fórmulas de offsets siguen valiendo, pero no hardcodees valores típicos; comprueba `e_type`.

## 3. Para tu stub (asm)

Tu stub se copia dentro del mismo ELF, así que se reubica junto al resto con la misma base aleatoria. Las distancias relativas entre stub y `.text` siguen siendo las que calculaste. Por eso:

- `lea reg, [rip + offset]` para datos (`....WOODY....`, clave).
- `jmp` con offset relativo al `e_entry` original guardado como valor de fichero.

Así funciona igual en `0x555555554000` que en cualquier otra base.

## 4. ¿`woody` debe ser PIE?

Preserva el `e_type` original. Si el input era PIE, `woody` también debe serlo (y comportarse con ASLR real); si era `ET_EXEC`, también. Cambiarlo puede alterar protecciones o comportamiento sutil.

## Predicciones y ejercicios

### Ejercicio 1 — ¿qué ves en `readelf -h`?

Compilas `sample.c` normal y con `-no-pie`. ¿Qué `Type` y `Entry` esperas?

<details><summary>Solución</summary>

Normal: `Type: DYN (Shared object file)` (PIE) y `Entry: 0x1050` aprox (bajo). Con `-no-pie`: `Type: EXEC` y `Entry: 0x401050` aprox.

</details>

### Ejercicio 2 — ¿funcionará tu stub con `mov rsi, msg`?

Lo probaste con un binario `ET_EXEC` y funcionó. Lo pasa un tester con un binario PIE. ¿Qué pasa?

<details><summary>Solución</summary>

Con `ET_EXEC` la dirección absoluta coincidió por suerte. Con PIE la base es aleatoria, la dirección absoluta apunta fuera del mapeo → segfault. Con `lea rsi, [rel msg]` habría funcionado en ambos.

</details>

### Ejercicio 3 — observa ASLR

```bash
cat /proc/sys/kernel/randomize_va_space  # 2 = completo
gdb ./woody
(gdb) run; info proc mappings
(gdb) kill; run; info proc mappings
```

¿Qué cambia y qué debe seguir funcionando?

<details><summary>Solución</summary>

La base de carga cambia entre ejecuciones. Si tu stub es relativo, `woody` sigue imprimiendo `....WOODY....` y el mismo output; si crashea aleatoriamente, hay una dirección absoluta escondida.

</details>

### Ejercicio 4 — checklist PIE

- ¿Compruebas `e_type`?
- ¿Todo acceso es `rip`-relativo?
- ¿El salto es offset, no absoluto?
- ¿Has probado PIE y no-PIE?

<details><summary>Solución</summary>

Si falta alguno, es la primera cosa que mirará el evaluador tras un crash intermitente. Pruébalo ahora, no la víspera.

</details>

## Errores frecuentes

- Asumir siempre `ET_EXEC` y usar direcciones como `0x400000`.
- `mov reg, etiqueta` en vez de `lea reg, [rel etiqueta]`.
- Guardar `e_entry` como absoluto del fichero de prueba y no como valor del ELF actual.
- Cambiar `e_type` del output sin motivo.

## Has aprendido que

- `ET_EXEC` = fijo, `ET_DYN` = PIE con base aleatoria (ASLR).
- `dirección_real = base + p_vaddr`.
- El stub debe ser totalmente `rip`-relativo; el salto al original es relativo.
- `woody` debe preservar `e_type` y comportarse con ASLR.
- `gdb mappings` revela la base real de cada ejecución.

## Preguntas tipo defensa

1. ¿Qué indica `e_type` y cómo afecta a `p_vaddr`?
2. ¿Qué es ASLR y qué valor muestra `randomize_va_space`?
3. ¿Por qué `lea [rel]` es obligatorio para PIE?
4. ¿Cómo calculas el salto al `e_entry` original sin usar direcciones absolutas?
5. ¿Por qué debes probar con `-no-pie` además de con PIE?

## Criterio de finalización

- Empaquetas el mismo `sample` compilado como PIE y como `-no-pie`; ambos `woody` funcionan.
- Ejecutas `woody` dos veces con PIE y verificas que bases distintas (gdb) no rompen la ejecución.
- Señalas en tu `readelf -h` y en tu asm dónde se usa direccionamiento relativo.

## Siguiente clase

La clase 8 cierra el proyecto: matriz de pruebas, protocolo de verificación, depuración de fuera hacia dentro y ensayo de defensa.

## Lecturas

- `readelf -h` y `file` — detectar PIE.
- `proc(5)` — `/proc/sys/kernel/randomize_va_space`.
- `gdb` `info proc mappings`.
- System V ABI — PIC y GOT (conceptual, para entender por qué relativo).
