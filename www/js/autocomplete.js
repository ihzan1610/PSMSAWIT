// ===============================
// PSM SAWIT - autocomplete.js
// Custom autocomplete untuk Pemilik & Sopir.
// Aturan:
// 1. Fokus kolom kosong tidak langsung membuka daftar.
// 2. Daftar muncul saat mengetik huruf.
// 3. Tombol panah membuka daftar lengkap.
// 4. Klik saran mengisi kolom.
// 5. Tetap boleh input manual tanpa memilih saran.
// ===============================

(function(){
    const CFG = {
        owner: { inputId: 'in-owner', listId: 'psm-owner-list' },
        driver: { inputId: 'in-driver', listId: 'psm-driver-list' }
    };

    function norm(v) {
        return String(v || '').toUpperCase().trimStart();
    }

    function uniqueSorted(arr) {
        return [...new Set((arr || []).map(norm).map(x => x.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    }

    function getOptions(type) {
        const base = type === 'owner' ? (window.savedOwners || []) : (window.savedDrivers || []);
        const fromDb = (window.db || []).map(x => type === 'owner' ? x.owner : x.driver);
        return uniqueSorted([...base, ...fromDb]);
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
            // Saat mengetik, tampilkan nama yang diawali huruf/teks yang diketik.
            options = options.filter(x => x.startsWith(q));
        }

        // Jika tidak ada yang diawali teks, bantu tampilkan yang mengandung teks supaya data lama tetap mudah dicari.
        if (mode !== 'all' && options.length === 0 && q) {
            options = getOptions(type).filter(x => x.includes(q));
        }

        options = options.slice(0, 80);

        if (options.length === 0) {
            list.innerHTML = `<div class="psm-ac-empty">Tidak ada saran. Boleh isi manual.</div>`;
        } else {
            list.innerHTML = options.map(name => `
                <div class="psm-ac-item" data-type="${type}" data-value="${escapeHtmlLocal(name)}">${escapeHtmlLocal(name)}</div>
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

    document.addEventListener('click', function(e){
        const item = e.target.closest && e.target.closest('.psm-ac-item');
        if (item) {
            e.preventDefault();
            selectName(item.getAttribute('data-type'), item.getAttribute('data-value'));
            return;
        }
        if (!(e.target.closest && e.target.closest('.psm-autocomplete'))) {
            closeAll();
        }
    });

    document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') closeAll();
    });
})();
