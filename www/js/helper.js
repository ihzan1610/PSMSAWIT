// ===============================
// PSM SAWIT - helper.js
// Versi 15: helper aman + tanggal pendek thermal + strip text printer.
// ===============================

function helperRp(el, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    let val = parseFloat(el && el.value);
    target.innerText = (val > 0) ? "Rp " + Math.round(val).toLocaleString('id-ID') : "";
}

const toNumber = (n, fallback = 0) => {
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : fallback;
};

const toInt = (n, fallback = 0) => {
    const v = Math.round(toNumber(n, fallback));
    return Number.isFinite(v) ? v : fallback;
};

const fRp = (n) => "Rp " + Math.round(toNumber(n)).toLocaleString('id-ID');
const fNum = (n) => toNumber(n).toLocaleString('id-ID');

const fTgl = (d) => {
    if(!d) return "-";
    let bersih = String(d).split('T')[0];
    let p = bersih.split('-');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : bersih;
};

// Khusus nota thermal banyak data agar baris thermal tidak cepat turun ke bawah.
const fTglYY = (d) => {
    if(!d) return "-";
    let bersih = String(d).split('T')[0];
    let p = bersih.split('-');
    if (p.length === 3) {
        const yy = String(p[0]).slice(-2);
        return `${p[2]}-${p[1]}-${yy}`;
    }
    return bersih;
};


