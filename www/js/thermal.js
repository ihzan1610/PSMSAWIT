// ===============================
// PSM SAWIT - thermal.js
// V23: thermal stabil + opsi logo bitmap hitam putih.
// ===============================

function buildThermalText(d) {
    if(!d || !d.list || d.list.length === 0) return '';

    let isSingle = d.list.length === 1;
    let t = "";
    const extraCuts = (typeof normalizeExtraDeductionRows === 'function') ? normalizeExtraDeductionRows(d.extraCuts || []) : [];
    const extraTotal = (typeof sumExtraDeductionRows === 'function') ? sumExtraDeductionRows(extraCuts) : toInt(d.sumExtra, 0);


    if (isSingle) {
        let x = d.list[0];
        t += (typeof buildThermalLogoHeader === 'function' ? buildThermalLogoHeader() : '');
        t += `\x1B\x61\x01\x1B\x45\x01STRUK PENIMBANGAN\x1B\x45\x00\n`;
        t += `\x1B\x61\x00================================\n`;
        t += `Pemilik : ${safeText(x.owner)}\n`;
        t += `Sopir   : ${safeText(x.driver)}\n`;
        t += `Tanggal : ${fTgl(x.date)}\n`;
        t += `--------------------------------\n`;
        t += alignCol("Bruto", fNum(x.w1)) + "\n";
        t += alignCol("Tara", fNum(x.w2)) + "\n";
        t += alignCol("Nett", Math.round(x.n1)) + "\n";
        t += alignCol("Sortasi (-3%)", (x.n2||0).toFixed(2)) + "\n";
        t += alignCol("Harga / kg", "x " + fNum(x.price)) + "\n";
        t += `\x1B\x45\x01` + alignCol("SUBTOTAL", "Rp " + fNum(x.kotor)) + `\x1B\x45\x00\n`;
        t += `--------------------------------\n`;
        t += `* BIAYA OPERASIONAL:\n`;
        if (x.tJ > 0) t += alignCol(`* Jalan (${x.fj || 0})`, `-Rp ` + fNum(x.tJ)) + "\n";
        if (x.tL > 0) t += alignCol(`* Langsir (${x.fl || 0})`, `-Rp ` + fNum(x.tL)) + "\n";
        if (x.tP > 0) t += alignCol(`* Panen (${x.fp || 0})`, `-Rp ` + fNum(x.tP)) + "\n";
        if (extraCuts.length > 0) {
            t += `* POTONGAN TAMBAHAN:\n`;
            t += (typeof buildThermalExtraDeductionRows === 'function') ? buildThermalExtraDeductionRows(extraCuts) : '';
        }

        t += `\n\x1B\x45\x01### TOTAL BERSIH : Rp ${fNum(toNumber(x.bersih) - extraTotal)}\x1B\x45\x00\n`;
        t += `================================\n`;
        t += (typeof buildThermalOperatorBlock === 'function') ? buildThermalOperatorBlock(5) : `\x1B\x61\x01Ditimbang oleh :\n\n\n\n\nAsri\n\x1B\x61\x00\n\n\n`;
    } else {
        const periodeText = formatPeriodeTanggal(d.list.map(x => x && x.date), true) || d.periode;
        t += (typeof buildThermalLogoHeader === 'function' ? buildThermalLogoHeader() : '');
        t += `\x1B\x61\x01\x1B\x45\x01STRUK PENIMBANGAN\x1B\x45\x00
\x1B\x61\x00Pemilik : ${safeText(d.name)}
Periode : ${safeText(periodeText)}

`;
        d.list.forEach((x, i) => {
            t += `${i+1}. ${fTglYY(x.date)} |${safeText(x.owner)}| ${safeText(x.driver)}
${fNum(x.w1)}-${fNum(x.w2)} = ${Math.round(x.n1)}
-3% = ${(x.n2||0).toFixed(2)}
x ${fNum(x.price)} = \x1B\x45\x01Rp ${fNum(x.kotor)}\x1B\x45\x00
---
`;
        });
        t += `\x1B\x45\x01` + alignLR(`TOTAL NETT`, `${Math.round(d.sn1)} kg`) + `\n` + alignLR(`TOTAL -3%`, `${d.sn2.toFixed(2)} kg`) + `\n` + alignLR(`TOTAL HARGA`, `Rp ${fNum(d.sk)}`) + `\x1B\x45\x00\n`;

        t += buildThermalDeductionRows('Jalan', d.sumJ)
            + buildThermalDeductionRows('Langsir', d.sumL)
            + buildThermalDeductionRows('Panen', d.sumP);
        if (extraCuts.length > 0) {
            t += (typeof buildThermalExtraDeductionRows === 'function') ? buildThermalExtraDeductionRows(extraCuts) : '';
        }
        t += `--------------------------------\n\x1B\x45\x01` + alignLR(`TOTAL BERSIH`, `Rp ${fNum(d.sk-(d.sj+d.sl+d.sp+extraTotal))}`) + `\x1B\x45\x00\n\n`;
        t += (typeof buildThermalOperatorBlock === 'function') ? buildThermalOperatorBlock(7) : `\x1B\x61\x01Ditimbang oleh :\n\n\n\n\n\n\nAsri\n\x1B\x61\x00\n\n\n`;
    }

    return t;
}


