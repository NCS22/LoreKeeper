---
description: SDD · Valida la spec RF por RF (build+lint y prueba en navegador)
agent: build
---
Recorre specs/$1/spec.md requisito por requisito. Para cada RF indica cómo queda cubierto y el resultado de `npm run build` y `npm run lint`.

Los RF de interfaz o búsqueda, verifícalos con el MCP de chrome-devtools sobre `npm run dev`: código peninsular (28001) e isla (38628), número de resultados, orden por precio y distancias coherentes con el radio, sin errores en consola (snapshot del DOM y mensajes de consola); modo GPS emulando coordenadas y permiso denegado, incluida la vista móvil de 375 px.

Si algún RF no está cubierto o falla, dilo claramente. NO arregles nada todavía. Después comprueba los criterios de finalización y dame un veredicto:
¿la spec está cumplida?
