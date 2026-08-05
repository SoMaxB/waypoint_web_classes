# Clase 2: registros e instrucciones

## Objetivo

Entender qué guardan los registros, distinguir una dirección de su contenido en memoria y seguir un bucle corto instrucción por instrucción. Al terminar, debes poder explicar cómo se recorre una cadena C y por qué `ft_strlen` no cuenta su terminador.

## 1. Registros y significado de los valores

Un registro es almacenamiento pequeño y rápido dentro de la CPU. Puede contener un número, una dirección o un byte. El registro no conoce el significado del valor: lo determina la instrucción que lo utiliza.

Usaremos estos tres registros como modelo:

```text
rdi: dirección del byte que estamos leyendo
rax: contador de caracteres
dl:  último byte leído
```

Si una cadena `"Hi"` está en memoria:

```text
Dirección   Contenido
0x1000      0x48    'H'
0x1001      0x69    'i'
0x1002      0x00    '\0'
```

y `rdi = 0x1000`, entonces:

```text
rdi       = 0x1000    dirección
[rdi]     = 0x48      contenido de esa dirección
```

Los corchetes indican un acceso a memoria. Sin ellos se usa el valor que ya contiene el registro.

```nasm
mov rax, rdi     ; copia 0x1000, una dirección
mov al, [rdi]    ; lee 0x48, un byte de memoria
```

## 2. Familias de registros

Un registro de 64 bits puede nombrarse por partes:

```text
rax: 64 bits
eax: 32 bits bajos de rax
ax:  16 bits bajos de rax
al:  8 bits bajos de rax
```

Para recorrer cadenas se cargan bytes en registros de 8 bits como `al` o `dl`. Un contador de longitud se mantiene en un registro de 64 bits como `rax`.

## 3. `mov`, aritmética y `lea`

`mov` copia un valor. No modifica la fuente:

```nasm
mov rdi, 0x1000
mov rax, rdi
```

Después ambas variables de registro contienen `0x1000`.

Para avanzar una posición de una cadena se suma uno a la dirección:

```nasm
add rdi, 1
```

También se puede escribir:

```nasm
inc rdi
```

`dec` resta uno. Estas instrucciones cambian solamente su operando:

```nasm
inc rax        ; no modifica rdi ni dl
```

`lea` calcula una dirección, pero no accede a memoria:

```nasm
lea rax, [rdi + 2]
```

Con `rdi = 0x1000`, el resultado es `rax = 0x1002`. A diferencia de `mov al, [rdi]`, no lee el contenido de esa dirección.

## 4. Comparación, flags y saltos

`cmp a, b` compara conceptualmente `a - b` y actualiza flags, pero no modifica `a` ni `b`.

```nasm
cmp dl, 0
je fin
```

Si `dl` es cero, se activa el flag cero (`ZF = 1`) y `je` salta a `fin`. Si no es cero, el salto no se realiza y la CPU ejecuta la instrucción siguiente.

Los saltos iniciales más importantes son:

```text
je:  salta si los valores eran iguales
jne: salta si los valores eran distintos
jb:  salta si el primer valor es menor sin signo
ja:  salta si el primer valor es mayor sin signo
```

Los nombres de las etiquetas no alteran el salto. `je fin` solo salta si la condición de igualdad se cumple, aunque la etiqueta se llame `fin`.

## 5. Recorrer una cadena C

Este bucle representa la lógica de `strlen`:

```nasm
mov rax, 0

bucle:
    mov dl, [rdi]
    cmp dl, 0
    je fin
    inc rax
    inc rdi
    jmp bucle

fin:
```

Para la cadena `"Hi\0"`, el seguimiento correcto es:

```text
Paso  rdi       dl leído       ¿Es '\0'?   rax después   rdi después
1     0x1000    0x48 ('H')     No          1             0x1001
2     0x1001    0x69 ('i')     No          2             0x1002
3     0x1002    0x00 ('\0')    Sí          2             0x1002
```

Al terminar:

```text
rdi = 0x1002
rax = 2
dl  = 0x00
```

El terminador se lee para saber cuándo parar, pero no se cuenta: `je fin` se realiza antes de `inc rax`.

## Predicciones y ejercicios

1. Con `rdi = 0x1000`, predecir `rax` y `al` tras:

```nasm
mov rax, rdi
mov al, [rdi]
```

Solución: `rax = 0x1000` y `al = 0x48`.

2. Con `rdi = 0x1000`, predecir `rax` tras:

```nasm
lea rax, [rdi + 1]
```

Solución: `rax = 0x1001`; no se ha leído memoria.

3. Para la cadena `"A\0"` que empieza en `0x2000`, ejecutar mentalmente el bucle anterior.

Solución:

```text
rdi = 0x2001
rax = 1
dl  = 0x00
```

4. Para una cadena vacía cuyo primer byte es `0x00`, determinar el retorno.

Solución: `rax = 0`. El primer `je fin` evita que se incremente el contador.

## Errores frecuentes

- Confundir `rdi`, la dirección, con `[rdi]`, el contenido de la dirección.
- Creer que una instrucción como `inc rax` modifica también registros que no menciona.
- Avanzar el puntero o cargar el siguiente byte antes de que esas instrucciones se ejecuten realmente.
- Contar `\0` como un carácter de la cadena.
- Creer que todos los flags quedan a cero cuando `cmp` compara dos valores iguales. En ese caso, el flag relevante `ZF` vale uno.
- Intentar interpretar todo el bucle de una vez. Es más fiable seguir una línea por vez: qué registro cambia, qué valor toma y si hay salto.

## Has aprendido que

- Un registro puede guardar una dirección o un dato; la instrucción determina cómo se interpreta.
- Los corchetes en `[registro]` acceden al contenido de memoria en la dirección guardada por el registro.
- `mov` copia, `inc` y `dec` modifican solo su operando, y `lea` calcula direcciones sin desreferenciarlas.
- `cmp` actualiza flags sin modificar sus operandos; `je` y `jne` deciden el flujo según esos flags.
- Un bucle de longitud lee el terminador `\0` para detenerse, pero no lo incluye en el contador.

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre `rdi` y `[rdi]`?
2. ¿Qué hace `lea rax, [rdi + 2]` y por qué no lee memoria?
3. ¿Modifica `cmp dl, 0` el valor de `dl`?
4. ¿Qué debe valer `dl` para que `je fin` salte después de `cmp dl, 0`?
5. ¿Por qué el contador no aumenta al encontrar `\0`?
6. ¿Qué registros cambian tras ejecutar exclusivamente `inc rax`?

## Criterio de finalización

La clase queda completada cuando puedes recorrer a mano una cadena vacía, una cadena de un carácter y una de varios caracteres, indicando en cada paso los valores de `rdi`, `rax` y `dl`, y explicando por qué se toma o no un salto.

## Siguiente clase

La clase 3 usa este modelo de registros y control de flujo para introducir la ABI System V: cómo llegan los argumentos desde C, cómo se devuelve el resultado en `rax`, qué hace `call` y `ret` con la pila y qué registros debes preservar.
