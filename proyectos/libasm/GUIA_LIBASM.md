# Guía de aprendizaje y desarrollo de Libasm

Esta guía traduce el `en.subject.pdf` v5.4 a un itinerario práctico para Linux x86-64. No sustituye al subject: si una indicación futura contradice el PDF, manda el PDF.

El objetivo no es copiar seis funciones cortas. Es aprender a razonar sobre memoria, registros, ABI, syscalls, enlace y depuración hasta poder explicar cada instrucción durante la defensa.

## 1. Qué exige exactamente el proyecto

### Parte obligatoria

Debes producir una biblioteca estática llamada `libasm.a` con estos símbolos:

| Símbolo | Referencia | Responsabilidad principal |
|---|---|---|
| `ft_strlen` | `strlen(3)` | Contar bytes hasta `\0` |
| `ft_strcpy` | `strcpy(3)` | Copiar toda la cadena, incluido `\0`, y devolver `dst` |
| `ft_strcmp` | `strcmp(3)` | Comparar los primeros bytes distintos como `unsigned char` |
| `ft_write` | `write(2)` | Ejecutar la syscall y reproducir retorno y `errno` de libc |
| `ft_read` | `read(2)` | Ejecutar la syscall y reproducir retorno y `errno` de libc |
| `ft_strdup` | `strdup(3)` | Reservar y copiar una cadena nueva; se permite llamar a `malloc` |

También debes entregar un `main` que enlace con `libasm.a` y demuestre que las funciones funcionan.

### Reglas que pueden invalidar la entrega

- Todo el ensamblador debe ser de 64 bits.
- Los fuentes de ensamblador deben ser archivos `.s`; no se permite ensamblador inline.
- Debes usar NASM y sintaxis Intel, no GAS con sintaxis AT&T.
- Está prohibido compilar o enlazar con `-no-pie`.
- Las funciones no pueden terminar inesperadamente salvo cuando el contrato original tenga comportamiento indefinido.
- `ft_read` y `ft_write` deben devolver `-1` y establecer `errno` correctamente en caso de error.
- El Makefile debe tener `$(NAME)`, `all`, `clean`, `fclean` y `re`.
- El Makefile no debe recompilar ni reenlazar entradas que no han cambiado.
- Solo se evalúa lo que esté dentro del repositorio entregado.

### Bonus

El bonus solo se corrige si toda la parte obligatoria es perfecta:

- `ft_atoi_base`
- `ft_list_push_front`
- `ft_list_size`
- `ft_list_sort`
- `ft_list_remove_if`

Mantén el bonus en archivos separados con sufijo `_bonus` y añádelo mediante una regla `bonus`. No mezcles objetos bonus en el objetivo obligatorio.

## 2. Entorno objetivo y herramientas

Esta guía usa:

- Arquitectura: x86-64.
- Sistema: Linux.
- Formato de objeto: ELF64.
- ABI de funciones: System V AMD64.
- Ensamblador: NASM con sintaxis Intel.
- Biblioteca C: glibc.

Herramientas recomendadas:

| Herramienta | Uso |
|---|---|
| `nasm` | Ensamblar `.s` a `.o` ELF64 |
| `cc` | Compilar el tester C y enlazar el ejecutable PIE |
| `make` | Automatizar dependencias y objetivos |
| `ar` | Crear e inspeccionar `libasm.a` |
| `nm` | Ver símbolos definidos y no resueltos |
| `objdump` | Inspeccionar cabeceras, relocaciones y desensamblado |
| `gdb` | Ejecutar instrucción a instrucción |
| `strace` | Observar syscalls y sus resultados |
| `valgrind` | Detectar accesos inválidos y fugas en tests |

En el entorno actual están disponibles todas salvo NASM. En Ubuntu se instala normalmente con:

```sh
sudo apt update
sudo apt install nasm
```

Comprueba el entorno antes de empezar:

```sh
uname -m
nasm --version
cc --version
make --version
gdb --version
```

El ensamblado elemental tendrá esta forma:

```sh
nasm -f elf64 -g -F dwarf fuente.s -o fuente.o
```

`-g -F dwarf` facilita la depuración y no cambia el contrato de la función. Los comandos definitivos deben vivir en el Makefile cuando este exista.

## 3. Modelo mental mínimo

### Bytes, palabras y direcciones

La memoria puede imaginarse como una secuencia de cajas de un byte. Un puntero contiene la dirección de una caja, no el contenido de esa caja.

