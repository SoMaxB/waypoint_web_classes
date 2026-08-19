# Guía de aprendizaje y desarrollo de ft_printf

Esta guía traduce el `en.subject.pdf` v12.0 a un itinerario práctico sobre Linux/glibc y **se apoya en una implementación completa y validada** que vive en la raíz de este repositorio. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

El objetivo no es copiar esa implementación. Es entender por qué cada pieza existe —funciones variádicas, parseo de formato, dedicación ordenada del padding y el valor de retorno— hasta poder reescribirla y defenderla sin mirar.

## 1. Qué exige exactamente el proyecto

Debes reprogramar una parte de `printf(3)` de la libc.

- Entregable: una biblioteca estática llamada **`libftprintf.a`** en la raíz del repositorio.
- Función: `int ft_printf(char const *, ...);`.
- Debes reproducir el comportamiento del `printf` original para las conversiones `cspdiuxX%`.
- **No** se implementa la gestión del buffer interno de `printf`.
- La biblioteca se crea con **`ar`**; el uso de `libtool` está prohibido.
- El Makefile debe tener `NAME`, `all`, `clean`, `fclean` y `re`, compilar con `cc` y `-Wall -Wextra -Werror`, y no relinkear objetos sin cambios.

### Conversiones obligatorias

| Conversión | Argumento esperado | Qué imprime |
|---|---|---|
| `%c` | `int` (promovido de `char`) | Un solo carácter |
| `%s` | `char *` | La cadena hasta `\0` (por defecto en C) |
| `%p` | `void *` | El puntero en hexadecimal |
| `%d` | `int` | Número decimal con signo, base 10 |
| `%i` | `int` | Igual que `%d` en este proyecto |
| `%u` | `unsigned int` | Número decimal sin signo, base 10 |
| `%x` | `unsigned int` | Hexadecimal en minúsculas, base 16 |
| `%X` | `unsigned int` | Hexadecimal en mayúsculas, base 16 |
| `%%` | — | El carácter `%` |

### Funciones autorizadas

`malloc`, `free`, `write`, `va_start`, `va_arg`, `va_copy`, `va_end`.

Nada más. Esto tiene consecuencias directas: no puedes llamar a `printf`, `putchar`, `strlen`, `isdigit`… de la libc. Cualquier utilidad que necesites (longitud de cadena, densidad de dígito, máximo, comparación de especie) debe implementarse dentro del proyecto.

## 2. Reglas que pueden invalidar la entrega

- No seguir la Norma 42 en cualquier `.c`/`.h` (incluye los extra).
- Que una función termine inesperadamente: segfault, bus error, double free… (salvo comportamiento indefinido del contrato original).
- Leaks de memoria (en este proyecto el camino de números no reserva heap, así que el foco son los tests propios).
- Falta de algún objetivo Makefile (`NAME`, `all`, `clean`, `fclean`, `re`), relink, o uso de `libtool`.
- Entregar el bonus en archivos que no sean `_bonus.{c,h}` o sin regla `bonus` separada.
- Que algún nombre de archivo no coincida con lo esperado: solo se evalúa lo que está dentro del repositorio. Se recomienda comprobar nombres dos veces.

## 3. Bonus

El bonus solo se evalúa si la parte obligatoria está **perfecta**, y no hace falta hacerlo todo:

- Gestionar **cualquier combinación** de los flags `-0.` y el ancho mínimo (`field minimum width`) bajo todas las conversiones posibles.
- Gestionar los flags `# +` (sí, uno de ellos es un espacio).

Observa que `-`, `0`, `.`, ancho, `#`, `+` y espacio no forman parte de las conversiones obligatorias como tales: son características extra del formateo. El subject aconseja pensar en ellas desde el principio para evitar un enfoque ingenuo.

## 4. Entorno objetivo y herramientas

