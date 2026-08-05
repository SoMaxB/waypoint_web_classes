# Guía de aprendizaje: POSIX Threads

Concepto que profundiza en la concurrencia con `pthreads` de C sobre Linux. Complementa a "Semáforos en C": aquí el foco son la creación/unión de hilos, el mutex (con *owner*) y las variables de condición. No depende de un subject; el tema es la fuente de verdad.

El objetivo es manejar hilos como primitivas de primera clase: crearlos, unirlos, proteger recursos compartidos con un mutex y coordinar esperas con variables de condición, entendiendo cuándo cada herramienta es la correcta.

## 1. Itinerario

| Clase | Tema | Resultado |
|---|---|---|
| 1 | Creación y unión de hilos: `pthread_create`, `pthread_join` | Lanzar y recoger hilos, pasar datos por puntero y capturar el retorno |
| 2 | Mutex: `pthread_mutex_lock` / `unlock` | Proteger sección crítica con exclusión mutua y *owner* |
| 3 | Variables de condición: `pthread_cond_wait` / `signal` | Esperar una condición sin gastar CPU y sin correr carreras |

## 2. Modelo mental mínimo

- `pthread_create` lanza una función en un hilo nuevo; `pthread_join` espera a que ese hilo termine y puede recoger su valor de retorno.
- Los hilos comparten la memoria del proceso: lo que un hilo escribe a un puntero, lo ve el otro (eso incluye las carreras de Semáforos).
- Un **mutex** es como un semáforo binario con *owner*: solo el hilo que lo adquirió puede liberarlo. Eso evita ciertos errores, pero introduce otros (deadlock si un hilo se bloquea sosteniéndolo).
- Una **variable de condición** permite a un hilo dormir hasta que otra señalice que una condición cambió, **sin** retener el mutex.

## 3. API mínima

```c
#include <pthread.h>

pthread_t th;
pthread_create(&th, NULL, rutina, argumento_por_puntero);
pthread_join(th, &retorno);

pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_lock(&m);    pthread_mutex_unlock(&m);
```

Compilar con `-pthread`.

## 4. Cómo se estudia

1. **Predecir** qué hilo corre primero y qué comparte.
2. **Implementar** un ejemplo que cree N hilos y los recoja con `join`.
3. **Detectar** carreras con `-fsanitize=thread` / helgrind.
4. **Depurar** con `gdb` (concurrencia: `info threads`, cambiar de hilo).
5. **Defender** en voz alta por qué hace falta un mutex y qué garantiza la condición.

## 5. Auditoría del concepto

Antes de cerrar debes responder afirmativamente:

- Creo y uno hilos y recojo su retorno.
- Explico por qué pasar `&i` de un bucle a varios hilos es un error de carrera clásico.
- Protejo una variable compartida con un mutex y evito el deadlock.
- Uso una variable de condición para esperar un estado sin spinning.
- Compilo y enlazo con `-pthread` y detecto carreras con sanitizers.

## 6. Siguientes pasos

- **Semáforos en C** aporta el contador y señalización; combinando mutex + condiciones se resuelven los mismos patrones de forma más expresiva.
- En **Sockets**, los hilos sirven para atender varios clientes a la vez.

## 7. Referencias

- `man 7 pthreads`, `man 3 pthread_create`, `man 3 pthread_join`, `man 3 pthread_mutex_lock`, `man 3 pthread_cond_wait`.
- `GCC -fsanitize=thread`, `valgrind --tool=helgrind`.