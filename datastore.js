const DB_NAME = 'myb_electronica_db';
const DB_VERSION = 2;
const STORE_ORDERS = 'orders';
const STORE_PHOTOS = 'photos';
const STORE_META = 'meta';
const FINANCE_KEY = 'finance_state';

const SUPABASE_DEFAULT_ORDERS_TABLE = 'myb_orders';
const SUPABASE_DEFAULT_PHOTOS_TABLE = 'myb_photos';
const SUPABASE_DEFAULT_META_TABLE = 'myb_meta';
let warnedInvalidSupabaseConfig = false;

function getSafeLocalStorageValue(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch (_err) {
    return '';
  }
}

function cleanUrl(raw) {
  return String(raw || '').trim().replace(/\/+$/, '');
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function getCloudConfig() {
  const runtime = (typeof globalThis !== 'undefined' && globalThis.MYB_SUPABASE_CONFIG)
    ? globalThis.MYB_SUPABASE_CONFIG
    : {};

  const url = cleanUrl(
    runtime.url ||
    globalThis.MYB_SUPABASE_URL ||
    getSafeLocalStorageValue('MYB_SUPABASE_URL')
  );

  const anonKey = String(
    runtime.anonKey ||
    globalThis.MYB_SUPABASE_ANON_KEY ||
    getSafeLocalStorageValue('MYB_SUPABASE_ANON_KEY')
  ).trim();

  const ordersTable = String(runtime.ordersTable || SUPABASE_DEFAULT_ORDERS_TABLE).trim();
  const photosTable = String(runtime.photosTable || SUPABASE_DEFAULT_PHOTOS_TABLE).trim();
  const metaTable = String(runtime.metaTable || SUPABASE_DEFAULT_META_TABLE).trim();
  const urlValida = isValidHttpUrl(url);
  const enabled = Boolean(urlValida && anonKey);

  if (!enabled && !warnedInvalidSupabaseConfig && (url || anonKey)) {
    warnedInvalidSupabaseConfig = true;
    console.warn('Supabase desactivado: configuracion invalida. Se usara almacenamiento local (IndexedDB).');
  }

  return {
    enabled,
    url,
    anonKey,
    ordersTable,
    photosTable,
    metaTable
  };
}

function normalizarNumero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function normalizarHistorial(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      id: it && it.id ? String(it.id) : `mov_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      fecha: it && it.fecha ? String(it.fecha) : new Date().toISOString(),
      descripcion: it && it.descripcion ? String(it.descripcion) : '',
      importe: normalizarNumero(it && it.importe),
      origen: it && it.origen ? String(it.origen) : 'manual',
      ordenId: it && it.ordenId ? String(it.ordenId) : null
    }))
    .filter((it) => it.importe > 0);
}

function normalizarFinanceState(raw) {
  const negocio = normalizarHistorial(raw && raw.historialNegocio);
  const reparaciones = normalizarHistorial(raw && raw.historialReparaciones);
  const totalNegocio = normalizarNumero(raw && raw.cajaNegocioTotal);
  const totalReparaciones = normalizarNumero(raw && raw.cajaReparacionesTotal);

  return {
    cajaNegocioTotal: totalNegocio || negocio.reduce((acc, it) => acc + it.importe, 0),
    cajaReparacionesTotal: totalReparaciones || reparaciones.reduce((acc, it) => acc + it.importe, 0),
    historialNegocio: negocio,
    historialReparaciones: reparaciones
  };
}

async function blobToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function normalizarEntradasFotos(orderId, photoEntries, suffix = 'p') {
  const out = [];
  if (!Array.isArray(photoEntries) || !photoEntries.length) return out;

  for (let i = 0; i < photoEntries.length; i += 1) {
    const entry = photoEntries[i];
    let dataUrl = '';
    let name = `foto_${i + 1}`;

    if (typeof entry === 'string') {
      dataUrl = entry;
    } else if (entry && typeof entry.dataUrl === 'string') {
      dataUrl = entry.dataUrl;
      if (entry.name) name = String(entry.name);
    } else if (entry instanceof Blob) {
      if (entry.name) name = String(entry.name);
      dataUrl = await blobToDataUrl(entry);
    }

    if (!dataUrl) continue;

    out.push({
      id: `${orderId}_${suffix}_${Date.now()}_${i}`,
      orderId,
      name,
      dataUrl
    });
  }

  return out;
}

function limpiarFotosOrder(order) {
  const copy = Object.assign({}, order || {});
  copy.fotos = [];
  return copy;
}

async function supabaseRequest(path, options = {}) {
  const cfg = getCloudConfig();
  if (!cfg.enabled) {
    throw new Error('Supabase no configurado. Define MYB_SUPABASE_URL y MYB_SUPABASE_ANON_KEY.');
  }

  const method = options.method || 'GET';
  const headers = Object.assign({
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    Accept: 'application/json'
  }, options.headers || {});

  const init = { method, headers };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const url = `${cfg.url}/rest/v1/${path}`;
  const response = await fetch(url, init);
  const raw = await response.text();

  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_err) {
      data = raw;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data
      : (data && (data.message || data.error_description || data.error || JSON.stringify(data)));
    throw new Error(`Supabase ${response.status}: ${message || 'Error de API REST.'}`);
  }

  return data;
}

function encodeEq(value) {
  return `eq.${encodeURIComponent(String(value))}`;
}

function ordenarOrdersDesc(items) {
  return items.sort((a, b) => {
    if (a.created_at && b.created_at) return String(b.created_at).localeCompare(String(a.created_at));
    return 0;
  });
}

async function cloudGetOrders() {
  const cfg = getCloudConfig();
  const rowsOrders = await supabaseRequest(`${cfg.ordersTable}?select=id,payload`);
  const rowsPhotos = await supabaseRequest(`${cfg.photosTable}?select=id,order_id,name,data_url`);

  const fotosPorOrden = new Map();
  for (const p of (rowsPhotos || [])) {
    const key = String(p.order_id || '');
    if (!key) continue;
    if (!fotosPorOrden.has(key)) fotosPorOrden.set(key, []);
    if (p.data_url) fotosPorOrden.get(key).push(String(p.data_url));
  }

  const out = (rowsOrders || []).map((row) => {
    const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
    const id = row && row.id ? String(row.id) : String(payload.id || `ord_${Date.now()}`);
    const fotos = fotosPorOrden.get(id) || [];
    return Object.assign({}, payload, { id, fotos });
  });

  return ordenarOrdersDesc(out);
}

async function cloudAddOrder(order, photoEntries) {
  const cfg = getCloudConfig();
  const id = String(order && order.id ? order.id : `ord_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`);
  const cleanOrder = limpiarFotosOrder(Object.assign({}, order || {}, { id }));

  await supabaseRequest(`${cfg.ordersTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: [{ id, payload: cleanOrder }]
  });

  const fotos = await normalizarEntradasFotos(id, photoEntries, 'p');
  if (fotos.length) {
    await supabaseRequest(`${cfg.photosTable}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: fotos.map((p) => ({
        id: p.id,
        order_id: p.orderId,
        name: p.name,
        data_url: p.dataUrl
      }))
    });
  }

  return Object.assign({}, cleanOrder, { fotos: fotos.map((f) => f.dataUrl) });
}

async function cloudUpdateOrder(id, updates) {
  const cfg = getCloudConfig();
  const safeId = String(id);

  const rows = await supabaseRequest(`${cfg.ordersTable}?id=${encodeEq(safeId)}&select=id,payload`);
  const current = rows && rows[0] ? rows[0] : null;
  const payload = current && current.payload && typeof current.payload === 'object' ? current.payload : { id: safeId };
  const merged = Object.assign({}, payload, updates || {}, { id: safeId });

  await supabaseRequest(`${cfg.ordersTable}?id=${encodeEq(safeId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: { payload: limpiarFotosOrder(merged) }
  });

  return true;
}

async function cloudDeleteOrder(id) {
  const cfg = getCloudConfig();
  const safeId = String(id);

  await supabaseRequest(`${cfg.photosTable}?order_id=${encodeEq(safeId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });

  await supabaseRequest(`${cfg.ordersTable}?id=${encodeEq(safeId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });

  return true;
}

async function cloudExportAll() {
  return cloudGetOrders();
}

async function cloudImportFromArray(arr) {
  const cfg = getCloudConfig();
  if (!Array.isArray(arr)) throw new Error('Formato invalido');

  if (!arr.length) return true;

  const orderRows = [];
  const photoRows = [];

  for (let idx = 0; idx < arr.length; idx += 1) {
    const it = arr[idx] || {};
    const id = String(it.id || `ord_${Date.now()}_${Math.random().toString(16).slice(2, 7)}_${idx}`);
    orderRows.push({ id, payload: limpiarFotosOrder(Object.assign({}, it, { id })) });

    if (Array.isArray(it.fotos)) {
      for (let i = 0; i < it.fotos.length; i += 1) {
        const dataUrl = String(it.fotos[i] || '');
        if (!dataUrl) continue;
        photoRows.push({
          id: `${id}_p_imp_${Date.now()}_${idx}_${i}`,
          order_id: id,
          name: `foto_${i + 1}`,
          data_url: dataUrl
        });
      }
    }
  }

  await supabaseRequest(`${cfg.ordersTable}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: orderRows
  });

  if (photoRows.length) {
    await supabaseRequest(`${cfg.photosTable}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: photoRows
    });
  }

  return true;
}

async function cloudGetMetaValue(key) {
  const cfg = getCloudConfig();
  const rows = await supabaseRequest(`${cfg.metaTable}?key=${encodeEq(key)}&select=key,value`);
  const first = rows && rows[0] ? rows[0] : null;
  return first ? first.value : null;
}

async function cloudSetMetaValue(key, value) {
  const cfg = getCloudConfig();
  await supabaseRequest(`${cfg.metaTable}?on_conflict=key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: [{ key, value }]
  });
}

async function cloudGetFinanceState() {
  const raw = await cloudGetMetaValue(FINANCE_KEY);
  return normalizarFinanceState(raw || {});
}

async function cloudAppendFinanceMovement(movement) {
  const cur = await cloudGetFinanceState();
  const importe = normalizarNumero(movement && movement.importe);

  if (!importe) {
    await cloudSetMetaValue(FINANCE_KEY, cur);
    return null;
  }

  const item = {
    id: `mov_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    fecha: new Date().toISOString(),
    descripcion: String((movement && movement.descripcion) || '').trim(),
    importe,
    origen: String((movement && movement.origen) || 'manual'),
    ordenId: movement && movement.ordenId ? String(movement.ordenId) : null
  };

  if (movement && movement.caja === 'reparaciones') {
    cur.cajaReparacionesTotal += importe;
    cur.historialReparaciones.unshift(item);
  } else {
    cur.cajaNegocioTotal += importe;
    cur.historialNegocio.unshift(item);
  }

  await cloudSetMetaValue(FINANCE_KEY, cur);
  return item;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function (e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const s = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        s.createIndex('by_order', 'orderId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function localAddOrder(order, photoEntries) {
  const photoRecords = await normalizarEntradasFotos(order.id, photoEntries, 'p');

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);

    ordersStore.put(order);
    for (const p of photoRecords) {
      photosStore.put({ id: p.id, orderId: p.orderId, name: p.name, dataUrl: p.dataUrl });
    }

    tx.oncomplete = () => {
      db.close();
      resolve(order);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Transaccion abortada al guardar orden/fotos'));
    };
  });
}

