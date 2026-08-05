# Clase 1: Creación y unión de hilos

## Objetivo

Aprender las dos operaciones fundamentales de pthreads: `pthread_create` (lanzar un hilo) y `pthread_join` (esperarlo y recoger su retorno). Al terminar debes poder crear N hilos, pasarles datos por puntero y recoger resultados, y explicar el error clásico de pasar la variable del bucle a varios hilos.

## 1. Crear un hilo

`pthread_create` lanza una función en un hilo nuevo:

```c
int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start_routine)(void *), void *arg);
```

- `thread`: dónde se guarda el identificador del hilo nuevo.
- `attr`: atributos; `NULL` = por defecto.
- `start_routine`: la función que ejecuta el hilo. Recibe un `void *` y devuelve un `void *`.
- `arg`: lo que se pasa a esa función.

Ejemplo mínimo:

```c
#include <pthread.h>
#include <stdio.h>

void *saludo(void *arg) {
    const char *msg = arg;
    printf("%s\n", msg);
    return NULL;
}

int main(void) {
    pthread_t th;
    pthread_create(&th, NULL, saludo, "hola desde el hilo");
    pthread_join(th, NULL);   /* sin esto el programa puede salir antes */
    return 0;
}
```

`main` también es un hilo: si termina (vuelve de `main`), el proceso termina **y se llevan por delante a los demás hilos**. Por eso casi siempre hay un `join` antes de salir.

## 2. Unir un hilo

`pthread_join` espera a que el hilo termine y puede recoger su valor de retorno:

```c
void *retorno;
pthread_join(th, &retorno);
```

Con `retorno = NULL` solo se espera sin recoger nada. El retorno es un puntero; típicamente se apunta a un `malloc`, no a una variable local de la rutina (que ya no existe).

## 3. Pasar argumentos

El argumento es un puntero único. Para pasar varios datos, se agrupan en una estructura:

```c
struct info { int id; int valor; };

void *trabajo(void *arg) {
    struct info *inf = arg;
    printf("hilo %d con valor %d\n", inf->id, inf->valor);
    return NULL;
}
```

La memoria debe seguir viva mientras el hilo la use: lo habitual es reservarla con `malloc` o usar un array global. No se debe pasar la dirección de una variable local de la pila de `main` que se recicla en cada iteración (ver error clásico).

## 4. Error clásico: pasar `&i` en un bucle

El patrón erróneo más repetido:

```c
for (int i = 0; i < N; i++)
    pthread_create(&th[i], NULL, trabajo, &i);   /* ¡mal! */
```

Todos los hilos reciben la **misma** dirección `&i`. Cuando el bucle avanza, `i` cambia, y cuando un hilo la lee puede ver un valor distinto del que "se le pasó": es una condición de carrera sobre `i`.

Alternativas correctas:

```c
/* 1) cada hilo recibe un malloc propio */
for (int i = 0; i < N; i++) {
    int *p = malloc(sizeof *p);
    *p = i;
    pthread_create(&th[i], NULL, trabajo, p);
}
/* y en la rutina, free(p) antes de retornar */

/* 2) un array con un slot por hilo */
static int slots[N];
for (int i = 0; i < N; i++) {
    slots[i] = i;
    pthread_create(&th[i], NULL, trabajo, &slots[i]);
}
```

Regla: cada hilo debe recibir memoria que **solo él** va a modificar, y que siga viva hasta que termine.

## 5. Recolectar retornos

```c
#include <stdlib.h>

void *calcula(void *arg) {
    int n = *(int *)arg;
    int *r = malloc(sizeof *r);
    *r = n * n;
    return r;   /* puntero a memoria dinámica */
}

int main(void) {
    pthread_t th;
    int arg = 7;
    pthread_create(&th, NULL, calcula, &arg);
    void *ret;
    pthread_join(th, &ret);
    printf("7^2 = %d\n", *(int *)ret);
    free(ret);
    return 0;
}
```

## 6. Compilación

Siempre con `-pthread`:

```text
cc -Wall -Wextra -Werror -pthread hilos.c -o hilos
```

## Predicciones y ejercicios

<details><summary>Predicción 1: ¿qué imprime?</summary>

Sin `pthread_join`, el ejemplo del saludo a menudo no imprime nada. ¿Por qué?

