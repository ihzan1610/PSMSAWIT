// ===============================
// PSM SAWIT - app.js
// V20: startup dengan backup harian APK-safe ke folder utama PSM SAWIT.
// ===============================

async function jalankanBackupHarianJikaPerlu() {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const lastOpen = localStorage.getItem('psm_last_open');

    if(lastOpen && lastOpen !== todayStr && db.length > 0) {
        const ok = await exportCSV(true);
        if (ok) {
            localStorage.setItem('psm_last_open', todayStr);
            localStorage.removeItem('psm_auto_backup_pending');
        } else {
            // Jangan tandai berhasil kalau file belum tersimpan. Biar dicoba lagi saat aplikasi dibuka berikutnya.
            localStorage.setItem('psm_auto_backup_pending', todayStr);
            console.warn('AutoBackup harian gagal dibuat. Akan dicoba lagi pada pembukaan aplikasi berikutnya.');
        }
        return;
    }

    if (!lastOpen) localStorage.setItem('psm_last_open', todayStr);
}

window.onload = async () => {
    try {
        if (typeof initStorageLayer === 'function') {
            const ok = await initStorageLayer();
            console.log(ok ? 'IndexedDB aktif' : 'IndexedDB fallback localStorage');
        }
    } catch (err) {
        console.warn('Gagal inisialisasi storage layer:', err);
    }

    await jalankanBackupHarianJikaPerlu();

    if(localStorage.getItem('psm_theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    const settingSuara = document.getElementById('setting-suara');
    if (settingSuara) settingSuara.checked = isSoundOn();

    if(location.hash) {
        history.replaceState(null, null, ' ');
    }

    if(sessionStorage.getItem('psm_unlocked') === 'true') {
        mulaiAplikasi();
    } else {
        document.getElementById('lock-screen').style.display = 'flex';
    }
};
