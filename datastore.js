const DB_NAME = 'myb_electronica_db';
const DB_VERSION = 2;
const STORE_ORDERS = 'orders';
const STORE_PHOTOS = 'photos';
const STORE_META = 'meta';
const FINANCE_KEY = 'finance_state';

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

async function blobToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function addOrder(order, photoEntries) {
  const photoRecords = [];

  if (Array.isArray(photoEntries) && photoEntries.length) {
    for (let i = 0; i < photoEntries.length; i += 1) {
      const entry = photoEntries[i];
      let dataUrl = '';
      let name = `foto_${i + 1}`;

      if (typeof entry === 'string') {
        dataUrl = entry;
      } else if (entry && typeof entry.dataUrl === 'string') {
        dataUrl = entry.dataUrl;
        if (entry.name) name = entry.name;
      } else if (entry instanceof Blob) {
        if (entry.name) name = entry.name;
        photoRecords.push({
          id: `${order.id}_p_${Date.now()}_${i}`,
          orderId: order.id,
          name,
          blob: entry
        });
        continue;
      }

      if (!dataUrl) continue;

      photoRecords.push({
        id: `${order.id}_p_${Date.now()}_${i}`,
        orderId: order.id,
        name,
        dataUrl
      });
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);

    ordersStore.put(order);
    for (const p of photoRecords) {
      photosStore.put(p);
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

async function updateOrder(id, updates) {
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

async function deleteOrder(id) {
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

async function getOrders() {
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

        ord.fotos = photosForOrder.map((p) => {
          if (p && p.blob instanceof Blob) return URL.createObjectURL(p.blob);
          if (p && typeof p.dataUrl === 'string') return p.dataUrl;
          return '';
        }).filter(Boolean);
      }

      orders.sort((a, b) => {
        if (a.created_at && b.created_at) {
          return b.created_at.localeCompare(a.created_at);
        }
        return 0;
      });

      db.close();
      resolve(orders);
    };

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function exportAll() {
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

        const fotosExport = [];
        for (const p of photosForOrder) {
          if (p && typeof p.dataUrl === 'string') {
            fotosExport.push(p.dataUrl);
          } else if (p && p.blob instanceof Blob) {
            fotosExport.push(await blobToDataUrl(p.blob));
          }
        }
        ord.fotos = fotosExport;
      }

      orders.sort((a, b) => {
        if (a.created_at && b.created_at) {
          return b.created_at.localeCompare(a.created_at);
        }
        return 0;
      });

      db.close();
      resolve(orders);
    };

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function importFromArray(arr) {
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

async function getFinanceState() {
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

async function appendFinanceMovement(movement) {
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