- Sistema: Linux, glibc (el comportamiento de referencia es el `printf` de glibc, incluido `(nil)` para `%p` nulo y `(null)` para `%s` nula).
- Compilador: `cc` con `-Wall -Wextra -Werror`.

| Herramienta | Uso |
|---|---|
| `cc` | Compilar fuentes, tests y ejecutables de comparación |
| `ar` | Crear e inspeccionar `libftprintf.a` |
| `nm` | Ver símbolos definidos y no resueltos de la biblioteca |
| `make` | Auto-tizar objetivos y dependencias |
| `valgrind` | Detectar fugas y accesos inválidos en los tests |
| `diff` | Comparar la salida de `ft_printf` y `printf` |

Comprueba el entorno antes de empezar:

```sh
cc --version
make --version
ar --version
```

## 5. Modelo mental mínimo

### Funciones variádicas

`printf` no sabe cuántos argumentos va a recibir. El mecanismo es la lista de argumentos variable:

- `va_start(ap, last)` inicializa la lista a partir del último parámetro nombrado (`format`).
- `va_arg(ap, TIPO)` extrae el siguiente argumento interpretándolo como `TIPO`.
- `va_end(ap)` cierra la lista.

Regla de oro del C: **los argumentos variádicos sufren promoción por defecto**. Un `char` o `short` se convierte a `int`; un `float` se convierte a `double`. Por eso el `%c` lee `int` y no `char`: el valor ya viaja como `int`. De la misma forma, `%p` lee `void *`, `%d`/`%i` leen `int`, y `%u`/`%x`/`%X` leen `unsigned int`.

### El formato es una cadena que se recorre

`ft_printf` recorre el `format` carácter a carácter. Los bytes normales se escriben tal cual. Al encontrar `%`, se:

1. **parsea** la conversión (flags, ancho, precisión, convertidor),
2. **extrae** el argumento correspondiente,
3. **formatea** (escribe el texto y cuenta caracteres),
4. acumula el resultado en un contador global.

El valor de retorno es el **número de caracteres escritos**: la suma de todo lo emitido. La implementación de referencia devuelve `-1` si el `format` es `NULL` y propaga `-1` si alguna `write` falla.

### El estado del formateo: `t_fmt`

```c
typedef struct s_fmt
{
	int		left;           /* flag '-' */
	int		zero;           /* flag '0' */
	int		hash;           /* flag '#' */
	int		space;          /* flag ' ' */
	int		plus;           /* flag '+' */
	int		width;          /* ancho mínimo */
	int		precision;      /* precisión numérica */
	int		has_precision;  /* ¿apareció '.'? */
	char	spec;           /* c, s, p, d, i, u, x, X, % */
}	t_fmt;
```

Una conversión queda descrita por estos campos. Toda la lógica posterior lee `t_fmt` y no vuelve a tocar el `format`.

### Salida char a char

El subject prohíbe reproducir el buffer de `printf`. La referencia escribió directamente con `write(1, &c, 1)` char a char (`ft_putstrn`/`ft_putnchar`) y cuenta cuántos bytes consigue escribir. Esto elimina por completo la necesidad de `malloc` en el camino de formateo.

## 6. Estructura recomendada (la de la referencia)

La implementación separa parseo, dispatch, salida y formateo por familias:

```text
.
├── Makefile
├── README.md
├── en.subject.pdf
├── ft_printf.h
├── ft_printf.c           → bucle principal sobre el format
├── ft_parse.c            → flags, ancho, precisión, convertidor
├── ft_format.c           → dispatch por especie
├── ft_format_text.c      → %c, %s, %%
├── ft_format_numbers.c   → %d, %i, %u
├── ft_format_hex.c       → %x, %X, con flag #
├── ft_format_pointer.c   → %p, incluido (nil)
├── ft_number_core.c      → ft_print_number: prefijo, ceros, dígitos, padding
├── ft_output.c           → ft_putnchar / ft_putstrn sobre write(1, …)
├── ft_utils.c            → ft_strlen, ft_isdigit, ft_is_spec, ft_max
├── ft_bonus_bonus.c      → marcador de bonus (solo regla bonus)
└── main_bonus_test.c     → tester local contra printf (no se entrega)
```

