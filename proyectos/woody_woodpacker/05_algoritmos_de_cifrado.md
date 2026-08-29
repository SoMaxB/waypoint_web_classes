# Algoritmos de cifrado para el packer

*Guía de estudio para woody_woodpacker (42) — elegir y justificar el algoritmo*

## 1. Lo que exige el enunciado (y lo que no)

El sujeto dice literalmente: *"La complejidad de vuestro algoritmo será una parte muy importante de la evaluación... un ROT fácil no se considera un algoritmo avanzado"*. No pide un algoritmo estándar certificado, pide que **sepáis defenderlo**: por qué es más fuerte que un XOR trivial, qué garantías da y cuáles no. No hace falta implementar AES completo — de hecho, para un binario que se reejecuta y se autodescifra, un cifrado de bloque completo con modos de operación complejos añade complejidad de implementación sin aportar mucho valor real aquí.

## 2. Opción base a evitar: XOR con clave fija corta

Un XOR byte a byte con una clave de, por ejemplo, 4 bytes repetida cíclicamente es exactamente el "ROT fácil" que el enunciado descarta: es trivialmente reversible por análisis de frecuencia si el atacante conoce o sospecha patrones en el `.text` (instrucciones x86 tienen mucha estructura reconocible). No lo uséis como algoritmo final, pero es un buen primer paso de implementación para validar el pipeline de inyección antes de complicar el cifrado real (como hicisteis en el paso 5 del plan de construcción original, "prueba de inyección sin cifrado" — el XOR fijo es un peldaño intermedio útil, no el resultado final).

## 3. Opción recomendada: RC4 (o similar *stream cipher* con keystream generado)

RC4 es un buen punto óptimo dificultad/tiempo/defendibilidad para este proyecto:
- Es un **stream cipher**: genera un flujo de bytes pseudoaleatorios (el "keystream") a partir de la clave, y cifra/descifra haciendo XOR byte a byte del keystream con los datos. Esto significa que cifrar y descifrar son **la misma operación** (ventaja práctica: un único bucle sirve para ambas direcciones).
- El keystream no es una clave fija repetida como en el XOR trivial: cada byte del keystream depende de un estado interno de 256 bytes que se mezcla mediante un *Key Scheduling Algorithm* (KSA) y luego se genera con un *Pseudo-Random Generation Algorithm* (PRGA). Esto rompe los patrones repetitivos que hacían trivial el XOR simple.
- Es implementable en pocas líneas tanto en C (para el lado host, si preferís cifrar ahí) como en ensamblador (si preferís que el propio stub lo calcule, aunque para el mandatory basta con que el host cifre y el stub descifre con el mismo algoritmo).

Estructura de RC4 (para que la estudiéis, no la copiéis sin entenderla — tendréis que defenderla):
1. **KSA**: inicializar un array `S[256] = {0, 1, 2, ..., 255}`, y con la clave, reordenarlo (permutación pseudoaleatoria dependiente de la clave).
2. **PRGA**: generar el keystream byte a byte, actualizando dos índices (`i`, `j`) sobre `S` en cada paso y usando el valor resultante para indexar el byte de keystream.
3. **XOR**: `byte_cifrado = byte_original XOR keystream_byte`.

⚠️ Nota de seguridad real (mencionadla en la defensa, da puntos de criterio): RC4 tiene debilidades criptográficas conocidas en contextos de red (por eso está deprecado en TLS), pero en este contexto —cifrar un blob estático una sola vez con clave aleatoria de un solo uso, sin reutilización de keystream entre binarios distintos— esas debilidades no son el punto débil relevante; lo importante aquí es no ser trivialmente reversible por inspección, que RC4 cumple de sobra frente a un ROT.

## 4. Alternativa: cifrado de bloque simplificado (más ambicioso)

Si queréis ir un paso más allá para el mandatory o como parte de la justificación de "complejidad", podéis implementar un cifrado por bloques simplificado (por ejemplo, unas pocas rondas de sustitución-permutación sobre bloques de 8 o 16 bytes, con la clave mezclada en cada ronda). Es más trabajo y más difícil de depurar (especialmente si lo hacéis en el stub en asm), así que valorad el coste/beneficio en tiempo frente a RC4. Para el bonus de "optimización en asm" puede tener sentido si os sobra tiempo tras tener el mandatory sólido.

## 5. Generación de la clave: aleatoriedad real

El enunciado pide que la clave se genere "lo más aleatoriamente posible". **No uséis `rand()`/`srand(time(NULL))`** — es predecible y de baja calidad. Usad el generador del propio sistema operativo:

```c
int fd = open("/dev/urandom", O_RDONLY);
read(fd, key_buffer, key_len);
close(fd);
```

`/dev/urandom` os da bytes con entropía real recolectada por el kernel, apto para claves de un solo uso como esta. Recordad: el enunciado pide que la clave se **imprima por stdout** al ejecutar el programa principal (`key_value: ...` en el ejemplo del sujeto), normalmente en hexadecimal.

## 6. Dónde vive la clave en runtime

El stub que descifra necesita la clave (o el keystream ya derivado) disponible en memoria cuando se ejecuta `woody`. Opciones:
- Embeber la clave directamente en los bytes inyectados junto al stub (más simple, es lo esperado para el mandatory).
- (Bonus "clave parametrizada") permitir pasar la clave por algún mecanismo externo en vez de embeberla fija — pensad en las implicaciones de seguridad de cada enfoque para poder discutirlo en la defensa.

## 7. Checklist para la defensa sobre esta parte

- [ ] ¿Sabéis explicar, sin mirar el código, por qué vuestro algoritmo no es un ROT disfrazado?
- [ ] ¿Sabéis qué pasa si dos ejecuciones de `woody_woodpacker` sobre el mismo binario producen claves distintas (deberían, por la aleatoriedad de `/dev/urandom`)?
- [ ] ¿Podéis argumentar qué tan grande es el espacio de claves y por qué eso importa?
- [ ] ¿Sabéis qué debilidades reales tiene vuestro algoritmo elegido, y por qué no son críticas en este contexto de uso concreto?

## 8. Ejercicio recomendado

Implementad primero RC4 (o el algoritmo que elijáis) como un programa C standalone, totalmente separado del proyecto: cifrad un fichero de texto, descifradlo, comprobad que `diff` da vacío entre el original y el resultado de cifrar+descifrar. Solo cuando esto esté validado de forma aislada, portad la parte de descifrado a ensamblador para el stub — así separáis los bugs de "el algoritmo está mal" de los bugs de "la inyección en el ELF está mal", que si los mezcláis desde el principio son mucho más difíciles de diagnosticar.
