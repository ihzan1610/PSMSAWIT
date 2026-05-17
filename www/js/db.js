// ===============================
// PSM SAWIT - db.js
// Step 5: IndexedDB storage layer.
// Tujuan:
// - data timbang utama disimpan di IndexedDB
// - localStorage tetap menjadi mirror/cadangan kecil agar fitur lama tetap kompatibel
// - migrasi otomatis dari localStorage lama ke IndexedDB
// ===============================

const PSM_IDB_NAME = 'PSM_SAWIT_INDEXEDDB';
const PSM_IDB_VERSION = 1;
const PSM_STORE_TIMBANG = 'timbang';
const PSM_STORE_DELETED = 'deleted_queue';
const PSM_STORE_META = 'meta';

const LOCAL_DB_KEY = 'psm_database_master';
const LOCAL_DB_TS_KEY = 'psm_database_master_updated_at';
const LOCAL_DELETE_KEY = 'psm_deleted_queue';
const LOCAL_DELETE_TS_KEY = 'psm_deleted_queue_updated_at';
const MIGRATION_FLAG_KEY = 'psm_indexeddb_migrated_v1';

let psmIDB = null;
let psmIDBReady = false;

function safeJsonParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch (_) {
        return fallback;
    }
}

function openPSMIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('Browser tidak mendukung IndexedDB'));
            return;
        }

        const req = indexedDB.open(PSM_IDB_NAME, PSM_IDB_VERSION);

        req.onupgradeneeded = event => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(PSM_STORE_TIMBANG)) {
                const timbang = database.createObjectStore(PSM_STORE_TIMBANG, { keyPath: 'id' });
                timbang.createIndex('__order', '__order', { unique: false });
                timbang.createIndex('date', 'date', { unique: false });
                timbang.createIndex('owner', 'owner', { unique: false });
                timbang.createIndex('driver', 'driver', { unique: false });
                timbang.createIndex('synced', 'synced', { unique: false });
            }

            if (!database.objectStoreNames.contains(PSM_STORE_DELETED)) {
                const deleted = database.createObjectStore(PSM_STORE_DELETED, { keyPath: 'id' });
                deleted.createIndex('synced', 'synced', { unique: false });
                deleted.createIndex('deletedAt', 'deletedAt', { unique: false });
            }

            if (!database.objectStoreNames.contains(PSM_STORE_META)) {
                database.createObjectStore(PSM_STORE_META, { keyPath: 'key' });
            }
        };

        req.onsuccess = event => {
            psmIDB = event.target.result;
            psmIDBReady = true;
            resolve(psmIDB);
        };

        req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB'));
    });
}

function idbTransaction(storeName, mode = 'readonly') {
    if (!psmIDB) throw new Error('IndexedDB belum siap');
    return psmIDB.transaction(storeName, mode).objectStore(storeName);
}

function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const store = idbTransaction(storeName, 'readonly');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