Prototipos públicos en el header:

```c
int ft_printf(const char *format, ...);
int ft_parse(const char *format, int i, t_fmt *fmt);
int ft_format(va_list ap, t_fmt *fmt);
int ft_print_number(unsigned long n, t_fmt *fmt, char *prefix, int base);
int ft_putnchar(char c, int n);
int ft_putstrn(const char *str, int n);
```

No es obligatorio usar exactamente esta distribución, pero la separación por responsabilidades (parsear ≠ formatear ≠ escribir) es la que hace el proyecto manejable.

## 7. El bucle principal: `ft_printf`

```c
int	ft_printf(const char *format, ...)
{
	va_list	ap;
	t_fmt	fmt;
	int		i;
	int		total;

	if (!format)
		return (-1);
	va_start(ap, format);
	i = 0;
	total = 0;
	while (format[i] && total >= 0)
	{
		if (format[i] == '%')
		{
			i = ft_parse(format, i + 1, &fmt);
			if (fmt.spec)
				total = ft_add(total, ft_format(ap, &fmt));
		}
		else
			total = ft_add(total, ft_putstrn(format + i++, 1));
	}
	va_end(ap);
	return (total);
}
```

Puntos que debes poder explicar:

- `ft_add(total, value)` devuelve `-1` si alguno de los dos es negativo: así, un fallo de `write` se propaga y corta el bucle (`total >= 0`).
- `ft_parse` devuelve la **posición** siguiente al convertidor, y el bucle continúa desde ahí.
- Si `fmt.spec` es `0` (conversión inválida, p. ej. `%q`), no se formatea nada; el carácter se tratará como texto normal en la siguiente iteración. Esta conversión queda fuera del alcance exigido por el subject.
- Al final se `va_end(ap)` siempre, también en los caminos cortos.

## 8. El parser: `ft_parse`

```c
int	ft_parse(const char *format, int i, t_fmt *fmt)
{
	ft_init_fmt(fmt);
	i = ft_parse_flags(format, i, fmt);
	while (ft_isdigit(format[i]))
		fmt->width = fmt->width * 10 + format[i++] - '0';
	if (format[i] == '.')
	{
		fmt->has_precision = 1;
		i++;
		while (ft_isdigit(format[i]))
			fmt->precision = fmt->precision * 10 + format[i++] - '0';
	}
	if (fmt->left)
		fmt->zero = 0;
	if (ft_is_spec(format[i]))
		fmt->spec = format[i++];
	return (i);
}
```

- `ft_parse_flags` consume tantos caracteres de `-0# +` como encuentre, activando cada campo.
- Después se acumula el **ancho** dígito a dígito.
- Si aparece `.`, se marca `has_precision` y se acumula la **precisión** dígito a dígito.
- Detalle importante: **`-` anula `0`** (`if (fmt->left) fmt->zero = 0;`), exactamente como hace `printf`: con alineación a la izquierda, el relleno de ceros no tiene sentido.
- Si el carácter final es un convertidor válido (`ft_is_spec`), se guarda en `fmt->spec` y se avanza una posición.

## 9. El dispatcher: `ft_format`

```c
int	ft_format(va_list ap, t_fmt *fmt)
{
	if (fmt->spec == 'c')  return (ft_format_char(va_arg(ap, int), fmt));
	if (fmt->spec == 's')  return (ft_format_string(va_arg(ap, char *), fmt));
	if (fmt->spec == 'p')  return (ft_format_pointer(va_arg(ap, void *), fmt));
	if (fmt->spec == 'd' || fmt->spec == 'i')
		return (ft_format_signed(va_arg(ap, int), fmt));
	if (fmt->spec == 'u')  return (ft_format_unsigned(va_arg(ap, unsigned int), fmt));
	if (fmt->spec == 'x')  return (ft_format_hex(va_arg(ap, unsigned int), fmt, 0));
	if (fmt->spec == 'X')  return (ft_format_hex(va_arg(ap, unsigned int), fmt, 1));
	if (fmt->spec == '%')  return (ft_format_percent(fmt));
	return (0);
}
```