// Normalisasi tanggal untuk input type="date".
// Mendukung format lama: yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, yyyy/mm/dd, ISO, dan serial number Google Sheet/Excel.
function normalizeDateForInput(value, fallback = '') {
    if (value === undefined || value === null || value === '') return fallback || '';
    let raw = String(value).trim();
    if (!raw) return fallback || '';

    // Jika berbentuk ISO lengkap, ambil tanggalnya saja.
    raw = raw.split('T')[0].trim();

    // Serial date Google Sheet/Excel, contoh 45424.
    if (/^\d{5,6}$/.test(raw)) {
        const serial = Number(raw);
        if (Number.isFinite(serial) && serial > 20000) {
            const base = new Date(Date.UTC(1899, 11, 30));
            const d = new Date(base.getTime() + serial * 86400000);
            if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
    }

    let m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) {
        const y = m[1], mo = m[2].padStart(2, '0'), da = m[3].padStart(2, '0');
        return `${y}-${mo}-${da}`;
    }

    m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) {
        const da = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0'), y = m[3];
        return `${y}-${mo}-${da}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    return fallback || '';
}

function normalizeTimeForInput(value, fallback = '') {
    if (value === undefined || value === null || value === '') return fallback || '';
    let raw = String(value).trim();
    if (!raw) return fallback || '';

    let m = raw.match(/(\d{1,2})[:.](\d{1,2})/);
    if (m) {
        const h = Math.max(0, Math.min(23, Number(m[1]))).toString().padStart(2, '0');
        const mi = Math.max(0, Math.min(59, Number(m[2]))).toString().padStart(2, '0');
        return `${h}:${mi}`;
    }

    m = raw.match(/^(\d{1,2})(\d{2})$/);
    if (m) {
        const h = Math.max(0, Math.min(23, Number(m[1]))).toString().padStart(2, '0');
        const mi = Math.max(0, Math.min(59, Number(m[2]))).toString().padStart(2, '0');
        return `${h}:${mi}`;
    }

    return fallback || '';
}

function formatPeriodeTanggal(dateList, shortYear = false) {
    const dates = (dateList || []).filter(Boolean).sort();
    if (dates.length === 0) return '-';

    const fmt = shortYear ? fTglYY : fTgl;
    const first = dates[0];
    const last = dates[dates.length - 1];
    return first === last ? fmt(first) : `${fmt(first)} s/d ${fmt(last)}`;
}

function stripThermalCommands(text) {
    return String(text || '')
        .replace(/\x1B\x61[\x00-\x03]/g, '')
        .replace(/\x1B\x45[\x00-\x01]/g, '')
        .replace(/\x1B[\s\S]/g, '')
        .replace(/\n{4,}$/g, '\n\n')
        .trim();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeText(value, fallback = '-') {
    const txt = String(value ?? '').trim();
    return txt || fallback;
}

function normalizeId(id) {
    return String(id ?? '').trim();
}

function formatKg(n, maxDecimals = 2) {
    const val = toNumber(n);
    if (Math.abs(val - Math.round(val)) < 0.000001) {
        return Math.round(val).toLocaleString('id-ID');
    }
    return val.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: maxDecimals
    });
}

function makeDeductionEntry(rate) {
    return {
        rate: toNumber(rate),
        weight: 0,
        amount: 0
    };
}

function addDeduction(summary, rate, weight, amount) {
    const r = toNumber(rate);
    const w = toNumber(weight);
    const a = toNumber(amount);

    if (r <= 0 || a <= 0) return;

    const key = String(r);
    if (!summary[key]) summary[key] = makeDeductionEntry(r);

    summary[key].weight += w;
    summary[key].amount += a;
}

function sortedDeductionEntries(obj) {
    return Object.keys(obj || {})
        .map(k => {
            const value = obj[k];
            if (value && typeof value === 'object') {
                return {
                    rate: toNumber(value.rate ?? k),
                    weight: toNumber(value.weight),
                    amount: toNumber(value.amount ?? value.total ?? 0)
                };
            }

            // Kompatibilitas untuk format lama: { tarif: totalNominal }
            return {
                rate: toNumber(k),
                weight: 0,
                amount: toNumber(value)
            };
        })
        .filter(x => x.amount > 0)
        .sort((a, b) => a.rate - b.rate);
}

function buildHtmlRow(label, obj) {
    let lines = '';
    const rows = sortedDeductionEntries(obj);
    const showWeight = rows.length > 1;

    rows.forEach(item => {
        const weightText = showWeight ? ` <span style="font-size:11px; font-weight:normal; white-space:nowrap;">(${formatKg(item.weight)} kg)</span>` : '';
        lines += `<tr><td style="text-align: left;">${escapeHtml(label)} (${escapeHtml(formatKg(item.rate))}/kg)${weightText}</td><td style="text-align: right; white-space:nowrap;">-Rp ${fNum(item.amount)}</td></tr>`;
    });

    return lines;
}

function buildThermalDeductionRows(label, obj) {
    let lines = '';
    const rows = sortedDeductionEntries(obj);
    const showWeight = rows.length > 1;

    rows.forEach(item => {
        const left = showWeight
            ? `* ${label} (${formatKg(item.rate)}) ${formatKg(item.weight)}kg`
            : `* ${label} (${formatKg(item.rate)})`;
        lines += alignLR(left, `-Rp ${fNum(item.amount)}`) + `\n`;
    });

    return lines;
}

function normalizeExtraDeductionRows(rows) {
    return (Array.isArray(rows) ? rows : [])
        .map((item, idx) => {
            if (!item) return null;
            const name = safeText(item.name ?? item.label ?? item.ket ?? '', '').trim();
            const amount = toInt(item.amount ?? item.nominal ?? item.value, 0);
            if (!name || amount <= 0) return null;
            return {
                name,
                amount,
                order: Number.isFinite(Number(item.order)) ? Number(item.order) : idx
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
}

function sumExtraDeductionRows(rows) {
    return normalizeExtraDeductionRows(rows).reduce((sum, item) => sum + toInt(item.amount), 0);
}

function buildHtmlExtraDeductionRows(rows) {
    let lines = '';
    normalizeExtraDeductionRows(rows).forEach(item => {
        lines += `<tr><td style="text-align:left; padding:2px 0;">${escapeHtml(item.name)}</td><td style="text-align:right; white-space:nowrap; padding:2px 0; font-weight:bold;">-Rp ${fNum(item.amount)}</td></tr>`;
    });
    return lines;
}

function buildThermalExtraDeductionRows(rows) {
    let lines = '';
    normalizeExtraDeductionRows(rows).forEach(item => {
        lines += alignLR(`* ${item.name}`, `-Rp ${fNum(item.amount)}`) + `\n`;
    });
    return lines;
}

const alignLR = (l, r) => {
    let lStr = String(l ?? '');
    let rStr = String(r ?? '');
    let s = 32 - lStr.length - rStr.length;
    return lStr + " ".repeat(Math.max(1, s)) + rStr;
};

const alignCol = (l, r) => {
    let leftPart = String(l ?? '').padEnd(15, ' ');
    let rightPart = String(r ?? '').padStart(14, ' ');
    return leftPart + " : " + rightPart;
};
