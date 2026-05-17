// ===============================
// PSM SAWIT - settings-format.js
// V28: Format nota final dengan header nota lebar + logo thermal hitam putih.
// ===============================

const PSM_NOTA_SETTINGS_KEY = 'psm_nota_format_settings_v23';
const PSM_OLD_NOTA_SETTINGS_KEY = 'psm_nota_format_settings_v21';

const DEFAULT_NOTA_SETTINGS = {
    operatorName: 'Asri',
    logoDataUrl: '',
    showLogoImage: true,
    showLogoThermalBitmap: true
};

function migrateOldNotaSettings() {
    try {
        if (localStorage.getItem(PSM_NOTA_SETTINGS_KEY)) return;
        const oldRaw = localStorage.getItem(PSM_OLD_NOTA_SETTINGS_KEY);
        if (!oldRaw) return;
        const old = JSON.parse(oldRaw);
        const migrated = Object.assign({}, DEFAULT_NOTA_SETTINGS, {
            operatorName: old.operatorName || 'Asri',
            logoDataUrl: old.logoDataUrl || '',
            showLogoImage: old.showLogoImage !== false,
            showLogoThermalBitmap: true
        });
        localStorage.setItem(PSM_NOTA_SETTINGS_KEY, JSON.stringify(migrated));
    } catch (err) {
        console.warn('Migrasi setting nota lama gagal:', err);
    }
}

function loadNotaSettings() {
    migrateOldNotaSettings();
    try {
        const raw = localStorage.getItem(PSM_NOTA_SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return Object.assign({}, DEFAULT_NOTA_SETTINGS, parsed && typeof parsed === 'object' ? parsed : {});
    } catch (err) {
        console.warn('Gagal membaca pengaturan nota:', err);
        return Object.assign({}, DEFAULT_NOTA_SETTINGS);
    }
}

function saveNotaSettings(settings) {
    const clean = Object.assign({}, DEFAULT_NOTA_SETTINGS, settings || {});
    clean.operatorName = safeText(clean.operatorName, 'Asri').trim() || 'Asri';
    clean.showLogoImage = !!clean.showLogoImage;
    clean.showLogoThermalBitmap = !!clean.showLogoThermalBitmap;
    clean.logoDataUrl = typeof clean.logoDataUrl === 'string' ? clean.logoDataUrl : '';
    try {
        localStorage.setItem(PSM_NOTA_SETTINGS_KEY, JSON.stringify(clean));
        return clean;
    } catch (err) {
        console.warn('Gagal menyimpan pengaturan nota:', err);
        alert('Gagal menyimpan pengaturan nota: ' + err.message);
        return clean;
    }
}

function getNotaOperatorName() {
    return safeText(loadNotaSettings().operatorName, 'Asri').trim() || 'Asri';
}

function getNotaLogoSrc() {
    const s = loadNotaSettings();
    return s.logoDataUrl || 'assets/icons/header-nota-default.png';
}

function isNotaLogoImageEnabled() {
    return !!loadNotaSettings().showLogoImage;
}

function isThermalLogoBitmapEnabled() {
    return !!loadNotaSettings().showLogoThermalBitmap;
}

function renderNotaLogoHtml(size = 46) {
    if (!isNotaLogoImageEnabled()) return '';
    const src = getNotaLogoSrc();
    const maxHeight = Math.max(30, Number(size) || 46);
    const maxWidth = Math.round(maxHeight * 5.6);
    return `<div style="text-align:center; margin-bottom:8px;"><img src="${escapeHtml(src)}" alt="Header PSM Sawit" style="display:inline-block; width:auto; height:auto; max-width:${maxWidth}px; max-height:${maxHeight}px; object-fit:contain;"></div>`;
}

// V23: operator hanya dicetak di THERMAL. Nota gambar tidak menampilkan tanda tangan/operator.
function renderNotaOperatorHtml(spacerBr = 6) {
    return '';
}

function buildThermalOperatorBlock(blankLines = 5) {
    const lines = '\n'.repeat(Math.max(1, blankLines));
    return `\x1B\x61\x01Ditimbang oleh :${lines}${safeText(getNotaOperatorName())}\n\x1B\x61\x00\n\n\n`;
}

// V23: logo thermal bukan teks. Logo bitmap dipasang pada proses printT(), bukan di string thermal.
function buildThermalLogoHeader() {
    return '';
}

function refreshNotaSettingsUI() {
    const s = loadNotaSettings();
    const op = document.getElementById('nota-operator-name');
    const img = document.getElementById('nota-logo-preview');
    const showLogo = document.getElementById('nota-show-logo');
    const thermalLogo = document.getElementById('nota-thermal-logo-bitmap-enabled');

    if (op) op.value = s.operatorName || 'Asri';
    if (img) img.src = s.logoDataUrl || 'assets/icons/header-nota-default.png';
    if (showLogo) showLogo.checked = !!s.showLogoImage;
    if (thermalLogo) thermalLogo.checked = !!s.showLogoThermalBitmap;
}

function saveNotaSettingsFromUI() {
    beepClick();
    const current = loadNotaSettings();
    const next = Object.assign({}, current, {
        operatorName: (document.getElementById('nota-operator-name')?.value || 'Asri').trim() || 'Asri',
        showLogoImage: !!document.getElementById('nota-show-logo')?.checked,
        showLogoThermalBitmap: !!document.getElementById('nota-thermal-logo-bitmap-enabled')?.checked
    });
    saveNotaSettings(next);
    refreshNotaSettingsUI();
    beepSuccess();
    alert('Format nota berhasil disimpan.');
}

function resetNotaLogoDefault() {
    beepClick();
    if (!confirm('Kembalikan logo nota ke logo default PSM Sawit?')) return;
    const s = loadNotaSettings();
    s.logoDataUrl = '';
    saveNotaSettings(s);
    const input = document.getElementById('nota-logo-input');
    if (input) input.value = '';
    refreshNotaSettingsUI();
}

function pilihLogoNota(evt) {
    const file = evt && evt.target && evt.target.files ? evt.target.files[0] : null;
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
        beepError();
        alert('File harus berupa gambar PNG/JPG.');
        return;
    }
    if (file.size > 700 * 1024) {
        beepError();
        alert('Ukuran logo terlalu besar. Pakai gambar di bawah 700 KB agar aplikasi tetap ringan.');
        evt.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const s = loadNotaSettings();
        s.logoDataUrl = String(e.target.result || '');
        s.showLogoImage = true;
        saveNotaSettings(s);
        refreshNotaSettingsUI();
        beepSuccess();
        alert('Logo nota berhasil diganti.');
    };
    reader.onerror = function() {
        beepError();
        alert('Gagal membaca file logo.');
    };
    reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', refreshNotaSettingsUI);