Fíjate en los tipos extraídos con `va_arg`: reflejan las promociones de la sección 5. `%c` lee `int`; `%x`/`%X` leen `unsigned int` aunque el llamador pase un `char` o un `int` con signo; `%s` lee `char *`; `%p` lee `void *`. No hay orden de extracción libre: el orden de `va_arg` debe coincidir exactamente con el orden de argumentos del llamador.

## 10. Texto: `%c`, `%s`, `%%`

### `%c`

```c
pad = ft_max(fmt->width - 1, 0);
if (!fmt->left) count = ft_join(count, ft_putnchar(' ', pad));
count = ft_join(count, ft_putstrn(&ch, 1));
if (fmt->left) count = ft_join(count, ft_putnchar(' ', pad));
```

Un carácter ocupa 1; el resto del ancho se rellena con espacios a la izquierda (o a la derecha con `-`). Se imprime el carácter tal cual, incluidos `\0`, `\n` o bytes no imprimibles. `printf` ignora `0` y precisión para `%c`.

### `%s`

```c
if (!str) str = "(null)";
len = ft_strlen(str);
if (fmt->has_precision && fmt->precision < len) len = fmt->precision;
pad = ft_max(fmt->width - len, 0);
```

La cadena nula se sustituye por `"(null)"` (comportamiento de glibc en Linux). La precisión **recorta** la cantidad de bytes que se imprimen; el ancho solo se aplica sobre la longitud efectiva. `ft_max` evita paddings negativos cuando el contenido es más largo que el ancho.

### `%%`

Idéntico a `%c` pero con carácter fijo `%` y la peculiaridad de que el flag `0` sí rellena con ceros (pad_char `'0'` cuando `fmt->zero && !fmt->left`).

## 11. Números con signo y sin signo: `%d`, `%i`, `%u`

```c
int	ft_format_signed(int n, t_fmt *fmt)
{
	unsigned long	value;
	char			*prefix;

	prefix = "";
	if (n < 0)
	{
		value = (unsigned long)(-(long)n);
		prefix = "-";
	}
	else
	{
		value = (unsigned long)n;
		if (fmt->plus) prefix = "+";
		else if (fmt->space) prefix = " ";
	}
	return (ft_print_number(value, fmt, prefix, 10));
}
```

Tres decisiones de diseño que debes entender:

- **`INT_MIN` no rompe**: el código convierte primero a `long` y luego niega (`-(long)n`) antes de pasarlo a `unsigned long`. Negar `INT_MIN` como `int` sería overflow; como `long` cabe perfectamente.
- El **prefijo de signo es un string** (`-`, `+` o espacio) que se cuenta aparte de los dígitos. `%+d` y `% d` solo tienen efecto si el número no es negativo; un negativo siempre lleva `-` y tiene prioridad.
- `%+d` gana a `% d` cuando ambos aparecen (primero `plus`, sino `space`).
- `%u` recibe `unsigned int` y por tanto `%u` con `-1` imprime `4294967295` (`UINT_MAX`), sin prefijo.

## 12. Hexadecimal y puntero: `%x`, `%X`, `%p`

### `%x` / `%X`

```c
prefix = "";
if (fmt->hash && n != 0 && fmt->spec == 'x') prefix = "0x";
else if (fmt->hash && n != 0 && fmt->spec == 'X') prefix = "0X";
return (ft_print_number((unsigned long)n, fmt, prefix, 16));
```

