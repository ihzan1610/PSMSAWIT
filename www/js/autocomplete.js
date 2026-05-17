// ===============================
// PSM SAWIT - autocomplete.js
// FIX FINAL AUTOCOMPLETE
// Aturan:
// 1. Fokus kolom kosong tidak langsung membuka daftar.
// 2. Daftar muncul saat mengetik huruf.
// 3. Tombol panah ▼ membuka daftar lengkap.
// 4. Klik/tap saran Pemilik atau Sopir langsung mengisi kolom.
// 5. Tetap boleh input manual tanpa memilih saran.
// Catatan bug fix:
// - Data utama `db`, `savedOwners`, `savedDrivers` dibuat dengan `let`, jadi tidak selalu ada di window.
//   Karena itu opsi harus dibaca dari variabel global langsung + localStorage + IndexedDB mirror.
// ===============================

(function(){
    const CFG = {
        owner: { inputId: 'in-owner', listId: 'psm-owner-list', field: 'owner', storeKey: 'psm_owners' },
        driver: { inputId: 'in-driver', listId: 'psm-driver-list', field: 'driver', storeKey: 'psm_drivers' }
    };

    function norm(v) {
        return String(v || '').toUpperCase().trimStart();
    }

    function safeJson(value, fallback) {
        try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
    }

    function uniqueSorted(arr) {
        return [...new Set((arr || [])
            .map(norm)
            .map(x => x.trim())
            .filter(Boolean)
        )].sort((a,b) => a.localeCompare(b));
    }

    function getGlobalDb() {
        let out = [];
        try { if (typeof db !== 'undefined' && Array.isArray(db)) out = out.concat(db); } catch (_) {}
        try { if (window.db && Array.isArray(window.db)) out = out.concat(window.db); } catch (_) {}
        try { out = out.concat(safeJson(localStorage.getItem('psm_database_master'), [])); } catch (_) {}
        return out.filter(Boolean);
    }

    function getSavedNames(type) {
        const cfg = CFG[type];
        let out = [];
        try {
            if (type === 'owner' && typeof savedOwners !== 'undefined' && Array.isArray(savedOwners)) out = out.concat(savedOwners);
            if (type === 'driver' && typeof savedDrivers !== 'undefined' && Array.isArray(savedDrivers)) out = out.concat(savedDrivers);
        } catch (_) {}
        try {
            if (type === 'owner' && window.savedOwners && Array.isArray(window.savedOwners)) out = out.concat(window.savedOwners);
            if (type === 'driver' && window.savedDrivers && Array.isArray(window.savedDrivers)) out = out.concat(window.savedDrivers);
        } catch (_) {}
        try { out = out.concat(safeJson(localStorage.getItem(cfg.storeKey), [])); } catch (_) {}
        return out;
    }

    function getOptions(type) {
        const cfg = CFG[type];
        if (!cfg) return [];
        const fromSaved = getSavedNames(type);
        const fromDb = getGlobalDb().map(x => x ? x[cfg.field] : '').filter(Boolean);
        return uniqueSorted([...fromSaved, ...fromDb]);
    }

    function getEl(type) {
        const c = CFG[type];
        if (!c) return {};
        return {
            input: document.getElementById(c.inputId),
            list: document.getElementById(c.listId)
        };
    }

    function escapeHtmlLocal(s) {
        if (typeof escapeHtml === 'function') return escapeHtml(s);
        return String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }

    function renderList(type, mode) {
        const { input, list } = getEl(type);
        if (!input || !list) return;
        if (input.readOnly) { hideList(type); return; }

        const q = norm(input.value).trim();
        let options = getOptions(type);

        if (mode !== 'all') {
            if (!q) { hideList(type); return; }
            // Prioritas: nama yang diawali huruf/teks yang diketik.
            const prefix = options.filter(x => x.startsWith(q));
            // Cadangan: nama yang mengandung teks, supaya data lama mudah dicari.
            const contains = options.filter(x => !x.startsWith(q) && x.includes(q));
            options = [...prefix, ...contains];
        }

        options = options.slice(0, 100);

        if (options.length === 0) {
            list.innerHTML = `<div class="psm-ac-empty">Tidak ada saran. Boleh isi manual.</div>`;
        } else {
            list.innerHTML = options.map(name => `
                <div class="psm-ac-item" role="button" tabindex="-1" data-type="${type}" data-value="${escapeHtmlLocal(name)}">${escapeHtmlLocal(name)}</div>
            `).join('');
        }
        list.classList.add('show');
    }

    function hideList(type) {
        const { list } = getEl(type);
        if (list) list.classList.remove('show');
    }

    function closeAll() {
        Object.keys(CFG).forEach(hideList);
    }

    function selectName(type, value) {
        const { input } = getEl(type);
        if (!input || input.readOnly) return;
        input.value = norm(value).trim();

        if (type === 'owner' && typeof fillTarif === 'function') fillTarif();
        if (typeof saveDraft === 'function') saveDraft();
        if (typeof beepClick === 'function') beepClick();
        closeAll();
    }

    window.handlePsmNameInput = function(type) {
        const { input } = getEl(type);
        if (!input) return;
        input.value = norm(input.value);
        if (type === 'owner' && typeof fillTarif === 'function') fillTarif();
        if (typeof saveDraft === 'function') saveDraft();
        renderList(type, 'typed');
    };

    window.togglePsmNameList = function(type) {
        const { input, list } = getEl(type);
        if (!input || !list || input.readOnly) return;
        if (typeof beepClick === 'function') beepClick();
        const isOpen = list.classList.contains('show');
        closeAll();
        if (!isOpen) {
            input.focus();
            renderList(type, 'all');
        }
    };

    window.closeAllPsmNameLists = closeAll;
    window.getPsmNameOptionsDebug = getOptions;

    function handlePickEvent(e) {
        const item = e.target.closest && e.target.closest('.psm-ac-item');
        if (!item) return false;
        e.preventDefault();
        e.stopPropagation();
        selectName(item.getAttribute('data-type'), item.getAttribute('data-value'));
        return true;
    }

    // Pakai mousedown + touchstart agar tap di Android tidak hilang karena keyboard/focus blur.
    document.addEventListener('mousedown', handlePickEvent, true);
    document.addEventListener('touchstart', handlePickEvent, { capture: true, passive: false });
    document.addEventListener('click', function(e){
        if (handlePickEvent(e)) return;
        if (!(e.target.closest && e.target.closest('.psm-autocomplete'))) {
            closeAll();
        }
    });

    document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') closeAll();
    });
})();