function idbGetMeta(key) {
    return new Promise((resolve, reject) => {
        const store = idbTransaction(PSM_STORE_META, 'readonly');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

function idbSetMeta(key, value) {
    return new Promise((resolve, reject) => {
        const store = idbTransaction(PSM_STORE_META, 'readwrite');
        const req = store.put({ key, value });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

function idbClearStore(storeName) {
    return new Promise((resolve, reject) => {
        const store = idbTransaction(storeName, 'readwrite');
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

function idbPutMany(storeName, items) {
    return new Promise((resolve, reject) => {
        const tx = psmIDB.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        (items || []).forEach(item => {
            if (item && item.id) store.put(item);
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

function idbDeleteMany(storeName, ids) {
    return new Promise((resolve, reject) => {
        const tx = psmIDB.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        (ids || []).forEach(id => {
            if (id) store.delete(id);
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

function normalizeDbRecord(item, idx = 0) {
    if (!item || item.id === undefined || item.id === null || String(item.id).trim() === '') return null;

    item.id = String(item.id).trim();
    item.owner = safeText(item.owner);
    item.driver = safeText(item.driver);
    item.date = normalizeDateForInput(item.date, '');
    item.time = normalizeTimeForInput(item.time, '');
    item.w1 = toNumber(item.w1);
    item.w2 = toNumber(item.w2);
    item.price = toNumber(item.price);
    item.fl = toInt(item.fl);
    item.fj = toInt(item.fj);
    item.fp = toInt(item.fp);

    item.n1 = toNumber(item.n1, Math.round(item.w1 - item.w2));
    item.srt = toNumber(item.srt, item.n1 * 0.03);
    item.n2 = toNumber(item.n2, item.n1 - item.srt);
    item.kotor = toInt(item.kotor, item.n2 * item.price);
    item.tL = toInt(item.tL, item.n1 * item.fl);
    item.tP = toInt(item.tP, item.n1 * item.fp);
    item.tJ = toInt(item.tJ, item.n2 * item.fj);
    item.bersih = toInt(item.bersih, item.kotor - (item.tL + item.tP + item.tJ));
    item.synced = !!item.synced;

    if (item.__order === undefined || item.__order === null || item.__order === '') item.__order = idx;
    return item;
}

function normalizeDeletedRecord(item) {
    if (!item || item.id === undefined || item.id === null || String(item.id).trim() === '') return null;
    item.id = String(item.id).trim();
    item.deletedAt = item.deletedAt || new Date().toISOString();
    item.synced = !!item.synced;
    return item;
}

function normalizeDbOrder(list) {
    if (!Array.isArray(list)) return [];

    list = list.map((item, idx) => normalizeDbRecord(item, idx)).filter(Boolean);

    let maxOrder = -1;
    list.forEach(item => {
        const order = Number(item && item.__order);
        if (Number.isFinite(order) && order > maxOrder) maxOrder = order;
    });

    list.forEach((item, idx) => {
        if (!item || !item.id) return;
        if (item.__order === undefined || item.__order === null || item.__order === '') {
            item.__order = maxOrder >= 0 ? ++maxOrder : idx;
        }
    });

    return list;
}

function sortByOrder(list) {
    return (list || []).slice().sort((a, b) => {
        const oa = Number(a && a.__order);
        const ob = Number(b && b.__order);
        if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
        const da = String((a && a.date) || '') + 'T' + String((a && a.time) || '00:00');
        const dbb = String((b && b.date) || '') + 'T' + String((b && b.time) || '00:00');
        return da.localeCompare(dbb);
    });
}

async function saveDbToIndexedDB(list) {
    if (!psmIDBReady) return false;

    const normalized = normalizeDbOrder(list || []);
    await idbClearStore(PSM_STORE_TIMBANG);
    await idbPutMany(PSM_STORE_TIMBANG, normalized);
    await idbSetMeta('dbUpdatedAt', Date.now());
    return true;
}

async function saveDeletedQueueToIndexedDB(list) {
    if (!psmIDBReady) return false;

    await idbClearStore(PSM_STORE_DELETED);
    await idbPutMany(PSM_STORE_DELETED, (list || []).map(normalizeDeletedRecord).filter(Boolean));
    await idbSetMeta('deletedUpdatedAt', Date.now());
    return true;
}

// Wrapper utama untuk menyimpan database transaksi.
// Semua file lain cukup panggil saveDbToStorage() agar localStorage + IndexedDB sama-sama aman.
function saveDbToStorage() {
    normalizeDbOrder(db);

    const now = Date.now();

    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
    localStorage.setItem(LOCAL_DB_TS_KEY, String(now));

    if (psmIDBReady) {
        saveDbToIndexedDB(db).catch(err => {
            console.warn('Gagal menyimpan database ke IndexedDB:', err);
        });
    }
}

function saveDeletedQueueToStorage() {
    const now = Date.now();

    localStorage.setItem(LOCAL_DELETE_KEY, JSON.stringify(deletedQueue || []));
    localStorage.setItem(LOCAL_DELETE_TS_KEY, String(now));

    if (psmIDBReady) {
        saveDeletedQueueToIndexedDB(deletedQueue || []).catch(err => {
            console.warn('Gagal menyimpan deleted queue ke IndexedDB:', err);
        });
    }
}

async function forceMirrorLocalToIndexedDB() {
    const localDb = safeJsonParse(localStorage.getItem(LOCAL_DB_KEY), []);
    const localDeleted = safeJsonParse(localStorage.getItem(LOCAL_DELETE_KEY), []);

    await saveDbToIndexedDB(localDb);
    await saveDeletedQueueToIndexedDB(localDeleted);

    await idbSetMeta('dbUpdatedAt', Number(localStorage.getItem(LOCAL_DB_TS_KEY) || Date.now()));
    await idbSetMeta('deletedUpdatedAt', Number(localStorage.getItem(LOCAL_DELETE_TS_KEY) || Date.now()));

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

async function initStorageLayer() {
    try {
        await openPSMIndexedDB();

        const localDb = safeJsonParse(localStorage.getItem(LOCAL_DB_KEY), []);
        const localDeleted = safeJsonParse(localStorage.getItem(LOCAL_DELETE_KEY), []);

        let idbDb = await idbGetAll(PSM_STORE_TIMBANG);
        let idbDeleted = await idbGetAll(PSM_STORE_DELETED);

        idbDb = sortByOrder(idbDb);
        idbDeleted = idbDeleted || [];

        const localDbTs = Number(localStorage.getItem(LOCAL_DB_TS_KEY) || 0);
        const idbDbTs = Number(await idbGetMeta('dbUpdatedAt') || 0);
        const localDeleteTs = Number(localStorage.getItem(LOCAL_DELETE_TS_KEY) || 0);
        const idbDeleteTs = Number(await idbGetMeta('deletedUpdatedAt') || 0);

        // Migrasi data utama.
        if (idbDb.length === 0 && localDb.length > 0) {
            db = normalizeDbOrder(localDb);
            await saveDbToIndexedDB(db);
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
            console.log('Migrasi localStorage → IndexedDB selesai:', db.length, 'data');
        } else if (localDbTs > idbDbTs && localDb.length >= 0) {
            db = normalizeDbOrder(localDb);
            await saveDbToIndexedDB(db);
            console.log('IndexedDB diperbarui dari mirror localStorage:', db.length, 'data');
        } else {
            db = normalizeDbOrder(idbDb);
            localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
            if (!localDbTs) localStorage.setItem(LOCAL_DB_TS_KEY, String(Date.now()));
            console.log('Database dibaca dari IndexedDB:', db.length, 'data');
        }

        // Migrasi antrean hapus.
        if (idbDeleted.length === 0 && localDeleted.length > 0) {
            deletedQueue = (localDeleted || []).map(normalizeDeletedRecord).filter(Boolean);
            await saveDeletedQueueToIndexedDB(deletedQueue);
        } else if (localDeleteTs > idbDeleteTs) {
            deletedQueue = (localDeleted || []).map(normalizeDeletedRecord).filter(Boolean);
            await saveDeletedQueueToIndexedDB(deletedQueue);
        } else {
            deletedQueue = (idbDeleted || []).map(normalizeDeletedRecord).filter(Boolean);
            localStorage.setItem(LOCAL_DELETE_KEY, JSON.stringify(deletedQueue));
            if (!localDeleteTs) localStorage.setItem(LOCAL_DELETE_TS_KEY, String(Date.now()));
        }

        return true;

    } catch (err) {
        console.warn('IndexedDB tidak aktif. Aplikasi memakai localStorage fallback:', err);
        db = safeJsonParse(localStorage.getItem(LOCAL_DB_KEY), []);
        deletedQueue = safeJsonParse(localStorage.getItem(LOCAL_DELETE_KEY), []).map(normalizeDeletedRecord).filter(Boolean);
        psmIDBReady = false;
        return false;
    }
}

// Tool kecil untuk debugging di Console jika diperlukan.
window.PSM_DEBUG_DB = {
    initStorageLayer,
    saveDbToStorage,
    saveDeletedQueueToStorage,
    forceMirrorLocalToIndexedDB,
    getStatus: async function () {
        const idbData = psmIDBReady ? await idbGetAll(PSM_STORE_TIMBANG) : [];
        const idbDeleted = psmIDBReady ? await idbGetAll(PSM_STORE_DELETED) : [];
        return {
            indexedDBReady: psmIDBReady,
            memoryData: db.length,
            indexedDBData: idbData.length,
            localStorageData: safeJsonParse(localStorage.getItem(LOCAL_DB_KEY), []).length,
            deletedQueueMemory: deletedQueue.length,
            deletedQueueIndexedDB: idbDeleted.length,
            deletedQueueLocalStorage: safeJsonParse(localStorage.getItem(LOCAL_DELETE_KEY), []).length
        };
    }
};
