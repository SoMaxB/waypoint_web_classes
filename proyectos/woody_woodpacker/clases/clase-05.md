# Clase 5: algoritmos de cifrado para el packer

## Objetivo

Elegir y justificar un algoritmo de cifrado no-trivial para el packer. Al terminar debes explicar por qué un XOR con clave fija corta es un ROT disfrazado y no vale, cómo funciona RC4 (KSA+PRGA), cómo se genera la clave con `/dev/urandom` y dónde vive en runtime, y poder defender debilidades reales y espacio de claves.

## 1. Qué exige el subject (y qué no)

> "La complejidad de vuestro algoritmo será muy importante... un ROT fácil no se considera un algoritmo avanzado"

No pide AES certificado; pide que sepas defender por qué no es reversible trivialmente por inspección de patrones x86. 42 valora la justificación tanto como los bytes.

## 2. Lo que no vale: XOR con clave fija corta

XOR byte a byte con clave de 4 bytes repetida cíclicamente es el ROT del subject: el `.text` x86 tiene mucha estructura (opcodes frecuentes, `0x00`, `0x55`...), así que un analista rompe la clave por frecuencia o por known-plaintext. Úsalo solo como **peldaño de implementación** para validar inyección antes de cambiar al algoritmo real.

## 3. Recomendado: RC4 (stream cipher)

- Genera un **keystream** pseudoaleatorio a partir de la clave; cifra/descifra con `xor` por byte del keystream. **La misma operación cifra y descifra**.
- El keystream no es la clave repetida: cada byte depende de un estado de 256 bytes mezclado por KSA y actualizado por PRGA → rompe patrones repetitivos.

Esqueleto conceptual:

1. **KSA:** `S[256] = 0..255`; permuta `S` con la clave.
2. **PRGA:** genera keystream byte a byte manteniendo `i,j` sobre `S`.
3. **XOR:** `cifrado = original XOR keystream`.

> Nota de defensa: RC4 tiene debilidades reales en TLS por reutilización de keystream entre sesiones; aquí cifras un blob estático una sola vez con clave de un solo uso → esas debilidades no son el punto crítico, pero mencionarlas da puntos.

## 4. Alternativa más ambiciosa

Un cifrado por bloques simplificado (pocas rondas de sustitución-permutación sobre 8/16 bytes, mezclando clave cada ronda) es más trabajo y más difícil de depurar en asm, así que valora coste/beneficio. Puede tener sentido si buscas el bonus de "optimización en asm".

## 5. Generación de la clave: aleatoriedad real

```c
int fd = open("/dev/urandom", O_RDONLY);
read(fd, key, key_len);
close(fd);
printf("key_value: %02X...\n", ...);
```

No uses `rand()/srand(time)` — es predecible. El subject pide que la clave se imprima en hex por stdout (`key_value:` del ejemplo).

## 6. Dónde vive la clave en runtime

Embébela en los bytes inyectados junto al stub (más simple, esperado en mandatory). El bonus "clave parametrizada" permitiría pasarla por otro mecanismo externo; piensa las implicaciones para defenderlo.

## Predicciones y ejercicios

### Ejercicio 1 — ¿por qué no vale XOR fijo?

Te dan un `.text` con muchos `0x00` y `0xFF` y lo cifras con XOR clave `0xAB` repetida. ¿Qué patrón ve el atacante?

<details><summary>Solución</summary>

Cada `0x00` se convierte en `0xAB`, cada `0xFF` en `0x54`. Aparecen dos valores dominantes a distancia fija `0xAB`; un conteo de frecuencia revela la clave por inspección sin conocer el plaintext.

</details>

### Ejercicio 2 — KSA/PRGA a mano (papel)

Con clave `01 02` y `S` inicial `0,1,2,3` (versión mini 4 elementos), ejecuta un KSA simplificado. ¿Cómo cambia el primer byte de keystream si cambias un byte de clave?

<details><summary>Solución</summary>

Casi todo el keystream cambia de forma pseudoaleatoria por la permutación: es la gracia del KSA — un bit de clave afecta a todo el estado, no solo a su posición.

</details>

### Ejercicio 3 — programa C standalone

Implementa RC4 en C puro, cifra un fichero de texto, descifra y verifica `diff` vacío. Luego repite con claves distintas generadas por `/dev/urandom`.

<details><summary>Solución</summary>

Si `diff` no da vacío, tu KSA/PRGA está mal; sepáralo del bug de inyección. Cuando el C puro funciona, porta solo el descifrado a asm.

</details>

### Ejercicio 4 — espacio de claves

Con clave de 16 bytes (128 bits), ¿cuál es el espacio de claves? ¿Por qué importa aunque RC4 sea "viejo"?

<details><summary>Solución</summary>

`2^128` combinaciones. Fuerza bruta es inviable; un atacante necesitaría criptoanálisis específico, no probar claves. Menciona que la seguridad aquí no es "resistir a la NSA" sino "no ser trivial por inspección", que con 128 bits se cumple sobradamente.

</details>

## Errores frecuentes

- Quedarse en XOR fijo y llamarlo "algoritmo avanzado".
- Usar `rand()` y decir que es aleatorio.
- Generar la clave una vez y reutilizarla en cada ejecución (el subject pide nueva cada vez).
- No embeber la clave en el stub → el descifrado no tiene de dónde leerla.
- No mencionar debilidades reales de RC4 en la defensa (parece que no sabes que existen).

## Has aprendido que

- XOR fijo repetido es trivialmente rompible por frecuencia.
- RC4 = KSA (permuta `S` con clave) + PRGA (keystream `i,j`) + XOR; cifra y descifra iguales.
- La clave debe venir de `/dev/urandom` y se imprime en hex.
- 128 bits → `2^128` claves; la no-reutilización del keystream es clave.
- La debilidad de RC4 en TLS no es el punto en un blob de un solo uso, pero debes conocerla.

## Preguntas tipo defensa

1. ¿Por qué tu algoritmo no es un ROT disfrazado?
2. ¿Qué hacen KSA y PRGA y qué estado mantienen `i,j,S`?
3. ¿Por qué `/dev/urandom` y no `rand()/time`?
4. ¿Qué pasa si ejecutas dos veces `woody_woodpacker` sobre el mismo binario? ¿Deben salir claves distintas?
5. ¿Qué debilidades tiene RC4 y por qué no son críticas aquí?

## Criterio de finalización

- Programa C standalone cifra→descifra y `diff` da vacío; RC4 funciona aislado de la inyección.
- Puedes dibujar KSA/PRGA sin código y justificar por qué rompe patrones.
- Explicas espacio de claves y generación con `/dev/urandom`.

## Siguiente clase

La clase 6 convierte el algoritmo en bytes inyectables: toolchain NASM/GAS, extracción de shellcode con `objcopy` y placeholders parcheables.

## Lecturas

- Descripción conceptual de RC4 (KSA/PRGA) — cualquier referencia académica, no copies sin entender.
- `man 4 urandom`, `man 2 open/read`.
- Ejemplo del subject (`key_value: 07A51FF040D45D5CD`) y objdumps de `sample` vs `woody`.