function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
    }
    return btoa(bin);
}

function textToThermalBytes(text) {
    const raw = String(text || '');
    const out = [];
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        // Thermal text kita mayoritas ASCII + ESC/POS command. Karakter di luar ASCII diganti spasi agar aman.
        out.push(c >= 0 && c <= 255 ? c : 32);
    }
    return out;
}

function loadImageForThermal(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Logo thermal gagal dimuat'));
        img.src = src;
    });
}

async function buildThermalLogoRasterBytes() {
    if (typeof isThermalLogoBitmapEnabled !== 'function' || !isThermalLogoBitmapEnabled()) return [];

    try {
        const src = (typeof getNotaLogoSrc === 'function') ? getNotaLogoSrc() : 'assets/icons/logo-nota-default.png';
        const img = await loadImageForThermal(src);
        const width = 160; // cocok untuk printer 58mm/80mm, tetap kecil supaya tidak lambat.
        const height = Math.max(48, Math.round((img.height / img.width) * width));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const bytesPerRow = Math.ceil(width / 8);
        const xL = bytesPerRow & 0xff;
        const xH = (bytesPerRow >> 8) & 0xff;
        const yL = height & 0xff;
        const yH = (height >> 8) & 0xff;
        const bytes = [];

        // center align, raster bit image GS v 0, back to left align.
        bytes.push(0x1B, 0x61, 0x01);
        bytes.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

        for (let y = 0; y < height; y++) {
            for (let xb = 0; xb < bytesPerRow; xb++) {
                let b = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = xb * 8 + bit;
                    if (x >= width) continue;
                    const idx = (y * width + x) * 4;
                    const r = data[idx], g = data[idx + 1], bl = data[idx + 2], a = data[idx + 3];
                    // Logo dibuat hitam putih: pixel gelap/warna kuat jadi hitam, background putih transparan diabaikan.
                    const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
                    const isInk = a > 60 && lum < 210;
                    if (isInk) b |= (0x80 >> bit);
                }
                bytes.push(b);
            }
        }

        bytes.push(0x0A, 0x1B, 0x61, 0x00);
        return bytes;
    } catch (err) {
        console.warn('Logo thermal bitmap dilewati:', err);
        return [];
    }
}

async function buildThermalPrintBase64(text) {
    const logoBytes = await buildThermalLogoRasterBytes();
    const textBytes = textToThermalBytes(text);
    const all = logoBytes.concat(textBytes);
    return bytesToBase64(all);
}

let __psmPrintRunning = false;

async function printT() {
    beepClick();

    if (__psmPrintRunning) return;

    let d = lastData;
    if(!d || !d.list || d.list.length === 0) {
        beepError();
        alert('Nota thermal belum siap. Buka preview thermal terlebih dahulu.');
        return;
    }

    const t = buildThermalText(d);
    if (!t) {
        beepError();
        alert('Data thermal kosong. Pilih data kembali lalu buka preview thermal.');
        return;
    }

    __psmPrintRunning = true;
    try {
        const wantLogoBitmap = (typeof isThermalLogoBitmapEnabled === 'function' && isThermalLogoBitmapEnabled());

        if (wantLogoBitmap && window.NativeBridge && typeof window.NativeBridge.printRawBTBase64Bytes === 'function') {
            try {
                const packed = await buildThermalPrintBase64(t);
                const okBytes = await window.NativeBridge.printRawBTBase64Bytes(packed);
                if (okBytes) return;
            } catch (e) {
                console.warn('Print thermal logo bitmap gagal, lanjut print teks:', e);
            }
        }

        if (window.NativeBridge && typeof window.NativeBridge.printRawBT === 'function') {
            const ok = await window.NativeBridge.printRawBT(t);
            if (ok) return;
        }

        if (window.AndroidRawBT && typeof window.AndroidRawBT.print === 'function') {
            try {
                window.AndroidRawBT.print(t);
                return;
            } catch(e) {
                console.warn('AndroidRawBT gagal:', e);
            }
        }

        // Fallback untuk browser/PWA lama.
        window.location.href = "intent:" + encodeURIComponent(t) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    } finally {
        setTimeout(() => { __psmPrintRunning = false; }, 1200);
    }
}
