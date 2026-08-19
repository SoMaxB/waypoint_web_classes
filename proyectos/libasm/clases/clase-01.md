# Clase 1: representación y memoria

## Objetivo

Construir el modelo mental mínimo para entender cómo una máquina representa información y cómo un programa accede a ella. Al terminar esta clase debes poder dibujar una cadena C en memoria y distinguir una dirección del contenido almacenado en ella.

Esta clase no requiere conocimientos previos ni introduce todavía instrucciones de ensamblador.

## 1. Bits

Un bit es la unidad mínima de información. Solo puede tener uno de dos valores:

```text
0
1
```

Puede imaginarse como un interruptor apagado o encendido. Un único bit permite representar dos estados posibles.

## 2. Bytes

Un byte agrupa ocho bits:

```text
01000001
```

En binario, cada posición representa una potencia de dos. De derecha a izquierda, sus valores son:

```text
posición:  7   6   5   4   3   2   1   0
valor:    128  64  32  16   8   4   2   1
```

Para convertir un byte a decimal se suman los valores de las posiciones que contienen un `1`:

```text
bits:       0   1   0   0   0   0   0   1
valor:    128  64  32  16   8   4   2   1

64 + 1 = 65
```

Por tanto:

```text
01000001 (binario) = 65 (decimal)
```

Cada uno de los ocho bits tiene dos posibilidades. Un byte admite:

```text
2^8 = 256 combinaciones
```

Si se interpreta como un entero sin signo, sus valores van de `0` a `255`. Hay 256 valores porque el cero también cuenta.

### Comparación con decimal

En decimal, cada posición es una potencia de diez:

```text
572 = 5 * 100 + 7 * 10 + 2 * 1
```

En binario, cada posición es una potencia de dos:

```text
101 = 1 * 4 + 0 * 2 + 1 * 1 = 5
```

No se elevan los dígitos escritos al cuadrado. El valor depende de la posición que ocupa cada dígito.

## 3. Hexadecimal

Hexadecimal es una forma compacta de escribir bits. Utiliza dieciséis símbolos:

```text
0 1 2 3 4 5 6 7 8 9 A B C D E F
```

Las letras representan los valores decimales del 10 al 15:

```text
A = 10
B = 11
C = 12
D = 13
E = 14
F = 15
```

Un dígito hexadecimal representa exactamente cuatro bits. Dos dígitos representan un byte:

```text
0100 0001
   4    1

01000001 (binario) = 0x41 (hexadecimal) = 65 (decimal)
```

El prefijo `0x` indica que un valor está escrito en hexadecimal.

Otro ejemplo:

```text
1010 1010
   A    A

10101010 (binario) = 0xAA (hexadecimal) = 170 (decimal)
```

Los bits no contienen inherentemente una letra, un número o un color. El mismo byte `0x41` puede interpretarse como el número 65, el carácter ASCII `A` o parte de otro tipo de dato. El contexto determina su significado.

## 4. Memoria y direcciones

La memoria puede imaginarse como una fila enorme de cajas. Cada caja:

- Guarda un byte.
- Tiene una dirección única.
- Puede contener un valor entre `0x00` y `0xFF`.

Ejemplo:

```text
Dirección    Contenido
0x1000       0x48
0x1001       0x6F
0x1002       0x6C
0x1003       0x61
0x1004       0x00
```

Como cada dirección identifica un byte, la siguiente caja está en la dirección siguiente:

```text
0x1000 -> 0x1001 -> 0x1002 -> 0x1003 -> 0x1004
```

## 5. Cadenas C

Una cadena C es una secuencia de bytes terminada por un byte cero. Los bytes del ejemplo anterior representan:

```text
0x48 = 'H'
0x6F = 'o'
0x6C = 'l'
0x61 = 'a'
0x00 = '\0'
```

La cadena completa es:

```text
'H' 'o' 'l' 'a' '\0'
```

El terminador `\0` es el byte con valor cero:

```text
'\0' = 0x00
```

No debe confundirse con el carácter visible `'0'`:

```text
'\0' = 0x00
'0'  = 0x30
```

