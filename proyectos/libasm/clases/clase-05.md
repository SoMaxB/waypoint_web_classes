# Clase 5: `ft_strlen`

## Objetivo

Construir la primera función real de `libasm.a`: recorrer memoria byte a byte hasta encontrar el terminador `\0`, mantener un invariante sobre el contador y devolver la longitud como `size_t` en `rax`. Al terminar debes poder explicar por qué el primer argumento llega en `rdi`, por qué `xor rax,rax` pone el contador a cero, por qué `cmp byte [rdi+rax],0` no necesita `movzx`, y demostrar con un tester comparativo que `ft_strlen` empata con `strlen` en todos los casos definidos.

Esta es una función hoja: no llama a nadie, no toca la pila y no necesita preservar registros callee-saved.

## 1. El contrato

```c
size_t ft_strlen(const char *s);
```

- `s` llega en `rdi` (System V AMD64, primer argumento puntero).
- Retorno en `rax` (`size_t` = 64 bits sin signo en este objetivo).
- No hay longitud almacenada: hay que buscar el primer `0x00`.
- El terminador no se cuenta. `strlen("") == 0`, `strlen("hola") == 4`.
- `strlen(NULL)` es comportamiento indefinido: no lo gestionamos.

Memoria de `"hola"` si `s == 0x1000`:

```text
0x1000  0x68 'h'
0x1001  0x6f 'o'
0x1002  0x6c 'l'
0x1003  0x61 'a'
0x1004  0x00 '\0'
```

## 2. ABI mínimo que necesitas

```text
rdi = s (preservado por ti si lo modificaras, aquí solo lo lees)
rax = contador y valor de retorno
flags = resultado de cmp para je/jne
```

Registros caller-saved (`rax, rcx, rdx, rsi, rdi, r8-r11`) pueden destruirse. Como no llamamos a nadie, no hay que salvar nada ni alinear `rsp`. `xor rax,rax` es el idiom para poner `rax` a cero: 3 bytes frente a 7 de `mov rax,0`, rompe dependencias y deja `ZF=1`.

`cmp byte [rdi+rax],0` compara directamente el byte en memoria con cero. No necesitas `movzx` porque no usas el valor, solo los flags. En `ft_strcmp` sí necesitarás `movzx` porque restarás `byte1 - byte2`.

## 3. Algoritmo e invariante

```c
size_t ft_strlen(const char *s) {
    size_t i = 0;
    while (s[i] != '\0')
        i++;
    return i;
}
```

Pasos en ensamblador:

1. `rax = 0`
2. leer `byte [rdi+rax]`
3. si es `0` → terminado
4. `rax++` y repetir
5. `ret` con `rax` ya a la longitud

Invariante: *antes de cada iteración, todos los bytes con índice `< rax` son `!= 0`*. Cuando encuentras `0`, `rax` ya es la respuesta y no has contado el terminador.

Esto excluye la trampa de `inc` antes de `cmp` (contarías el `\0`) y la de usar contador de 32 bits (`eax`) que truncaría longitudes > 2^32.

## 4. Implementación NASM

```nasm
default rel
section .text

global ft_strlen
ft_strlen:
    xor     rax, rax          ; i = 0
.loop:
    cmp     byte [rdi + rax], 0
    je      .done
    inc     rax
    jmp     .loop
.done:
    ret

section .note.GNU-stack noalloc noexec nowrite progbits
```

Equivalente desensamblado (`objdump -d -M intel`):

```text
xor    rax,rax
cmp    BYTE PTR [rdi+rax*1],0x0
je     <done>
inc    rax
jmp    <loop>
ret
```

Notas:

- `default rel` favorece RIP-relative, aunque aquí no lo necesitamos.
- `global` exporta el símbolo; `nm -g ft_strlen.o` debe mostrar `T ft_strlen`.
- `.note.GNU-stack` evita pila ejecutable.
- Función hoja: ningún `push`/`pop`, ningún ajuste de `rsp`.

Variante con `test`:

```nasm
movzx   ecx, byte [rdi+rax]
test    cl, cl
je      .done
```

Ambas son correctas; `cmp byte ...,0` es más corta cuando solo testeas cero.

## 5. UTF-8 es bytes, no caracteres

`strlen` cuenta bytes. `"café"` en UTF-8 son 5 bytes:

```text
'c' 0x63
'a' 0x61
'f' 0x66
'é' 0xc3 0xa9   ; 2 bytes
'\0' 0x00
```