En x86-64 los enteros de varios bytes se almacenan en little-endian. El valor `0x12345678` ocupa, de menor a mayor dirección, los bytes `78 56 34 12`. Para las cadenas esto apenas se nota porque se procesan byte a byte.

Una cadena C es una secuencia de bytes terminada por un byte cero. No lleva su longitud almacenada. `strlen` debe buscar el terminador cada vez.

### Registros

Los registros son almacenamiento muy pequeño y rápido dentro de la CPU. Los más relevantes son:

| Registro | Uso habitual en este proyecto |
|---|---|
| `rax` | Retorno, acumulador y número de syscall |
| `rdi` | Primer argumento |
| `rsi` | Segundo argumento |
| `rdx` | Tercer argumento |
| `rcx` | Cuarto argumento de función; contador temporal |
| `r8`, `r9` | Quinto y sexto argumento de función |
| `rsp` | Tope de la pila |
| `rbp` | Registro preservado; frame pointer si se decide usarlo |
| `rbx`, `r12`-`r15` | Registros que una función debe preservar |
| `r10` | Cuarto argumento de syscall Linux |
| `r11` | Temporal; la instrucción `syscall` lo destruye |

Subregistros importantes:

- `rax`: 64 bits.
- `eax`: 32 bits bajos; escribir aquí pone a cero los 32 bits altos.
- `ax`: 16 bits bajos.
- `al`: 8 bits bajos.

Para cargar un byte y usarlo como número sin signo, `movzx eax, byte [dirección]` evita que un byte como `0xff` se convierta accidentalmente en un número negativo.

### Flags y control de flujo

`cmp a, b` calcula conceptualmente `a - b` sin guardar el resultado y actualiza flags. Un salto posterior interpreta esos flags:

| Salto | Significado frecuente |
|---|---|
| `je` / `jz` | Igual / resultado cero |
| `jne` / `jnz` | Distinto / resultado no cero |
| `jl`, `jg` | Menor/mayor con signo |
| `jb`, `ja` | Menor/mayor sin signo |
| `js` | Resultado con bit de signo activo |

No mezcles comparaciones con y sin signo. En particular, los caracteres de `strcmp` se interpretan como bytes sin signo.

### La pila

La pila crece hacia direcciones menores. `call` coloca la dirección de retorno en la pila y salta; `ret` extrae esa dirección.

Un `push` resta 8 a `rsp` y escribe ocho bytes. Un `pop` lee ocho bytes y suma 8 a `rsp`. Cada modificación debe quedar compensada antes de `ret`.

## 4. ABI System V AMD64

La ABI es el acuerdo que permite que C y ASM se llamen mutuamente.

### Argumentos y retorno

Los seis primeros argumentos enteros o punteros llegan en este orden:

```text
rdi, rsi, rdx, rcx, r8, r9
```

El retorno entero o puntero se coloca en `rax`. Un `int` usa la parte baja `eax`, aunque es prudente producir un valor coherente con el tipo esperado.

### Registros volátiles y preservados

Una función puede destruir sin guardar:

```text
rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11
```

Una función que quiera usar estos registros debe restaurarlos antes de retornar:

```text
rbx, rbp, r12, r13, r14, r15
```

La consecuencia práctica es importante: si guardas un puntero en `rdi` y luego llamas a `malloc`, no puedes asumir que `rdi` conserva ese puntero. Debes guardarlo en pila o en un registro preservado que tú mismo salves y restaures.

### Alineación de la pila

Antes de ejecutar una instrucción `call`, el llamador debe tener `rsp` alineado a 16 bytes. Como el propio `call` apila 8 bytes, al entrar normalmente en una función se cumple:

```text
rsp % 16 == 8
```

Una función hoja, que no llama a nadie, puede no tocar `rsp`. Una función que vaya a llamar a otra debe ajustar la pila y mantener equilibrados todos sus `push`, `sub rsp, ...`, `pop` y `add rsp, ...`.

### Plantilla conceptual

```nasm
default rel
section .text

global nombre_de_funcion
nombre_de_funcion:
    ; rdi, rsi, ... contienen argumentos
    ; colocar resultado en rax/eax
    ret

section .note.GNU-stack noalloc noexec nowrite progbits
```

`default rel` favorece direccionamiento relativo a RIP. La sección `.note.GNU-stack` comunica al linker que el objeto no necesita una pila ejecutable.

## 5. PIE, símbolos y llamadas externas

El subject prohíbe `-no-pie`; por tanto, no soluciones errores de relocación desactivando PIE. El código debe poder enlazarse en un ejecutable cuya dirección final no se conoce al ensamblar.

