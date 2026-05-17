// ===============================
// PSM SAWIT - backup.js
// V20: backup CSV aman untuk APK Android + folder utama Download/PSM SAWIT.
// - Browser/PWA: tetap memakai download CSV biasa.
// - APK/Capacitor: simpan CSV lewat native bridge ke Download/PSM SAWIT/Backup.
// - Jika native APK belum aktif, backup harian tetap tersimpan di dalam aplikasi.
// ===============================

const PSM_BACKUP_VAULT_KEY = 'psm_backup_harian_v17';
const PSM_BACKUP_VAULT_LIMIT = 40;

function hapusData() {
    beepClick();
    if(curIdx !== -1) {
        if(confirm("Hapus data yang sedang dilihat ini?")) {
            const deletedId = db[curIdx] && db[curIdx].id;
            if (deletedId) markDeletedForCloud(deletedId);
            db.splice(curIdx, 1);
            saveDbToStorage();
            syncToCloud();
            resetForm();
        }
        return;
    }

    const domIds = (typeof getCheckedIdsFromDom === 'function') ? getCheckedIdsFromDom() : [];
    const ids = [...new Set([...(selectedIds || []), ...domIds].map(normalizeId).filter(Boolean))];

    if(ids.length > 0) {
        if(confirm(`Hapus ${ids.length} data terpilih?`)) {
            markDeletedForCloud(ids);
            const idSet = new Set(ids);
            db = db.filter(x => !idSet.has(normalizeId(x.id)));
            selectedIds.clear();
            saveDbToStorage();
            syncToCloud();
            resetForm();
        }
    } else { beepError(); alert("Pilih data dulu!"); }
}

function buildCSV(targetDb) {
    let h = "ID;Tgl;Jam;Own;Dri;T1;T2;P;L;J;Pn\n";
    return h + (targetDb || []).map(d => [d.id,d.date,d.time,d.owner,d.driver,d.w1,d.w2,d.price,d.fl,d.fj,d.fp].join(";")).join("\n");
}

function buildBackupFilename(prefix) {
    let now = new Date();
    let tgl = now.getDate().toString().padStart(2,'0') + "-" + (now.getMonth()+1).toString().padStart(2,'0') + "-" + now.getFullYear();
    let jam = now.getHours().toString().padStart(2,'0') + "." + now.getMinutes().toString().padStart(2,'0') + "." + now.getSeconds().toString().padStart(2,'0');
    return `${prefix}_PSM_${tgl}_Jam_${jam}.csv`;
}

function downloadCsvBrowser(csvText, filename) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (_) {}
        try { a.remove(); } catch (_) {}
    }, 1000);
    return true;
}

function loadBackupVault() {
    try {
        const raw = localStorage.getItem(PSM_BACKUP_VAULT_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(x => x && x.filename && x.csv) : [];
    } catch (err) {
        console.warn('Gagal membaca brankas backup:', err);
        return [];
    }
}

function saveBackupVault(list) {
    try {
        const clean = (Array.isArray(list) ? list : []).slice(0, PSM_BACKUP_VAULT_LIMIT);
        localStorage.setItem(PSM_BACKUP_VAULT_KEY, JSON.stringify(clean));
        return true;
    } catch (err) {
        console.warn('Gagal menyimpan brankas backup:', err);
        return false;
    }
}

function simpanBackupInternal(csvText, filename, type) {
    try {
        const item = {
            filename,
            csv: String(csvText || ''),
            type: type || 'manual',
            rows: Math.max(0, String(csvText || '').split(/\r?\n/).filter(Boolean).length - 1),
            createdAt: new Date().toISOString()
        };
        const old = loadBackupVault().filter(x => x.filename !== filename);
        old.unshift(item);
        return saveBackupVault(old);
    } catch (err) {
        console.warn('Backup internal gagal:', err);
        return false;
    }
}

function formatBackupTime(iso) {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '-';
        const dd = d.getDate().toString().padStart(2,'0');
        const mm = (d.getMonth()+1).toString().padStart(2,'0');
        const yy = d.getFullYear();
        const hh = d.getHours().toString().padStart(2,'0');
        const mi = d.getMinutes().toString().padStart(2,'0');
        return `${dd}-${mm}-${yy} ${hh}:${mi}`;
    } catch (_) {
        return '-';
    }
}

