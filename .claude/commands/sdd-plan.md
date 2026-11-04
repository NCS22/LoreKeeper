---
description: SDD · Genera el plan técnico de una spec aprobada
agent: plan
---
Lee docs/constitution.md, AGENTS.md, MEMORY.md y specs/$1/spec.md. Usa la skill sdd.
NO escribas código.

Genera specs/$1/plan.md con: archivos que se crean o modifican y la responsabilidad de cada uno (respetando pages/ → hooks/ → services/ → utils/ + config/, red solo en services/, CSS solo en estilos/), cálculos o funciones afectados, algoritmo en pseudocódigo, cómo se pinta en la interfaz (móvil primero), decisiones técnicas justificadas (con su alternativa descartada) y estrategia de verificación con `npm run build` y `npm run lint` más prueba en navegador (`npm run dev` con 28001 peninsular y 38628 isla; GPS con DevTools → Sensors).

Todo debe respetar la constitución y cubrir todos los RF. Marca qué RF cubre cada parte. Si el plan usa una librería o API nueva, contrasta la sintaxis con context7. Si la spec no está aprobada o tiene dudas abiertas, para y avísame.
