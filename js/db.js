/* =========================================================
   db.js — Camada de persistência 100% OFFLINE (IndexedDB)
   Stores:
     sites    → sítios/clientes (com litragem calculada)
     reports  → vistorias (fotos em Base64 + Blob do PDF)
     settings → dados da empresa ({key:'company', value:{...}})
   ========================================================= */
const DB = (() => {
  'use strict';
  const NAME = 'negrets-master-db', VERSION = 1;
  let _db = null;

  function open(){
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sites'))    db.createObjectStore('sites',    { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reports'))  db.createObjectStore('reports',  { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror   = () => reject(req.error);
    });
  }

  const wrap = (req) => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  return {
    open,
    async put(store, value){
      const db = await open();
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    },
    async get(store, key){ const db = await open(); return wrap(db.transaction(store).objectStore(store).get(key)); },
    async all(store){      const db = await open(); return wrap(db.transaction(store).objectStore(store).getAll()); },
    async del(store, key){
      const db = await open();
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    },
    async clear(store){
      const db = await open();
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    }
  };
})();
