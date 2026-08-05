# Clase 3: ABI, llamadas y pila

## Objetivo

Entender el contrato que permite que una funcion C llame a una funcion escrita en ensamblador. Al terminar, debes poder explicar como llegan los argumentos a una funcion ASM, donde se coloca el valor de retorno, que hace `ret`, que registros puedes modificar libremente y por que la pila debe quedar equilibrada.

## 1. Que es la ABI

ABI significa *Application Binary Interface*. No es una instruccion concreta, sino un acuerdo entre el codigo llamador y el codigo llamado.

En Libasm usamos la ABI System V AMD64 sobre Linux x86-64. Esta ABI define, entre otras cosas:

```text
El primer argumento llega en rdi.
El segundo argumento llega en rsi.
El tercer argumento llega en rdx.
El valor de retorno sale en rax.
ret vuelve al llamador usando una direccion guardada en la pila.
Algunos registros se pueden destruir; otros se deben preservar.
La pila debe estar correctamente alineada antes de llamar a otra funcion.
```

Sin esta convencion, C y ASM no sabrian donde dejar o buscar argumentos y resultados.

## 2. Argumentos de funcion

Los primeros argumentos enteros o punteros llegan en este orden:

```text
1. rdi
2. rsi
3. rdx
4. rcx
5. r8
6. r9
```

Por ejemplo:

```c
size_t ft_strlen(const char *s);
```

`ft_strlen` recibe un solo argumento, asi que al entrar en ASM:

```text
rdi = direccion del primer byte de la cadena
```

Si C llama:

```c
ft_strlen("Hi");
```

y la cadena esta en memoria asi:

```text
Direccion   Contenido
0x1000      0x48    'H'
0x1001      0x69    'i'
0x1002      0x00    '\0'
```

entonces al entrar:

```text
rdi   = 0x1000
[rdi] = 0x48
```

`rdi` contiene la direccion. `[rdi]` lee el contenido de esa direccion.

Para dos argumentos:

```c
char *ft_strcpy(char *dst, const char *src);
```

al entrar:

```text
rdi = dst
rsi = src
```

Si `dst` empieza en `0x8000` y `src` empieza en `0x9000`:

```text
rdi = 0x8000
rsi = 0x9000
```

Leer un byte de `src` y escribirlo en `dst` puede hacerse asi:

```nasm
mov al, [rsi]
mov [rdi], al
```

## 3. Valor de retorno

La ABI dice que los retornos enteros o punteros salen en:

```text
rax
```

Si una funcion ASM termina con:

```nasm
mov rax, 5
ret
```

y C hizo:

```c
int x = mi_funcion();
```

entonces C recibe:

```text
x = 5
```

En `ft_strlen`, `rax` se usa como contador porque al final ese contador es exactamente el valor que debe devolver la funcion.

En `ft_strcpy`, el contrato exige devolver el `dst` original. Por eso conviene guardar ese valor antes de avanzar el puntero:

```nasm
mov rax, rdi
```

Luego se puede modificar `rdi` durante la copia, mientras `rax` conserva el inicio original de `dst`.

## 4. `call`, `ret` y direccion de retorno

Cuando C llama a una funcion, la CPU ejecuta conceptualmente una instruccion `call`.

`call` hace dos cosas:

```text
1. Guarda en la pila la direccion a la que hay que volver.
2. Salta a la funcion llamada.
```

`ret` hace lo contrario:

```text
1. Lee de la pila la direccion de retorno.
2. Salta a esa direccion.
```

Por eso una funcion ASM normalmente acaba con:

```nasm
ret
```

La funcion no necesita saber manualmente a que linea de C volver. La direccion de retorno ya fue guardada por `call`.

## 5. Registros volatiles y preservados

La ABI separa los registros en dos grupos.

Registros volatiles, tambien llamados caller-saved:

```text
rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11
```

Una funcion puede modificarlos libremente. Si el llamador necesitaba conservarlos, el llamador debia guardarlos antes del `call`.

Registros preservados, tambien llamados callee-saved:

```text
rbx, rbp, r12, r13, r14, r15
```

Si una funcion modifica uno de estos registros, debe restaurarlo antes de `ret`.

Incorrecto:

```nasm
mi_funcion:
    mov rbx, 123
    ret
```

Correcto si de verdad necesitas usar `rbx`:

```nasm
mi_funcion:
    push rbx
    mov rbx, 123
    ; usar rbx...
    pop rbx
    ret
```

Para las funciones obligatorias simples, muchas veces la mejor decision es no usar registros preservados.

## 6. La pila

La pila es una zona de memoria gestionada principalmente mediante `rsp`, el *stack pointer*.

En x86-64 la pila crece hacia direcciones menores.

```nasm
push rax
```

equivale conceptualmente a:

```text
rsp = rsp - 8
[rsp] = rax
```

porque un registro de 64 bits ocupa 8 bytes.

```nasm
pop rax
```

equivale conceptualmente a:

```text
rax = [rsp]
rsp = rsp + 8
```

Ejemplo:

```text
rsp = 0x1000
rax = 55
```

Despues de:

```nasm
push rax
```

queda:

```text
rsp   = 0xff8
[rsp] = 55
```

## 7. Equilibrio de la pila

Cada `push` debe estar compensado por un `pop` antes de `ret`, salvo que estes ajustando la pila explicitamente con `sub rsp, ...` y `add rsp, ...`.

Esta funcion tiene un problema grave:

```nasm
ft_bad:
    push rbx
    mov rbx, 123
    ret
```

Al entrar en una funcion, arriba de la pila esta la direccion de retorno. Pero despues de `push rbx`, arriba de la pila queda el valor antiguo de `rbx`.

Si se ejecuta `ret` sin hacer antes `pop rbx`, `ret` intentara saltar al valor antiguo de `rbx` como si fuera una direccion de codigo.

Version equilibrada:

```nasm
ft_ok:
    push rbx
    mov rbx, 123
    pop rbx
    ret
```

`pop rbx` restaura `rbx` y tambien devuelve `rsp` a la posicion correcta, dejando arriba la direccion de retorno real.

## 8. Funciones hoja

Una funcion hoja es una funcion que no llama a otra funcion.

Ejemplos probables en la parte obligatoria:

```text
ft_strlen
ft_strcpy
ft_strcmp
```

Si una funcion no llama a nadie y no necesita registros preservados, puede no tocar la pila.

Una version compacta de `ft_strlen`:

```nasm
global ft_strlen

ft_strlen:
    mov rax, 0

.loop:
    cmp byte [rdi + rax], 0
    je .end
    inc rax
    jmp .loop

.end:
    ret
```

Aqui:

```text
rdi = direccion inicial de la cadena
rax = indice y contador
```

La instruccion:

```nasm
cmp byte [rdi + rax], 0
```

hace cuatro cosas conceptuales:

```text
1. Calcula la direccion rdi + rax.
2. Lee un byte en esa direccion.
3. Compara ese byte contra 0.
4. Actualiza flags para que je decida si salta.
```

No compara `rdi` contra `rax`. Tampoco modifica `rdi` ni `rax`.

## 9. Alineacion de pila

Para funciones hoja simples, normalmente basta con no tocar `rsp`.

Cuando una funcion llama a otra, como ocurrira en `ft_strdup` al llamar a `malloc`, hay que pensar en la alineacion de la pila antes del `call`.

Regla practica por ahora:

```text
Si tu funcion no llama a nadie, puedes evitar tocar rsp.
Si tu funcion llama a otra funcion, debes razonar sobre la pila.
```

## Predicciones y ejercicios

1. Dada esta memoria:

```text
0x5000: 0x41    'A'
0x5001: 0x00    '\0'
```

y al entrar `rdi = 0x5000`, determinar:

```text
rdi   = ?
[rdi] = ?
```

Solucion:

```text
rdi   = 0x5000
[rdi] = 0x41
```

2. Con:

```text
rdi = 0x8000
rsi = 0x9000

0x9000: 0x4f
0x9001: 0x4b
0x9002: 0x00
```

predecir el resultado de:

```nasm
mov al, [rsi]
```

Solucion:

```text
al = 0x4f
```

3. Al entrar en `ft_strcpy`:

```text
rdi = 0x8000
rsi = 0x9000
```

Se ejecuta:

```nasm
mov rax, rdi
```

Luego la copia avanza `rdi` hasta `0x8003`. Determinar el valor que conserva `rax`.

Solucion:

```text
rax = 0x8000
```

4. Esta funcion:

```nasm
mov rbx, 123
ret
```

no respeta la ABI porque modifica `rbx` sin guardar ni restaurar su valor original.

5. Con:

```text
rsp = 0x1000
rax = 55
```

despues de:

```nasm
push rax
```

queda:

```text
rsp   = 0xff8
[rsp] = 55
```

6. Esta funcion:

```nasm
ft_bad:
    push rbx
    mov rbx, 123
    ret
```

tiene dos problemas: no restaura `rbx` y deja el valor antiguo de `rbx` arriba de la pila, por lo que `ret` intentaria usarlo como direccion de retorno.

7. Trazar esta funcion:

```nasm
global ft_strlen

ft_strlen:
    mov rax, 0

.loop:
    cmp byte [rdi + rax], 0
    je .end
    inc rax
    jmp .loop

.end:
    ret
```

con esta memoria:

```text
0x4000: 0x4f    'O'
0x4001: 0x4b    'K'
0x4002: 0x21    '!'
0x4003: 0x00    '\0'
```

Solucion:

```text
Iteracion 1:
rax antes = 0
direccion leida = 0x4000
byte leido = 0x4f
salta je = no
rax despues = 1

Iteracion 2:
rax antes = 1
direccion leida = 0x4001
byte leido = 0x4b
salta je = no
rax despues = 2

Iteracion 3:
rax antes = 2
direccion leida = 0x4002
byte leido = 0x21
salta je = no
rax despues = 3

Iteracion 4:
rax antes = 3
direccion leida = 0x4003
byte leido = 0x00
salta je = si
valor final devuelto en rax = 3
```

## Errores frecuentes

- Confundir `rdi`, que contiene una direccion, con `[rdi]`, que lee el contenido de esa direccion.
- Creer que `cmp byte [rdi + rax], 0` compara `rdi` contra `rax`; en realidad calcula una direccion, lee un byte y compara ese byte contra cero.
- Pensar que `ret` vuelve por magia; realmente usa una direccion de retorno guardada en la pila por `call`.
- Modificar `rbx`, `rbp` o `r12`-`r15` sin restaurarlos.
- Hacer `push` sin el `pop` correspondiente antes de `ret`.
- Usar la pila en funciones simples cuando no hace falta, aumentando el riesgo de romper la ABI.
- Olvidar que `rax` es el registro de retorno, aunque su significado concreto dependa de la funcion.

## Has aprendido que

- La ABI es el contrato binario que permite que C y ASM cooperen.
- En System V AMD64, los primeros argumentos llegan en `rdi`, `rsi`, `rdx`, `rcx`, `r8` y `r9`.
- El valor de retorno se coloca en `rax`.
- `call` guarda una direccion de retorno en la pila y `ret` vuelve usando esa direccion.
- `push` resta 8 a `rsp` y guarda un valor; `pop` recupera un valor y suma 8 a `rsp`.
- `rbx`, `rbp` y `r12`-`r15` deben conservar su valor si una funcion los usa.
- Una funcion hoja simple puede evitar tocar la pila y usar solo registros volatiles.
- `cmp byte [rdi + rax], 0` lee un byte de memoria en la direccion calculada y compara ese byte contra cero.

## Preguntas tipo defensa

1. Que registro contiene el primer argumento de una funcion en System V AMD64?
2. Donde debe colocar una funcion ASM su valor de retorno?
3. Que diferencia hay entre `rdi` y `[rdi]`?
4. Que hace `call` antes de saltar a una funcion?
5. Que espera encontrar `ret` arriba de la pila?
6. Que registros son preservados por la ABI?
7. Por que `mov rbx, 123; ret` puede romper al llamador?
8. Que hace `push rax` sobre `rsp`?
9. Por que una funcion hoja como `ft_strlen` puede no tocar la pila?
10. En `cmp byte [rdi + rax], 0`, que se compara realmente?

## Criterio de finalizacion

La clase queda completada cuando puedes explicar como llegan argumentos desde C a ASM, como se devuelve un valor por `rax`, que hacen `call` y `ret`, que registros debes preservar, como funcionan `push` y `pop`, y puedes trazar una version de `ft_strlen` basada en `[rdi + rax]` hasta devolver la longitud correcta.

## Siguiente clase

La clase 4 parte de este modelo de ABI y pila para bajar hasta el artefacto real: secciones ELF, símbolos, relocaciones, el enlazador `ld`, la biblioteca estática y las herramientas (`nasm`, `ar`, `readelf`, `objdump`, `nm`, `gdb`) con las que se inspecciona todo.
