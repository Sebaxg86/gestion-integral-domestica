# AGENTS.md

## Contexto del proyecto

Este repositorio contiene **GID — Gestión Integral Doméstica**, una aplicación
PWA mobile-first para gestionar viviendas, vehículos, documentos, servicios,
mantenimientos, vencimientos y responsabilidades familiares.

El código también cumple una función de aprendizaje. Prioriza una estructura
clara, visual y didáctica sin sacrificar calidad técnica.

Antes de implementar o modificar una funcionalidad:

1. Revisa el código relacionado y la documentación disponible en `docs/`.
2. Identifica las convenciones, componentes, servicios y patrones existentes.
3. Reutiliza soluciones existentes cuando sean adecuadas.
4. Comprueba dónde se utiliza una implementación antes de modificarla,
   reemplazarla o eliminarla.
5. Evita crear estructuras paralelas o duplicar lógica sin justificación.

## Idioma

- Comunícate con el usuario en español.
- Escribe la documentación, los comentarios y los textos visibles en español.
- Utiliza inglés para nombres técnicos: variables, funciones, clases,
  componentes, hooks, servicios, archivos, propiedades, endpoints y tablas.
- Conserva en inglés los nombres propios de librerías, frameworks, APIs y
  conceptos técnicos cuando traducirlos pueda causar confusión.

## Principios de código

- Escribe código claro, legible, mantenible y fácil de estudiar.
- Prioriza la comprensión sobre la reducción innecesaria de líneas.
- Utiliza nombres descriptivos y evita abreviaturas ambiguas.
- Mantén las funciones pequeñas y con una sola responsabilidad.
- Extrae funciones auxiliares cuando un bloque tenga una responsabilidad propia.
- Evita duplicar lógica y niveles innecesarios de anidación.
- Utiliza retornos tempranos cuando simplifiquen el flujo.
- Respeta la arquitectura, estructura y convenciones existentes.
- No agregues dependencias sin una justificación técnica.
- Modifica únicamente los archivos relacionados con la tarea.
- No cambies contratos públicos, esquemas, endpoints o estructuras de datos sin
  revisar sus consumidores.
- No incluyas credenciales, tokens, secretos ni datos personales reales.
- No dejes código provisional, simulaciones, valores temporales o errores
  ignorados sin explicarlo.
- Elimina imports, variables, funciones y archivos que queden sin uso por el
  cambio realizado.

## Legibilidad y organización visual

Todo archivo de código mantenido manualmente debe estar organizado mediante
saltos de línea y comentarios jerárquicos.

El código no debe quedar amontonado. Cada función, componente, plantilla,
consulta, prueba o archivo debe poder recorrerse visualmente antes de analizar
cada instrucción.

Separa cuando corresponda:

- Declaración o extracción de datos.
- Normalización y validación.
- Consultas y permisos.
- Reglas de negocio y transformaciones.
- Preparación y persistencia de cambios.
- Efectos secundarios.
- Construcción y retorno de resultados.
- Manejo de errores.
- Secciones visuales, estados, variantes o casos de prueba.

Deja una línea en blanco entre etapas lógicas.

Evita:

- Condicionales importantes en una sola línea.
- Objetos complejos o varias operaciones en una sola línea.
- Ternarios anidados.
- Cadenas extensas de métodos difíciles de leer.
- Funciones con varias responsabilidades.
- JSX, HTML, estilos, SQL o pruebas escritos como bloques continuos.
- Comentarios que ya no coincidan con el comportamiento real.

El formateador automático define el mínimo aceptable, pero no sustituye la
organización lógica y didáctica.

## Convención obligatoria de comentarios

Los comentarios deben permitir entender el flujo general y las decisiones
importantes. No es suficiente colocar solo el nombre de la función encima.

Agrega comentarios internos aunque una etapa pueda parecer evidente para un
desarrollador experimentado, cuando ayuden a un estudiante a comprender el
orden de ejecución.

Los comentarios deben:

- Estar en español y usar palabras sencillas.
- Explicar la etapa, intención, regla de negocio, validación, transformación,
  efecto secundario o caso límite.
- Describir el propósito del bloque y, cuando sea relevante, su motivo.
- Utilizar la sintaxis válida del lenguaje.
- Mantener un formato consistente dentro del archivo.

No comentes cada línea ni repitas literalmente la sintaxis.

### Jerarquía

#### Nivel 1: sección principal del archivo

Úsalo para agrupar responsabilidades relacionadas en archivos extensos.

```ts
// ============================================================================
// Gestión de viviendas
// ============================================================================
```

- Solo se utiliza a nivel de archivo.
- No encierres cada función individual.
- No agregues secciones meramente decorativas.

#### Nivel 2: etapa principal

Úsalo dentro de funciones, componentes, plantillas, pruebas o bloques de código.

```ts
// ===== Validación de datos =====

// ===== Consulta de información =====

// ===== Aplicación de reglas de negocio =====

// ===== Persistencia de cambios =====

// ===== Retorno del resultado =====
```

- Deja una línea en blanco antes y después.
- El título debe corresponder con el contenido real.
- La función debe poder comprenderse leyendo primero estos encabezados.

