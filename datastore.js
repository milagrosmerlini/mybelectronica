const DB_NAME = 'myb_electronica_db';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';
const STORE_PHOTOS = 'photos';

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fileToDataUrl(file) {
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
        dataUrl = await fileToDataUrl(entry);
        if (entry.name) name = entry.name;
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

        ord.fotos = photosForOrder.map((p) => p.dataUrl);
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
  return getOrders();
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

export default {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrders,
  exportAll,
  importFromArray,
  openDB
};
