# Clase 10: bonus, textura triplanar

## Objetivo

Reducir el stretching de la textura sin depender de coordenadas `vt` del OBJ. El shader proyecta la imagen sobre los planos XY, XZ e YZ y mezcla las muestras segun la normal de la cara.

## 1. Tres proyecciones

Una sola proyeccion XY estira las caras verticales. Triplanar mapping calcula tres muestras:

```glsl
xy = texture(tex, position.xy * scale);
xz = texture(tex, position.xz * scale);
yz = texture(tex, position.yz * scale);
```

Los pesos son la normal absoluta elevada a una potencia para que domine el plano mas alineado:

```glsl
weights = pow(abs(normal), vec3(4.0));
weights /= weights.x + weights.y + weights.z;
color = xy * weights.z + xz * weights.y + yz * weights.x;
```

La normal se obtiene en el fragment shader con derivadas de la posicion de la cara. Asi no se necesitan UV ni una libreria externa.

## 2. Comparacion

| Tecnica | Ventaja | Problema |
|---|---|---|
| UV planar | Minima | Stretching en caras verticales |
| UV del OBJ | Control artistico | Requiere leer `vt` y duplicar esquinas |
| Triplanar | Funciona sin UV y reduce estiramiento | Usa tres muestras por fragmento |

## Predicciones y ejercicios

1. Que proyeccion domina en una cara cuya normal apunta a +Z?
2. Por que se normalizan los pesos?
3. Pulsa `T` en el cubo y en la tetera y compara la textura.

<details><summary>Solucion</summary>

Para +Z domina XY, por eso su peso es `weights.z`. La normalizacion hace que la suma de pesos sea 1 y evita cambiar el brillo global.

</details>

## Errores frecuentes

- Usar la normal sin normalizar.
- Mezclar pesos de X/Y/Z con planos equivocados.
- Confundir posicion local con posicion clip.
- Cambiar el factor de textura y romper la transicion de la clase 6.

## Has aprendido que

- Triplanar mapping evita depender de `vt`.
- La normal decide que proyeccion domina.
- El coste es mayor porque cada fragmento toma tres muestras.

## Preguntas tipo defensa

1. Por que una sola UV planar produce stretching?
2. Que representan `xy`, `xz` e `yz`?
3. Como se calculan los pesos?
4. Que trade-off introduce triplanar mapping?

## Criterio de finalizacion

- La textura sigue funcionando con `T`.
- El cubo y la tetera muestran menos estiramiento visible.
- Puedes explicar la formula de pesos y el coste de tres muestras.

## Siguiente clase

Se añadiran modos wireframe y normales para inspeccionar la geometria durante la defensa.

## Lista de lecturas

- Triplanar projection mapping.
- GLSL `dFdx`, `dFdy`, `normalize`, `pow` y `texture`.
- `src/main.c` y el fragment shader.