El flag `#` añade `0x`/`0X` **solo si el valor es distinto de cero** (con `n == 0` `printf` no imprime prefijo), y las letras respetan la caja de la conversión. El argumento se lee como `unsigned int`. La tabla de dígitos es `0123456789abcdef` o `0123456789ABCDEF`.

### `%p`

```c
if (!ptr) return (ft_ptr_nil(fmt));
value = (unsigned long)ptr;
len = ft_ptr_len(value);
zeros = ft_max(fmt->precision - len, 0);
if (fmt->zero && !fmt->left && !fmt->has_precision)
	zeros = ft_max(fmt->width - 2 - len, 0);
spaces = ft_max(fmt->width - 2 - zeros - len, 0);
```

- Puntero nulo → imprime `(nil)` (glibc/Linux), tratado como una cadena de 5 caracteres con su propio padding.
- Cualquier otro puntero se convierte a `unsigned long` y se imprime como hexadecimal **siempre en minúsculas**, precedido de `0x` (dos caracteres que se descuentan del ancho).
- El flag `0` puede rellenar con ceros entre `0x` y los dígitos (`%020p`).

## 13. El corazón: `ft_print_number`

Todo número del proyecto acaba aquí. Recibe el valor sin signo, el prefijo y la base, y resuelve **en qué orden** escribir las cuatro piezas: espacios, prefijo, ceros y dígitos.

```c
prefix_len = ft_strlen(prefix);
len    = ft_num_len(n, base, fmt);                  /* nº de dígitos (0 con .0 y valor 0) */
zeros  = ft_max(fmt->precision - len, 0);
if (fmt->zero && !fmt->left && !fmt->has_precision)
	zeros = ft_max(fmt->width - prefix_len - len, 0);
spaces = ft_max(fmt->width - prefix_len - zeros - len, 0);

if (!fmt->left) count += ft_putnchar(' ', spaces);
count += ft_prefix(prefix, prefix_len);
count += ft_putnchar('0', zeros);
count += ft_putnum(n, base, fmt->spec == 'X', len);
if (fmt->left)  count += ft_putnchar(' ', spaces);
```

La idea maestra: `zeros` puede venir de **dos fuentes** que nunca se mezclan.

1. **De la precisión**: `%.5d` de `42` → `zeros = 5 - 2 = 3` → `00042`; con `-42` → `-00042` (el prefijo no consume ceros de precisión).
2. **Del flag `0` con ancho**: solo si no hay `-` y no hay precisión, `%05d` de `-42` → `zeros = 5 - 1 - 2 = 2` → `-0042` (el signo cuenta dentro del ancho, como `printf`).

Los `spaces` se calculan restando del ancho todo lo demás (`prefix_len + zeros + len`), garantizando que el total de la línea sea exactamente `width` cuando `width > contenido`. Con `-` los espacios van detrás; sin `-`, delante.

### La conversión de dígitos sin `malloc`

`ft_putnum` construye los dígitos **en sentido inverso** en un buffer local de 32 bytes partiendo del final:

```c
char	buf[32];
i = 31;
buf[i--] = digits[n % base];   /* el dígito menos significativo arriba del todo */
n = n / base;
while (n > 0) { buf[i--] = digits[n % base]; n = n / base; }
return (ft_putstrn(buf + i + 1, len));
```

Como el dígito menos significativo se coloca al final del buffer y los siguientes se van escribiendo hacia el principio, al final `buf + i + 1` apunta al primer dígito significativo y la cadena queda en el orden correcto (casa UNIDAD→CENTENA). `len` ya se calculó antes, así que se imprimen exactamente `len` bytes. `len == 0` (precisión `.0` con valor `0`) imprime nada.

`ft_num_len` implementa el caso límite de la precisión `.0` con valor `0` devolviendo `0` dígitos, que es lo que hace `printf`.

## 14. Salida y errores: `ft_output`

```c
int	ft_putnchar(char c, int n)
{
	int	written = 0;
	while (written < n)
	{
		if (write(1, &c, 1) != 1)
			return (-1);
		written++;
	}
	return (written);
}
```