En Linux los símbolos no llevan el guion bajo inicial de macOS:

```nasm
global ft_strdup
extern malloc
extern __errno_location
```

Para una llamada externa desde NASM ELF64, utiliza una referencia al PLT cuando sea necesaria:

```nasm
call malloc wrt ..plt
```

Para datos propios usa referencias relativas, por ejemplo `[rel etiqueta]`, o activa `default rel`. Tras enlazar, revisa relocaciones y tipo de ejecutable:

```sh
readelf -h ./tester
readelf -r objeto.o
objdump -dr objeto.o
```

No memorices una receta sin entenderla: si el linker muestra una relocación incompatible con PIE, inspecciona qué símbolo se referencia y cómo se ha generado la relocación.

## 6. Estructura recomendada

Una estructura simple evita complejidad accidental:

```text
.
├── Makefile
├── libasm.h
├── main.c
├── ft_strlen.s
├── ft_strcpy.s
├── ft_strcmp.s
├── ft_write.s
├── ft_read.s
├── ft_strdup.s
├── libasm_bonus.h
├── ft_atoi_base_bonus.s
├── ft_list_push_front_bonus.s
├── ft_list_size_bonus.s
├── ft_list_sort_bonus.s
└── ft_list_remove_if_bonus.s
```

No es obligatorio usar exactamente esta distribución. Sí son obligatorios la biblioteca, los símbolos, los `.s`, la separación bonus y el `main` demostrativo.

Prototipos esperables para la cabecera obligatoria:

```c
size_t  ft_strlen(const char *s);
char    *ft_strcpy(char *dst, const char *src);
int     ft_strcmp(const char *s1, const char *s2);
ssize_t ft_write(int fd, const void *buf, size_t count);
ssize_t ft_read(int fd, void *buf, size_t count);
char    *ft_strdup(const char *s);
```

Incluye los headers C que definen `size_t` y `ssize_t`; no inventes tipos incompatibles.

## 7. Makefile

El Makefile debe expresar dependencias, no una secuencia que siempre recompila todo.

Diseño recomendado:

- `NAME := libasm.a`.
- Una lista de fuentes obligatorias y otra de bonus.
- Una transformación `.s` a `.o` con `nasm -f elf64`.
- `all` depende de `$(NAME)`.
- `$(NAME)` depende de objetos obligatorios y ejecuta `ar rcs` solo cuando alguno cambia.
- `clean` elimina objetos.
- `fclean` depende de `clean` y elimina `libasm.a`.
- `re` depende de `fclean` y `all`.
- `bonus` incorpora los objetos bonus sin contaminar la compilación obligatoria.

Comprobaciones de incrementalidad:

```sh
make
make
touch ft_strlen.s
make
```

La segunda ejecución no debería ensamblar ni archivar nada. Tras tocar `ft_strlen.s`, solo debería regenerarse su objeto y actualizarse la biblioteca.

Comprueba el archivo:

```sh
ar t libasm.a
nm -g --defined-only libasm.a
```

No añadas `-no-pie` ni escondas warnings del linker sin comprenderlos.

## 8. Orden de implementación obligatorio

Orden recomendado:

1. Preparar cabecera, Makefile mínimo y tester.
2. Implementar `ft_strlen`.
3. Implementar `ft_strcpy`.
4. Implementar `ft_strcmp`.
5. Implementar `ft_write`.
6. Implementar `ft_read`.
7. Implementar `ft_strdup`.
8. Construir una matriz de tests comparativos.
9. Auditar ABI, PIE, `errno`, símbolos e incrementalidad.
10. Empezar el bonus únicamente cuando todo lo anterior pase.

Este orden introduce una dificultad cada vez: bucle, dos punteros, semántica sin signo, kernel, errores, llamada externa y memoria dinámica.

## 9. `ft_strlen`

Contrato:

```c
size_t ft_strlen(const char *s);
```

Algoritmo:

1. Inicializar el contador a cero.
2. Leer el byte `s[contador]`.
3. Si es cero, terminar.
4. Incrementar el contador y repetir.
5. Devolver el contador en `rax`.

Invariante útil: antes de cada iteración, todos los bytes con índice menor que el contador son distintos de cero.

Casos de prueba:

| Entrada | Resultado |
|---|---:|
| `""` | 0 |
| `"a"` | 1 |
| `"hola"` | 4 |
| Cadena larga | Igual que `strlen` |
| Bytes UTF-8 | Número de bytes, no de caracteres visuales |

Errores frecuentes:

