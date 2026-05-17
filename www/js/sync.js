// ===============================
// PSM SAWIT - sync.js
// Step 5: faster cloud sync + delete queue + no-cors POST + IndexedDB save.
// ===============================

const DELETE_QUEUE_KEY = 'psm_deleted_queue';

function getCloudUrl() {
    if (typeof CONFIG !== 'undefined' && CONFIG.CLOUD_URL) {
        return CONFIG.CLOUD_URL;
    }

    if (window.PSM_CONFIG && window.PSM_CONFIG.CLOUD_URL) {
        return window.PSM_CONFIG.CLOUD_URL;
    }

    if (typeof CLOUD_URL !== 'undefined' && CLOUD_URL) {
        return CLOUD_URL;
    }

    return '';
}

async function postToCloudNoCors(payload) {
    const url = getCloudUrl();

    if (!url.includes('http')) {
        throw new Error('CLOUD_URL belum diisi di js/config.js');
    }

    await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
    });

    return true;
}

function saveDeletedQueue() {
    if (typeof saveDeletedQueueToStorage === 'function') {
        saveDeletedQueueToStorage();
    } else {
        localStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(deletedQueue || []));
    }
}

function getDeletedIdSet() {
    return new Set(
        (deletedQueue || [])
            .filter(x => x && x.id)
            .map(x => normalizeId(x.id))
    );
}

function markDeletedForCloud(ids) {
    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    const existing = getDeletedIdSet();
    const now = new Date().toISOString();

    ids.forEach(id => {
        const safeId = normalizeId(id);
        if (!safeId || existing.has(safeId)) return;

        deletedQueue.push({
            id: safeId,
            deletedAt: now,
            synced: false
        });

        existing.add(safeId);
    });

    saveDeletedQueue();
}

function getPendingDeleteIds() {
    return (deletedQueue || [])
        .filter(x => x && x.id && !x.synced)
        .map(x => normalizeId(x.id));
}

function pruneDeletedQueue() {
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    deletedQueue = (deletedQueue || []).filter(x => {
        if (!x || !x.id) return false;
        if (!x.synced) return true;

        const t = new Date(x.deletedAt || 0).getTime();

        return Number.isFinite(t) && (now - t) < maxAgeMs;
    });

    saveDeletedQueue();
}

async function syncDeletesToCloud() {
    const ids = getPendingDeleteIds();

    if (ids.length === 0) {
        return true;
    }

    await postToCloudNoCors({
        action: 'delete',
        ids: ids
    });

    const sent = new Set(ids);

    deletedQueue.forEach(x => {
        if (sent.has(x.id)) {
            x.synced = true;
        }
    });

    saveDeletedQueue();
    pruneDeletedQueue();

    return true;
}

async function tarikDataCloud() {
    beepClick();

    const url = getCloudUrl();

    if (!url.includes('http')) {
        beepError();
        return alert('CLOUD_URL belum diisi di js/config.js');
    }

    const pInput = prompt(
        "FITUR BERBAHAYA!\nMasukkan PIN Akses untuk melanjutkan:"
    );

    if (pInput !== getPin()) {
        beepError();
        return alert("PIN SALAH! Akses ditolak.");
    }

    const unsynced =
        db.filter(x => !x.synced).length +
        getPendingDeleteIds().length;

    if (unsynced > 0) {
        const lanjut = confirm(
            `Peringatan!\nAda ${unsynced} data/perubahan yang BELUM tersimpan ke Cloud.\nJika Anda tarik data sekarang, perubahan lokal bisa tertimpa.\n\nYakin lanjut tarik data?`
        );

        if (!lanjut) return;
    }

    const konfirmasi = confirm(
        "KONFIRMASI TERAKHIR:\nSemua data lokal akan diganti dengan data dari Cloud. Setuju?"
    );

    if (!konfirmasi) return;

    if (!navigator.onLine) {
        beepError();
        return alert("Koneksi Internet dibutuhkan!");
    }

    const s = document.getElementById('sync-status');

    s.style.display = 'inline-block';
    s.innerText = "⏳ Menarik...";
    s.style.background = "#3b82f6";

    try {
        const resp = await fetch(url);
        const res = await resp.json();

        if (res && res.data) {
            const deletedIds = getDeletedIdSet();

            db = res.data.filter(item =>
                item &&
                item.id &&
                !deletedIds.has(normalizeId(item.id))
            );

            db.forEach(item => {
                item.id = normalizeId(item.id);
                item.synced = true;
            });

            if (typeof saveDbToStorage === 'function') saveDbToStorage();
            else localStorage.setItem('psm_database_master', JSON.stringify(db));

            const oS = new Set();
            const dS = new Set();

            db.forEach(x => {
                if (x.owner) oS.add(x.owner);
                if (x.driver) dS.add(x.driver);
            });

            localStorage.setItem(
                'psm_owners',
                JSON.stringify([...oS])
            );

            localStorage.setItem(
                'psm_drivers',
                JSON.stringify([...dS])
            );

            beepSuccess();

            alert(
                "BERHASIL! " +
                db.length +
                " data ditarik. Data yang pernah dihapus lokal tetap disembunyikan."
            );

            closeSettings();
            mulaiAplikasi();
        }

    } catch (e) {
        beepError();
        alert("Gagal: " + e.message);

    } finally {
        s.style.display = 'none';
    }
}

async function syncToCloud() {
    const url = getCloudUrl();

    if (
        !navigator.onLine ||
        !url.includes("http") ||
        isSyncing
    ) {
        return;
    }

    const unsyncedData = db.filter(x => !x.synced);
    const pendingDeleteIds = getPendingDeleteIds();

    if (
        unsyncedData.length === 0 &&
        pendingDeleteIds.length === 0
    ) {
        return;
    }

    const s = document.getElementById('sync-status');

    s.style.display = 'inline-block';
    s.innerText = "⏳ Sinkronisasi...";
    s.style.background = "#3b82f6";

    isSyncing = true;

    try {
        if (unsyncedData.length > 0) {
            await postToCloudNoCors(unsyncedData);

            const idsJustSent = unsyncedData.map(d => normalizeId(d.id));

            db.forEach(item => {
                if (idsJustSent.includes(normalizeId(item.id))) {
                    item.synced = true;
                }
            });

            if (typeof saveDbToStorage === 'function') saveDbToStorage();
            else localStorage.setItem('psm_database_master', JSON.stringify(db));
        }

        if (pendingDeleteIds.length > 0) {
            await syncDeletesToCloud();
        }

        s.innerText = "✅ TERSINKRON";
        s.style.background = "#10b981";

        renderLiveTable();

    } catch (e) {
        console.warn('Sync tertunda:', e);

        s.innerText = "☁️ TERTUNDA";
        s.style.background = "#f59e0b";

    } finally {
        isSyncing = false;

        setTimeout(() => {
            s.style.display = 'none';
        }, 3000);
    }
}
