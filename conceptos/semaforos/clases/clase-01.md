# Clase 1: Procesos, hilos, carrera y sección crítica

## Objetivo

Construir el modelo mental mínimo de la concurrencia en C: qué es un hilo, qué significa que dos hilos compartan memoria, por qué una operación como `i++` no es atómica y cómo una condición de carrera produce resultados erróneos. Al terminar debes poder dibujar el interleaving de dos hilos sobre una variable compartida y señalar el punto exacto donde se pierde la exclusión.

## 1. Procesos frente a hilos

Un **proceso** es una instancia de un programa en ejecución. Cada proceso tiene su propia memoria, sus propios descriptores y su propio espacio de direcciones. Dos procesos no ven la memoria del otro sin un mecanismo explícito.

Un **hilo** (thread) es una línea de ejecución dentro de un proceso. Todos los hilos de un mismo proceso **comparten la misma memoria**, los mismos descriptores y el mismo espacio de direcciones. Esa memoria compartida es la fuente de los problemas que veremos.

```text
Proceso A                  Proceso B
+------------------------+  +------------------------+
| memoria propia         |  | memoria propia          |
| hilo a1, hilo a2       |  | hilo b1                 |
+------------------------+  +------------------------+
        ^ solo comparten lo que piden mediante IPC

Proceso C (un solo proceso con varios hilos)
+----------------------------------------+
| memoria ÚNICA                          |
| hilo c1  hilo c2  hilo c3  (comparten) |
+----------------------------------------+
```

Modelo mental: un hilo es lo que la CPU ejecuta; un proceso es la "caja" que le da memoria. Varios hilos comparten la caja.

## 2. El programador y el interleaving

El kernel tiene un **planificador** (scheduler) que interrumpe un hilo y ejecuta otro. El orden en que se entrelazan las instrucciones se llama **interleaving** y **no es determinista**: no podemos predecir cuál se ejecutará primero ni en qué punto.

```text
hilo c1:   A   B   C
hilo c2:      X     Y

Interleaving posible: A X B C Y
Otro posible:          X A Y B C
```

Dos hilos pueden intercalarse **dentro** de una misma operación si esa operación usa varias instrucciones.

## 3. Operaciones atómicas y no atómicas

Una operación es **atómica** si, desde fuera del hilo que la ejecuta, parece indivisible: no hay un punto intermedio observable. En C, la mayoría de las operaciones de alto nivel **no son atómicas**.

Por ejemplo, `counter++` en C se traduce en varias instrucciones de máquina:

```text
1. leer   el valor de counter desde memoria   (load)
2. sumar  1 al valor leído                    (add)
3. escribir el resultado de vuelta a memoria  (store)
```

Hay un punto observable entre la lectura y la escritura: otro hilo puede ver `counter` con el valor antiguo o con el nuevo, pero no "a medias del incremento". El problema es que dos hilos pueden intercalarse entre esos tres pasos.

## 4. Condición de carrera

Una **condición de carrera** ocurre cuando el resultado depende del orden en que se ejecutan los hilos. Es un error: el resultado puede ser distinto en cada ejecución del mismo programa.

Ejemplo con dos hilos que ambos ejecutan `counter++` partiendo de `counter = 0`:

```c
#include <stdio.h>
#include <pthread.h>

static int counter = 0;

void *inc(void *arg) {
    (void)arg;
    for (int i = 0; i < 100000; i++) counter++;
    return NULL;
}

int main(void) {
    pthread_t t1, t2;
    pthread_create(&t1, NULL, inc, NULL);
    pthread_create(&t2, NULL, inc, NULL);
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    printf("counter = %d\n", counter);   /* ¿200000? */
    return 0;
}
```

Intuitivamente querríamos `200000`, pero a menudo es menor. El interleaving "pierde" incrementos:

```text
hilo c1:   leer 0  -> sumar -> 1 -> escribir 1
hilo c2:     leer 0 (ve el valor ANTES del store de c1)
             -> sumar -> 1 -> escribir 1

Resultado: 1 en lugar de 2. Se perdió un incremento.
```

Ambos hilos leyeron `0`; ambos escribieron `1`. El segundo store pisa al primero. Esa es la condición de carrera: el resultado depende del interleaving.

## 5. Sección crítica

Una **sección crítica** es el fragmento de código que accede a un recurso compartido y que no debe ejecutarse **a la vez** que otra sección crítica sobre el mismo recurso.

En el ejemplo anterior, el cuerpo `counter++` es la sección crítica. El objetivo de la sincronización es garantizar una propiedad llamada **exclusión mutua**: si un hilo está en la sección crítica, ningún otro puede entrar hasta que salga.

Necesitamos una herramienta que:

- Impida que dos hilos estén **simultáneamente** dentro de la sección crítica.
- No dependa de adivinar el interleaving.
- Funcione agente casual: dé resultados reproducibles.

Esa herramienta, en este concepto, es el **semáforo** (clase 2). Existe otra, el **mutex**, que veremos a fondo en Hilos POSIX.

## 6. Cuándo hace falta sincronización

Se necesita cuando se cumplen las tres condiciones a la vez:

1. Hay un recurso **compartido** entre varios hilos (una variable global, un buffer, un descriptor).
2. Hay al menos una **escritura** sobre ese recurso.
3. Los hilos no se coordinan de otro modo.

Si el recurso es de solo lectura, no hace falta. Si cada hilo tuviera su propia copia, tampoco. El "riesgo" empieza cuando se comparte algo que se escribe.

