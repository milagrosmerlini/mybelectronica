// datastore.js - Adapter local usando IndexedDB
const DB_NAME = 'myb_electronica_db';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';
const STORE_PHOTOS = 'photos';

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(e){
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_ORDERS)){
        db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
      }
      if(!db.objectStoreNames.contains(STORE_PHOTOS)){
        const s = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        s.createIndex('by_order', 'orderId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addOrder(order, photoFiles){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);
    ordersStore.put(order);
    const addPhotoPromises = [];
    if(Array.isArray(photoFiles)){
      for(let i=0;i<photoFiles.length;i++){
        const file = photoFiles[i];
        const id = order.id + '_p_' + Date.now() + '_' + i;
        addPhotoPromises.push(fileToDataUrl(file).then(dataUrl=>{
          photosStore.put({ id, orderId: order.id, name: file.name || id, dataUrl });
        }));
      }
    }
    Promise.all(addPhotoPromises).then(()=>{
      tx.oncomplete = ()=>{ resolve(order); db.close(); };
      tx.onerror = ()=>{ reject(tx.error); db.close(); };
    }).catch(err=>{ reject(err); db.close(); });
  });
}

async function updateOrder(id, updates){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);
    const req = store.get(id);
    req.onsuccess = () => {
      const cur = req.result || {};
      const merged = Object.assign({}, cur, updates);
      store.put(merged);
    };
    tx.oncomplete = ()=>{ resolve(true); db.close(); };
    tx.onerror = ()=>{ reject(tx.error); db.close(); };
  });
}

async function deleteOrder(id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    tx.objectStore(STORE_ORDERS).delete(id);
    const idx = tx.objectStore(STORE_PHOTOS).index('by_order');
    const range = IDBKeyRange.only(id);
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = function(e){
      const cur = e.target.result;
      if(cur){ cur.delete(); cur.continue(); }
    };
    tx.oncomplete = ()=>{ resolve(true); db.close(); };
    tx.onerror = ()=>{ reject(tx.error); db.close(); };
  });
}

async function getOrders(){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readonly');
    const store = tx.objectStore(STORE_ORDERS);
    const req = store.getAll();
    req.onsuccess = async () => {
      const orders = req.result || [];
      // load photos per order
      const photosStore = tx.objectStore(STORE_PHOTOS);
      for(const ord of orders){
        ord.fotos = [];
        const idx = photosStore.index('by_order');
        const photosForOrder = [];
        const pReq = idx.openCursor(IDBKeyRange.only(ord.id));
        await new Promise((res)=>{
          pReq.onsuccess = function(ev){
            const c = ev.target.result;
            if(c){ photosForOrder.push(c.value); c.continue(); } else res();
          };
        });
        ord.fotos = photosForOrder.map(p=>p.dataUrl);
      }
      // sort by created_at desc if exists
      orders.sort((a,b)=>{ if(a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at); return 0; });
      resolve(orders);
      db.close();
    };
    req.onerror = ()=>{ reject(req.error); db.close(); };
  });
}

async function exportAll(){
  const orders = await getOrders();
  return orders;
}

async function importFromArray(arr){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_ORDERS, STORE_PHOTOS], 'readwrite');
    const ordersStore = tx.objectStore(STORE_ORDERS);
    const photosStore = tx.objectStore(STORE_PHOTOS);
    for(const it of arr){
      const id = it.id || it.idOrden || ('ord_'+Date.now());
      const copy = Object.assign({}, it, { id });
      ordersStore.put(copy);
      if(Array.isArray(it.fotos)){
        for(const [i,f] of it.fotos.entries()){
          const pid = id + '_p_imp_' + i;
          photosStore.put({ id: pid, orderId: id, name: pid, dataUrl: f });
        }
      }
    }
    tx.oncomplete = ()=>{ resolve(true); db.close(); };
    tx.onerror = ()=>{ reject(tx.error); db.close(); };
  });
}

function fileToDataUrl(file){
  return new Promise((res,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> res(reader.result);
    reader.onerror = ()=> reject(reader.error);
    reader.readAsDataURL(file);
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