Una cadena C no lleva su longitud almacenada. Para conocerla hay que recorrer sus bytes hasta encontrar el primer `0x00`. El terminador no cuenta como parte de la longitud:

```text
strlen("Hola") = 4
```

Sin embargo, almacenar la cadena completa requiere cinco bytes: cuatro caracteres y el terminador.

Un cero en medio finaliza la cadena aunque haya otros bytes después:

```text
'A' '\0' 'B' '\0'
```

Vista como cadena C, su longitud es `1`. El byte `'B'` sigue existiendo en memoria, pero queda después del primer terminador.

## 6. Punteros

Un puntero es un valor que contiene una dirección de memoria. Si `s` apunta a la cadena `"Hola"` del ejemplo:

```text
s = 0x1000
```

El puntero contiene la dirección `0x1000`; no contiene directamente la letra `H` ni la cadena completa.

En notación similar a C:

```text
s       = 0x1000             dirección guardada
*s      = 0x48 = 'H'        contenido de esa dirección
s + 2   = 0x1002             nueva dirección
*(s+2)  = 0x6C = 'l'        contenido de la nueva dirección
```

El operador `*` representa aquí el acceso a la memoria situada en la dirección indicada. Esta operación se llama desreferenciar.

### El puntero también ocupa memoria

Una variable puntero debe estar almacenada en algún lugar:

```text
Dirección de la variable s:  0x5000
Valor guardado en s:         0x1000
Byte situado en 0x1000:      0x48
```

Esto crea dos niveles diferentes:

```text
&s = 0x5000    dirección donde está almacenado el puntero
s  = 0x1000    dirección contenida en el puntero
*s = 0x48      byte almacenado en la dirección apuntada
```

Representación visual:

```text
0x5000                  0x1000
+--------------+        +----------+
|    0x1000    |------->| 0x48 'H' |
+--------------+        +----------+
 variable s              dato apuntado
```

## 7. Little-endian

Un byte individual no necesita un orden interno entre bytes. Un valor que ocupa varios bytes sí.

El número:

```text
0x12345678
```

está formado por cuatro bytes:

```text
0x12 0x34 0x56 0x78
```

x86-64 utiliza el orden little-endian: el byte menos significativo, el situado más a la derecha en la escritura del número, se guarda en la dirección más baja.

Si el número comienza en `0x2000`, la memoria contiene:

```text
Dirección    Contenido
0x2000       0x78
0x2001       0x56
0x2002       0x34
0x2003       0x12
```

Little-endian no invierte los bits dentro de cada byte. Tampoco invierte el texto de una cadena. Solo determina el orden de los bytes cuando varios de ellos se interpretan conjuntamente como un único valor.

Una cadena se almacena como una secuencia de bytes independientes en orden de recorrido:

```text
"1234" -> 0x31 0x32 0x33 0x34 0x00
```

## 8. Predicciones y ejercicios

Conviene intentar cada ejercicio antes de consultar la solución.

### Ejercicio 1: conversión binaria

Para el byte `10101010`:

1. Indica qué columnas deben sumarse.
2. Calcula su valor decimal.
3. Sepáralo en dos grupos de cuatro bits y conviértelo a hexadecimal.

<details>
<summary>Solución</summary>

```text
Columnas: 128, 32, 8 y 2
Decimal:  128 + 32 + 8 + 2 = 170
Hex:      1010 1010 = 0xAA
```

</details>

### Ejercicio 2: cadena en memoria

Una cadena `"Hola"` empieza en `0x1000` y ocupa los bytes mostrados anteriormente.

1. ¿Qué valor contiene un puntero `s` que apunta a la cadena?
2. ¿Qué byte hay en `0x1002`?
3. ¿Qué dirección se obtiene al avanzar `s` dos bytes?
4. ¿Qué carácter hay en esa nueva dirección?
5. ¿Cuántos bytes ocupa la cadena incluyendo su terminador?

<details>
<summary>Solución</summary>

```text
s = 0x1000
byte en 0x1002 = 0x6C
s + 2 = 0x1002
*(s + 2) = 'l'
espacio total = 5 bytes
```