#### Nivel 3: explicación específica

Úsalo para acciones, decisiones o validaciones concretas dentro de una etapa.

```ts
// ------- Evitar operaciones sobre una vivienda inexistente -------

// ------- Conservar el historial en lugar de eliminar el registro -------
```

- Explica el propósito, no la sintaxis literal.
- No es obligatorio en cada asignación o llamada sencilla.

### Ejemplo general

```ts
async function updateProperty(
  propertyId: string,
  input: UpdatePropertyInput,
): Promise<Property> {
  // ===== Normalización de datos =====

  const normalizedName = input.name.trim();
  const normalizedAddress = input.address?.trim() || null;

  // ===== Validación de datos =====

  // ------- Evitar guardar una vivienda sin un nombre útil -------

  if (!normalizedName) {
    throw new ValidationError(
      "El nombre de la vivienda es obligatorio",
    );
  }

  // ===== Consulta de información =====

  const property = await propertyRepository.findById(propertyId);

  // ------- Evitar operaciones sobre una vivienda inexistente -------

  if (!property) {
    throw new NotFoundError("La vivienda no existe");
  }

  // ===== Preparación y persistencia de cambios =====

  const updatedProperty = {
    ...property,
    name: normalizedName,
    address: normalizedAddress,
    updatedAt: new Date(),
  };

  await propertyRepository.save(updatedProperty);

  // ===== Retorno del resultado =====

  return updatedProperty;
}
```

Evita comentarios literales como:

```ts
// ------- Crear una constante llamada name -------

const name = input.name;
```

Prefiere describir el propósito del bloque:

```ts
// ===== Preparación de los datos de la vivienda =====

const name = input.name.trim();
```

## Cobertura por tipo de archivo

Estas reglas se aplican a todo código mantenido manualmente, incluyendo:

- `.ts`, `.js`, `.tsx`, `.jsx`.
- HTML y otros archivos de plantillas.
- CSS, SCSS, Sass y Less.
- Servicios, controladores, repositorios, hooks, rutas y middleware.
- Scripts, SQL y migraciones.
- Pruebas unitarias, de integración y end-to-end.
- Configuraciones que admitan comentarios.
- Código de frontend, backend y herramientas internas.

### React, TSX y JSX

En la parte lógica utiliza comentarios normales. Dentro del JSX usa:

```tsx
{/* ===== Información principal ===== */}
```

No utilices `//` directamente entre etiquetas JSX.

Separa cuando corresponda:

- Tipos e interfaces.
- Constantes y props.
- Estado, hooks y datos calculados.
- Efectos y manejadores.
- Estados de carga, error o contenido vacío.
- Encabezados, formularios, listados, modales y acciones.
- Renderizado principal.

Ejemplo:

```tsx
function PropertyCard({ property }: PropertyCardProps) {
  // ===== Estado del componente =====

  const [isExpanded, setIsExpanded] = useState(false);

  // ===== Manejadores de eventos =====

  const handleToggle = () => {
    setIsExpanded((currentValue) => !currentValue);
  };

  // ===== Renderizado del componente =====

  return (
    <article>
      {/* ===== Información principal ===== */}

      <header>
        <h2>{property.name}</h2>
      </header>

      {/* ===== Acciones disponibles ===== */}

      <button type="button" onClick={handleToggle}>
        {isExpanded ? "Ocultar detalles" : "Mostrar detalles"}
      </button>
    </article>
  );
}
```

### HTML

```html
<!-- ===== Contenido principal ===== -->

<main>
  <section>
    <h2>Viviendas registradas</h2>
  </section>
</main>
```

Para detalles específicos:

```html
<!-- ------- Mostrar el mensaje cuando no existan viviendas ------- -->
```

### CSS y otros estilos

```css
/* ==========================================================================
   Tarjeta de vivienda
   ========================================================================== */

/* ===== Contenedor principal ===== */

.property-card {
  display: flex;
  flex-direction: column;
}

/* ------- Destacar viviendas archivadas ------- */

.property-card--archived {
  opacity: 0.65;
}
```

Agrupa y separa estructura, tipografía, estados, variantes, animaciones,
comportamiento responsive y temas.

### SQL

```sql
-- ===== Consulta de viviendas activas =====

SELECT
  id,
  name
FROM properties
WHERE status = 'active';
```

### Pruebas

Separa preparación, mocks, ejecución, verificación y limpieza.

```ts
it("archiva una vivienda administrada por el usuario", async () => {
  // ===== Preparación =====

  const property = createPropertyFixture();
  permissionService.canManageProperty.mockResolvedValue(true);

  // ===== Ejecución =====

  await archiveProperty(property.id, userId);

  // ===== Verificación =====

  expect(propertyRepository.save).toHaveBeenCalled();
});
```

## Documentación superior

Documenta funciones, componentes, clases, hooks y servicios importantes cuando
su responsabilidad, parámetros, resultado o efectos secundarios no sean
evidentes.

