// ===============================
// PSM SAWIT - table.js
// Versi 8: tabel aman untuk ID angka/string, HTML, dan pilihan data.
// ===============================

function updateLists() {
    let o = new Set(savedOwners), d = new Set(savedDrivers);
    db.forEach(x => { if(x.owner) o.add(x.owner); if(x.driver) d.add(x.driver); });
    document.getElementById('l-own').innerHTML = [...o].map(x => `<option value="${escapeHtml(x)}">`).join('');
    document.getElementById('l-dri').innerHTML = [...d].map(x => `<option value="${escapeHtml(x)}">`).join('');
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
    filtered.sort((a, b) => new Date(a.date + 'T' + (a.time||'00:00')) - new Date(b.date + 'T' + (b.time||'00:00')));

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
            <td align="center">${awan}</td>
        </tr>`;
    });
    document.getElementById('live-body').innerHTML = body || '<tr><td colspan="13" align="center">Kosong</td></tr>';
}