`ft_putnchar` y `ft_putstrn` son casi idénticas: escriben char a char en el descriptor `1` (stdout) y devuelven `-1` si `write` no completa el byte. Ese `-1` se propaga por `ft_add`/`ft_join` hasta el `total` de `ft_printf`, que devuelve `-1`. Así el error de escritura no se convierte silenciosamente en un contador falso.

## 15. Bonus: flags, ancho y precisión sobre los casos reales

Los flags y el ancho ya se aplican siempre en la referencia (estrategia integrada). Lo que hay que dominar es la **semántica completa de cada flag** combinada con cada conversión. Ejemplos reales contra `printf`:

| Formato | Argumento | Salida esperada |
|---|---|---|
| `%05d` | `-42` | `-0042` (el signo cuenta dentro del ancho) |
| `%-05d` | `42` | `42   ` (`-` anula `0`) |
| `%5.3d` | `42` | `  042` (con precisión, `0` de ancho se ignora) |
| `%.0d` | `42` | `42` |
| `%.0d` | `0` | *(vacío)* |
| `%5.0d` | `0` | `     ` (5 espacios) |
| `%+8.5d` | `42` | `  +00042` |
| `%#x` | `0` | `0` (sin prefijo con valor 0) |
| `%#x` | `48879` | `0xbeef` |
| `%#08x` | `48879` | `0x0000beef` |
| `%#.0x` | `0` | *(vacío)* |
| `%(nulo)` | `NULL` | `(nil)` |

Combinaciones típicas del bonus del subject: `-0.` con ancho bajo todas las conversiones, y `# +` (incluido el espacio, p. ej. `% d` → `" 42"`).

El tester `main_bonus_test.c` del repositorio contiene todas estas familias (`test_width`, `test_precision`, `test_zero_flag`, `test_hash_flag`, `test_sign_flags`, `test_bonus_combinations`) y compara el **valor de retorno** con `printf`, dejando la comparación visual de las líneas para el ojo humano.

## 16. Makefile y la biblioteca estática

```make
NAME = libftprintf.a
CC = cc
CFLAGS = -Wall -Wextra -Werror
AR = ar rcs

SRCS = ft_printf.c ft_parse.c ft_format.c ft_format_text.c \
	ft_format_numbers.c ft_format_hex.c ft_format_pointer.c \
	ft_number_core.c ft_output.c ft_utils.c
BONUS_SRCS = $(SRCS) ft_bonus_bonus.c

all: $(NAME)
$(NAME): $(OBJS)
	$(AR) $(NAME) $(OBJS)

bonus: $(BONUS_STAMP)
$(BONUS_STAMP): $(BONUS_OBJS)
	$(AR) $(NAME) $(BONUS_OBJS)
	touch $(BONUS_STAMP)

clean:
	$(RM) $(OBJS) $(BONUS_OBJS) $(BONUS_STAMP)
fclean: clean
	$(RM) $(NAME)
re: fclean all
```

Decisiones que debes justificar:

- `NAME`, `all`, `clean`, `fclean`, `re` presentes; `all` depende de `$(NAME)`, que solo se re-archiva cuando cambia algún objeto (para el no-relink, confía en la regla de patrones `%.o: %.c ft_printf.h`).
- `ar rcs` crea la biblioteca; no aparece `libtool`.
- **Norma de bonus**: los bonus van en archivos separados `_bonus.{c,h}` y se incorporan con una regla `bonus`. Aquí `ft_bonus_bonus.c` solo está en `BONUS_SRCS`, y el objetivo `bonus` usa un archivo centinela `.bonus` para archivar el objeto extra sin tocar la compilación obligatoria. Objeto bonus fuera del `all`.
- Reglas para comprobar la biblioteca:

```sh
make
ar t libftprintf.a
nm -g --defined-only libftprintf.a
```

## 17. Tester y casos límite

