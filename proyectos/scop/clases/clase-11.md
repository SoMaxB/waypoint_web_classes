# Clase 11: bonus, modos de depuracion visual

## Objetivo

Añadir herramientas visuales para defender y depurar el renderer: wireframe con `G` y visualizacion de normales con `N`, que se desactiva con `B`.

## 1. Wireframe

El modo wireframe usa el estado OpenGL:

```c
```

No cambia los buffers ni el parser; cambia como rasteriza OpenGL los triangulos. `G` usa deteccion de flanco para alternar una sola vez por pulsacion.

## 2. Normales en pantalla

El vertex shader pasa la posicion local. El fragment shader obtiene una normal plana mediante derivadas:

```glsl
vec3 normal = normalize(cross(dFdx(v_position), dFdy(v_position)));
vec3 debug_color = normal * 0.5 + 0.5;
```

El modo `N` muestra esa normal como RGB. `B` vuelve al color o textura normal.

## Predicciones y ejercicios

1. Que informacion muestra una cara azul en el modo normal?
2. Por que wireframe no necesita duplicar vertices?
3. Activa `G`, `N` y `B` durante la ejecucion.

<details><summary>Solucion</summary>

El color codifica la direccion de la normal. Wireframe solo cambia el estado de rasterizacion. `G` muestra aristas, `N` muestra normales y `B` restaura el material.

</details>

## Errores frecuentes

- Dejar `GL_LINE` activo al terminar la demo.
- Confundir normales con colores por triangulo.
- No detectar el flanco de `G`.
- Usar derivadas de una posicion que no sea coherente en toda la primitive.

## Has aprendido que

- `glPolygonMode` permite inspeccionar la triangulacion.
- Las derivadas del fragment shader permiten visualizar normales planas.
- Un modo de depuracion puede reutilizar el mismo mesh y draw call.

## Preguntas tipo defensa

1. Que cambia `glPolygonMode`?
2. Por que `dFdx` y `dFdy` permiten calcular una normal?
3. Que diferencia hay entre normal y color?
4. Por que los modos de depuracion no requieren otro VBO?

## Criterio de finalizacion

- `G` alterna wireframe sin reiniciar el programa.
- `N` muestra normales y `B` restaura el render.
- La textura y la transicion siguen funcionando fuera del modo debug.

## Siguiente clase

Auditar el coste de los bonus, limpiar estados OpenGL y decidir si se conserva esta implementacion para la defensa.

## Lista de lecturas

- OpenGL `glPolygonMode`.
- GLSL fragment derivatives.
- `src/gl_loader.*` y `src/main.c`.
