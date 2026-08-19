# ft_printf Agent Notes

## Source Of Truth
- `en.subject.pdf` (version 12.0, subject en español) es la especificación normativa del proyecto. `GUIA_FT_PRINTF.md` traduce el subject al itinerario de clases; en caso de conflicto, manda el PDF.
- Este repositorio contiene una **implementación completa y validada** de referencia en la raíz (`ft_printf.c`, `ft_parse.c`, `ft_format.c`, `ft_format_text.c`, `ft_format_numbers.c`, `ft_format_hex.c`, `ft_format_pointer.c`, `ft_number_core.c`, `ft_output.c`, `ft_utils.c`, `ft_bonus_bonus.c`, `ft_printf.h`).
- La implementación de referencia **no usa libft**: todas las utilidades (`ft_strlen`, `ft_isdigit`, `ft_max`) están implementadas dentro del proyecto, y solo se usan las funciones autorizadas (`malloc`, `free`, `write`, `va_start`, `va_arg`, `va_copy`, `va_end`).
- No inventar comandos de build: los objetivos y flags del `Makefile` del repositorio son autoritativos (`all`, `clean`, `fclean`, `re`, `bonus`, `NAME = libftprintf.a`).

## Evaluation Constraints
- Entregable: librería estática `libftprintf.a` en la raíz del repositorio, creada con `ar` (`libtool` prohibido).
- Makefile con `NAME`, `all`, `clean`, `fclean` y `re`; compilar con `cc` y `-Wall -Wextra -Werror`; no debe relinkear objetos sin cambios.
- Funciones autorizadas: `malloc`, `free`, `write`, `va_start`, `va_arg`, `va_copy`, `va_end`.
- Firme la Norma 42 en todos los fuentes; las funciones no deben terminar inesperadamente (segfault, bus error, doble free…) salvo comportamiento indefinido; sin leaks.
- Conversiones obligatorias exactamente `cspdiuxX%`. No se implementa la gestión del buffer del `printf` original.
- La función debe devolver el número de caracteres escritos; la implementación de referencia devuelve `-1` para `format == NULL` y ante errores de `write`.
- `ft_printf` se compara contra `printf(3)` de la plataforma (glibc/Linux) para verificar comportamiento.

## Bonus Boundary
- Bonus sujetos a tener la parte obligatoria perfecta: gestionar combinaciones de flags `-0.` con ancho mínimo bajo todas las conversiones, y flags `#`, `+` y espacio.
- En la referencia, los flags, el ancho y la precisión se parsean y aplican **siempre** en los fuentes obligatorios (estrategia integrada), y el objetivo `bonus` añade `ft_bonus_bonus.o` (archivo `_bonus` separado) para declarar el bonus presente sin contaminar la compilación obligatoria.
- No empezar a depender del bonus hasta que cada conversión obligatoria coincide con `printf` en los casos básicos.

## Teaching Mode
- Sesiones interactivas para un principiante: construir primero el modelo mental de funciones variádicas (`va_list`) y del formato como cadena a recorrer; después pedir predicciones de salida y valor de retorno; solo entonces implementar y depurar.
- Escalar la ayuda gradualmente: preguntas, pistas, pseudocódigo, fragmentos y solo al final la implementación completa razonada; no convertir los ejercicios en soluciones copiadas.
- Revisar el código en términos de: promociones de argumentos variádicos, valores de retorno de `write`, orden de salida de padding/prefijo/dígitos, casos límite (`INT_MIN`, `UINT_MAX`, precisión `0` con valor `0`, `(nil)`, `(null)`) y comportamiento observable frente a `printf`.
- Cerrar cada lección con resumen, preguntas tipo defensa, un pequeño ejercicio y un criterio de finalización explícito.
- Tras cada clase numerada, crear o actualizar su draft independiente en `proyectos/ft_printf/clases/clase-NN.md` según la plantilla canónica, listo para publicación bilingüe posterior; no transcribir la conversación del alumno verbatim.