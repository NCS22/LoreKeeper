---
description: SDD · Implementa UNA tarea, verifica con build+lint (uso - /sdd-implement 002-nombre T3)
agent: build
---
Implementa SOLO la tarea indicada en $ARGUMENTS (formato: 002-nombre Tn). Lee specs/002-nombre/tasks.md, specs/002-nombre/plan.md, docs/constitution.md, AGENTS.md y usa la skill sdd (sustituye 002-nombre por la carpeta indicada).

1. Escribe el código mínimo que cumpla la tarea, respetando las capas, `import type`, valores mágicos en `config/` y las trampas de dominio (parseCoordenada / parsePrecio, nunca Number() directo ni places[0]).
2. Ejecuta `npm run build` y `npm run lint`, y muéstrame el resultado.
3. Marca esa tarea como hecha en tasks.md e indica qué RF cubre.

Después PÁRATE. No empieces la siguiente tarea.
