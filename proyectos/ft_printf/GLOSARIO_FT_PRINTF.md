# Glosario de ft_printf

Este documento reúne las siglas, tipos, funciones y conceptos que aparecen durante el proyecto. No hace falta memorizarlo de una vez: úsalo como referencia mientras lees `ft_printf.h` o haces ejercicios.

## Funciones variádicas

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| variádica | Variable arguments, argumentos variables | Función que acepta una cantidad y tipos de argumentos no fijos, declarada con `...` en el prototipo. |
| `va_list` | Variable argument list, lista de argumentos variable | Tipo opaco que representa la lista de argumentos variádicos; se pasa por puntero a `va_start`, `va_arg` y `va_end`. |
| `va_start` | Variable argument start | Inicializa la lista a partir del último parámetro nombrado: `va_start(ap, format)`. |
| `va_arg` | Variable argument get | Extrae el siguiente argumento con el tipo indicado: `va_arg(ap, int)`. Debe coincidir con el tipo real. |
| `va_copy` | Variable argument copy | Copia una lista ya iniciada (autorizada por el subject aunque esta implementación no la usa). |
| `va_end` | Variable argument end | Cierra la lista; debe llamarse antes de retornar. |
| promoción por defecto | Default argument promotion | Regla de C: en los argumentos variádicos, `char`/`short` suben a `int` y `float` sube a `double`. Por eso `%c` extrae un `int`. |

## El formato y el estado `t_fmt`

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `format` | Formato | Cadena de control que `ft_printf` recorre: texto literal más conversiones que empiezan por `%`. |
| conversión | Conversion | Bloque `%[flags][width][.precision]spec` que describe cómo imprimir un argumento. |
| `t_fmt` | Formato tipado | Estructura con el estado de una conversión parseada: `left`, `zero`, `hash`, `space`, `plus`, `width`, `precision`, `has_precision` y `spec`. |
| `spec` | Specifier, convertidor | El carácter final que elige el tipo: `c s p d i u x X %`. |
| `has_precision` | Tiene precisión | Marca que apareció el `.` aunque la precisión valga 0; con `%d` es importante distinguir `%.0d` de no poner precisión. |
| parser | Parser, analizador | Parte que lee el formato y rellena `t_fmt` (`ft_parse`). |
| dispatch | Distribución | Parte que, según `spec`, llama a la función de formateo adecuada (`ft_format`). |

## Conversiones de la parte obligatoria

| Conversión | Significado literal | Descripción de uso |
|---|---|---|
| `%c` | character | Imprime un carácter (extraído como `int`). |
| `%s` | string | Imprime una cadena terminada en `\0`; con `NULL` imprime `(null)` en glibc. |
| `%p` | pointer | Imprime un puntero `void *` en hexadecimal precedido de `0x`; con `NULL` imprime `(nil)`. |
| `%d` | decimal | Número entero con signo en base 10. |
| `%i` | integer | Número entero con signo en base 10; en este proyecto se comporta igual que `%d`. |
| `%u` | unsigned | Número entero sin signo en base 10. |
| `%x` | hexadecimal (minúscula) | Número sin signo en base 16 con dígitos `0-9a-f`. |
| `%X` | hexadecimal (mayúscula) | Número sin signo en base 16 con dígitos `0-9A-F`. |
| `%%` | por ciento | Imprime el carácter literal `%`. |

## Flags, ancho y precisión

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| flag | Bandera, marca | Carácter de control entre `%` y el ancho. Los de este proyecto son `-`, `0`, `#`, ` ` y `+`. |
| `-` | left, izquierda | Alinea a la izquierda: el padding va detrás del contenido. También anula el flag `0`. |
| `0` | zero, cero | Rellena con ceros a la izquierda. Se ignora con `-` o cuando hay precisión. |
| `#` | hash, alternativa | Añade `0x`/`0X` a `%x`/`%X` solo si el valor no es 0. |
| `+` | plus, signo | Fuerza el signo `+` en números no negativos. |
| ` ` | space, espacio | Deja un espacio de signo en números no negativos. `+` gana al espacio. |
| ancho | width | Número mínimo de caracteres de la salida; se rellena con espacios si el contenido es más corto. |
| precisión | precision | Tras `.`: para números, número mínimo de dígitos; para `%s`, número máximo de bytes. |
| padding | Relleno | Espacios o ceros que completan hasta el ancho. |
| `left` | Alineación izquierda | Campo de `t_fmt` que pone el padding detrás del contenido. |

