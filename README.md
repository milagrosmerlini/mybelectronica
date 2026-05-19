# MyB Electronica

La app ahora soporta 2 modos de datos:

- `Cloud (Supabase)`: si hay credenciales, guarda `reparaciones`, `fotos` y `caja` en Supabase.
- `Local (IndexedDB)`: si no hay credenciales, sigue funcionando 100% local como antes.

## 1) Crear tablas en Supabase

1. Abri tu proyecto de Supabase.
2. En SQL Editor, ejecuta el archivo `supabase-schema.sql`.

## 2) Configurar credenciales en la app

1. Edita `supabase-config.js`.
2. Completa:

- `url`: `https://TU-PROYECTO.supabase.co`
- `anonKey`: tu `anon public` key

Si no queres usar Supabase temporalmente, deja esos valores vacios y la app cae automaticamente a local.

## 3) Cargar datos actuales a la nube

Con Supabase ya configurado:

1. En la app actual, usa `Exportar JSON`.
2. Luego usa `Importar JSON` con ese mismo archivo.
3. Eso sube las ordenes/fotos al backend cloud.

## Notas

- `supabase-config.example.js` es plantilla de referencia.
- `supabase-config.js` se carga antes de `app.js`.
- El service worker fue actualizado para cachear los archivos nuevos.
