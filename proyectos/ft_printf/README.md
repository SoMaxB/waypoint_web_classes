*Este proyecto ha sido creado como parte del curriculo de 42 por <login>.*

## Descripcion
`ft_printf` reimplementa una parte de `printf(3)` como libreria estatica de C.
Incluye las conversiones obligatorias `cspdiuxX%` y soporte bonus para ancho,
precision y flags `-0# +`.

## Instrucciones
Compilar la libreria obligatoria:

```sh
make
```

Compilar con target bonus:

```sh
make bonus
```

La salida es `libftprintf.a` en la raiz del repositorio.

## Recursos
- `man 3 printf`
- `man 3 stdarg`
- Subject `en.subject.pdf`

Uso de IA: pruebas de comparacion rapidas contra `printf`.

## Estructura
La implementacion separa parseo, dispatch, salida y formateo por familias de
conversion. Los numeros se imprimen sin reservar memoria, construyendo los
digitos en un buffer local invertido y escribiendo prefijo, padding y precision
en el mismo orden que `printf`.