El proyecto se valida por **comparación con `printf`**: mismo texto y mismo valor de retorno. Casos que destapan casi todos los bugs:

- `INT_MIN` y `INT_MAX` en `%d`/`%i` (negación sin overflow).
- `UINT_MAX` y `-1` en `%u`.
- `0` con precisión `.0` (dígitos vacíos) y con bandas `%5.0d`, `%#.0x`.
- Precisión antes que ancho: `%8.5d`, `%08.3x`.
- `%s` con `""` y con `NULL`.
- `%c` con valor `0` (carácter NUL) y con ancho.
- `%p` con `NULL` (`(nil)`) y con puntero real.
- Signos y espacios mal ordenados: `"% +d"`, `"%+ d"`, `"%-05d"`.
- Flags combinados: `"%#-012.8x"`, `"%+- 012.8d"`.

Estructura de un test comparativo:

```c
int ft_ret = printf("…" …);   /* referencia */
/* … comparar texto y retorno con ft_printf … */
```

Importante: captura primero retorno y texto de una llamada, y solo después imprime/usa la otra; nunca midas una con `printf` dentro del propio cómputo de la otra (eso añadiría caracteres al retorno).

## 18. Auditoría de la parte obligatoria

No empieces a depender del bonus hasta poder responder afirmativamente:

- `make`, `make clean`, `make fclean` y `make re` funcionan; un segundo `make` no hace trabajo innecesario.
- La salida se llama exactamente `libftprintf.a` y está en la raíz.
- La biblioteca se crea con `ar` y contiene los símbolos esperados (`nm -g --defined-only`).
- Cada conversión `cspdiuxX%` coincide con `printf` en casos normales, límites (`INT_MIN`, `UINT_MAX`, `0`, `.0`) e incluso bytes no imprimibles.
- El valor de retorno es el número exacto de caracteres escritos.
- `ft_printf(NULL)` y los fallos de `write` devuelven `-1` sin comportamiento inesperado.
- No hay leaks en los tests que reservan memoria (Valgrind limpio).
- Puedes explicar el flujo completo: parseo → dispatch → `ft_print_number` → `write`, y por qué `%c` extrae `int`.

## 19. Depuración

El flujo es lineal y sencillo de seguir con `gdb`:

```gdb
break ft_printf
break ft_parse
break ft_print_number
run "test %05d" 42
si  ni  bt
```

Pregúntate durante el trace:

- ¿Qué conversión estoy parseando ahora (estado de `fmt`)?
- ¿Cuántos dígitos van a imprimirse (`len`)?
- ¿Los `zeros` vienen de la precisión o del flag `0`?
- ¿Estoy calculando los `spaces` con los mismos términos que `printf`?
- ¿Qué devuelve cada `write` y se está acumulando bien el contador?

Para diferencias sutiles de salida, redirige stdout de ambos programas a dos archivos y compáralos con `diff`; los retornos se comparan en el tester.

## 20. Preparación de la defensa

Debes poder responder sin mirar el código:

- ¿Qué hace `va_start`, `va_arg` y `va_end`, y por qué `%c` lee `int`?
- ¿Por qué no se puede usar `printf` ni `strlen` de la libc?
- ¿Qué contiene `t_fmt` y qué significa cada campo?
- ¿Por qué `-` anula `0` y por qué con precisión el flag `0` se ignora?
- ¿Cómo se representa `INT_MIN` sin overflow en `%d`?
- ¿Cuál es el orden de escritura en `ft_print_number` y cómo se calculan los ceros?
- ¿Cuándo `%#x` NO imprime el prefijo?
- ¿Qué imprime `%p` con `NULL` en nuestra plataforma?
- ¿Qué devuelve `ft_printf` si `write` falla?
- ¿Cómo verifica un tester que la salida coincide con `printf`?

Durante la defensa, explica primero el contrato (retorno, conversiones), después el flujo (parsing, dispatch, número) y finalmente las pruebas.

## 21. Programa de clases interactivas