async function saveCsvFile(csvText, filename, options = {}) {
    const isAuto = !!options.isAuto;
    const isNative = !!(window.NativeBridge && typeof window.NativeBridge.isNativeApp === 'function' && window.NativeBridge.isNativeApp());

    if (window.NativeBridge && typeof window.NativeBridge.saveCsv === 'function') {
        try {
            const ok = await window.NativeBridge.saveCsv(csvText, filename, { silent: isAuto });
            if (ok) return 'native';
        } catch (err) {
            console.warn('Native CSV saver gagal:', err);
        }
    }

    // Di browser/PWA tetap gunakan download biasa.
    // Di APK native, fallback download biasa sering tidak benar-benar tersimpan, jadi jangan diberi pesan sukses palsu.
    if (!isNative) {
        try {
            downloadCsvBrowser(csvText, filename);
            if (!isAuto) alert(`✅ Backup CSV dibuat. Cek folder Download.\n\nFolder tujuan: Download/PSM SAWIT/Backup\nNama file: ${filename}`);
            return 'browser';
        } catch (err) {
            console.error('Download CSV gagal:', err);
            if (!isAuto) alert('❌ Backup gagal dibuat: ' + (err && err.message ? err.message : err));
            return false;
        }
    }

    if (!isAuto) {
        alert('Backup CSV belum berhasil tersimpan ke folder Download.\n\nData backup tetap aman karena sudah disimpan di dalam aplikasi.\nDetail: Native CsvSaver belum aktif. Install APK V40 hasil build Actions terbaru dan hapus APK lama sebelum install.');
    }
    return 'internal-only';
}

async function exportCSV(isAuto = false) {
    if (!isAuto) beepClick();
    if (!db || db.length === 0) {
        if (!isAuto) { beepError(); alert('Data masih kosong.'); }
        return false;
    }

    const prefix = isAuto ? "AutoBackup" : "Backup";
    const filename = buildBackupFilename(prefix);
    const csvText = buildCSV(db);

    // V20: simpan dulu ke brankas internal agar tetap ada walaupun APK belum punya native saver.
    const internalOk = simpanBackupInternal(csvText, filename, isAuto ? 'auto' : 'manual');
    const externalOk = await saveCsvFile(csvText, filename, { isAuto });

    const ok = !!(externalOk || internalOk);
    if (ok) {
        if (!isAuto) {
            beepSuccess();
            if (externalOk === 'internal-only' && internalOk) {
                alert('✅ Backup aman di dalam aplikasi.\n\nFile belum tersimpan langsung ke folder Download. Jika masih terjadi setelah install APK terbaru, gunakan tombol 📦 LIHAT BACKUP HARIAN untuk ekspor ulang file CSV.');
            } else if (!externalOk && internalOk) {
                alert('✅ Backup tersimpan di dalam aplikasi.\n\nTekan 📦 LIHAT BACKUP HARIAN untuk mengekspor ulang file CSV.');
            }
        }
        return ok;
    }

    if (!isAuto) beepError();
    return ok;
}

async function exportCSVFilter() {
    beepClick();
    let nFilter = document.getElementById('f-name').value.toUpperCase().trim(), s = document.getElementById('f-start').value, e = document.getElementById('f-end').value;
    let filtered = db.filter(x => (!nFilter || (x.owner && x.owner.includes(nFilter))) && (!s || x.date >= s) && (!e || x.date <= e));
    if(filtered.length === 0) { beepError(); return alert("Data filter kosong!"); }

    const safeName = (nFilter || 'Semua').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `Laporan_Filter_${safeName}.csv`;
    const csvText = buildCSV(filtered);
    simpanBackupInternal(csvText, filename, 'filter');
    const ok = await saveCsvFile(csvText, filename, { isAuto: false });
    if (ok) beepSuccess(); else beepError();
}

async function lihatBackupHarian() {
    beepClick();
    const list = loadBackupVault();
    if (!list.length) {
        beepError();
        return alert('Belum ada backup harian di dalam aplikasi. Backup otomatis dibuat saat aplikasi dibuka di hari baru dan data tidak kosong.');
    }

    const lines = list.slice(0, 20).map((x, i) => {
        const label = x.type === 'auto' ? 'AUTO' : (x.type === 'filter' ? 'FILTER' : 'MANUAL');
        return `${i + 1}. ${label} | ${formatBackupTime(x.createdAt)} | ${x.rows || 0} data\n   ${x.filename}`;
    }).join('\n\n');

    const pilih = prompt('BACKUP TERSIMPAN DI APLIKASI\n\nKetik nomor backup yang mau diekspor/download ulang:\n\n' + lines, '1');
    if (pilih === null) return;

    const idx = parseInt(pilih, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= list.length) {
        beepError();
        return alert('Nomor backup tidak valid.');
    }

    const item = list[idx];
    const ok = await saveCsvFile(item.csv, item.filename, { isAuto: false });
    if (ok) beepSuccess(); else beepError();
}