- Contar también el terminador.
- Leer de ocho en ocho antes de dominar los límites de página.
- Usar un contador de 32 bits y truncar longitudes teóricas.
- Intentar gestionar `NULL`: `strlen(NULL)` tiene comportamiento indefinido; el proyecto no exige inventar otro contrato.

## 10. `ft_strcpy`

Contrato:

```c
char *ft_strcpy(char *dst, const char *src);
```

Algoritmo:

1. Conservar el valor original de `dst` para el retorno.
2. Leer un byte de `src`.
3. Escribirlo en `dst`.
4. Si el byte era cero, terminar.
5. Avanzar ambos punteros y repetir.
6. Devolver el `dst` original, no el puntero avanzado.

Casos de prueba:

- Cadena vacía.
- Un carácter.
- Cadena normal.
- Buffer relleno previamente para comprobar que se escribe `\0`.
- Verificar que el puntero devuelto es exactamente `dst`.

El llamador debe proporcionar espacio suficiente. Un destino pequeño es comportamiento indefinido de `strcpy`; no es una extensión que debas corregir.

## 11. `ft_strcmp`

Contrato:

```c
int ft_strcmp(const char *s1, const char *s2);
```

Algoritmo:

1. Cargar un byte de cada cadena extendiéndolos con ceros.
2. Si son distintos, devolver `byte1 - byte2`.
3. Si ambos son cero, devolver cero.
4. Avanzar y repetir.

La norma de C define la comparación en términos de `unsigned char`. Por eso debes evitar extensión de signo al cargar bytes.

La función debe respetar el signo y, para comportarse como la implementación habitual, puede devolver la diferencia exacta. No reduzcas sin necesidad el resultado a `-1`, `0` o `1`.

Tests esenciales:

```text
""       contra ""
"a"      contra "a"
"a"      contra "b"
"b"      contra "a"
"abc"    contra "abcd"
"abcd"   contra "abc"
{0x80,0} contra {0x00,0}
{0xff,0} contra {0x01,0}
```

Compara el signo de `ft_strcmp` con `strcmp`; también puedes comparar el valor exacto en esta plataforma.

## 12. Syscalls Linux: base de `ft_read` y `ft_write`

Una función C y una syscall no son lo mismo. Tus funciones reciben argumentos según System V, pero la instrucción `syscall` entra al kernel con esta convención:

| Elemento | Registro x86-64 |
|---|---|
| Número de syscall | `rax` |
| Argumentos 1-3 | `rdi`, `rsi`, `rdx` |
| Argumentos 4-6 | `r10`, `r8`, `r9` |
| Retorno | `rax` |

Para este proyecto solo hay tres argumentos, así que llegan ya en los registros correctos.

Números Linux x86-64:

```text
read  = 0
write = 1
```

La instrucción `syscall` destruye `rcx` y `r11`.

### Diferencia crítica en los errores

El kernel devuelve un error como entero negativo, por ejemplo `-EBADF`. La función de libc debe exponer:

```text
retorno = -1
errno   = EBADF positivo
```

En Linux, los retornos entre `-4095` y `-1` representan errores. Para `read` y `write`, comprobar si `rax` es negativo es suficiente en la práctica porque un resultado válido no cabe en la zona negativa. El flujo conceptual es:

1. Ejecutar la syscall.
2. Si `rax >= 0`, devolver directamente.
3. Convertir `rax` negativo en número de error positivo.
4. Preservar ese número a través de la llamada siguiente.
5. Llamar a `__errno_location`.
6. Escribir el error como `int` de 32 bits en la dirección devuelta.
7. Devolver `-1` en `rax`.

`errno` es thread-local y puede ser una macro; no declares `extern int errno`. En glibc, `__errno_location()` devuelve el `int *` correspondiente al hilo actual.

El PDF menciona `___error` o `errno_location` para contemplar plataformas distintas. Para este objetivo Linux/glibc, el símbolo comprobado es `__errno_location` con dos guiones bajos. En macOS sería otra solución y otras syscalls; no mezcles ambas plataformas.

## 13. `ft_write`

Contrato:

```c
ssize_t ft_write(int fd, const void *buf, size_t count);
```

Camino de éxito:

1. Cargar `rax` con el número de `write`.
2. Ejecutar `syscall`.
3. Retornar el número de bytes escritos.

Camino de error: aplicar exactamente el flujo de `errno` de la sección anterior.

Tests esenciales:

- Escribir cero bytes.
- Escribir en `STDOUT_FILENO` o en un pipe capturable.
- Escribir en un archivo temporal y comparar contenido.
- Usar `fd = -1`; comparar retorno y `errno` con `write`.
- Escribir sobre el extremo incorrecto de un pipe.
- No asumir que una escritura correcta siempre escribe todo el buffer.

