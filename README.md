# mybelectronica

Esta versión funciona totalmente en local usando IndexedDB.
- Ordenes, fotos y datos se guardan en el navegador.
- No es necesario estar conectado a Supabase ni a internet para usar la app.
- La integración con Supabase queda como posible mejora futura.

## Cómo usar
1. Abrir `index.html` mediante un servidor local (recomendado) o con Live Server en VS Code.
2. Completar la orden y crear clientes.
3. Exportar/importar JSON si querés respaldos manuales.

## Futuro
Para integrar Supabase más adelante, podés:
- crear un adapter remoto en lugar de `datastore.js`
- usar supabase storage para fotos y Firestore para órdenes
- mantener la misma UI y cambiar sólo la capa de datos

