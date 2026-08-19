# Clase 3: Productor-consumidor y problemas clásicos

## Objetivo

Aplicar los semáforos al patrón **productor-consumidor**: un productor escribe datos en un buffer, un consumidor los lee, y ambos se coordinan con dos semáforos de contador. Al terminar debes poder implementar el patrón completo sin carreras ni accesos descontrolados, y justificar cada valor inicial.

## 1. El problema

Tenemos dos roles:

- **Productor**: produce un item y lo coloca en un buffer.
- **Consumidor**: retira un item del buffer y lo procesa.

El buffer es **compartido**, así que escribir y leer de él es una sección crítica. Además hay dos condiciones que hay que respetar:

- El consumidor no debe retirar de un buffer **vacío**.
- El productor no debe escribir en un buffer **lleno**.

Necesitamos coordinar al mismo tiempo la **exclusión** (no dos accesos a la vez) y el **retraso** (ocupado/vacío).

## 2. Dos semáforos de contador

Solución clásica con dos semáforos y un índice:

```c
#define N 8

sem_t empty;      /* huecos libres:  N  */
sem_t full;       /* items presentes: 0 */
sem_t mutex;      /* exclusión:       1 */

int buf[N];
int in = 0, out = 0;

void *productor(void *arg) {
    (void)arg;
    for (int i = 0; ; i++) {
        sem_wait(&empty);      /* espera hueco libre        */
        sem_wait(&mutex);      /* entra a la sección crítica */
        buf[in] = i;
        in = (in + 1) % N;
        sem_post(&mutex);      /* sale                       */
        sem_post(&full);       /* señaliza que hay un item   */
    }
    return NULL;
}

void *consumidor(void *arg) {
    (void)arg;
    int dato;
    for (;;) {
        sem_wait(&full);       /* espera item presente       */
        sem_wait(&mutex);
        dato = buf[out];
        out = (out + 1) % N;
        sem_post(&mutex);
        sem_post(&empty);      /* libera un hueco            */
        /* procesar dato... */
    }
    return NULL;
}
```

Valores iniciales:

- `empty = N`: hay N huecos libres.
- `full = 0`: no hay items al principio.
- `mutex = 1`: exclusión mutua sobre `buf` y los índices.

## 3. Por qué no hay carrera

Tres invariantes sostenidas por la elección de valores:

1. **`mutex` protege el acceso al buffer y a `in`/`out`**: dos hilos nunca tocan el array a la vez.
2. **`full` nunca se decrementa por debajo de "items realmente escritos"**: el consumidor solo pasa su `wait(&full)` cuando el productor ya hizo `post(&full)`.
3. **`empty` nunca se decrementa por debajo de "huecos reales"**: el productor solo avanza cuando hay hueco.

Al razonar el valor de `full`, el número de `post(&full)` del productor debe ser igual al número de `post(&empty)` del consumidor; cualquier desequilibrio es un bug visible al traducir el interleaving.

## 4. Elegir el valor inicial como parte del diseño

El patrón casi se explica solo si se piensa en los contadores como "permisos":

- `empty` es un permiso para **colocar** (hay `N`).
- `full` es un permiso para **retirar** (hay `0` al inicio).
- `mutex` es un permiso para **tocar el buffer** (hay `1`).

Si cambio el tamaño del buffer, cambio `N` en la inicialización de `empty`, no del resto.

## 5. Semáforos con nombre

`sem_open`, `sem_unlink` y `sem_close` crean semáforos **con nombre**, visibles por nombre y compartibles entre procesos (aunque hay que guardar la estructura en memoria compartida para el valor). Son útiles entre procesos; la filosofía es la misma: `wait`/`post`, solo cambia la creación.

## 6. Problemas clásicos (punto de partida)

Con el modelo de permisos se abordan otros problemas:

- **Filósofos que comen**: `N` filósofos y palillos; el riesgo de **deadlock** viene de que todos tomen primero el palillo izquierdo. Los semáforos no eliminan el deadlock: hay que diseñar para que un filósofo tome dos palillos "a la vez" o que el último no compita.
- **Lectores-escritores**: varios lectores a la vez o un único escritor; se resuelve con contadores y un mutex de control.

La lección: el semáforo hace eficiente la sincronización, pero **la estrategia** (evitar deadlock/inanición) es diseño del programador.

## Predicciones y ejercicios

<details><summary>Predicción 1: invariante de full</summary>

Con la implementación productor-consumidor, un productor completó exactamente `k` iteraciones completas (escribió `k` items) y no hay más en curso. ¿Qué valor entero puede tener `full` como máximo, y por qué?