```ts
/**
 * Actualiza la información editable de una vivienda.
 *
 * @param propertyId Identificador de la vivienda.
 * @param input Datos enviados para la actualización.
 * @returns La vivienda actualizada.
 * @throws NotFoundError Si la vivienda no existe.
 */
```

La documentación superior explica la responsabilidad general; los comentarios
internos explican las etapas de ejecución. Ninguno sustituye al otro cuando ambos
aportan claridad.

No agregues documentación extensa a funciones triviales.

## Complejidad y reglas de negocio

- Si una función contiene demasiadas etapas o comentarios, divídela en funciones
  auxiliares con nombres descriptivos.
- No utilices comentarios para ocultar código innecesariamente complejo.
- Las reglas de negocio deben ser fáciles de identificar.
- Explica el motivo de las condiciones propias del dominio.
- Extrae las reglas reutilizadas a funciones, servicios o módulos compartidos.

```ts
// ===== Validación de administradores =====

// ------- Evitar que la vivienda quede sin una persona responsable -------

if (remainingAdministrators === 0) {
  throw new ValidationError(
    "La vivienda debe conservar al menos un administrador",
  );
}
```

## Manejo de errores

- No ignores errores silenciosamente ni utilices bloques `catch` vacíos.
- Captura errores solo para recuperarte, transformarlos o agregar contexto útil.
- Los mensajes visibles deben ser claros y estar en español.
- No expongas información sensible.
- No utilices valores por defecto que oculten errores importantes.
- Comenta las estrategias de recuperación que no sean evidentes.

## Código comentado y TODO

- No conserves código antiguo o deshabilitado mediante comentarios.
- Utiliza el historial de Git para consultar implementaciones anteriores.
- Los `TODO` deben explicar qué falta, por qué y, cuando sea posible, qué
  condición permitirá resolverlo.

```ts
// TODO: Reemplazar la validación local cuando el backend exponga los permisos por vivienda.
```

Evita comentarios vagos como `TODO: arreglar después`.

## Excepciones

No agregues comentarios cuando el formato no los admita o puedan invalidarlo.

En JSON estándar:

- Utiliza nombres descriptivos y una estructura ordenada.
- Documenta decisiones en `docs/` o en un archivo relacionado.
- No introduzcas sintaxis no estándar solo para comentar.

No agregues comentarios manuales a:

- Archivos generados o minificados.
- Dependencias y código de terceros.
- Directorios de compilación.
- Archivos de bloqueo.
- Artefactos producidos por herramientas.

## Alcance de los cambios

- Modifica únicamente lo necesario para completar la tarea.
- No realices refactorizaciones generales no solicitadas.
- Se permite una refactorización localizada si mejora claridad, seguridad o
  mantenibilidad.
- Conserva el comportamiento no relacionado con la tarea.
- No mezcles mejoras ajenas al cambio.
- No cambies estilos globales, configuraciones o dependencias sin necesidad.

## Git y commits

Utiliza Conventional Commits. El tipo se escribe en inglés y la descripción en
español, en minúsculas y con verbo en infinitivo.

```text
feat: agregar registro de viviendas
fix: corregir validación de vencimientos
docs: actualizar requerimientos del proyecto
chore: configurar herramientas de desarrollo
refactor: separar lógica de autenticación
test: agregar pruebas de permisos familiares
style: ajustar presentación del dashboard
```

- Cada commit debe contener un cambio lógico y cohesivo.
- El agente puede crear commits sin solicitar autorización.
- Antes del commit, revisa el diff y ejecuta las verificaciones disponibles.
- No hagas `push` salvo que el usuario lo solicite.
- No reescribas el historial ni uses `--no-verify` sin autorización.
- No incluyas archivos generados, temporales o sensibles por accidente.

## Finalización de tareas

Antes de considerar terminada una tarea:

1. Revisa todos los archivos modificados y el diff completo.
2. Comprueba que no existan cambios accidentales.
3. Revisa todo archivo de código creado o modificado, incluidos TSX, JSX, HTML,
   estilos, pruebas, scripts, SQL y configuraciones compatibles.
4. Verifica que el código tenga saltos de línea y comentarios jerárquicos con la
   sintaxis correcta del lenguaje.
5. Comprueba que funciones, componentes y secciones puedan entenderse leyendo
   primero sus encabezados.
6. Asegúrate de que los comentarios estén en español, sean claros, sigan
   vigentes y expliquen intención o estructura.
7. Divide las funciones con demasiadas responsabilidades.
8. Ejecuta las pruebas relacionadas, el linter, el formateador y la comprobación
   de tipos cuando estén configurados.
9. Corrige los errores relacionados con el cambio.
10. Resume qué se modificó y qué verificaciones se ejecutaron.
11. Crea un commit cuando el cambio esté completo y sea coherente.

## Formato de la respuesta final

Informa brevemente:

- Qué se modificó.
- Qué decisiones relevantes se tomaron.
- Qué archivos principales cambiaron.
- Qué pruebas o verificaciones se ejecutaron.
- Qué verificaciones no pudieron ejecutarse y por qué.
- Qué commit se creó, cuando corresponda.

No declares una tarea completamente verificada si no se ejecutaron las pruebas
correspondientes.