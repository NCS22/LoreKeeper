---
name: sdd
description: Úsala siempre que trabajes con Spec-Driven Development en este proyecto (docs/constitution o cualquier archivo dentro de specs/) - redactar, revisar o cambiar specs, planes y tareas, o implementar y validar tareas de una spec.
---

# Spec-Driven Development

## Flujo

Constitution -> Spec -> Clarificación -> Plan -> Tareas -> Implementación -> Validación -> Cambio.

- Nunca pases a la siguiente fase sin la aprovación explícita del usuario.
- La spec manda: si algo no está en la spec, no se implementa. Si falta una decisión, para y pregunta.
- Un cambio de requisitos se hace primero en la spec, luego en el plan y las tareas y por último en el código.
- Todo informe técnico que se enseñe al usuario debe ser legible para el usuario: explicaciones extensas, detalles amplios y sin tecnicismos. No se puede cambiar el orden ni la gravedad de los hallazgos. Los informes originales se conservan para el equipo técnico.

## Plantilla de spec ([[spec.md]])
```
# Spec NNN — <Nombre>

Estado: borrador | aprobada | implementada

## Contexto y objetivo

## Usuarios

## Historias de usuario
- HU-1. Como <rol>, quiero <acción> para <beneficio>.

## Definiciones (solo si hay términos que puedan interpretarse de varias formas)

## Requisitos funcionales

## Requisitos no funcionales

## Casos límite

## Fuera de alcance

## Criterios de finalización

## Dudas abiertas

- [NECESITA ACLARACIÓN] <duda>
```

La spec describe el QUÉ y el POR QUÉ. Nada de stack, arquitectura ni nombres de archivos.

## Requisitos en EARS

- RF-x: CUANDO evento, EL SISTEMA respuesta.
- RF-x: SI condición no deseada, ENTONCES EL SISTEMA respuesta.
- RF-x: MIENTRAS estado, EL SISTEMA respuesta
- RF-x: EL SISTEMA comportamiento permanente.

Cada RF debe ser verificable: nada de "rápido", "intenso" o "bonito" sin un criterio medible. 

## Requisitos en EARS (en español)
- RF-x: CUANDO <evento>, EL SISTEMA <respuesta>.
- RF-x: SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.
- RF-x: MIENTRAS <estado>, EL SISTEMA <respuesta>.
- RF-x: EL SISTEMA <comportamiento permanente>.

Cada RF debe ser verificable: nada de "rápido", "intenso" o "bonito" sin un criterio
medible.

## Plan ([[planner.md]])

> En esta parte tenemos que detallar cómo queremos que se construya y constituya el archivo [planner.md], además de cómo debe entender el sistema los diferentes archivos y cómo debe tratarlos para la planificación.

## Tareas ([[tasks.md]])

```
- [] **Tn. <Descripción>.** RF-x, RF-y
  - Hecho cuando: <comprobación verificable>
```

Máximo 20-30 minutos por tarea, en orden de dependencia. Si salen más de 10 propón dividir la spec. 

## Implementación

> Una sola tarea cada vez: código mínimo que cumpla la tarea. Ante dudas de API consultar context7, `npm run build` y `npm run lint` en verde, marcar la tarea y parar.