Para comparar `errno`, llama primero a la función de referencia, guarda inmediatamente retorno y `errno`, y después prueba tu función. Cualquier `printf` intermedio podría cambiar `errno`.

## 14. `ft_read`

Contrato:

```c
ssize_t ft_read(int fd, void *buf, size_t count);
```

La estructura es casi idéntica a `ft_write`; cambia el número de syscall.

Tests esenciales:

- Leer cero bytes.
- Leer desde un archivo vacío.
- Leer menos bytes que el tamaño del archivo.
- Leer más bytes que el tamaño del archivo y comprobar el retorno real.
- Leer varias veces para observar el desplazamiento del descriptor.
- Leer de un pipe.
- Usar `fd = -1` y comparar `errno`.
- Comprobar solo los bytes indicados por el retorno; `read` no añade `\0`.

No conviertas `read` en una función de cadenas. El buffer puede contener ceros y datos binarios.

## 15. `ft_strdup`

Contrato:

```c
char *ft_strdup(const char *s);
```

Algoritmo:

1. Preservar el puntero `s` a través de llamadas externas.
2. Obtener `len = ft_strlen(s)`.
3. Reservar `len + 1` bytes mediante `malloc`.
4. Si `malloc` devuelve `NULL`, retornar `NULL`.
5. Copiar la cadena, incluido `\0`, al bloque nuevo.
6. Devolver el bloque nuevo.

Aspectos de ABI:

- `malloc` puede destruir todos los registros caller-saved.
- Si usas `rbx` o `r12` para conservar `s`, guarda el valor original del registro y restáuralo.
- Alinea `rsp` antes de cada `call`.
- Las llamadas a símbolos externos deben ser compatibles con PIE.
- Si llamas a tus propias funciones, asegúrate de que sus contratos y preservación de registros ya están probados.

Tests esenciales:

- Cadena vacía.
- Cadena normal.
- Comparar contenido con `strdup`.
- Confirmar que el puntero es distinto del original.
- Modificar la copia y comprobar que el original no cambia.
- Liberar la copia.
- Ejecutar Valgrind sobre el tester.

No es razonable forzar un fallo real de `malloc` reservando memoria gigantesca en una máquina con overcommit. El contrato de retorno nulo sí debe estar contemplado en el código.

## 16. Tester obligatorio y estrategia de pruebas

El `main` entregado debe demostrar las funciones, pero conviene separar dos objetivos mentales:

- Demostración legible para la defensa.
- Tester riguroso que compara contra libc y fuerza errores.

Una utilidad C para registrar un resultado debería capturar primero retorno y `errno`, y solo después imprimir. Reinicia `errno` antes de cada llamada cuando la prueba lo necesite.

Matriz mínima:

| Función | Éxito | Límite | Error/propiedad |
|---|---|---|---|
| `ft_strlen` | Texto normal | Vacía, larga, UTF-8 | Igual a `strlen` |
| `ft_strcpy` | Copia normal | Vacía | Retorna `dst`, copia `\0` |
| `ft_strcmp` | Igual/distinta | Prefijos, bytes altos | Signo y semántica unsigned |
| `ft_write` | Archivo/pipe | `count = 0` | `fd = -1`, retorno y `errno` |
| `ft_read` | Archivo/pipe | EOF, lectura parcial | `fd = -1`, retorno y `errno` |
| `ft_strdup` | Copia normal | Vacía | Bloque independiente y liberable |

Herramientas de verificación:

```sh
nm -g --defined-only libasm.a
ar t libasm.a
strace -e trace=read,write ./tester
valgrind --leak-check=full --track-origins=yes ./tester
```

Compilar el tester con warnings estrictos ayuda a detectar prototipos incorrectos:

```sh
cc -Wall -Wextra -Werror -g main.c -L. -lasm -o tester
```

No añadas `-no-pie`. El ejecutable moderno será PIE por defecto en esta distribución.

## 17. Depuración con GDB

Flujo básico:

```sh
gdb ./tester
```

Comandos útiles dentro de GDB:

```gdb
break ft_strlen
run
disassemble /r ft_strlen
info registers
x/16bx $rdi
x/s $rdi
si
ni
bt
```

Preguntas que debes hacerte en cada paso:

- ¿Qué representa cada registro ahora?
- ¿Qué dirección voy a leer o escribir?
- ¿Tengo permiso para acceder a ese byte?
- ¿Qué flags acaba de modificar la instrucción?
- ¿Sigue `rsp` en la posición esperada?
- ¿He preservado los registros que exige la ABI?

Cuando aparezca un segfault, no añadas instrucciones al azar. Obtén el backtrace, mira la instrucción exacta, calcula la dirección efectiva y rastrea de dónde salió cada componente.

## 18. Auditoría de la parte obligatoria

No empieces bonus hasta poder responder afirmativamente:

- `make`, `make clean`, `make fclean` y `make re` funcionan.
- Un segundo `make` no hace trabajo innecesario.
- La salida se llama exactamente `libasm.a`.
- La biblioteca exporta exactamente los símbolos obligatorios esperados.
- Todos los `.s` se ensamblan con NASM en formato ELF64.
- No existe `-no-pie` en el repositorio.
- El tester enlaza como PIE.
- Cada función coincide con libc en casos normales y límites definidos.
- `ft_read` y `ft_write` coinciden en retorno y `errno` para errores.
- `ft_strdup` no fuga memoria y devuelve una copia independiente.
- Puedes explicar la ABI, la alineación de pila y cada registro usado.
- Puedes reconstruir la lógica sin depender de una solución memorizada.

## 19. Bonus: estructura de lista

El subject define:

```c
typedef struct s_list
{
    void            *data;
    struct s_list   *next;
} t_list;
```

En x86-64 ambos campos son punteros de 8 bytes:

| Campo | Offset | Tamaño |
|---|---:|---:|
| `data` | 0 | 8 |
| `next` | 8 | 8 |

Por tanto, `sizeof(t_list) == 16` en este objetivo.

Comprender estos offsets es imprescindible. `[rdi]` y `[rdi + 8]` no son abstracciones: son accesos concretos a memoria.

## 20. `ft_atoi_base`

Prototipo del subject:

```c
int ft_atoi_base(char *str, char *base);
```

Debe convertir la parte inicial de `str` escrita en `base`. Salvo por la base, debe comportarse como el `ft_atoi` esperado en el cursus.

Base inválida, resultado cero:

- Cadena base vacía.
- Base de un solo carácter.
- Caracteres repetidos.
- Presencia de `+` o `-`.
- Presencia de cualquier whitespace.

Descomposición recomendada:

1. Validar la base y obtener su longitud.
2. Saltar whitespace inicial de `str` según el contrato de `ft_atoi`.
3. Procesar signos iniciales según ese mismo contrato.
4. Buscar cada carácter de `str` en la base.
5. Detenerse en el primer carácter que no pertenezca a la base.
6. Acumular `resultado = resultado * longitud_base + índice`.
7. Aplicar el signo y devolver un `int`.

Tests:

- Binario, decimal, hexadecimal y una base arbitraria.
- Cero y cadena vacía.
- Whitespace y signos.
- Carácter inválido después de dígitos válidos.
- Todas las formas de base inválida.
- Duplicados no adyacentes.

El subject no define una política especial de overflow. No inventes saturación ni errores adicionales sin una exigencia verificable.

## 21. `ft_list_push_front`

Prototipo:

```c
void ft_list_push_front(t_list **begin_list, void *data);
```

Algoritmo:

1. Reservar 16 bytes para un nodo.
2. Si falla la reserva, no desreferenciar `NULL`.
3. Escribir `data` en offset 0.
4. Escribir el antiguo `*begin_list` en offset 8.
5. Guardar el nuevo nodo en `*begin_list`.

Debes preservar `begin_list` y `data` alrededor de `malloc`; ambos llegan en registros caller-saved.

Tests:

- Insertar en lista vacía.
- Insertar varios nodos y comprobar orden inverso de inserción.
- Confirmar que se guarda el puntero `data`, no una copia implícita.
- Liberar al final todos los nodos y los datos que sean propiedad del test.

## 22. `ft_list_size`

Prototipo:

```c
int ft_list_size(t_list *begin_list);
```

Recorre el campo `next` del offset 8 hasta `NULL` e incrementa un contador. La lista vacía devuelve cero.

Esta función es ideal para comprobar que entiendes layout de estructuras antes de trabajar con callbacks.

## 23. `ft_list_sort`

Prototipo:

```c
void ft_list_sort(t_list **begin_list, int (*cmp)());
```

El callback se invoca exactamente con datos, no con nodos:

```c
cmp(actual->data, otro->data);
```

El objetivo es orden ascendente. Una estrategia simple y suficiente para listas pequeñas es recorrer repetidamente pares e intercambiar los punteros `data` cuando `cmp(a, b) > 0`. Intercambiar datos evita reencadenar nodos, siempre que se respete el contrato observable.