## Predicciones y ejercicios

Desarrolla cada uno antes de mirar la solución.

<details><summary>Predicción 1: interleaving de `i++`</summary>

Dos hilos ejecutan `i++` con `i = 0` inicial. Escribe una secuencia de interleaving concreta que termine en `i = 1` explicando qué instrucción del hilo B ve un valor ya desactualizado.

**Solución**: B lee `i` mientras A está entre su `load` y su `store`. Ejemplo:

```text
A: load i  (lee 0)
B: load i  (lee 0, A aún no ha escrito)
A: add  -> 1 ; store -> i = 1
B: add  -> 1 ; store -> i = 1  (pisa el store de A)
Resultado: i = 1
```

</details>

<details><summary>Predicción 2: qué es atómico</summary>

Di si las siguientes operaciones son atómicas a nivel de máquina y por qué:

1. `x = 5;` (guardar una constante en una variable `int`).
2. `counter += 1;`
3. `str++;` (avanzar un puntero).

**Solución**:

1. Normalmente sí: un `store` de un `int` alineado suele ser atómico en x86-64.
2. No: implica `load`, `add`, `store`.
3. No: es `load` del puntero + `add` + `store` del nuevo valor del puntero. Aunque el "avance" sea de una unidad, son varias instrucciones.

La atomicidad depende de la plataforma y de si hay un punto observable a mitad de camino; el estándar no promete nada sobre instrucciones concretas, solo sobre primitivas como los atómicos de C11.
</details>

<details><summary>Predicción 3: ¿siempre hay carrera?</summary>

Tres hilos incrementan cada uno 1000 veces una variable compartida. ¿El resultado está garantizado? Justifica.

**Solución**: No. El resultado puede ser menor que 3000 dependiendo del interleaving. La presencia de la carrera no garantiza un valor erróneo en cada ejecución: puede "acertar" por casualidad. Que no salte cada vez no significa que el código sea correcto.
</details>

<details><summary>Ejercicio: localizar la sección crítica</summary>

Dada esta función que dos hilos llaman sobre la misma estructura `struct msg *m`:

```c
void add(struct msg *m, int n) {
    m->total += n;
    m->count++;
}
```

Localiza la sección crítica, la escritura compartida y explica qué resultado querríamos y cuál puede pasar.

**Solución**:

- Recurso compartido: `m->total` y `m->count` (ambos se leen y escriben).
- Sección crítica: ambas sentencias del cuerpo de `add`, pues tocan el mismo recurso.
- Resultado esperado: si dos hilos llaman `add(m, 1)` y `add(m, 2)`, querríamos `total` incrementado en 3 y `count` en 2.
- Resultado posible: si los hilos intercalan dentro de `m->total += n`, se pierde una suma; y el par `total`/`count` puede quedar incoherente de forma transitoria (aunque cada campo por separado sea consistente al final, un tercer hilo podría observar la mezcla). De aquí surge también la idea de que a veces hace falta proteger más de una variable a la vez.
</details>

## Errores frecuentes

- Pensar que "escribo código simple, así que no hace falta sincronización". La necesidad no depende de la complejidad sino de compartir una escritura.
- Creer que `i++` es atómico porque en el lenguaje parece una sola operación.
- Asumir que el resultado erróneo aparece siempre; una carrera puede pasar desapercibida en pruebas.
- Confundir hilos con procesos y asumir que no comparten memoria.
- Intentar "arreglar" la carrera durmiendo hilos o esperando con `usleep`; eso cambia la probabilidad, no elimina el problema.
- Creer que leer y escribir la misma variable desde un único hilo es un problema; la carrera exige al menos dos.

## Has aprendido que

- Un hilo comparte la memoria de su proceso con sus hermanos; un proceso no.
- El orden de ejecución de los hilos (interleaving) lo decide el planificador y no es determinista.
- Una operación en C no es atómica por defecto; `i++` son varias instrucciones.
- Un **interleaving** entre `load`, `add` y `store` puede perder incrementos.
- Una **condición de carrera** es un resultado que depende del orden de ejecución.
- Una **sección crítica** toca un recurso compartido y debe correr con exclusión mutua.
- La sincronización es necesaria cuando se comparte un recurso que se escribe.
- Dormir hilos o esperar no arregla una carrera; solo cambia su probabilidad.

## Preguntas tipo defensa

1. ¿Qué diferencia hay entre un proceso y un hilo respecto a la memoria?
2. ¿Por qué `i++` no es atómico en C?
3. Dibuja un interleaving en el que dos hilos pierden un incremento de una variable compartida.
4. ¿Qué es una condición de carrera y por qué depende del orden de ejecución?
5. ¿Qué condiciones hacen falta para que un acceso necesite sincronización?
6. ¿Por qué `usleep` no es una solución válida para una carrera?

## Criterio de finalización

- Dibujo el interleaving de dos hilos sobre una variable compartida indicando el punto exacto del conflicto.
- Explico por qué `i++` son varias instrucciones y por tanto no atómico.
- Distingo recurso compartido, sección crítica y condición de carrera con tus palabras.
- Doy el ejemplo mínimo donde el resultado depende del orden de ejecución.
- Doy razones por las que "funcionó una vez" no demuestra que el programa sea correcto.

## Siguiente clase

La clase 2 introduce el semáforo POSIX (`sem_t`, `sem_init`, `sem_wait`, `sem_post`) como la herramienta que impone exclusión mutua sobre la sección crítica, y te enseña a predecir el valor del contador tras cada operación.