## Números y bases

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| base | Base de numeración | Cantidad de dígitos usada: 10 (decimal), 16 (hexadecimal). |
| dígito | Dígito | Símbolo de una base; en hexadecimal de 0 a 15 (`0-9a-f` / `0-9A-F`). |
| prefijo | Prefix | Texto que precede a los dígitos: signo (`-`, `+`, espacio) o `0x`/`0X`. |
| buffer inverso | Reverse buffer | Técnica de `ft_putnum`: los dígitos se escriben en un `char buf[32]` desde el final hacia el principio y se imprimen después en orden correcto, sin reservar memoria. |
| `INT_MIN` | Minimum int | `-2147483648`. Su negación desborda como `int`; la referencia la niega en `long` primero. |
| `UINT_MAX` | Maximum unsigned int | `4294967295`; lo imprime `%u` (o `%x`) al pasar `-1`. |
| `(nil)` | Null pointer literal | Salida de `%p` con puntero nulo en glibc/Linux. |
| `(null)` | Null string literal | Salida de `%s` con cadena nula en glibc/Linux. |

## Salida, errores y retorno

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `write` | Escribir | Syscall/libc que emite bytes a un descriptor de archivo; devuelve bytes escritos o `-1` en error. |
| descriptor `1` | stdout | El flujo estándar de salida al que se envía el texto. |
| valor de retorno | Return value | De `ft_printf`: el número de caracteres escritos; `-1` si `write` falla o si `format` es `NULL`. |
| `ft_putstrn` | Put string n | Escribe `n` bytes de una cadena char a char y cuenta cuántos escribió. |
| `ft_putnchar` | Put char n times | Escribe `n` veces el mismo carácter y cuenta cuántos escribió. |
| propagación de error | Propagar | Devolver `-1` hacia arriba para que `ft_printf` retorne `-1` sin contar caracteres falsos. |

## Makefile y biblioteca

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `libftprintf.a` | Archivo estático de ft_printf | Biblioteca estática obligatoria creada en la raíz del repositorio. |
| `ar rcs` | Archive, archivar | Comando que empaqueta objetos en la biblioteca; `libtool` está prohibido. |
| `NAME` | Nombre | Variable del Makefile con la salida (`libftprintf.a`). |
| `all` | Todo | Objetivo por defecto: construir la biblioteca. |
| `clean` | Limpiar | Borra objetos (y el centinela `.bonus`). |
| `fclean` | Fully clean, limpiar del todo | Borra objetos y la biblioteca. |
| `re` | Rebuild, reconstruir | `fclean` + `all`. |
| `bonus` | Extra | Objetivo que incorpora los archivos `_bonus` dentro de la biblioteca sin contaminar `all`. |
| centinela `.bonus` | Stamp file, archivo marcador | Archivo vacío que evita re-archivar el bonus si no cambió nada. |
| relink | Reenlazar | Volver a construir o archivar lo que no cambió; el Makefile debe evitarlo. |
| Norma 42 | Norm | Reglas de estilo obligatorias para todo `.c`/`.h` del proyecto. |
| `-Wall -Wextra -Werror` | Flags de warnings | Advertencias estrictas tratadas como errores de compilación. |

## Herramientas de verificación

| Nombre | Significado literal | Descripción de uso |
|---|---|---|
| `make` | Make | Ejecuta los objetivos del Makefile solo sobre lo que cambió. |
| `ar t` | Archive table | Lista los objetos que contiene una biblioteca. |
| `nm -g --defined-only` | Name list | Lista los símbolos públicos definidos: `ft_printf`, `ft_parse`, etc. |
| `gdb` | GNU Debugger | Detiene el programa, pone breakpoints en `ft_parse`/`ft_print_number` y sigue registro a registro. |
| Valgrind | Nombre de la herramienta | Detecta fugas y accesos inválidos en el tester. |
| `diff` | Diferencia | Compara las salidas de `printf` y `ft_printf` byte a byte. |
| `printf(3)` | Libc printf | Función de referencia contra la que se valida todo el comportamiento. |

## Regla de lectura

Cuando te encuentres una conversión nueva, pregúntate:

```text
1. ¿Qué `spec` tengo y qué tipo debo extraer con `va_arg`?
2. ¿Qué flags, ancho o precisión ha rellenado el parser en `t_fmt`?
3. ¿Cuántos dígitos o caracteres se imprimirán (len)?
4. ¿Los ceros vienen de la precisión o del flag '0' + ancho?
5. En qué orden se escribe: espacios, prefijo, ceros, dígitos (y espacios si es '-')?
6. ¿Cuántos caracteres he escrito en total y cómo se acumulan?
```

Esta secuencia evita intentar entender todo el formateo de golpe.