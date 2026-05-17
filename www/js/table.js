// ===============================
// PSM SAWIT - table.js
// Versi FIX MONITORING: cloud dekat nomor, ongkos terlihat, urutan edit tidak berubah.
// ===============================

function updateLists() {
    let o = new Set(savedOwners), d = new Set(savedDrivers);
    db.forEach(x => { if(x.owner) o.add(x.owner); if(x.driver) d.add(x.driver); });
    savedOwners = [...o].filter(Boolean).map(x => String(x).toUpperCase().trim()).filter(Boolean).sort();
    savedDrivers = [...d].filter(Boolean).map(x => String(x).toUpperCase().trim()).filter(Boolean).sort();
    localStorage.setItem('psm_owners', JSON.stringify(savedOwners));
    localStorage.setItem('psm_drivers', JSON.stringify(savedDrivers));
    if (typeof closeAllPsmNameLists === 'function') closeAllPsmNameLists();
}

function fillTarif() {
    if (curIdx !== -1) return;
    let n = document.getElementById('in-owner').value.toUpperCase().trim();
    if(mem[n]) {
        document.getElementById('in-fl').value = mem[n].l || 0;
        document.getElementById('in-fj').value = mem[n].j || 0;
        document.getElementById('in-fp').value = mem[n].p || 0;
    }
}

function clearSelection() {
    selectedIds.clear();
    const all = document.getElementById('chk-all');
    if (all) all.checked = false;
    document.querySelectorAll('.row-chk').forEach(cb => cb.checked = false);
}

function toggleRow(id, cb) {
    beepClick();
    const safeId = normalizeId(id);
    if(cb && cb.checked) selectedIds.add(safeId); else selectedIds.delete(safeId);
    const all = document.getElementById('chk-all');
    if(cb && !cb.checked && all) all.checked = false;
}

function toggleAll(cb) {
    beepClick();
    let checkboxes = document.querySelectorAll('.row-chk');
    checkboxes.forEach(c => {
        c.checked = cb.checked;
        const safeId = normalizeId(c.value);
        if(cb.checked) selectedIds.add(safeId);
        else selectedIds.delete(safeId);
    });
}

function debounceSearch(cb) {
    clearTimeout(window.tSearch);
    window.tSearch = setTimeout(cb, 300);
}

function renderLiveTable() {
    let n = document.getElementById('f-name').value.toUpperCase().trim(),
        d = document.getElementById('f-driver').value.toUpperCase().trim();
    let s = document.getElementById('f-start').value, e = document.getElementById('f-end').value;
    let filtered = db.filter(x =>
        (!n || (x.owner && x.owner.includes(n))) &&
        (!d || (x.driver && x.driver.includes(d))) &&
        (!s || x.date >= s) &&
        (!e || x.date <= e)
    );
    // Jangan sort berdasarkan tanggal/jam.
    // Nomor dan posisi baris harus mengikuti urutan input asli agar cocok dengan buku manual.
    // Saat data diedit dan tanggal/jam berubah, posisi data tetap tidak pindah.
    let isFiltered = n || d || s || e;
    let displayData = isFiltered ? filtered : filtered.slice(-150);

    let body = '';
    const all = document.getElementById('chk-all');
    if (all) all.checked = false;

    displayData.slice().reverse().forEach((x) => {
        let idx = db.findIndex(orig => normalizeId(orig.id) === normalizeId(x.id));
        let id = normalizeId(x.id);
        let isChecked = selectedIds.has(id) ? 'checked' : '';
        let awan = x.synced ? '✅' : '☁️';
        body += `<tr class="${idx === curIdx ? 'active-row' : ''}">
            <td align="center"><input type="checkbox" class="row-chk" value="${escapeHtml(id)}" ${isChecked} onchange="toggleRow(this.value, this)"></td>
            <td align="center" onclick="editH(${idx})">${idx + 1}</td>
            <td align="center" title="Status cloud" onclick="editH(${idx})">${awan}</td>
            <td align="center" onclick="editH(${idx})">${fTgl(x.date)}</td>
            <td onclick="editH(${idx})"><b>${escapeHtml(x.owner)}</b></td>
            <td onclick="editH(${idx})">${escapeHtml(x.driver)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.w1)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.w2)}</td>
            <td align="right" onclick="editH(${idx})">${Math.round(x.n1)}</td>
            <td align="right" style="color:#2563eb; font-weight:bold" onclick="editH(${idx})"><b>${(x.n2||0).toFixed(2)}</b></td>
            <td align="right" onclick="editH(${idx})">${fNum(x.price)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.kotor)}</td>
            <td align="right" style="font-weight:bold; color:#059669" onclick="editH(${idx})">${fNum(x.bersih)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.fl || 0)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.fj || 0)}</td>
            <td align="right" onclick="editH(${idx})">${fNum(x.fp || 0)}</td>
        </tr>`;
    });
    document.getElementById('live-body').innerHTML = body || '<tr><td colspan="16" align="center">Kosong</td></tr>';
}