</details>

### Ejercicio 3: little-endian

Guarda `0x12345678` empezando en `0x2000`. Completa:

```text
Dirección    Contenido
0x2000       ?
0x2001       ?
0x2002       ?
0x2003       ?
```

<details>
<summary>Solución</summary>

```text
Dirección    Contenido
0x2000       0x78
0x2001       0x56
0x2002       0x34
0x2003       0x12
```

</details>

### Ejercicio 4: dirección frente a contenido

Supón:

```text
Dirección    Contenido
0x4000       0x58       'X'
0x4001       0x59       'Y'
0x4002       0x00       '\0'

q = 0x4000
```

Calcula:

```text
q       = ?
*q      = ?
q + 1   = ?
*(q+1)  = ?
```

<details>
<summary>Solución</summary>

```text
q       = 0x4000
*q      = 0x58
q + 1   = 0x4001
*(q+1)  = 0x59
```

</details>

## 9. Errores frecuentes

- Aplicar reglas de posiciones decimales al interpretar binario.
- Confundir el valor hexadecimal `A` con la escritura decimal `10` dentro de un número hexadecimal.
- Confundir el puntero `p` con el contenido `*p`.
- Responder con `p + 2` cuando se pregunta por `*(p + 2)`.
- Contar el terminador `\0` como parte de la longitud de una cadena.
- Confundir el byte cero `0x00` con el carácter `'0'`, cuyo código es `0x30`.
- Pensar que little-endian invierte una cadena o los bits de cada byte.

## 10. Has aprendido que:

- Un bit vale `0` o `1`.
- Un byte contiene ocho bits y admite 256 combinaciones.
- Dos dígitos hexadecimales representan exactamente un byte.
- Los bits no tienen un significado único; el programa decide cómo interpretarlos.
- La memoria es una secuencia de bytes identificados por direcciones.
- Un puntero contiene una dirección, mientras que desreferenciarlo obtiene el contenido de esa dirección.
- Sumar a un puntero produce otra dirección; desreferenciar el resultado obtiene el byte situado allí.
- Una cadena C es una secuencia de bytes terminada por `0x00`.
- El terminador ocupa memoria, pero no forma parte de la longitud de la cadena.
- x86-64 almacena valores multibyte en orden little-endian.
- Little-endian no invierte las cadenas, porque estas se recorren byte a byte.

## 11. Preguntas tipo defensa

1. ¿Qué diferencia hay entre `p`, `p + 1`, `*p` y `*(p + 1)`?
2. ¿Por qué `"Hola"` tiene longitud 4 pero ocupa 5 bytes?
3. ¿Qué diferencia existe entre `0x00` y el carácter `'0'`?
4. ¿Por qué el byte `0x41` no significa necesariamente la letra `A`?
5. ¿Cómo se almacena `0x12345678` en una máquina little-endian?
6. ¿Por qué little-endian no transforma `"Hola"` en `"aloH"`?

## 12. Criterio de finalización

La clase está completada cuando puedes:

- Convertir un byte sencillo entre binario, decimal y hexadecimal.
- Dibujar una cadena C en memoria incluyendo su terminador.
- Explicar la diferencia entre una dirección y su contenido.
- Calcular correctamente `p`, `*p`, `p + n` y `*(p + n)` sobre una tabla de memoria.
- Distribuir en memoria los bytes de un valor multibyte usando little-endian.

## Siguiente clase

La clase 2 utiliza este modelo de memoria para introducir los registros de la CPU y las instrucciones `mov`, `lea`, aritmética, `cmp`, flags y saltos.

## Lista de lecturas

- `man 7 ascii` — el conjunto ASCII y el carácter nulo `\0` que termina toda cadena C.
- `man 3 strlen` — la longitud de una cadena C terminada en nulo (la función que implementarás).
- `man 1 od` (`od -tx1`) — volcar la memoria en hexadecimal y ver el orden little-endian.
- Intel SDM, Vol. 1, §3.3.3 — el orden de bytes (little-endian) de los valores multibyte.
