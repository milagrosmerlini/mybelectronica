MyB Electrónica — Gestión de Reparaciones (cliente web)

Resumen rápido
- Esta versión usa Supabase para almacenar órdenes y fotos en la nube.
- Archivos clave: `index.html`, `styles.css`, `app.js`.

Requisitos (Supabase)
1. Crear un proyecto en supabase.com.
2. En la sección "Storage" crear un bucket público llamado `ordenes`.
3. Crear una tabla SQL llamada `orders` con al menos estas columnas:
   - `id` (text) PRIMARY KEY
   - `idOrden` (text)
   - `nombre` (text)
   - `apellido` (text)
   - `telefono` (text)
   - `marca` (text)
   - `modelo` (text)
   - `serie` (text)
   - `falla` (text)
   - `estado` (text)
   - `detalle_presupuesto` (text)
   - `precio_presupuesto` (text)
   - `fue_reparado` (boolean)
   - `fotos` (text[])
   - `created_at` (timestamptz default now())

Configuración local
- Abrir `index.html` en el navegador.
- Hacer click en "⚙️ Configurar Supabase" y pegar `SUPABASE_URL` y `SUPABASE_ANON_KEY` (la clave anon/public).

Notas de seguridad
- La clave `anon` permite acceso público según políticas de tu proyecto. Para producción considera funciones server-side y reglas RLS más estrictas.
- Asegurate que el bucket `ordenes` tenga la visibilidad que necesitas (público o privado con URLs firmadas).

Siguientes pasos recomendados
- Habilitar Row Level Security (RLS) y políticas basadas en roles si vas a exponer la app.
- Añadir autenticación (email/phone) para registros de técnicos.
- Migrar fotos a bucket privado y usar `createSignedUrl` para descargas seguras.
- Opcional: empaquetar con Electron para versión de escritorio.

Si querés, puedo:
- Crear la tabla SQL exacta y un script para crearla.
- Añadir validaciones y manejo de errores más robusto.
- Implementar login/roles y políticas RLS.