**Solución**: `main` vuelve y el proceso termina; el hilo nuevo puede no haber llegado a ejecutar el `printf`. `pthread_join` hace que `main` espere al hilo y garantiza que su trabajo se completó.
</details>

<details><summary>Predicción 2: el orden de los hilos</summary>

Dos hilos lanzados en este orden: `create(A)`, `create(B)`. ¿Está garantizado que A ejecuta su primera instrucción antes que B?

**Solución**: No. `pthread_create` solo crea el hilo; el planificador decide cuándo ejecuta cada uno. Puede correr B antes, o intercalarse, o ambos en paralelo. No hay orden de "arranque" garantizado.
</details>

<details><summary>Predicción 3: el bucle de `&i`</summary>

Con `for (int i = 0; i < 4; i++) pthread_create(&th[i], NULL, trabajo, &i);`, ¿qué puede imprimir el conjunto de hilos? ¿Por qué puede pasar?

**Solución**: Puede imprimir combinaciones con valores repetidos o faltantes (por ejemplo, cuatro "3", o "2 2 3 3"). Todos los hilos apuntan a la misma variable `i`; al leerla, cada uno puede ver el valor que `i` tenga en ese momento. Es una condición de carrera y el resultado es impredecible.
</details>

<details><summary>Ejercicio: suma con hilos</summary>

Escribe el código (esqueleto) que crea 4 hilos, cada uno suma una parte de un array global, y el hilo principal recolecta los resultados y muestra la suma total. Indica qué comparten y qué no.

**Solución** (esqueleto):

```c
#define N 4
static long partial[N];
static int data[1000];

void *sumar_parte(void *arg) {
    int id = *(int *)arg;
    for (int i = id * 250; i < (id + 1) * 250; i++)
        partial[id] += data[i];
    return NULL;
}

int main(void) {
    pthread_t th[N];
    int ids[N];
    for (int i = 0; i < N; i++) { ids[i] = i; pthread_create(&th[i], NULL, sumar_parte, &ids[i]); }
    long total = 0;
    for (int i = 0; i < N; i++) { pthread_join(th[i], NULL); total += partial[i]; }
    /* total = suma de todo el array; cada hilo escribe su propia partial[id], sin carrera */
    return 0;
}
```

Clave: cada hilo escribe en un slot **distinto** de `partial` (índice por id), así que no hay escritura compartida. `ids[i]` se guarda en un array fijo, no en la variable del bucle.
</details>

## Errores frecuentes

- No hacer `join` y que el proceso termine antes que sus hilos.
- Pasar `&i` del bucle a varios hilos (carrera clásica).
- Pasar la dirección de una variable local de `main` que se sale de alcance.
- Recoger el retorno sin liberar el `malloc` (fuga).
- No compilar con `-pthread`.
- Asumir que el orden de `create` es el orden de ejecución.

## Has aprendido que

- `pthread_create` lanza una función en un hilo nuevo.
- `pthread_join` espera al hilo y recoge su retorno.
- `main` también es un hilo; si termina, el proceso termina con todos los hilos.
- El argumento es un puntero único; hay que agrupar o repartir memoria por hilo.
- Pasar `&i` del bucle es una condición de carrera.
- No hay orden de ejecución garantizado entre hilos.
- Se compila y enlaza con `-pthread`.

## Preguntas tipo defensa

1. ¿Qué hace `pthread_join` y por qué casi siempre es necesario?
2. ¿Por qué pasar `&i` del bucle a varios hilos es un error?
3. ¿Qué memoria debe estar viva mientras un hilo usa su `arg`?
4. ¿Puedo confiar en que `create(A)` corra antes que `create(B)`? ¿Por qué?
5. ¿Cómo recogería el retorno de un hilo y cómo evitar fugas?

## Criterio de finalización

- Creo y uno N hilos y recojo resultados.
- Paso datos a cada hilo sin compartir memoria que se modifica por error.
- Explico el error de `&i` y lo corrijo con `malloc` o slots.
- Compilo con `-pthread` sin errores.
- Dibujo qué comparten y qué no comparten los hilos de mi programa.

## Siguiente clase

La clase 2 introduce el **mutex**: cuando los hilos sí escriben en un recurso compartido, la exclusión mutua con *owner* es la herramienta que evita las carreras.