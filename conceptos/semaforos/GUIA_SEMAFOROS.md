# Guía de aprendizaje: Semáforos POSIX

Este concepto es transversal a varios proyectos de 42 (philosophers, minishell, ft_ping…). No depende de ningún subject: aquí el tema es la fuente de verdad. Se estudia con C y `semaphore.h` (POSIX) sobre Linux.

El objetivo no es memorizar llamadas, sino construir el modelo mental de la concurrencia: qué es una sección crítica, por qué una operación no atómica necesita sincronización y cuándo un semáforo es la herramienta correcta.

## 1. Itinerario

| Clase | Tema | Resultado |
|---|---|---|
| 1 | Procesos, hilos, carrera y sección crítica | Identificar una condición de carrera y explicar por qué `i++` no es atómico |
| 2 | Semáforos POSIX: `sem_init`, `sem_wait`, `sem_post` | Proteger una sección crítica y predecir el valor del contador |
| 3 | Productor-consumidor y problemas clásicos | Sincronizar dos roles con un contador y elegir la semántica correcta |

## 2. Modelo mental mínimo

- Un **proceso** es una instancia de un programa con su propia memoria; un **hilo** es una línea de ejecución dentro de un proceso que comparte memoria con sus hermanos.
- Dos hilos pueden ejecutarse **intercalados** en cualquier orden. El interleaving real no es determinista.
- Una **sección crítica** es un fragmento de código que toca un recurso compartido y no debe ejecutarse en paralelo con otra sección crítica sobre el mismo recurso.
- Una operación es **atómica** si se ejecuta sin interrupciones observables. En C, `i++` compila a varias instrucciones (leer, sumar, escribir) y por tanto no es atómico.
- Un **semáforo** es un contador con dos operaciones atómicas: `wait` (decrementa; si llega a negativo, bloquea) y `post` (incrementa; puede desbloquear un hilo).
- **Condición de carrera**: el resultado depende del orden de ejecución de los hilos.

## 3. API POSIX (semáforos sin nombre)

```c
#include <semaphore.h>

int sem_init(sem_t *sem, int pshared, unsigned int value);
int sem_wait(sem_t *sem);      /* decrementa; bloquea si el valor es 0 */
int sem_post(sem_t *sem);      /* incrementa; desbloquea un hilo si estaba esperando */
int sem_destroy(sem_t *sem);
```

- `pshared = 0` para hilos del mismo proceso (nuestro caso). Para procesos distintos, `pshared = 1` y el semáforo debe vivir en memoria compartida.
- Compilar enlazando con `-pthread` (o `-lrt` según el sistema; en glibc moderna `-pthread` es suficiente).
- Recursos: usar `-Wall -Wextra -Werror`, `gdb` para detener hilos, y herramientas como helgrind/TSan (`-fsanitize=thread`) para detectar carreras.

## 4. Cómo se estudia

1. **Predecir** el interleaving de un fragmento con dos hilos antes de ejecutarlo.
2. **Implementar** un ejemplo mínimo en `sem.c` y compilar con `cc -pthread`.
3. **Observar** el comportamiento real y compararlo con la predicción.
4. **Inspeccionar** con `gdb`/TSan qué operaciones comparten datos.
5. **Defender** en voz alta qué garantiza el semáforo y qué no.

## 5. Auditoría del concepto

Antes de cerrar la clase 3 debes poder responder afirmativamente:

- Explico con un dibujo qué ocurre cuando dos hilos incrementan la misma variable.
- Distingo sección crítica, condición de carrera y operación atómica.
- Razono el valor del contador del semáforo tras una secuencia de `wait`/`post`.
- Protejo un recurso compartido con un semáforo y justifico el valor inicial.
- Implemento un productor-consumidor y explico por qué no hay carrera.
- Sé cuándo un semáforo no es la herramienta adecuada (p. ej. cuando solo hace falta exclusión mutua).

## 6. Siguientes pasos

- El concepto de **Hilos POSIX** profundiza en la creación y unión de hilos y en mutex.
- El concepto de **Sockets** usa la sincronización para servidores que atienden varios clientes.

## 7. Referencias

- `man 3 sem_init`, `man 3 sem_wait`, `man 3 sem_post`, `man 7 pthreads`, `man 7 sem_overview`.
- `GCC` con `-fsanitize=thread` para detectar carreras.