Por eso `strlen("café") == 5`, no 4. El test de la guía usa esta distinción para asegurar que no cuentas caracteres visuales.

## 6. Compilación y verificación

```sh
nasm -f elf64 -g -F dwarf ft_strlen.s -o ft_strlen.o
cc -Wall -Wextra -Werror -g main.c ft_strlen.o -o tester
./tester
nm -g ft_strlen.o          # 0000000000000000 T ft_strlen
objdump -d -M intel ft_strlen.o
ar rcs libasm.a ft_strlen.o  # luego con las 6 funciones
nm -g --defined-only libasm.a
```

Matriz mínima de pruebas (comparar siempre contra `strlen`):

| Entrada | Esperado |
|---|---:|
| `""` | 0 |
| `"a"` | 1 |
| `"hola"` | 4 |
| `"0123456789"` | 10 |
| `"café"` (`63 61 66 c3 a9 00`) | 5 |
| cadena larga (50+ bytes) | igual que `strlen` |

Captura retorno y `errno` antes de imprimir si mezclas con syscalls en clases futuras. Aquí no hay `errno`, pero el hábito importa.

## Predicciones y ejercicios

### Ejercicio 1: terminador y contador

`rdi = 0x1000` con `[ 'h' 'o' 'l' 'a' 0 ]`.

1. ¿Qué vale `rax` al terminar?
2. ¿Cuentas el `0`?

<details><summary>Solución</summary>

```text
rax = 4. No se cuenta el terminador. Secuencia:
rax=0 -> 'h' !=0 -> rax=1
rax=1 -> 'o' !=0 -> rax=2
rax=2 -> 'l' !=0 -> rax=3
rax=3 -> 'a' !=0 -> rax=4
rax=4 -> 0x00 ==0 -> done, ret 4
```

</details>

### Ejercicio 2: cadena vacía

Memoria `[ 0x00 ]` con `s` apuntando al `0x00`.

1. ¿Qué devuelve `ft_strlen`?
2. ¿Cuántas iteraciones ejecuta el bucle?

<details><summary>Solución</summary>

```text
Devuelve 0. El bucle comprueba el primer byte, ve 0 y salta a .done
sin ningún inc. 0 iteraciones de incremento.
```

</details>

### Ejercicio 3: bytes vs caracteres

`"café"` ocupa `63 61 66 c3 a9 00`.

1. ¿Qué devuelve `strlen`?
2. ¿Por qué no 4?

<details><summary>Solución</summary>

```text
Devuelve 5. strlen cuenta bytes hasta \0, no glifos Unicode.
La 'é' en UTF-8 son dos bytes (c3 a9), así que 3 + 2 = 5.
```

</details>

### Ejercicio 4: cmp sin movzx

¿Por qué `cmp byte [rdi+rax],0` funciona sin `movzx` y cuándo sí necesitarías `movzx`?

<details><summary>Solución</summary>

```text
cmp compara el byte en memoria contra 0 y fija flags directamente.
Solo necesitas saber si es cero o no. movzx lo necesitas cuando
vas a usar el valor (p. ej. ft_strcmp hace byte1 - byte2 y debe
extender sin signo para que 0xff no se vuelva -1).
```

</details>

### Ejercicio 5: xor vs mov

¿Por qué `xor rax,rax` es preferible a `mov rax,0`?

<details><summary>Solución</summary>

```text
xor rax,rax pone rax a 0 en 3 bytes (48 31 c0), rompe dependencias
del valor previo y deja ZF=1. mov rax,0 ocupa 7 bytes y no aporta
nada en una función hoja.
```

</details>

### Ejercicio 6: invariante

Enuncia el invariante del bucle y explica por qué garantiza que no cuentas el `\0`.

<details><summary>Solución</summary>

```text
Antes de cada iteración, todos los bytes con índice < rax son != 0.
El bucle solo hace inc cuando el byte actual != 0. Cuando encuentra 0,
salta a .done sin inc, así que rax sigue siendo el número de bytes !=0.
```

</details>

### Ejercicio 7: verificación real

Predice y luego ejecuta:

```sh
nasm -f elf64 ft_strlen.s -o ft_strlen.o
cc -Wall -Wextra -Werror main.c ft_strlen.o -o tester
./tester
nm -g ft_strlen.o | grep ft_strlen
```

<details><summary>Solución</summary>