Cada sesión seguirá este formato: repaso breve → explicación con modelo mental → predicciones de salida/retorno antes de ejecutar → un ejercicio pequeño → implementación conjunta → depuración y tests → preguntas tipo defensa → resumen y tarea.

Al terminar cada clase se creará o actualizará un documento independiente en `clases/`, numerado y escrito como material reutilizable.

### Clase 1: funciones variádicas y promociones

Objetivos: `va_list`, `va_start`, `va_arg`, `va_end`; por qué los `char` viajan como `int`; por qué `%x` lee `unsigned int`.
Resultado: predecir qué tipo extrae cada conversión y escribir un mini-número con `va_arg`.

### Clase 2: bucle principal y `t_fmt`

Objetivos: recorrer el `format`, detectar `%`, acumular retorno, estructura `t_fmt`.
Resultado: `ft_printf` que imprime texto plano y devuelve el número de caracteres.

### Clase 3: `%c`, `%s` y `%%`

Objetivos: escritura char a char, `(null)`, padding por ancho, `%%`.
Resultado: las tres conversiones de texto comparadas con `printf`.

### Clase 4: `%d`, `%i`, `%u`

Objetivos: signo y prefijo, `INT_MIN` sin overflow, buffer inverso local.
Resultado: números correctos en casos límite frente a `printf`.

### Clase 5: `%x`, `%X`, `%p`

Objetivos: cambio de base sin `malloc`, flag `#`, `0x`, `(nil)`.
Resultado: hexadecimales y punteros idénticos a `printf`.

### Clase 6: parser completo: flags, ancho y precisión

Objetivos: `ft_parse`, acumulación dígito a dígito, `-` anula `0`.
Resultado: `t_fmt` correctamente rellenado para formatos complejos.

### Clase 7: `ft_print_number` y la fórmula del padding

Objetivos: cuatro piezas (espacios, prefijo, ceros, dígitos), fuentes de `zeros` (precisión vs `0`).
Resultado: ancho y precisión exactos para `%8.5d`, `%05d`, `%-8.5d`, `%.0d`.

### Clase 8: bonus `#`, `+` y espacio con combinaciones

Objetivos: prefijos `0x`, signos explícitos, prioridad `+` sobre espacio, `%#08x`, `%+012.8d`.
Resultado: combinaciones bonus comparadas contra `printf`.

### Clase 9: Makefile, biblioteca estática y auditoría final

Objetivos: `ar`, objetivos `make`, no-relink, regla `bonus`, tester comparativo, defensa.
Resultado: entrega reproducible, explicable y ajustada al subject.

## 22. Cómo pedir la siguiente clase

Puedes iniciar con una petición como:

```text
Empecemos la clase 1 de ft_printf. No asumas conocimientos previos.
```

En sesiones posteriores indica qué código has escrito y qué parte no entiendes. Si te bloqueas, el profesor debe escalar la ayuda: pregunta conceptual, pista, pseudocódigo, fragmento y solo finalmente la implementación completa razonada.

## 23. Referencias

- `en.subject.pdf`, ft_printf v12.0: especificación normativa del proyecto.
- `man 3 printf`: contrato de referencia de formato y conversiones.
- `man 3 stdarg`: funciones variádicas (`va_list`, `va_start`, `va_arg`, `va_copy`, `va_end`).
- `man 2 write`: escritura y valores de retorno/errores.
- `man 3 malloc`, `man 3 free`: si el tester necesita memoria dinámica.
- `ar(1)` y `nm(1)`: creación e inspección de bibliotecas estáticas.
- Implementación de referencia y `main_bonus_test.c` en la raíz de este repositorio.

---

La regla de trabajo del proyecto será: comprender, predecir, implementar, inspeccionar y probar. Una conversión no está terminada cuando “parece funcionar”, sino cuando coincide con `printf` en texto y retorno, en los casos normales y en los límites, y puedes explicar por qué.