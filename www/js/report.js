// ===============================
// PSM SAWIT - report.js
// Versi 19: potongan tambahan multi-baris untuk rekapan + gambar tanpa tanda tangan.
// ===============================

const PSM_EXTRA_DEDUCTION_GROUPS_KEY = 'psm_extra_deduction_groups_v20';

function loadExtraDeductionGroupMap() {
    try {
        const raw = localStorage.getItem(PSM_EXTRA_DEDUCTION_GROUPS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        console.warn('Gagal membaca potongan tambahan:', err);
        return {};
    }
}

function saveExtraDeductionGroupMap(map) {
    try {
        localStorage.setItem(PSM_EXTRA_DEDUCTION_GROUPS_KEY, JSON.stringify(map || {}));
        return true;
    } catch (err) {
        console.warn('Gagal menyimpan potongan tambahan:', err);
        return false;
    }
}

function buildReportSelectionKey(list) {
    const ids = (Array.isArray(list) ? list : [])
        .map(x => normalizeId(x && x.id))
        .filter(Boolean)
        .sort();

    if (!ids.length) return 'RPT_EMPTY';

    const raw = ids.join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `RPT_${Math.abs(hash).toString(36)}_${ids.length}`;
}

function loadExtraDeductionsForKey(key) {
    if (!key) return [];
    const map = loadExtraDeductionGroupMap();
    return normalizeExtraDeductionRows(map[key] || []);
}

function saveExtraDeductionsForKey(key, rows) {
    if (!key) return [];
    const map = loadExtraDeductionGroupMap();
    const clean = normalizeExtraDeductionRows(rows);
    if (clean.length > 0) map[key] = clean;
    else delete map[key];
    saveExtraDeductionGroupMap(map);
    return clean;
}

function renderThermalPreviewExtraRows(rows) {
    return normalizeExtraDeductionRows(rows).map(item =>
        `<tr><td>${escapeHtml(item.name)}</td><td>:</td><td align="right">-Rp ${fNum(item.amount)}</td></tr>`
    ).join('');
}

function getCurrentExtraDeductions() {
    return normalizeExtraDeductionRows(lastData && lastData.extraCuts);
}

function addExtraDeductionEditorRow(item = {}) {
    const list = document.getElementById('extra-deduction-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'extra-deduction-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1.5fr 1fr auto';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';

    row.innerHTML = `
        <input type="text" class="extra-name" placeholder="Contoh: POTONGAN RACUN" value="${escapeHtml(item.name || '')}" oninput="this.value=this.value.toUpperCase().trimStart()">
        <input type="number" class="extra-amount" placeholder="Nominal" value="${item.amount ? escapeHtml(String(item.amount)) : ''}">
        <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:0 12px; font-weight:bold;">✕</button>
    `;

    list.appendChild(row);
}

function collectExtraDeductionRowsFromEditor() {
    return Array.from(document.querySelectorAll('#extra-deduction-list .extra-deduction-row')).map((row, idx) => ({
        name: (row.querySelector('.extra-name')?.value || '').toUpperCase().trim(),
        amount: toInt(row.querySelector('.extra-amount')?.value, 0),
        order: idx
    }));
}

function renderExtraDeductionEditor() {
    const host = document.getElementById('extra-deduction-host');
    if (!host) return;

    if (!lastData || !lastData.allowExtraDeductions) {
        host.innerHTML = '';
        return;
    }

    host.innerHTML = `
        <div style="margin-top:12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">
                <div>
                    <div style="font-weight:bold; color:#0f172a;">🧾 POTONGAN TAMBAHAN REKAPAN</div>
                    <div style="font-size:11px; color:#64748b;">Isi setelah rekapan dipilih. Potongan ini akan tampil di GAMBAR, THERMAL, dan Teks WA rincian.</div>
                </div>
                <button type="button" onclick="addExtraDeductionEditorRow()" style="background:#0ea5e9; color:white; border:none; border-radius:8px; padding:8px 10px; font-weight:bold; white-space:nowrap;">＋ BARIS</button>
            </div>
            <div id="extra-deduction-list"></div>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="button" onclick="saveExtraDeductionsFromEditor()" style="flex:1; background:#10b981; color:white; border:none; border-radius:8px; padding:10px; font-weight:bold;">SIMPAN POTONGAN</button>
                <button type="button" onclick="clearExtraDeductionsFromEditor()" style="flex:1; background:#ef4444; color:white; border:none; border-radius:8px; padding:10px; font-weight:bold;">HAPUS SEMUA</button>
            </div>
        </div>
    `;

    const rows = getCurrentExtraDeductions();
    if (rows.length > 0) rows.forEach(item => addExtraDeductionEditorRow(item));
    else addExtraDeductionEditorRow();
}

function saveExtraDeductionsFromEditor() {
    beepClick();
    if (!lastData || !lastData.reportKey) return;
    const rows = collectExtraDeductionRowsFromEditor();
    const clean = saveExtraDeductionsForKey(lastData.reportKey, rows);
    lastData.extraCuts = clean;
    lastData.sumExtra = sumExtraDeductionRows(clean);
    openReview(lastData.reportType, { silent: true });
}

function clearExtraDeductionsFromEditor() {
    beepClick();
    if (!lastData || !lastData.reportKey) return;
    if (!confirm('Hapus semua potongan tambahan untuk rekapan ini?')) return;
    saveExtraDeductionsForKey(lastData.reportKey, []);
    lastData.extraCuts = [];
    lastData.sumExtra = 0;
    openReview(lastData.reportType, { silent: true });
}

function saveThenReview(t) {
    beepClick();
    if(isEditMode) { if(!proses()) return; isEditMode = false; updateToolbar(); }
    else if(curIdx === -1) { if(!proses()) return; }
    openReview(t);
}

function getCheckedIdsFromDom() {
    return Array.from(document.querySelectorAll('.row-chk:checked'))
        .map(cb => normalizeId(cb.value))
        .filter(Boolean);
}

function getFilteredDataForReport() {
    let nFilter = document.getElementById('f-name').value.toUpperCase().trim(),
        dFilter = document.getElementById('f-driver').value.toUpperCase().trim(),
        s = document.getElementById('f-start').value,
        e = document.getElementById('f-end').value;

    return db.filter(x =>
        (!nFilter || (x.owner && x.owner.includes(nFilter))) &&
        (!dFilter || (x.driver && x.driver.includes(dFilter))) &&
        (!s || x.date >= s) &&
        (!e || x.date <= e)
    );
}

function getSelectedDataForReport() {
    const domIds = getCheckedIdsFromDom();
    const stateIds = selectedIds ? [...selectedIds].map(normalizeId).filter(Boolean) : [];

    const useIds = domIds.length > 0 ? domIds : stateIds;
    if (useIds.length === 0) return [];

    const selectedSet = new Set(useIds.map(normalizeId));
    const list = db.filter(x => x && selectedSet.has(normalizeId(x.id)));

    if (domIds.length > 0) {
        selectedIds.clear();
        domIds.forEach(id => selectedIds.add(id));
    } else if (list.length === 0 && stateIds.length > 0) {
        selectedIds.clear();
    }

    return list;
}

function getReportList(type) {
    if (type === 'nota-thermal' && curIdx !== -1 && db[curIdx]) {
        return [db[curIdx]];
    }

    const selected = getSelectedDataForReport();
    if (selected.length > 0) return selected;

    return getFilteredDataForReport();
}

function buildReportTotals(list) {
    let sN1=0, sN2=0, sK=0, sL=0, sJ=0, sP=0, sumJ = {}, sumL = {}, sumP = {};

    list.forEach(x => {
        const n1 = toNumber(x.n1);
        const n2 = toNumber(x.n2);
        const kotor = toNumber(x.kotor);
        const fl = toNumber(x.fl);
        const fj = toNumber(x.fj);
        const fp = toNumber(x.fp);
        const tL = toNumber(x.tL, Math.round(n1 * fl));
        const tJ = toNumber(x.tJ, Math.round(n2 * fj));
        const tP = toNumber(x.tP, Math.round(n1 * fp));

        sN1 += n1;
        sN2 += n2;
        sK += kotor;
        sL += tL;
        sJ += tJ;
        sP += tP;

        addDeduction(sumJ, fj, n2, tJ);
        addDeduction(sumL, fl, n1, tL);
        addDeduction(sumP, fp, n1, tP);
    });

    return { sN1, sN2, sK, sL, sJ, sP, sumJ, sumL, sumP, sBersih: sK-(sJ+sL+sP) };
}

function openReview(type, options = {}) {
    if (!options.silent) beepClick();

    let filtered = getReportList(type);

    if (!filtered[0]) {
        beepError();
        return alert("Data Kosong atau Belum Dipilih!");
    }

    filtered.sort((a, b) => new Date(a.date + 'T' + (a.time||'00:00')) - new Date(b.date + 'T' + (b.time||'00:00')));

    let pName = [...new Set(filtered.map(x => x.owner))].join(", ");
    let dateList = filtered.map(x => x.date).sort();
    let isSingle = filtered.length === 1;
    let isThermalMulti = type !== 'rekap-gambar' && !isSingle;
    let strPeriode = formatPeriodeTanggal(dateList, isThermalMulti);
    let totals = buildReportTotals(filtered);
    let tableRows = '';
    const reportKey = buildReportSelectionKey(filtered);
    const allowExtraDeductions = type !== 'nota-thermal';
    const extraCuts = allowExtraDeductions ? loadExtraDeductionsForKey(reportKey) : [];
    const sumExtra = sumExtraDeductionRows(extraCuts);
    const bersihFinal = totals.sBersih - sumExtra;

    filtered.forEach((x, i) => {
        tableRows += `<tr><td>${i + 1}</td><td>${fTgl(x.date)}</td><td align="left">${escapeHtml(x.driver)}</td><td>${fNum(x.w1)}</td><td>${fNum(x.w2)}</td><td>${Math.round(x.n1)}</td><td style="font-weight:bold">${(x.n2||0).toFixed(2)}</td><td>${fNum(x.price)}</td><td>${fNum(x.kotor)}</td></tr>`;
    });

    lastData = {
        list: filtered,
        sk: totals.sK,
        sj: totals.sJ,
        sl: totals.sL,
        sp: totals.sP,
        sn1: totals.sN1,
        sn2: totals.sN2,
        name: pName,
        periode: strPeriode,
        sumJ: totals.sumJ,
        sumL: totals.sumL,
        sumP: totals.sumP,
        reportType: type,
        reportKey,
        allowExtraDeductions,
        extraCuts,
        sumExtra,
        bersihFinal
    };

    let extraHeaderHtml = extraCuts.length > 0
        ? `<tr><td colspan="2" style="padding-top:8px; font-size:12px; color:#475569; border-top:1px solid #94a3b8;">POTONGAN TAMBAHAN</td></tr>${buildHtmlExtraDeductionRows(extraCuts)}`
        : '';

    if (type === 'rekap-gambar') {
        document.getElementById('review-container').innerHTML = `<div id="review-target" style="width:500px; background:#fff; padding:15px; color:#000; font-family:Arial, sans-serif; border:1px solid #ddd; box-sizing:border-box;">
            ${typeof renderNotaLogoHtml === 'function' ? renderNotaLogoHtml(52) : ''}<center><h2 style="margin:0; text-decoration:underline; font-size:18px;">STRUK PENIMBANGAN</h2><b style="font-size:13px;">PEMILIK: ${escapeHtml(pName)}</b><br><span style="font-size:11px;">PERIODE: ${escapeHtml(strPeriode)}</span></center><br>
            <table class="rep-table-img"><thead><tr><th>No</th><th>Tgl</th><th>Sopir</th><th>T1</th><th>T2</th><th>Nett</th><th>-3%</th><th>Rp</th><th>Total</th></tr></thead><tbody>
            ${tableRows}
            <tr class="subtotal-row"><td colspan="5">SUBTOTAL</td><td>${Math.round(totals.sN1)}</td><td>${totals.sN2.toFixed(2)}</td><td></td><td>${fNum(totals.sK)}</td></tr></tbody></table>
            <div style="width: 75%; margin-left: auto; margin-top: 15px; border-top: 2.5px solid black; padding-top: 8px;">
                <table style="width: 100%; border: none; font-size: 13px; font-weight: bold; color:black;">
                    ${buildHtmlRow('Potongan Jalan', totals.sumJ)}
                    ${buildHtmlRow('Potongan Langsir', totals.sumL)}
                    ${buildHtmlRow('Potongan Panen', totals.sumP)}
                    ${extraHeaderHtml}
                    <tr><td colspan="2" style="border-top: 2px solid black; padding-top: 5px;"></td></tr>
                    <tr><td style="text-align: left; font-size: 16px; color:#059669;">BERSIH</td><td style="text-align: right; font-size: 16px; color:#059669;">${fRp(bersihFinal)}</td></tr>
                </table>
            </div>
            ${typeof renderNotaOperatorHtml === 'function' ? renderNotaOperatorHtml(5) : '<center style="font-size:12px; font-weight:bold; color:black; margin-top:22px;">Ditimbang oleh :<br><br><br><br><br><b>Asri</b></center>'}
            </div>`;
        document.getElementById('modal-btns').innerHTML = `<button class="btn-m" style="background:#f59e0b" onclick="capture()">💾 GAMBAR</button><button class="btn-m" style="background:#25D366" onclick="shareWaText()">💬 Teks WA Rinci</button>`;
    } else {
        if (isSingle) {
            let x = filtered[0];
            let extraRows = extraCuts.length > 0 ? `<tr><td colspan="3" style="padding-top:4px;">* POTONGAN TAMBAHAN:</td></tr>${renderThermalPreviewExtraRows(extraCuts)}` : '';
            let htmlSingle = `<div id="thermal-preview">
                <center>
                ${typeof renderNotaLogoHtml === 'function' ? renderNotaLogoHtml(36) : ''}
                <b>STRUK PENIMBANGAN</b><br>
                ================================<br>
                </center>
                <div style="text-align: left;">
                    Pemilik : ${escapeHtml(x.owner)}<br>
                    Sopir   : ${escapeHtml(x.driver)}<br>
                    Tanggal : ${fTgl(x.date)}<br>
                    --------------------------------<br>
                    <table style="width:100%; font-family:monospace; font-size:12px; border:none; border-collapse:collapse;">
                        <tr><td width="42%">Bruto</td><td width="8%">:</td><td align="right">${fNum(x.w1)}</td></tr>
                        <tr><td>Tara</td><td>:</td><td align="right">${fNum(x.w2)}</td></tr>
                        <tr><td>Nett</td><td>:</td><td align="right"><b>${Math.round(x.n1)}</b></td></tr>
                        <tr><td>Sortasi (-3%)</td><td>:</td><td align="right">${(x.n2||0).toFixed(2)}</td></tr>
                        <tr><td>Harga / kg</td><td>:</td><td align="right">x ${fNum(x.price)}</td></tr>
                        <tr><td><b>SUBTOTAL</b></td><td>:</td><td align="right"><b>Rp ${fNum(x.kotor)}</b></td></tr>
                    </table>
                    --------------------------------<br>
                    * BIAYA OPERASIONAL:<br>
                    <table style="width:100%; font-family:monospace; font-size:12px; border:none; border-collapse:collapse;">
                        ${x.tJ > 0 ? `<tr><td width="48%">* Jalan (${x.fj || 0})</td><td width="5%">:</td><td align="right">-Rp ${fNum(x.tJ)}</td></tr>` : ''}
                        ${x.tL > 0 ? `<tr><td>* Langsir (${x.fl || 0})</td><td>:</td><td align="right">-Rp ${fNum(x.tL)}</td></tr>` : ''}
                        ${x.tP > 0 ? `<tr><td>* Panen (${x.fp || 0})</td><td>:</td><td align="right">-Rp ${fNum(x.tP)}</td></tr>` : ''}
                        ${extraRows}
                    </table>
                    <br>
                    <b>### TOTAL BERSIH : Rp ${fNum(toNumber(x.bersih) - sumExtra)}</b><br>
                    ================================<br>
                </div>
                <center>Ditimbang oleh :<br><br><br><br><br><b>${escapeHtml(typeof getNotaOperatorName === 'function' ? getNotaOperatorName() : 'Asri')}</b></center>
            </div>`;
            document.getElementById('review-container').innerHTML = htmlSingle;
        } else {
            let html = `<div id="thermal-preview"><center>${typeof renderNotaLogoHtml === 'function' ? renderNotaLogoHtml(36) : ''}<b>STRUK PENIMBANGAN</b><br>Pemilik: ${escapeHtml(pName)}<br>Periode: ${escapeHtml(strPeriode)}</center><br>`;
            filtered.forEach((x, i) => {
                html += `${i+1}. ${fTglYY(x.date)} |${escapeHtml(x.owner)}| ${escapeHtml(x.driver)}<br>${fNum(x.w1)}-${fNum(x.w2)} = ${Math.round(x.n1)}<br>-3% = ${(x.n2||0).toFixed(2)}<br>x ${fNum(x.price)} = <b>Rp ${fNum(x.kotor)}</b><br>---<br>`;
            });
            html += `<table style="width: 100%; border: none; font-size: 12px; font-family: monospace;">`;
            html += `<tr><td><b>TOTAL NETT</b></td><td align="right"><b>${Math.round(totals.sN1)} kg</b></td></tr><tr><td><b>TOTAL -3%</b></td><td align="right"><b>${totals.sN2.toFixed(2)} kg</b></td></tr><tr><td><b>TOTAL HARGA</b></td><td align="right"><b>Rp ${fNum(totals.sK)}</b></td></tr>`;
            html += `${buildHtmlRow('Jalan', totals.sumJ)}${buildHtmlRow('Langsir', totals.sumL)}${buildHtmlRow('Panen', totals.sumP)}`;
            if (extraCuts.length > 0) html += `<tr><td colspan="2">POTONGAN TAMBAHAN</td></tr>${buildHtmlExtraDeductionRows(extraCuts)}`;
            html += `<tr><td colspan="2">-----------------------------</td></tr><tr><td><b>TOTAL BERSIH</b></td><td align="right"><b>Rp ${fNum(bersihFinal)}</b></td></tr>
            </table><br><center>Ditimbang oleh :<br><br><br><br><br><br><b>${escapeHtml(typeof getNotaOperatorName === 'function' ? getNotaOperatorName() : 'Asri')}</b></center></div>`;
            document.getElementById('review-container').innerHTML = html;
        }
        document.getElementById('modal-btns').innerHTML = `<button class="btn-m" style="background:#8b5cf6" onclick="printT()">🖨️ CETAK THERMAL</button><button class="btn-m" style="background:#25D366" onclick="shareWaText()">💬 Teks WA Rinci</button>`;
    }

    document.getElementById('preview-modal').style.display = 'block';
    renderExtraDeductionEditor();
    location.hash = 'review';
}

function shareWaText() {
    beepClick();
    let d = lastData;
    if (!d || !d.list || d.list.length === 0) { beepError(); return alert('Data laporan belum siap.'); }

    let teks = '';
    if (typeof buildThermalText === 'function') {
        teks = stripThermalCommands(buildThermalText(d));
    }

    if (!teks) {
        beepError();
        return alert('Teks thermal belum siap. Buka preview thermal terlebih dahulu.');
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`);
}

function safeFilenamePart(value, fallback = 'DATA', maxLen = 60) {
    let raw = String(value || fallback)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .trim();

    raw = raw
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (!raw) raw = fallback;
    if (raw.length > maxLen) raw = raw.slice(0, maxLen).replace(/_+$/g, '');
    return raw.toUpperCase();
}

function compactDateForFilename(dateValue) {
    if (!dateValue) return '';
    const clean = String(dateValue).split('T')[0];
    const p = clean.split('-');
    if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
    return clean.replace(/[^0-9a-zA-Z-]/g, '');
}

function nowStampForFilename() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    const hh = String(n.getHours()).padStart(2, '0');
    const mm = String(n.getMinutes()).padStart(2, '0');
    const ss = String(n.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function buildImageFilenameFromLastData() {
    const d = lastData || {};
    const list = Array.isArray(d.list) ? d.list.filter(Boolean) : [];

    let owner = d.name || [...new Set(list.map(x => x.owner).filter(Boolean))].join('_') || 'TANPA_PEMILIK';
    owner = safeFilenamePart(owner, 'TANPA_PEMILIK', 55);

    const dates = list.map(x => x && x.date).filter(Boolean).sort();
    let periode = d.periode || '';

    if (!periode && dates.length > 0) {
        const first = compactDateForFilename(dates[0]);
        const last = compactDateForFilename(dates[dates.length - 1]);
        periode = first === last ? first : `${first}_SD_${last}`;
    }

    periode = safeFilenamePart(periode || 'TANPA_TANGGAL', 'TANPA_TANGGAL', 45);

    const rit = list.length > 0 ? `${list.length}RIT` : '0RIT';
    const saveAt = nowStampForFilename();

    let idPart = '';
    if (list.length === 1 && list[0] && list[0].id) {
        idPart = '_ID_' + safeFilenamePart(String(list[0].id).slice(-10), 'ID', 16);
    } else if (list.length > 1) {
        const firstId = list[0] && list[0].id ? String(list[0].id).slice(-5) : 'AWAL';
        const lastId = list[list.length - 1] && list[list.length - 1].id ? String(list[list.length - 1].id).slice(-5) : 'AKHIR';
        idPart = '_ID_' + safeFilenamePart(`${firstId}_${lastId}`, 'RANGE', 24);
    }

    let filename = `PSM_SAWIT_${owner}_PERIODE_${periode}_${rit}_SIMPAN_${saveAt}${idPart}.png`;
    filename = filename.replace(/_+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');

    if (filename.length > 180) {
        const suffix = `_SIMPAN_${saveAt}${idPart}.png`;
        const maxOwnerLen = Math.max(20, 180 - suffix.length - 30);
        filename = `PSM_SAWIT_${owner.slice(0, maxOwnerLen)}_PERIODE_${periode.slice(0, 32)}_${rit}${suffix}`;
        filename = filename.replace(/_+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    return filename;
}

async function capture() {
    beepClick();

    const target = document.getElementById('review-target');
    if (!target) {
        beepError();
        return alert('Preview gambar belum siap.');
    }

    if (typeof html2canvas !== 'function') {
        beepError();
        return alert('Fitur simpan gambar belum siap. Library html2canvas tidak terbaca.');
    }

    const oldTransform = target.style.transform;
    const oldTransformOrigin = target.style.transformOrigin;

    try {
        target.style.transform = 'none';
        target.style.transformOrigin = 'top left';

        const canvas = await html2canvas(target, {
            scale: 3,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: target.scrollWidth,
            windowHeight: target.scrollHeight
        });

        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const filename = buildImageFilenameFromLastData();

        const nativeApp = !!(window.NativeBridge && window.NativeBridge.isNativeApp && window.NativeBridge.isNativeApp());
        if (window.NativeBridge && typeof window.NativeBridge.saveImage === 'function') {
            const saved = await window.NativeBridge.saveImage(dataUrl, filename, { silentOnMissing: false });
            if (saved) {
                beepSuccess();
                return;
            }
        }

        if (nativeApp) {
            beepError();
            return;
        }

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        beepSuccess();

    } catch (err) {
        console.error('Gagal simpan gambar:', err);
        beepError();
        alert('Gagal menyimpan gambar: ' + (err && err.message ? err.message : err));

    } finally {
        target.style.transform = oldTransform;
        target.style.transformOrigin = oldTransformOrigin;
    }
}
