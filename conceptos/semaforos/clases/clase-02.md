# Clase 2: Semáforos POSIX y sección crítica

## Objetivo

Presentar el semáforo de `semaphore.h` como la herramienta que impone exclusión mutua sobre una sección crítica. Al terminar debes poder proteger una variable compartida con `sem_init`/`sem_wait`/`sem_post`, predecir el valor del contador tras una secuencia de operaciones y explicar qué garantiza y qué no garantiza un semáforo.

## 1. Qué es un semáforo

Un **semáforo** es un contador entero con dos operaciones **atómicas**:

- `sem_wait(sem)`: si el contador es mayor que 0, lo decrementa en 1 y continúa. Si es 0, el hilo **se bloquea** hasta que pueda decrementarlo.
- `sem_post(sem)`: incrementa el contador en 1. Si había hilos bloqueados esperando, desbloquea a uno de ellos.

La palabra clave es **atómica**: la comprobación y el decremento de `sem_wait` ocurren sin posibilidad de intercalado con otro hilo. Por eso sirve para sincronizar.

```text
sem_wait:
   if (contador == 0) { bloquear este hilo; }
   contador--;            /* todo esto es atómico */
sem_post:
   contador++;
   si hay un hilo esperando, desbloquéalo
```

## 2. Declaración e inicialización

```c
#include <semaphore.h>

sem_t sem;                          /* tipo opaco */
sem_init(&sem, 0, 1);               /* pshared=0 (mismos hilos), valor inicial 1 */
```

El segundo argumento (`pshared`) indica el ámbito:

- `0`: el semáforo se comparte entre hilos del mismo proceso (más común en este concepto).
- `1`: el semáforo se comparte entre procesos y debe vivir en memoria compartida.

El tercer argumento es el **valor inicial**, que decide la semántica (sección 4). Siempre se libera con `sem_destroy(&sem)` cuando ya no se usa.

## 3. Proteger una sección crítica

El patrón para exclusión mutua con un semáforo **binario** (valor inicial 1):

```c
sem_t sem;

void *trabajo(void *arg) {
    (void)arg;
    for (int i = 0; i < 100000; i++) {
        sem_wait(&sem);          /* ENTRAR a la sección crítica */
        counter++;               /* sección crítica              */
        sem_post(&sem);          /* SALIR de la sección crítica  */
    }
    return NULL;
}

int main(void) {
    sem_init(&sem, 0, 1);
    /* crear dos hilos y hacerles join */
    sem_destroy(&sem);
}
```

Con valor inicial `1`, solo un hilo está "dentro" a la vez: el primero hace `wait` y deja el contador en `0`; el segundo hace `wait`, ve `0` y se bloquea hasta que el primero hace `post`. Así el `counter++` queda protegido y el resultado es reproducible.

## 4. Significado del valor inicial

El valor inicial selecciona la semántica:

- `0`: nadie puede pasar hasta que alguien haga `post`. Es la base para **señalizar** ("avísame cuando esté listo").
- `1`: exclusión mutua (como un candado): únicamente un hilo a la vez.
- `N` (> 1): permiten que hasta `N` hilos entren a la vez (acceso a un pool de recursos).

Hay que **elegirlo conscientemente**. `sem_init(&sem, 0, 1)` no es una fórmula mágica: es "dejo pasar a uno".

## 5. Predecir el valor del contador

La forma de razonar:

1. Cada `sem_wait` superado resta 1 (si no bloqueó).
2. Cada `sem_post` suma 1.
3. Un `sem_wait` bloqueado no modifica el contador aún: lo deja en 0 y lo mueve cuando otro hilo hace `post`.
4. `sem_post` nunca bloquea: siempre suma y desbloquea un esperador.

Ejemplo: `sem_init(&s, 0, 0)`.

```text
sem_wait(&s);   -> bloquea (contador 0)      contador = 0
sem_post(&s);   -> contador 1, desbloquea     contador = 0 (lo consume el esperador)
```

Sumar `post` sin `wait` (o al revés) lleva a contadores desequilibrados; detectar ese desequilibrio es clave para leer código concurrente.

## 6. Compilación

Los semáforos y los hilos requieren activar el soporte de pthreads:

```text
cc -Wall -Wextra -Werror -pthread sem.c -o sem
```

Sin `-pthread`, `sem_*` puede no declararse correctamente o fallar en enlazado dependiendo de la glibc.

## Predicciones y ejercicios

<details><summary>Predicción 1: exclusión mutua</summary>

Dos hilos, cada uno hace `wait; counter++; post` 100000 veces, con `sem_init(&sem, 0, 1)` y `counter = 0`. ¿Qué valor tiene `counter` al final? ¿Por qué?

**Solución**: `200000` (el esperado). El semáforo con valor inicial `1` garantiza que `counter++` se ejecuta con exclusión mutua; la sección crítica de cada hilo es indivisible desde el punto de vista del otro. No puede haber dos `counter++` superpuestos, así que no se pierde ningún incremento.
</details>