function importCSV() {
    beepClick();
    const fileInput = document.getElementById('file-restore');
    const f = fileInput.files[0];

    if(!f) { beepError(); return alert("Pilih file CSV terlebih dahulu melalui kotak bergaris putus-putus di atas!"); }
    if (!f.name.toLowerCase().endsWith('.csv')) { beepError(); return alert("❌ Format file salah! Harus file .csv"); }

    let r = new FileReader();
    r.onload = (e) => {
        try {
            let rows = e.target.result.split(/\r?\n/);
            let newDb = [];
            if(!rows[0].includes("ID;Tgl;Jam;Own")) { beepError(); return alert("❌ Gagal! Format isi CSV tidak sesuai dengan standar PSM Sawit."); }

            for(let i=1; i<rows.length; i++) {
                if (rows[i].trim() === "") continue;
                let c = rows[i].split(";");
                if(c.length < 11) continue;

                let w1=parseFloat(c[5])||0, w2=parseFloat(c[6])||0, p=parseFloat(c[7])||0, fl=parseFloat(c[8])||0, fj=parseFloat(c[9])||0, fp=parseFloat(c[10])||0, n1=w1-w2, srt=n1*0.03, n2=n1-srt, k=Math.round(n2*p);
                newDb.push({ id: normalizeId(c[0]) || ('PSM-RESTORE-' + Date.now() + '-' + i), date:c[1], time:c[2], owner:safeText(c[3]), driver:safeText(c[4]), w1, w2, price:p, fl, fj, fp, n1, srt, n2, kotor:k, tL:Math.round(n1*fl), tJ:Math.round(n2*fj), tP:Math.round(n1*fp), bersih: k-(Math.round(n1*fl)+Math.round(n2*fj)+Math.round(n1*fp)), synced: false, __order: i-1 });
            }

            if(newDb.length === 0) throw new Error("File kosong atau data tidak valid.");
            if(confirm(`Yakin mau restore ${newDb.length} data? Data di HP saat ini akan tertimpa!`)) {
                const newIds = new Set(newDb.map(x => normalizeId(x.id)));
                const oldIdsToDelete = db.filter(x => x && x.id && !newIds.has(normalizeId(x.id))).map(x => x.id);
                if (oldIdsToDelete.length > 0) markDeletedForCloud(oldIdsToDelete);
                db = newDb; saveDbToStorage(); syncToCloud(); alert("✅ Restore Berhasil! Aplikasi akan memuat ulang."); location.reload();
            }
        } catch (err) { beepError(); alert("❌ Terjadi kesalahan saat membaca file: " + err.message); }
    };
    r.readAsText(f);
}

async function tutupBuku() {
    beepClick();
    if(db.length === 0) { beepError(); return alert("Data masih kosong."); }
    let pass = prompt("PERINGATAN!\nSemua data akan dihapus permanen dari HP dan dikirim sebagai hapus ke Cloud.\n\nSistem akan menyimpan Backup otomatis terlebih dahulu.\n\nKetik kata sandi: BONGKAR");
    if(pass === "BONGKAR") {
        const backupOk = await exportCSV(true);
        if (!backupOk) {
            beepError();
            return alert('❌ Tutup buku dibatalkan karena backup CSV belum berhasil dibuat. Coba tekan BACKUP SEMUA dulu, lalu ulangi tutup buku.');
        }
        setTimeout(() => {
            markDeletedForCloud(db.map(x => x.id));
            db = [];
            saveDbToStorage();
            syncToCloud();
            closeSettings();
            resetForm();
            beepSuccess();
            alert("✅ TUTUP BUKU SUKSES! Data masuk antrean hapus cloud.\n\nBackup CSV sudah disimpan. Jika file tidak muncul di Download/PSM SAWIT/Backup, buka Pengaturan > 📦 LIHAT BACKUP HARIAN.");
        }, 500);
    } else if(pass !== null) { beepError(); alert("❌ Kata sandi salah."); }
}