Riesgos de ABI:

- `call` indirecto al registro que contiene `cmp`.
- El callback puede destruir cualquier registro caller-saved.
- Los punteros de iteración necesarios después de la llamada deben preservarse.
- La pila debe estar alineada antes de cada callback.

Tests:

- Lista vacía y lista de un nodo.
- Lista ya ordenada.
- Orden inverso.
- Valores duplicados.
- Comparador de cadenas y comparador numérico.
- Confirmar que los enlaces siguen siendo válidos.

## 24. `ft_list_remove_if`

Prototipo:

```c
void ft_list_remove_if(t_list **begin_list, void *data_ref,
    int (*cmp)(), void (*free_fct)(void *));
```

Se elimina un nodo cuando:

```c
cmp(node->data, data_ref) == 0
```

Antes de liberar necesitas conservar:

- El nodo actual que habrá que liberar.
- El siguiente nodo.
- La dirección desde la que debe actualizarse el enlace.
- `data_ref`.
- Los callbacks `cmp` y `free_fct`.

Todo estado que siga siendo necesario debe sobrevivir a las llamadas a `cmp`, `free_fct` y `free`: guárdalo en pila o en registros callee-saved correctamente preservados y mantén la alineación antes de cada `call`.

Para cada coincidencia:

1. Guardar `next` antes de liberar nada.
2. Llamar a `free_fct(node->data)`.
3. Liberar el nodo con `free`.
4. Actualizar la cabeza o el `next` del nodo anterior.
5. Continuar desde el nodo guardado.

Casos que descubren casi todos los bugs:

- Lista vacía.
- Ninguna coincidencia.
- Solo coincide la cabeza.
- Coinciden varias cabezas consecutivas.
- Coinciden nodos intermedios consecutivos.
- Coincide la cola.
- Coinciden todos.
- `data_ref` apunta a un dato igual pero no al mismo bloque.

No uses memoria después de liberarla y no avances el puntero anterior cuando acabas de eliminar el nodo actual.

## 25. Preparación de la defensa

Debes poder responder sin mirar el código:

- ¿Por qué `rdi` contiene el primer argumento?
- ¿Qué diferencia hay entre `rax`, `eax` y `al`?
- ¿Qué registros debe preservar tu función?
- ¿Por qué se alinea la pila antes de `call`?
- ¿Qué hace `call` que no hace `jmp`?
- ¿Por qué `strcmp` debe cargar bytes sin signo?
- ¿Qué devuelve realmente el kernel cuando falla `write`?
- ¿Por qué no se puede declarar una variable global normal para `errno`?
- ¿Qué hace `wrt ..plt` y por qué no usamos `-no-pie`?
- ¿Cómo verificas qué símbolos contiene `libasm.a`?
- ¿Qué ocurre si `read` devuelve menos bytes de los pedidos?
- ¿Qué partes de `ft_strdup` obligan a preservar registros?
- ¿Cuáles son los offsets de `t_list`?
- ¿Qué debe sobrevivir a una llamada a callback en el bonus?

Durante la defensa, explica primero el contrato, después el estado de registros, luego el bucle o flujo de errores y finalmente las pruebas.

## 26. Programa de clases interactivas

Cada sesión seguirá este formato:

1. Repaso de cinco minutos.
2. Explicación con equivalencias en C y estado de memoria/registros.
3. Preguntas de predicción antes de ejecutar código.
4. Ejercicio pequeño escrito por el alumno.
5. Implementación conjunta de una parte concreta.
6. Depuración real y tests.
7. Preguntas tipo defensa.
8. Resumen y tarea breve.

Al terminar cada clase se creará o actualizará un documento independiente en `clases/`, numerado y escrito como material reutilizable. Debe conservar las explicaciones, el estilo de las predicciones y ejercicios, sus soluciones, errores frecuentes, preguntas de defensa, criterio de finalización y una sección `Has aprendido que`. No será una transcripción literal de la conversación del alumno: estará preparado para revisarlo y convertirlo más adelante a formato web.

### Clase 1: representación y memoria

Objetivos: binario, hexadecimal, bytes, little-endian, direcciones, punteros y cadenas C.

Resultado: poder dibujar en memoria una cadena y explicar qué contiene un puntero.

### Clase 2: registros e instrucciones

Objetivos: familias de registros, `mov`, `lea`, aritmética, `cmp`, flags y saltos.