**Solución**: a lo sumo `k` (y de hecho `full` cuenta items escritos no consumidos: `0 <= full <= N`). Cada item escrito correspondió a un `post(&full)`; como `full` empieza en 0 y solo se decrementa con `wait(&full)` del consumidor, el número de items no consumidos es menor o igual que el de escritas. Por eso `sem_wait(&full)` con valor 0 bloquea correctamente al consumidor con buffer vacío.
</details>

<details><summary>Predicción 2: distintos valores</summary>

¿Qué pasaría si en el productor-consumidor usáramos `empty = 0` y `full = 0`? ¿Y `empty = N` con `full = N`?

**Solución**:

- `empty = 0`, `full = 0`: el productor se bloquea de inmediato en `wait(&empty)` y nunca produce; el sistema queda muerto. Mal para empezar.
- `empty = N`, `full = N`: el consumidor cree que hay N items cuando el buffer está vacío; sus primeros `N` `wait(&full)` pasan sin que haya datos, leyendo basura del array. Error: los contadores no reflejan la realidad.
</details>

<details><summary>predicción 3: orden de los wait</summary>

En productor-consumidor, ¿por qué se hace `sem_wait(&full)` antes de `sem_wait(&mutex)`, en lugar de tomar el mutex primero?

**Solución**: Tomar `mutex` primero y luego bloquearse en `full`/`empty` es una receta para **deadlock**: un consumidor bloqueado (porque no hay items) sostendría el mutex e impediría al productor escribir el item que lo desbloquearía. Al esperar primero el recurso de "permiso" y solo después tomar el mutex, un hilo bloqueado no retiene el candado del buffer.
</details>

<details><summary>Ejercicio: buffer de 1</summary>

Adapta el patrón al caso más simple, `N = 1`. ¿Se puede eliminar `mutex`? ¿Por qué?

**Solución**: Con un buffer de tamaño 1, escribir y leer no pueden chocar si `full`/`empty` garantizan que el productor y el consumidor ya no acceden a la vez: cuando está lleno solo el consumidor actúa; cuando está vacío solo el productor. En ese caso `mutex` es redundante y puede omitirse. Es un buen ejercicio para ver cuándo la disciplina de los contadores sustituye al candado.
</details>

## Errores frecuentes

- Inicializar `full` y `empty` iguales (rompe la invariante).
- Tomar `mutex` antes de esperar al permiso (riesgo de deadlock).
- Olvidar mantener emparejados `post(&full)` / `post(&empty)`.
- Acceder al buffer o a `in`/`out` sin el mutex (carrera sobre los índices).
- Creer que aumentar el buffer "arregla" el patrón; cambia `N`, no la lógica.
- Diseñar el patrón sin pensar en deadlock e inanición; los semáforos no lo evitan por sí solos.

## Has aprendido que

- El productor-consumidor combina exclusión (`mutex`) y capacidad (`empty`/`full`).
- Los valores iniciales de `empty = N`, `full = 0`, `mutex = 1` definen el comportamiento correcto.
- Un hilo bloqueado en un `wait` de permiso no debe retener el mutex.
- Un buffer de tamaño 1 puede sincronizarse sin `mutex` gracias a los contadores.
- Los semáforos resuelven la primitiva, pero evitar deadlock e inanición es decisión de diseño.
- `sem_open`/`sem_unlink` extienden la idea entre procesos.

## Preguntas tipo defensa

1. ¿Qué valor inicial tienen `empty`, `full` y `mutex` y por qué cada uno?
2. ¿Qué ocurriría si el productor hiciera `post(&empty)` sin haber escrito el buffer?
3. ¿Por qué la API manda esperar el permiso antes de tomar el mutex?
4. ¿Cuándo puede eliminarse el mutex del patrón?
5. ¿Cómo detectarías en el interleaving un desequilibrio entre `full` y `empty`?
6. ¿Qué lección de *diseño* (no de primitivas) ilustra el problema de los filósofos?

## Criterio de finalización

- Implemento el productor-consumidor completo y correcto para un buffer de tamaño arbitrario.
- Justifico cada valor inicial y el orden de los `wait`.
- Explico por qué no hay carrera ni deadlock en mi versión.
- Adapto el patrón a `N = 1` y razono si el mutex es necesario.
- Reproduzco el razonamiento de permisos para diseñar una sincronización nueva.

## Siguiente clase

Con el semáforo dominado, el concepto de **Hilos POSIX** profundiza en la creación y unión de hilos, el `mutex` (con *owner*) y las variables de condición, herramientas más expresivas para coordinar hilos.