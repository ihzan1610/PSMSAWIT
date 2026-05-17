// ===============================
// PSM SAWIT - form.js
// PSM SAWIT FIX: klik baris menampilkan data lengkap, tombol edit tetap ada, tanggal/jam lama tetap muncul dan tersimpan.
// ===============================

function mulaiAplikasi() {
    let lp = localStorage.getItem('psm_lp');
    if(lp) {
        document.getElementById('in-price').value = lp;
        updateTopPrice();
        helperRp(document.getElementById('in-price'), 'hp-price');
    }
    loadDraft();
    updateLists();
    updateToolbar();
    renderLiveTable();
    lockInputs(false);
    syncToCloud();
}

function validateWeights() {
    let e1 = document.getElementById('in-w1'), e2 = document.getElementById('in-w2');
    let t1 = toNumber(e1.value), t2 = toNumber(e2.value);
    e1.classList.remove('input-error', 'input-success');
    e2.classList.remove('input-error', 'input-success');
    if(e1.value || e2.value) {
        if(t1 > 0 && t2 > 0 && t1 <= t2) {
            e1.classList.add('input-error');
            e2.classList.add('input-error');
        } else if(t1 > t2 && t2 > 0) {
            e1.classList.add('input-success');
            e2.classList.add('input-success');
        }
    }
}

function updateTime() {
    if (curIdx === -1) ensureDateTimeInputs();
}