Resultado: seguir manualmente un bucle corto e indicar el valor de registros y flags.

### Clase 3: pila y funciones

Objetivos: `rsp`, `call`, `ret`, registros volátiles/preservados y alineación.

Resultado: diseñar una función hoja y otra que llama a una función C.

### Clase 4: NASM, ELF64 y herramientas

Objetivos: secciones, `global`, `extern`, objetos, símbolos, relocaciones, biblioteca estática y GDB.

Resultado: ensamblar un objeto mínimo, inspeccionarlo y enlazarlo con C.

### Clase 5: `ft_strlen`

Objetivos: recorrido de memoria, terminador, invariantes y retorno `size_t`.

Resultado: implementación explicable y tests comparativos completos.

### Clase 6: `ft_strcpy` y `ft_strcmp`

Objetivos: dos punteros, retorno original, terminador y semántica de `unsigned char`.

Resultado: ambas funciones validadas, incluidos bytes `>= 0x80`.

### Clase 7: interfaz de syscalls

Objetivos: frontera usuario/kernel, registros de syscall, retornos negativos y `strace`.

Resultado: predecir una llamada `read`/`write` y distinguir kernel de wrapper libc.

### Clase 8: `ft_write`, `ft_read` y `errno`

Objetivos: flujo de éxito/error, `__errno_location`, thread-local storage, PLT y pila.

Resultado: igualdad de retorno y `errno` frente a libc en errores reales.

### Clase 9: `ft_strdup`

Objetivos: `malloc`, llamadas anidadas, preservación de punteros, alineación y ownership.

Resultado: copia independiente, sin accesos inválidos ni fugas.

### Clase 10: Makefile, tester y auditoría obligatoria

Objetivos: biblioteca incremental, PIE, símbolos, matriz de tests y simulación de defensa.

Resultado: parte obligatoria considerada cerrada antes de abrir el bonus.

### Clase 11: `ft_atoi_base`

Objetivos: validación, búsqueda de dígitos, acumulación y descomposición del problema.

Resultado: bonus de conversión probado con bases válidas e inválidas.

### Clase 12: layout de listas

Objetivos: estructuras en memoria, offsets, `malloc`, doble puntero, push y size.

Resultado: `ft_list_push_front` y `ft_list_size` sin fugas.

### Clase 13: callbacks y ordenación

Objetivos: llamada indirecta, estado que debe sobrevivir y estrategia de ordenación.

Resultado: `ft_list_sort` validado con distintos comparadores.

### Clase 14: eliminación segura

Objetivos: pointer-to-pointer, nodos consecutivos, ownership, callbacks y use-after-free.

Resultado: `ft_list_remove_if` correcto en toda la matriz de casos.

### Clase 15: auditoría y defensa final

Objetivos: ejecutar todas las pruebas, inspeccionar artefactos y responder preguntas sin memorizar frases.

Resultado: entrega reproducible, explicable y ajustada al subject.

## 27. Cómo pedir la siguiente clase

Puedes iniciar con una petición como:

```text
Empecemos la clase 1 de Libasm. No asumas conocimientos previos.
```

En sesiones posteriores conviene indicar qué código has escrito y qué parte no entiendes. El profesor debe pedirte predicciones y explicaciones, no limitarse a pegar la solución. Si estás bloqueado, puede aumentar progresivamente la ayuda: pregunta conceptual, pista, pseudocódigo, fragmento y solo finalmente implementación completa razonada.

## 28. Referencias

- `en.subject.pdf`, Libasm v5.4: especificación normativa del proyecto.
- Manual oficial de NASM: <https://www.nasm.us/doc/>
- Formatos ELF de NASM: <https://www.nasm.us/doc/nasm09.html>
- `syscall(2)`: <https://man7.org/linux/man-pages/man2/syscall.2.html>
- `errno(3)`: <https://man7.org/linux/man-pages/man3/errno.3.html>
- `read(2)`: <https://man7.org/linux/man-pages/man2/read.2.html>
- `write(2)`: <https://man7.org/linux/man-pages/man2/write.2.html>
- ABI System V AMD64: consulta la especificación AMD64 ABI y usa esta guía como introducción, no como reemplazo.
- Manuales locales: `man 3 strlen`, `man 3 strcpy`, `man 3 strcmp`, `man 2 read`, `man 2 write`, `man 3 strdup`.

---

La regla de trabajo del proyecto será: comprender, predecir, implementar, inspeccionar y probar. Una función no está terminada cuando “parece funcionar”, sino cuando respeta el contrato, la ABI y los casos límite y puedes explicar por qué.
