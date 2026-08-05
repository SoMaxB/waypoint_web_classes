# Glosario: Semáforos en C

Referencia de los términos que aparecen en este concepto, en español. Se publica como glosario bilingüe cuando el concepto se publica.

| Término | Significado literal | Descripción de uso |
|---|---|---|
| proceso | Process | Instancia de un programa en ejecución con su propia memoria y sus propios descriptores. |
| hilo / thread | Thread | Línea de ejecución dentro de un proceso. Los hilos de un mismo proceso comparten memoria. |
| concurrencia | Concurrency | Capacidad de ejecutar varias secuencias de código superpuestas en el tiempo. |
| interleaving | Intercalado | Orden concreto en el que se entrelazan las instrucciones de varios hilos. No es determinista. |
| condición de carrera | Race condition | Resultado erróneo que depende del orden en que se ejecutan los hilos. |
| sección crítica | Critical section | Fragmento que accede a un recurso compartido y no debe ejecutarse en paralelo con otro que toque el mismo recurso. |
| operación atómica | Atomic operation | Operación que se observa como indivisible desde fuera del hilo. |
| semáforo | Semaphore | Contador con operaciones atómicas de espera y señalización. |
| mutex | Mutual exclusion | Cerradura de exclusión mutua: solo un hilo a la vez. Caso particular de semáforo binario con owner. |
| sem_t | Semaphore type | Tipo opaco declarado en `semaphore.h` que representa un semáforo. |
| sem_init | Semaphore initialize | Inicializa un semáforo sin nombre con un valor inicial. |
| sem_wait | Semaphore wait | Decrementa el contador; bloquea al hilo si el valor es 0. |
| sem_post | Semaphore post | Incrementa el contador; desbloquea un hilo si alguno esperaba. |
| sem_destroy | Semaphore destroy | Libera los recursos asociados a un semáforo inicializado. |
| pshared | Process-shared | Argumento de `sem_init`: 0 para hilos del mismo proceso, 1 para procesos distintos (requiere memoria compartida). |
| bloqueo | Blocking | Estado de un hilo que espera hasta que una condición se cumpla. |
| desbloqueo | Unblocking | Acción que hace que un hilo bloqueado reanude su ejecución. |
| spinlock | Busy wait | Espera activa que repite un bucle en vez de dormir al hilo. Consume CPU. |
| deadlock | Interbloqueo | Situación en la que dos o más hilos esperan recursos que solo los otros liberan; ninguno avanza. |
| starvation | Inanición | Un hilo nunca obtiene el recurso porque otros siempre se adelantan. |
| productor-consumidor | Producer-consumer | Patrón con un productor que crea datos y un consumidor que los usa, coordinados por un buffer y contadores. |
| scheduler | Planificador | Componente del kernel que decide qué hilo se ejecuta y cuándo. |
| TSan | Thread Sanitizer | Sanitizador de GCC/Clang (`-fsanitize=thread`) que detecta condiciones de carrera en tiempo de ejecución. |
| `-pthread` | pthread flag | Flag de compilación y enlace que activa el soporte de hilos POSIX. |
