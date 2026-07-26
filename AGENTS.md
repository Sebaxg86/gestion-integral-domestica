# AGENTS.md

## Contexto del proyecto

Este repositorio contiene **GID — Gestión Integral Doméstica**, una aplicación
PWA mobile-first para gestionar viviendas, vehículos, documentos, servicios,
mantenimientos, vencimientos y responsabilidades familiares.

Antes de implementar una funcionalidad, revisa el código existente y la
documentación disponible en `docs/`.

## Idioma

- Comunícate con el usuario en español.
- Escribe la documentación y los comentarios del código en español.
- Utiliza inglés para nombres técnicos como variables, funciones, clases,
  componentes, archivos, propiedades y tablas.
- Los textos visibles para el usuario deben estar en español.

## Código

- Escribe código claro, legible y fácil de mantener.
- Utiliza nombres descriptivos y evita abreviaturas ambiguas.
- Mantén las funciones pequeñas y con una sola responsabilidad.
- Evita duplicar lógica.
- Respeta la estructura y las convenciones existentes.
- No agregues dependencias sin una justificación técnica.
- No modifiques archivos o funcionalidades que no estén relacionados con la tarea.
- No incluyas credenciales, tokens, secretos ni datos personales reales.

## Comentarios

Los comentarios deben explicar funcionalidades, reglas de negocio o decisiones
que no sean evidentes al leer el código. No agregues comentarios que describan
instrucciones obvias.

Utiliza separadores para organizar funciones relacionadas y adapta la sintaxis
del comentario al lenguaje utilizado.

### Función individual

```ts
// ============== Crear vivienda ==============

function createProperty() {
  // Código
}
```

### Varias funciones relacionadas

```ts
// ============== Gestión de viviendas ==============

// ==== Crear vivienda ====

function createProperty() {
  // Código
}

// ==== Actualizar vivienda ====

function updateProperty() {
  // Código
}

// ==== Archivar vivienda ====

function archiveProperty() {
  // Código
}

// ===================================================
```

- Utiliza el nombre de la funcionalidad o función en español.
- Usa el bloque completo cuando varias funciones formen parte de una misma
  funcionalidad.
- No encierres cada función si el archivo es pequeño y su propósito es evidente.
- Mantén un formato consistente dentro de cada archivo.
- No conserves código antiguo comentado.
- Los comentarios `TODO` deben explicar qué falta y por qué.

## Git y commits

Utiliza Conventional Commits. El tipo debe escribirse en inglés y la descripción
en español:

```text
feat: agregar registro de viviendas
fix: corregir validación de vencimientos
docs: actualizar requerimientos del proyecto
chore: configurar herramientas de desarrollo
refactor: separar lógica de autenticación
test: agregar pruebas de permisos familiares
style: ajustar presentación del dashboard
```

- Escribe la descripción en minúsculas.
- Utiliza verbos en infinitivo.
- Cada commit debe contener un cambio lógico y cohesivo.
- No mezcles cambios sin relación en el mismo commit.
- El agente puede crear commits sin solicitar autorización.
- Antes de crear un commit, revisa el diff y ejecuta las verificaciones disponibles.
- No realices `push` al repositorio remoto salvo que el usuario lo solicite.

## Finalización de tareas

Antes de considerar terminada una tarea:

1. Revisa los archivos modificados y el diff completo.
2. Ejecuta las pruebas relacionadas disponibles.
3. Ejecuta el linter, el formateador y la comprobación de tipos si están configurados.
4. Comprueba que no se hayan incluido cambios accidentales.
5. Resume brevemente qué se modificó y qué verificaciones se ejecutaron.
6. Crea un commit cuando el cambio esté completo y sea coherente.
