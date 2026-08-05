# Glosario: POSIX Threads

Referencia de los términos que aparecen en este concepto, en español. Se publica como glosario bilingüe cuando el concepto se publica.

| Término | Significado literal | Descripción de uso |
|---|---|---|
| hilo / thread | Thread | Línea de ejecución dentro de un proceso; los hilos hermanos comparten memoria. |
| pthread | POSIX thread | API estándar de hilos de C en sistemas POSIX (Linux, BSD, macOS). |
| pthread_t | Tipo de hilo | Tipo opaco que identifica un hilo dentro de un proceso. |
| pthread_create | Thread create | Crea un hilo nuevo que ejecuta una función. |
| pthread_join | Thread join | Espera a que un hilo termine y recoge su valor de retorno. |
| pthread_exit | Thread exit | Termina el hilo que lo llama con un valor de retorno. |
| argumento (arg) | Argument | Puntero opaco que se pasa a la rutina del hilo; los datos se comparten por puntero. |
| retorno | Return value | Valor que el hilo entrega al final y que `pthread_join` puede recoger. |
| raza / condición de carrera | Race condition | Resultado erróneo que depende del orden de ejecución de los hilos. |
| mutex | Mutual exclusion | Mecanismo de exclusión mutua con *owner*: solo quien lo adquirió puede liberarlo. |
| pthread_mutex_t | Tipo de mutex | Tipo que representa un mutex. |
| pthread_mutex_lock | Mutex lock | Adquiere el mutex; bloquea al hilo si otro lo tiene. |
| pthread_mutex_unlock | Mutex unlock | Libera el mutex; es ilegal soltarlo si no lo posees. |
| PTHREAD_MUTEX_INITIALIZER | Inicializador estático | Macro para inicializar un mutex estático. |
| owner | Propietario | Hilo que adquirió el mutex; solo él puede liberarlo. |
| variable de condición | Condition variable | Mecanismo para que un hilo duerma hasta que otro señale un cambio de estado. |
| pthread_cond_wait | Cond wait | Libera el mutex, duerme y lo recupera al despertar; debe llamarse en bucle. |
| pthread_cond_signal | Cond signal | Despierta a un hilo que espera en esa condición. |
| pthread_cond_broadcast | Cond broadcast | Despierta a todos los hilos que esperan en esa condición. |
| spurious wakeup | Despertar espurio | Despertar de un hilo sin señalización explícita; por eso la espera va en bucle. |
| deadlock | Interbloqueo | Espera cíclica de recursos; ningún hilo avanza. |
| spinning / busy wait | Espera activa | Bucle que repite comprobando una condición sin dormir; consume CPU. |
| TSan | Thread Sanitizer | `-fsanitize=thread`: detecta carreras en tiempo de ejecución. |
| helgrind | — | Herramienta de Valgrind que detecta carreras y bloqueos de hilos. |
| `-pthread` | pthread flag | Flag que activa soporte de hilos en compilación y enlace. |