async function localUpdateOrder(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);
    const req = store.get(id);

    req.onsuccess = () => {
      const cur = req.result || { id };
      const merged = Object.assign({}, cur, updates);
      store.put(merged);
    };

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function localDeleteOrder(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');

    tx.objectStore(STORE_ORDERS).delete(id);

    const idx = tx.objectStore(STORE_PHOTOS).index('by_order');
    const cursorReq = idx.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = function (e) {
      const cur = e.target.result;
      if (cur) {
        cur.delete();
        cur.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function localGetOrders() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readonly');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);
    const req = ordersStore.getAll();

    req.onsuccess = async () => {
      const orders = req.result || [];

      for (const ord of orders) {
        const idx = photosStore.index('by_order');
        const photosForOrder = [];
        const pReq = idx.openCursor(IDBKeyRange.only(ord.id));

        await new Promise((res) => {
          pReq.onsuccess = function (ev) {
            const c = ev.target.result;
            if (c) {
              photosForOrder.push(c.value);
              c.continue();
            } else {
              res();
            }
          };
          pReq.onerror = () => res();
        });

        ord.fotos = photosForOrder
          .map((p) => (p && typeof p.dataUrl === 'string' ? p.dataUrl : ''))
          .filter(Boolean);
      }

      db.close();
      resolve(ordenarOrdersDesc(orders));
    };

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function localExportAll() {
  return localGetOrders();
}

async function localImportFromArray(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Formato invalido');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);

    for (const it of arr) {
      const id = it.id || `ord_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
      const copy = Object.assign({}, it, { id });
      ordersStore.put(copy);

      if (Array.isArray(it.fotos)) {
        for (let i = 0; i < it.fotos.length; i += 1) {
          const foto = it.fotos[i];
          const pid = `${id}_p_imp_${Date.now()}_${i}`;
          photosStore.put({ id: pid, orderId: id, name: pid, dataUrl: foto });
        }
      }
    }

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function localGetFinanceState() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(FINANCE_KEY);

    req.onsuccess = () => {
      const val = req.result && req.result.value ? req.result.value : {};
      db.close();
      resolve(normalizarFinanceState(val));
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function localAppendFinanceMovement(movement) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const req = store.get(FINANCE_KEY);

    req.onsuccess = () => {
      const curRaw = req.result && req.result.value ? req.result.value : {};
      const cur = normalizarFinanceState(curRaw);
      const importe = normalizarNumero(movement && movement.importe);
      if (!importe) {
        store.put({ key: FINANCE_KEY, value: cur });
        resolve(null);
        return;
      }

      const item = {
        id: `mov_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        fecha: new Date().toISOString(),
        descripcion: String((movement && movement.descripcion) || '').trim(),
        importe,
        origen: String((movement && movement.origen) || 'manual'),
        ordenId: movement && movement.ordenId ? String(movement.ordenId) : null
      };

      if (movement && movement.caja === 'reparaciones') {
        cur.cajaReparacionesTotal += importe;
        cur.historialReparaciones.unshift(item);
      } else {
        cur.cajaNegocioTotal += importe;
        cur.historialNegocio.unshift(item);
      }

      store.put({ key: FINANCE_KEY, value: cur });
      resolve(item);
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function usarCloud() {
  return getCloudConfig().enabled;
}

async function addOrder(order, photoEntries) {
  if (usarCloud()) return cloudAddOrder(order, photoEntries);
  return localAddOrder(order, photoEntries);
}

async function updateOrder(id, updates) {
  if (usarCloud()) return cloudUpdateOrder(id, updates);
  return localUpdateOrder(id, updates);
}

async function deleteOrder(id) {
  if (usarCloud()) return cloudDeleteOrder(id);
  return localDeleteOrder(id);
}

async function getOrders() {
  if (usarCloud()) return cloudGetOrders();
  return localGetOrders();
}

async function exportAll() {
  if (usarCloud()) return cloudExportAll();
  return localExportAll();
}

async function importFromArray(arr) {
  if (usarCloud()) return cloudImportFromArray(arr);
  return localImportFromArray(arr);
}

async function getFinanceState() {
  if (usarCloud()) return cloudGetFinanceState();
  return localGetFinanceState();
}

async function appendFinanceMovement(movement) {
  if (usarCloud()) return cloudAppendFinanceMovement(movement);
  return localAppendFinanceMovement(movement);
}

export default {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrders,
  exportAll,
  importFromArray,
  getFinanceState,
  appendFinanceMovement,
  openDB
};