```text
nasm no imprime nada si va bien. cc enlaza sin -no-pie (prohibido).
./tester muestra [OK] en las 6 pruebas y len 5 para "café".
nm muestra: 0000000000000000 T ft_strlen
Si ves "U ft_strlen", olvidaste global.
```

</details>

## Errores frecuentes

- Contar el terminador (`inc` antes de `cmp` o `jge` mal puesto).
- Usar `eax`/`ecx` de 32 bits y truncar longitudes > 4 GiB.
- Usar `mov al, [rdi+rax]` sin `movzx` y luego `cmp` con signo accidental en funciones posteriores.
- Intentar gestionar `NULL`: `strlen(NULL)` es indefinido, no inventes un retorno.
- Leer de 8 en 8 bytes antes de dominar límites de página (causa segfault en el borde).
- Olvidar `global ft_strlen` y obtener símbolo `U` en lugar de `T`.
- Añadir `push`/`pop` innecesarios en una hoja y desalinear la pila sin necesidad.

## Has aprendido que

- Una cadena C no lleva longitud: se busca el primer `0x00` y el terminador no se cuenta.
- `rdi` trae `s`, `rax` devuelve `size_t` (64 bits).
- `cmp byte [rdi+rax],0` + `je` basta para testear cero sin `movzx`.
- `xor rax,rax` es el idiom para poner un registro a cero.
- El invariante "todo `< rax` es `!=0`" hace el bucle correcto por construcción.
- `strlen` cuenta bytes, no caracteres Unicode; UTF-8 puede ocupar varios bytes por glifo.
- Una función hoja no necesita tocar `rsp` ni preservar `rbx/r12-r15`.
- `global` + `section .note.GNU-stack` + `default rel` forman la plantilla mínima NASM/ELF64.
- La verificación es comparativa: `ft_strlen` debe empatar con `strlen` en vacía, 1 char, normal, larga y UTF-8.

## Preguntas tipo defensa

1. ¿Por qué `rdi` contiene el primer argumento y `rax` el retorno?
2. ¿Qué diferencia hay entre `rax`, `eax` y `al` y por qué aquí usas `rax`?
3. ¿Por qué `cmp byte [rdi+rax],0` no necesita `movzx` y `ft_strcmp` sí?
4. ¿Qué hace `xor rax,rax` y por qué es preferible a `mov rax,0`?
5. ¿Cuál es el invariante del bucle y qué garantiza?
6. ¿Por qué no cuentas el `\0` y cuánto ocupa `"hola"` en memoria incluyendo terminador?
7. ¿Qué devuelve `strlen("café")` y por qué?
8. ¿Qué significaría ver `U ft_strlen` en `nm`?
9. ¿Por qué esta función no necesita alinear la pila?
10. ¿Cómo verificas que tu objeto exporta exactamente `T ft_strlen`?

## Criterio de finalización

La clase está completada cuando puedes:

- Escribir `ft_strlen.s` de memoria con `xor`/`cmp`/`je`/`inc`/`jmp`/`ret` y la sección `GNU-stack`.
- Explicar ABI (rdi/rax), invariante y por qué no se cuenta `\0`.
- Distinguir `cmp byte ...,0` (test de cero) de `movzx` (uso del valor).
- Compilar con `nasm -f elf64` y enlazar con `cc -Wall -Wextra -Werror` sin `-no-pie`.
- Pasar la matriz de 6 tests comparativos contra `strlen` y explicar el caso UTF-8.
- Inspeccionar con `nm`/`objdump` que el símbolo es `T` y el desensamblado coincide.

## Siguiente clase

La clase 6 implementa dos punteros y semántica sin signo: `ft_strcpy` (preservar `dst` original y copiar el `\0`) y `ft_strcmp` (cargar bytes con `movzx` como `unsigned char` y devolver `byte1 - byte2`, incluyendo el caso `>= 0x80`).

## Lista de lecturas

- `man 3 strlen` — contrato, `size_t` y terminador `\0`.
- `man 7 ascii` — `0x00` vs `'0'` (`0x30`) y bytes `>=0x80`.
- Intel SDM Vol.1 §3.4.1, §3.7.2 — registros `rax`/`eax`/`al` y `xor` idiom; Vol.2 `CMP`/`TEST`/`Jcc`.
- `man 1 nm`, `man 1 objdump` — verificar `T ft_strlen` y desensamblado.
- `GUIA_LIBASM.md` §9 — casos de prueba y errores de `ft_strlen`.