function getLocalDateValue() {
    const n = new Date();
    return new Date(n.getTime() - (n.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function getLocalTimeValue() {
    const n = new Date();
    return n.getHours().toString().padStart(2,'0') + ":" + n.getMinutes().toString().padStart(2,'0');
}

function ensureDateTimeInputs() {
    const dInp = document.getElementById('in-date');
    const tInp = document.getElementById('in-time');
    // Hanya data baru yang otomatis memakai tanggal/jam sekarang.
    // Saat edit data lama, tanggal/jam lama tidak boleh ditimpa otomatis.
    if (curIdx === -1) {
        if (dInp && !dInp.value) dInp.value = getLocalDateValue();
        if (tInp && !tInp.value) tInp.value = getLocalTimeValue();
    }
}

function getEditOriginalRecord() {
    return (curIdx !== -1 && db && db[curIdx]) ? db[curIdx] : null;
}

function resolveFormDateForSave() {
    const el = document.getElementById('in-date');
    const rawInput = el ? String(el.value || '').trim() : '';
    const old = getEditOriginalRecord();

    // 1. Pakai tanggal yang terlihat di form jika ada.
    let result = normalizeDateForInput(rawInput, '');

    // 2. Saat edit, kalau input tanggal kosong karena browser/date picker gagal menampilkan,
    //    pertahankan tanggal lama. Jangan diganti tanggal hari ini.
    if (!result && old && old.date) {
        result = normalizeDateForInput(old.date, String(old.date));
    }

    // 3. Data baru baru boleh pakai tanggal hari ini sebagai fallback.
    if (!result && curIdx === -1) result = getLocalDateValue();

    if (el && result && /^\d{4}-\d{2}-\d{2}$/.test(result)) el.value = result;
    return result;
}

function resolveFormTimeForSave() {
    const el = document.getElementById('in-time');
    const rawInput = el ? String(el.value || '').trim() : '';
    const old = getEditOriginalRecord();

    // 1. Pakai jam yang terlihat di form jika ada.
    let result = normalizeTimeForInput(rawInput, '');

    // 2. Saat edit, kalau input jam kosong, pertahankan jam lama.
    if (!result && old && old.time) {
        result = normalizeTimeForInput(old.time, String(old.time));
    }

    // 3. Data baru baru boleh pakai jam sekarang sebagai fallback.
    if (!result && curIdx === -1) result = getLocalTimeValue();

    if (el && result && /^\d{2}:\d{2}$/.test(result)) el.value = result;
    return result;
}

function hitungTransaksi(w1, w2, p, fl, fj, fp) {
    const n1 = Math.round(toNumber(w1) - toNumber(w2));
    const srt = n1 * 0.03;
    const n2 = n1 - srt;
    const kotor = Math.round(n2 * toNumber(p));
    const tL = Math.round(n1 * toInt(fl));
    const tP = Math.round(n1 * toInt(fp));
    const tJ = Math.round(n2 * toInt(fj));
    const bersih = kotor - (tL + tP + tJ);
    return { n1, srt, n2, kotor, tL, tP, tJ, bersih };
}

function proses() {
    ensureDateTimeInputs();
    let dt = resolveFormDateForSave();
    let tm = resolveFormTimeForSave();
    if (!dt) { beepError(); alert("Isi tanggal!"); return false; }
    if (!tm) { beepError(); alert("Isi jam!"); return false; }

    let w1 = toNumber(document.getElementById('in-w1').value);
    let w2 = toNumber(document.getElementById('in-w2').value);
    let p = toNumber(document.getElementById('in-price').value);

    let fl = toInt(document.getElementById('in-fl').value);
    let fj = toInt(document.getElementById('in-fj').value);
    let fp = toInt(document.getElementById('in-fp').value);

    let own = safeText(document.getElementById('in-owner').value.toUpperCase().trim()).replace(/[;\n\r\t]/g, " ");
    let drv = safeText(document.getElementById('in-driver').value.toUpperCase().trim()).replace(/[;\n\r\t]/g, " ");

    if(w1 <= 0 || w2 <= 0) {
        beepError();
        alert("T1 dan T2 wajib diisi!");
        return false;
    }

    if(w1 <= w2) {
        beepError();
        document.getElementById('input-area').classList.add('shake');
        setTimeout(()=>document.getElementById('input-area').classList.remove('shake'), 300);
        alert("T1 harus > T2!");
        return false;
    }

    if(p <= 0) {
        beepError();
        alert("Harga wajib diisi dan harus lebih dari 0!");
        return false;
    }

    if(p > 5000) {
        beepError();
        if(!confirm(`Harga Rp ${fNum(p)}/kg sepertinya kemahalan! Yakin simpan?`)) return false;
    }

    let hasil = hitungTransaksi(w1, w2, p, fl, fj, fp);
    let baseId = document.getElementById('in-id').value;
    let safeId = baseId ? normalizeId(baseId) : "PSM-" + Date.now().toString() + "-" + Math.floor(Math.random()*10000).toString();
    const oldOrder = curIdx !== -1 && db[curIdx] ? db[curIdx].__order : undefined;

    let data = {
        id: safeId,
        date: dt,
        time: tm,
        owner: own,
        driver: drv,
        w1, w2, price: p, fl, fj, fp,
        ...hasil,
        synced: false
    };
    if (oldOrder !== undefined) data.__order = oldOrder;

    if(curIdx === -1) {
        db.push(data);
        curIdx = db.length - 1;
    } else {
        db[curIdx] = data;
    }

    mem[own] = {l:fl, j:fj, p:fp};
    saveDbToStorage();
    localStorage.setItem('psm_mem_master', JSON.stringify(mem));
    localStorage.setItem('psm_lp', p);
    if(own !== "-" && !savedOwners.includes(own)) { savedOwners.push(own); localStorage.setItem('psm_owners', JSON.stringify(savedOwners)); }
    if(drv !== "-" && !savedDrivers.includes(drv)) { savedDrivers.push(drv); localStorage.setItem('psm_drivers', JSON.stringify(savedDrivers)); }

    beepSuccess();
    localStorage.removeItem('psm_draft');
    updateTopPrice();
    syncToCloud();
    updateLists(); updateToolbar(); renderLiveTable();
    return true;
}

function navMove(dir) {
    beepClick();
    if(db.length === 0) return;
    if(curIdx === -1) { curIdx = (dir === -1) ? db.length - 1 : 0; } else { curIdx += dir; }
    if(curIdx >= 0 && curIdx < db.length) loadForm(db[curIdx]); else resetForm();
    updateToolbar(); renderLiveTable();
}

function resetForm() {
    curIdx = -1;
    isEditMode = false;
    ['in-id','in-owner','in-driver','in-w1','in-w2','in-fl','in-fj','in-fp','in-date','in-time'].forEach(i => {
        const el = document.getElementById(i);
        if (el) el.value = "";
    });
    document.getElementById('in-w1').className='';
    document.getElementById('in-w2').className='';
    updateToolbar(); updateTime(); lockInputs(false); renderLiveTable();
}

function editH(i) {
    beepClick();
    if (!db[i]) return;
    curIdx = i;
    loadForm(db[i]);
    // Klik baris hanya menampilkan data lama lengkap.
    // Tombol ✏️ tetap muncul untuk masuk mode edit.
    isEditMode = false;
    updateToolbar();
    renderLiveTable();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function loadForm(d) {
    if (!d) return;
    document.getElementById('in-id').value = d.id || '';
    document.getElementById('in-owner').value = d.owner || '';
    document.getElementById('in-driver').value = d.driver || '';
    document.getElementById('in-w1').value = d.w1 || '';
    document.getElementById('in-w2').value = d.w2 || '';
    // Saat edit data, tanggal dan jam lama wajib tetap muncul.
    // Jangan pakai tanggal/jam sekarang sebagai fallback untuk data lama, karena itu bisa mengubah data tanpa sengaja.
    const dateInput = document.getElementById('in-date');
    const timeInput = document.getElementById('in-time');
    const oldDate = normalizeDateForInput(d.date, '');
    const oldTime = normalizeTimeForInput(d.time, '');
    if (dateInput) {
        dateInput.value = oldDate;
        dateInput.dataset.oldValue = d.date || '';
    }
    if (timeInput) {
        timeInput.value = oldTime;
        timeInput.dataset.oldValue = d.time || '';
    }
    document.getElementById('in-price').value = d.price || '';
    document.getElementById('in-fl').value = d.fl || '';
    document.getElementById('in-fj').value = d.fj || '';
    document.getElementById('in-fp').value = d.fp || '';
    helperRp(document.getElementById('in-price'), 'hp-price');
    updateTopPrice();
}
