// ===============================
// PSM SAWIT - ui.js
// PSM SAWIT FIX: settings submenu terkunci + toolbar stabil.
// ===============================

    window.addEventListener('hashchange', () => {
        if (!location.hash || location.hash === "") {
            document.getElementById('settings-modal').style.display = 'none';
            const advancedSettingsPanel = document.getElementById('advanced-settings-panel');
            if (advancedSettingsPanel) advancedSettingsPanel.style.display = 'none';
            document.getElementById('preview-modal').style.display = 'none';
            clearSelection(); 
            renderLiveTable();
        }
    });

    function openSettings() { 
        beepClick();
        const advanced = document.getElementById('advanced-settings-panel');
        if (advanced) advanced.style.display = 'none';
        if (typeof refreshNotaSettingsUI === 'function') refreshNotaSettingsUI();
        const settingSuara = document.getElementById('setting-suara');
        if (settingSuara && typeof isSoundOn === 'function') settingSuara.checked = isSoundOn();
        document.getElementById('settings-modal').style.display = 'block'; 
        location.hash = 'settings'; 
    }

    function openAdvancedSettings() {
        beepClick();
        const p = prompt('Masukkan PIN untuk membuka Menu Setelan:');
        if (p === null) return;
        if (p !== getPin()) {
            beepError();
            alert('PIN salah. Menu setelan tidak dibuka.');
            return;
        }
        const advanced = document.getElementById('advanced-settings-panel');
        if (advanced) advanced.style.display = 'block';
        if (typeof refreshNotaSettingsUI === 'function') refreshNotaSettingsUI();
        const settingSuara = document.getElementById('setting-suara');
        if (settingSuara && typeof isSoundOn === 'function') settingSuara.checked = isSoundOn();
        beepSuccess();
    }

    function closeAdvancedSettings() {
        beepClick();
        const advanced = document.getElementById('advanced-settings-panel');
        if (advanced) advanced.style.display = 'none';
    }

    function closeSettings() { 
        beepClick();
        const advanced = document.getElementById('advanced-settings-panel');
        if (advanced) advanced.style.display = 'none';
        if (location.hash === '#settings') { history.back(); } 
        else { document.getElementById('settings-modal').style.display = 'none'; }
    }
    
    function closeReview() {
        beepClick();
        if (location.hash === '#review') { history.back(); } 
        else { document.getElementById('preview-modal').style.display = 'none'; }
    }

    function toggleDark() { 
        beepClick();
        document.body.classList.toggle('dark-mode'); 
        localStorage.setItem('psm_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    function updateTopPrice() {
        let p = parseFloat(document.getElementById('in-price').value) || 0;
        document.getElementById('top-price').innerText = fRp(p);
    }

    function lockInputs(l) {
        document.querySelectorAll('#input-area input:not([type="hidden"])').forEach(i => i.readOnly = l);
    }

    function setMainButton(label, color) {
        const bm = document.getElementById('btn-main');
        if (!bm) return;
        bm.innerHTML = label;
        bm.style.background = color;
    }

    function toggleEdit() {
        beepClick();
        if (curIdx === -1) return;
        isEditMode = !isEditMode;
        updateToolbar();
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    function updateToolbar() {
        let b = document.getElementById('status-badge'), bl = document.getElementById('btn-lock');
        document.getElementById('v-prev').disabled = (db.length === 0 || curIdx === 0);
        document.getElementById('v-next').disabled = (curIdx === -1 || curIdx === db.length - 1);
        
        if(curIdx === -1) {
            isEditMode = false;
            b.innerText = `Data Baru #${db.length + 1}`; b.className = "status-badge badge-new";
            bl.style.display = "none";
            lockInputs(false);
            setMainButton("➕", "#10b981");
            validateWeights();
        } else if (isEditMode) {
            b.innerText = `Edit Data #${curIdx + 1}`; b.className = "status-badge badge-new";
            bl.style.display = "flex";
            bl.innerText = "👁️";
            bl.title = "Batal edit / lihat saja";
            bl.style.background = "#64748b";
            document.querySelectorAll('#input-area input:not([type="hidden"])').forEach(i => i.readOnly = false);
            setMainButton("💾", "#059669");
            document.getElementById('in-w1').className = ''; document.getElementById('in-w2').className = '';
            validateWeights();
        } else {
            b.innerText = `Melihat Data #${curIdx + 1}`; b.className = "status-badge badge-saved";
            bl.style.display = "flex";
            bl.innerText = "✏️";
            bl.title = "Edit data ini";
            bl.style.background = "#f59e0b";
            document.querySelectorAll('#input-area input:not([type="hidden"])').forEach(i => i.readOnly = true);
            setMainButton("🆕", "#3b82f6");
            document.getElementById('in-w1').className = ''; document.getElementById('in-w2').className = '';
        }
    }

    function actionMain() {
        if (curIdx === -1) {
            if(proses()) resetForm();
        } else if (isEditMode) {
            if (proses()) {
                isEditMode = false;
                updateToolbar();
                renderLiveTable();
                beepSuccess();
                alert('Perubahan data berhasil disimpan.');
            }
        } else {
            beepClick();
            resetForm();
        }
    }