<details><summary>Predicción 2: el contador</summary>

Con `sem_init(&s, 0, 2)` y un único hilo que ejecuta `sem_wait(&s); sem_wait(&s); sem_post(&s);`, ¿cuál es el valor de `s` al final y cuántos hilos podrían entrar sin bloquearse?

**Solución**: El hilo consume dos permisos (`2 -> 1 -> 0`) y luego hace un `post` (`0 -> 1`). Valor final: `1`. El significado era "hasta 2 a la vez"; tras consumir dos permisos, se ha restaurado uno, así que queda un permiso libre: un hilo podría entrar ahora de inmediato.
</details>

<details><summary>Predicción 3: señalización</summary>

Con `sem_init(&s, 0, 0)`, el hilo A ejecuta `sem_post(&s)` y el hilo B ejecuta `sem_wait(&s)`. Describe qué le pasa a cada hilo y al contador, y cuál es el papel del semáforo aquí.

**Solución**: B hace `wait`, ve `0` y se bloquea. A hace `post`, el contador pasa a 1, se desbloquea B y B consume esa señalización: su `wait` no modifica adicionalmente el contador (ya lo "tomó"). Al final el contador vuelve a `0`. Aquí el semáforo no protege una sección sino que **avisa** de que algo está listo: B espera la señal de A.
</details>

<details><summary>Ejercicio: aislar la sección crítica</summary>

Escribe el código (solo la parte de sincronización) que protege dos variables globales `a` y `b` que dos hilos incrementan juntas, de modo que el par quede siempre coherente. Indica dónde van `sem_wait` y `sem_post` y el valor inicial.

**Solución**:

```c
sem_t sem;   /* sem_init(&sem, 0, 1);  */
void *trabajo(void *arg) {
    (void)arg;
    for (int i = 0; i < 100000; i++) {
        sem_wait(&sem);
        a++;
        b++;
        sem_post(&sem);
    }
    return NULL;
}
```

Ambas escrituras quedan dentro de la misma sección crítica (valor inicial `1`), de modo que ningún otro hilo observa `a` incrementada sin `b` (ni a la inversa). Si se protegieran con semáforos distintos, el par podría quedar temporalmente incoherente.
</details>

## Errores frecuentes

- Olvidar `sem_destroy` — no libera la sección crítica pero sí recursos del semáforo.
- Usar valor inicial `1` cuando se quiere señalizar (debería ser `0`) o al revés.
- Poner `sem_wait` y `sem_post` alrededor de código que no toca recursos compartidos (sobre-proteger, pierdes rendimiento sin motivo).
- Asumir que con más hilos o más iteraciones "se nota más" la carrera: si el semáforo está bien puesto, el resultado es estable.
- Confundir `sem_wait` (decrementa/bloquea) con `pthread_mutex_lock`; un mutex tiene *owner* y no puede ser liberado por otro hilo, cosa que un semáforo sí permite.
- No compilar con `-pthread` y culpar al código.

## Has aprendido que

- Un semáforo es un contador con `wait` y `post` atómicos.
- `sem_wait` decrementa o bloquea; `sem_post` incrementa y desbloquea, y nunca bloquea.
- El valor inicial decide la semántica: 0 = señalizar, 1 = excluir, N = pool.
- El patrón `wait` / sección crítica / `post` con valor inicial 1 impone exclusión mutua.
- Se puede predecir el valor del contador contando `wait` y `post` y sabiendo cuándo un `wait` bloquea.
- Se compila y enlaza con `-pthread`.
- Un semáforo garantiza exclusión, no por ejemplo orden de finalización de los hilos.

## Preguntas tipo defensa

1. ¿Qué hace exactamente `sem_wait` sobre el contador, y qué cuando está a 0?
2. ¿Por qué `sem_wait`/`sem_post` son atómicos y `i++` no?
3. ¿Qué valor inicial usarías para exclusión mutua, para señalización y para un pool de 4 recursos?
4. ¿Qué ocurre si dos hilos hacen `sem_post` sin ningún `sem_wait` entre medias?
5. ¿Por qué no es lo mismo un semáforo que un mutex?
6. ¿Qué problema resolvería este código y cuál podría quedar todavía sin resolver si protegiera dos variables por separado?

## Criterio de finalización

- Protejo una variable compartida con semáforo binario y el resultado es estable.
- Preveo el valor del contador tras una secuencia arbitraria de `wait`/`post`.
- Justifico el valor inicial elegido según la semántica buscada.
- Compilo correctamente con `-pthread`.
- Explico la diferencia entre semáforo y mutex.

## Siguiente clase

La clase 3 aplica el semáforo al patrón **productor-consumidor**: un productor y un consumidor coordinados por un buffer y un par de contadores, donde la elección del valor inicial es parte del diseño.