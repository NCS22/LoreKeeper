---
description: Crea un agente nuevo delegando en recruiter (uso - /new-agent nombre-agente Descripción de lo que debe hacer)
---

No crees nada tú: delega en @recruiter. El primer parámetro ($1) es el nombre del agente (kebab-case, será `.opencode/agents/$1.md`); el resto del texto ($ARGUMENTS sin $1) es la descripción de lo que debe hacer.

Tu trabajo:
1. Comprueba que `.opencode/agents/$1.md` no exista. Si existe, PARA y avisa.
2. Llama a @recruiter pasándole nombre, descripción y que siga su flujo (preguntas de una en una, propuesta completa y confirmación explícita antes de crear).
3. Si devuelve preguntas, házmelas de una en una y vuelve a llamarle con mis respuestas.
