# Clase 9: bonus, triangulacion robusta

## Objetivo

Entender y defender el primer bonus de Scop: sustituir el abanico por ear clipping para caras concavas y usar una proyeccion dominante para trabajar con pequenas desviaciones no coplanares.

## 1. Por que falla el abanico

El abanico siempre conecta el primer vertice con todos los demas. En una cara concava puede crear triangulos que salen fuera del poligono. La estrategia implementada mantiene una lista de vertices y elimina sucesivamente una oreja: un triangulo convexo que no contiene otros vertices.

## 2. Proyeccion dominante

`dominant_projection()` calcula una normal de Newell y elimina el eje con mayor componente absoluta. La cara 3D se convierte temporalmente en un poligono 2D, donde se calcula el winding, se detectan orejas y se comprueba si otro vertice esta dentro del triangulo candidato.

La triangulacion no pretende resolver poligonos autointersectados o degenerados: esos casos devuelven error explicito.

## Predicciones y ejercicios

1. Por que una cara concava puede romper el abanico?
2. Que representa el eje dominante de la normal?
3. Ejecuta `timeout 1s ./scop tests/concave.obj` y las dos teteras.

<details><summary>Solucion</summary>

El abanico puede crear triangulos fuera de la cara. La proyeccion dominante minimiza la perdida de area visible. Los modelos arrancan y el fixture concavo se triangula sin error.

</details>

## Errores frecuentes

- Confundir no coplanar con autointersectado.
- Aceptar una cara de area proyectada casi cero.
- Ignorar el winding al decidir si un vertice es convexo.
- Declarar que ear clipping arregla cualquier geometria degenerada.

## Has aprendido que

- Ear clipping trabaja eliminando orejas validas.
- La orientacion del poligono importa.
- Newell permite escoger una proyeccion razonable.
- El bonus debe tener fixtures concavos y modelos reales.

## Preguntas tipo defensa

1. Que es una oreja?
2. Por que se proyecta la cara?
3. Que complejidad tiene el algoritmo?
4. Que casos siguen fuera de soporte?

## Criterio de finalizacion

- `tests/concave.obj`, `teapot.obj` y `teapot2.obj` arrancan.
- Puedes explicar winding, normal de Newell y ear clipping.
- Las caras degeneradas producen error, no indices corruptos.

## Siguiente clase

Se sustituira la UV planar por triplanar mapping para reducir el stretching de la textura.

## Lista de lecturas

- Normal de Newell para poligonos 3D.
- Ear clipping y triangulacion de poligonos simples.
- `src/obj_parser.c`.
