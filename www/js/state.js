// ===============================
// PSM SAWIT - state.js
// Step 5: state + IndexedDB bridge.
// ===============================

const CLOUD_URL = (window.PSM_CONFIG && window.PSM_CONFIG.CLOUD_URL) ? window.PSM_CONFIG.CLOUD_URL : '';

// Data utama tetap tersedia sebagai array global agar semua fitur lama tidak berubah.
// Pada Step 5, array ini diisi ulang dari IndexedDB saat aplikasi start.
let db = JSON.parse(localStorage.getItem('psm_database_master')) || [];
let mem = JSON.parse(localStorage.getItem('psm_mem_master')) || {};
let savedOwners = JSON.parse(localStorage.getItem('psm_owners')) || [];
let savedDrivers = JSON.parse(localStorage.getItem('psm_drivers')) || [];
let curIdx = -1, isEditMode = false, lastData = null;
let selectedIds = new Set();
let isSyncing = false;

// Queue khusus data yang dihapus.
// Pada Step 5, queue ini juga disimpan ke IndexedDB.
let deletedQueue = JSON.parse(localStorage.getItem('psm_deleted_queue')) || [];
