// ===============================
// PSM SAWIT - native.js
// V33 FINAL: native saver memakai PsmNative + JavascriptInterface + plugin + fallback download.
// ===============================

const NativeBridge = (() => {
    let lastBackAt = 0;
    let printBusy = false;

    function isNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    const pluginProxyCache = {};

    function getPlugin(name) {
        if (!window.Capacitor) return null;

        // 1) Capacitor proxy resmi untuk custom plugin di project tanpa bundler.
        //    Ini penting karena sebagian WebView tidak menaruh custom plugin di Capacitor.Plugins.
        try {
            if (typeof window.Capacitor.registerPlugin === 'function') {
                if (!pluginProxyCache[name]) {
                    pluginProxyCache[name] = window.Capacitor.registerPlugin(name);
                }
                if (pluginProxyCache[name]) return pluginProxyCache[name];
            }
        } catch (e) {
            console.warn('registerPlugin gagal untuk', name, e);
        }

        // 2) Fallback global Capacitor.Plugins.
        if (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) {
            return window.Capacitor.Plugins[name];
        }

        return null;
    }

    async function callNativePlugin(pluginName, methodName, payload) {
        if (!isNativeApp() || !window.Capacitor) return false;

        // Jalur 1: proxy hasil registerPlugin, paling penting untuk custom plugin ImageSaver/CsvSaver.
        const plugin = getPlugin(pluginName);
        if (plugin && typeof plugin[methodName] === 'function') {
            return await plugin[methodName](payload || {});
        }

        // Jalur 2: nativePromise kalau tersedia di runtime Capacitor tertentu.
        if (typeof window.Capacitor.nativePromise === 'function') {
            return await window.Capacitor.nativePromise(pluginName, methodName, payload || {});
        }

        // Jalur 3: postMessage fallback internal Capacitor Android.
        if (window.Capacitor.Plugins && window.Capacitor.Plugins[pluginName] && typeof window.Capacitor.Plugins[pluginName][methodName] === 'function') {
            return await window.Capacitor.Plugins[pluginName][methodName](payload || {});
        }

        return false;
    }

    async function initStatusBar() {
        if (!isNativeApp()) return;

        document.body.classList.add('cap-native');

        const StatusBar = getPlugin('StatusBar');
        if (!StatusBar) return;

        try { await StatusBar.setOverlaysWebView({ overlay: false }); } catch (e) { console.warn('StatusBar overlay gagal:', e); }
        try { await StatusBar.setBackgroundColor({ color: '#059669' }); } catch (e) { console.warn('StatusBar color gagal:', e); }
        try { await StatusBar.show(); } catch (e) { console.warn('StatusBar show gagal:', e); }
    }

    function isVisible(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    }

    function toast(msg) {
        let el = document.getElementById('native-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'native-toast';
            el.style.position = 'fixed';
            el.style.left = '50%';
            el.style.bottom = '28px';
            el.style.transform = 'translateX(-50%)';
            el.style.background = 'rgba(0,0,0,0.82)';
            el.style.color = '#fff';
            el.style.padding = '10px 14px';
            el.style.borderRadius = '999px';
            el.style.fontSize = '12px';
            el.style.fontWeight = '700';
            el.style.zIndex = '20000';
            el.style.display = 'none';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(window.__psmToastTimer);
        window.__psmToastTimer = setTimeout(() => {
            el.style.display = 'none';
        }, 1800);
    }

    function handleBackButton() {
        if (isVisible('preview-modal')) {
            if (typeof closeReview === 'function') closeReview();
            else document.getElementById('preview-modal').style.display = 'none';
            return;
        }

        if (isVisible('settings-modal')) {
            if (typeof closeSettings === 'function') closeSettings();
            else document.getElementById('settings-modal').style.display = 'none';
            return;
        }

        if (location.hash) {
            history.back();
            return;
        }

        if (typeof curIdx !== 'undefined' && curIdx !== -1) {
            if (typeof resetForm === 'function') resetForm();
            return;
        }

        if (window.scrollY > 40) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const now = Date.now();
        if (now - lastBackAt < 2000) {
            const App = getPlugin('App');
            if (App && App.exitApp) App.exitApp();
            return;
        }

        lastBackAt = now;
        toast('Tekan kembali sekali lagi untuk keluar');
    }

    function initBackButton() {
        if (!isNativeApp()) return;

        const App = getPlugin('App');
        if (!App || !App.addListener) return;

        App.addListener('backButton', () => {
            handleBackButton();
        });
    }

    async function openExternalUrl(url) {
        const AppLauncher = getPlugin('AppLauncher');

        if (isNativeApp() && AppLauncher && AppLauncher.openUrl) {
            await AppLauncher.openUrl({ url });
            return true;
        }

        window.location.href = url;
        return true;
    }

    function toBase64Utf8(str) {
        try {
            const bytes = new TextEncoder().encode(String(str || ''));
            let bin = '';
            bytes.forEach(b => bin += String.fromCharCode(b));
            return btoa(bin);
        } catch (_) {
            return btoa(unescape(encodeURIComponent(String(str || ''))));
        }
    }

    function androidRawBTReady() {
        try {
            return !!(window.AndroidRawBT &&
                typeof window.AndroidRawBT.print === 'function' &&
                (typeof window.AndroidRawBT.isReady !== 'function' || window.AndroidRawBT.isReady()));
        } catch (_) {
            return !!(window.AndroidRawBT && typeof window.AndroidRawBT.print === 'function');
        }
    }

    async function printWithCapacitorPlugin(rawText) {
        const RawBT = getPlugin('RawBT');
        if (!isNativeApp() || !RawBT || typeof RawBT.print !== 'function') return false;

        const res = await RawBT.print({ text: rawText });
        console.log('RawBT plugin print result:', res);
        toast('Perintah cetak dikirim ke RAWBT');
        return true;
    }

    async function printBytesWithCapacitorPlugin(base64Bytes) {
        const RawBT = getPlugin('RawBT');
        if (!isNativeApp() || !RawBT || typeof RawBT.printBase64Bytes !== 'function') return false;

        const res = await RawBT.printBase64Bytes({ base64: String(base64Bytes || '') });
        console.log('RawBT plugin printBase64Bytes result:', res);
        toast('Perintah cetak logo + thermal dikirim ke RAWBT');
        return true;
    }

    async function printBytesWithJavascriptInterface(base64Bytes) {
        if (!androidRawBTReady()) return false;
        if (!window.AndroidRawBT || typeof window.AndroidRawBT.printBase64Bytes !== 'function') return false;
        const res = window.AndroidRawBT.printBase64Bytes(String(base64Bytes || ''));
        console.log('AndroidRawBT.printBase64Bytes result:', res);
        toast('Perintah cetak logo + thermal dikirim ke RAWBT');
        return true;
    }

    async function printBytesWithRawbtScheme(base64Bytes) {
        const raw = String(base64Bytes || '').replace(/\s+/g, '');
        if (!raw) return false;
        const urls = [
            'rawbt:base64,' + raw,
            'intent:base64,' + raw + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;'
        ];
        for (const url of urls) {
            try {
                await openExternalUrl(url);
                return true;
            } catch (e) {
                console.warn('Gagal buka RAWBT bytes URL:', e);
            }
        }
        return false;
    }

    async function printRawBTBase64Bytes(base64Bytes) {
        const raw = String(base64Bytes || '').replace(/\s+/g, '');
        if (!raw) return false;

        if (printBusy) return true;
        printBusy = true;

        try {
            try { if (await printBytesWithCapacitorPlugin(raw)) return true; } catch (e) { console.warn('RawBT plugin bytes gagal:', e); }
            try { if (await printBytesWithJavascriptInterface(raw)) return true; } catch (e) { console.warn('AndroidRawBT bytes gagal:', e); }
            try { if (await printBytesWithRawbtScheme(raw)) return true; } catch (e) { console.warn('RAWBT bytes scheme gagal:', e); }
            return false;
        } finally {
            setTimeout(() => { printBusy = false; }, 1200);
        }
    }


    async function testRawBT() {
        const RawBT = getPlugin('RawBT');
        if (isNativeApp() && RawBT && typeof RawBT.test === 'function') {
            const res = await RawBT.test();
            toast('Tes RAWBT dikirim');
            return res;
        }
        if (window.AndroidRawBT && typeof window.AndroidRawBT.print === 'function') {
            return window.AndroidRawBT.print('PSM SAWIT TEST RAWBT\n\n\n');
        }
        throw new Error('RAWBT bridge belum tersedia');
    }

    async function printWithJavascriptInterface(rawText) {
        if (!androidRawBTReady()) return false;
        const res = window.AndroidRawBT.print(rawText);
        console.log('AndroidRawBT.print result:', res);
        toast('Perintah cetak dikirim ke RAWBT');
        return true;
    }

    async function printWithRawbtScheme(rawText) {
        const base64 = toBase64Utf8(rawText);
        const urls = [
            'rawbt:base64,' + base64,
            'intent:base64,' + base64 + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;',
            'intent:' + encodeURIComponent(rawText) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;'
        ];

        for (const url of urls) {
            try {
                await openExternalUrl(url);
                return true;
            } catch (e) {
                console.warn('Gagal buka URL RAWBT:', url, e);
            }
        }

        return false;
    }

    async function printRawBT(text) {
        const rawText = String(text || '');
        if (!rawText.trim()) {
            alert('Data thermal kosong. Ulangi buka nota thermal.');
            return false;
        }

        if (printBusy) return true;
        printBusy = true;

        try {
            // Jalur 1: plugin Capacitor native yang dipatch ke MainActivity.
            try {
                if (await printWithCapacitorPlugin(rawText)) return true;
            } catch (e) {
                console.warn('RawBT Capacitor plugin gagal:', e);
            }

            // Jalur 2: fallback JavascriptInterface lama.
            try {
                if (await printWithJavascriptInterface(rawText)) return true;
            } catch (e) {
                console.warn('AndroidRawBT bridge gagal:', e);
            }

            // Jalur 3: fallback rawbt scheme / intent.
            try {
                if (await printWithRawbtScheme(rawText)) return true;
            } catch (e) {
                console.warn('RAWBT scheme/intent gagal:', e);
            }

            alert('Gagal membuka RAWBT. Pastikan RAWBT 7.1.2 terinstall, printer sudah diset di RAWBT, lalu ulangi cetak.');
            return false;
        } finally {
            setTimeout(() => { printBusy = false; }, 1200);
        }
    }


    function sanitizeImageFilename(filename) {
        const raw = String(filename || 'PSM_STRUK.png').trim();
        let safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!safe.toLowerCase().endsWith('.png')) safe += '.png';
        return safe;
    }

    function imageSaverJsReady() {
        try {
            return !!(window.AndroidImageSaver && typeof window.AndroidImageSaver.save === 'function');
        } catch (_) {
            return false;
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForImageSaverBridge(maxMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            if (imageSaverJsReady()) return true;
            await delay(250);
        }
        return imageSaverJsReady();
    }

    function parseNativeJsonResult(res, fallbackMethod) {
        if (!res) return { ok: false, method: fallbackMethod || 'unknown', message: 'Tidak ada respon native' };
        if (typeof res === 'object') return res;
        try { return JSON.parse(String(res)); }
        catch (_) { return { ok: String(res).toLowerCase().includes('ok'), method: fallbackMethod || 'native', message: String(res) }; }
    }

    async function callPsmNative(methodName, payload) {
        if (!isNativeApp()) return false;
        try {
            const p = getPlugin('PsmNative');
            if (p && typeof p[methodName] === 'function') {
                const res = await p[methodName](payload || {});
                return res || { ok: true, method: 'PsmNative.' + methodName };
            }
        } catch (e) {
            console.warn('PsmNative ' + methodName + ' gagal:', e);
            throw e;
        }
        return false;
    }

    async function pingPsmNative() {
        try { return await callPsmNative('ping', {}); }
        catch (_) { return false; }
    }


    function triggerWebViewDownload(dataUrl, filename, kind) {
        try {
            const safeName = kind === 'csv' ? sanitizeCsvFilename(filename) : sanitizeImageFilename(filename);
            const oldTitle = document.title || 'PSM SAWIT';
            document.title = 'PSM_SAVE_' + String(kind || 'file').toUpperCase() + ':' + safeName;
            const a = document.createElement('a');
            a.href = String(dataUrl || '');
            a.download = safeName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { document.body.removeChild(a); } catch (_) {}
                try { document.title = oldTitle; } catch (_) {}
            }, 5000);
            return true;
        } catch (e) {
            console.warn('Fallback download gagal:', e);
            return false;
        }
    }

    function utf8ToBase64(str) {
        try {
            const bytes = new TextEncoder().encode(String(str || ''));
            let bin = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                const part = bytes.slice(i, i + chunk);
                bin += String.fromCharCode.apply(null, Array.from(part));
            }
            return btoa(bin);
        } catch (_) {
            return btoa(unescape(encodeURIComponent(String(str || ''))));
        }
    }

    function buildCsvDataUrl(text) {
        return 'data:text/csv;charset=utf-8;base64,' + utf8ToBase64(String(text || ''));
    }

    async function saveImageWithPsmNative(dataUrl, filename) {
        const safeName = sanitizeImageFilename(filename);
        const res = await callPsmNative('saveImage', {
            dataUrl: String(dataUrl || ''),
            filename: safeName
        });
        if (!res) return false;
        console.log('PsmNative saveImage result:', res);
        toast('Gambar tersimpan di folder PSM SAWIT');
        alert('✅ Gambar tersimpan\n\nNama file: ' + (res && res.filename ? res.filename : safeName) + '\nFolder: Download/PSM SAWIT/Gambar');
        return true;
    }

    async function saveImageWithJavascriptInterface(dataUrl, filename) {
        if (!imageSaverJsReady()) {
            await waitForImageSaverBridge(8000);
        }
        if (!imageSaverJsReady()) return false;

        const safeName = sanitizeImageFilename(filename);
        const rawResult = window.AndroidImageSaver.save(String(dataUrl || ''), safeName);
        const result = parseNativeJsonResult(rawResult, 'AndroidImageSaver');
        console.log('AndroidImageSaver save result:', result);

        if (result && result.ok) {
            toast('Gambar tersimpan di folder PSM SAWIT');
            alert('✅ Gambar tersimpan\n\nNama file: ' + (result.filename || safeName) + '\nFolder: Download/PSM SAWIT/Gambar');
            return true;
        }

        throw new Error(result && result.message ? result.message : 'AndroidImageSaver gagal menyimpan gambar');
    }

    async function saveImageWithCapacitorPlugin(dataUrl, filename) {
        if (!isNativeApp()) return false;

        const safeName = sanitizeImageFilename(filename);
        const res = await callNativePlugin('ImageSaver', 'saveBase64', {
            dataUrl: String(dataUrl || ''),
            filename: safeName
        });

        if (!res) return false;

        console.log('ImageSaver native save result:', res);
        toast('Gambar tersimpan di folder PSM SAWIT');
        alert('✅ Gambar tersimpan\n\nNama file: ' + (res && res.filename ? res.filename : safeName) + '\nFolder: Download/PSM SAWIT/Gambar');
        return true;
    }

    async function saveImage(dataUrl, filename, options = {}) {
        if (!dataUrl || !String(dataUrl).startsWith('data:image')) {
            alert('Data gambar kosong. Ulangi buka preview gambar.');
            return false;
        }

        const errors = [];

        try {
            if (await saveImageWithPsmNative(dataUrl, filename)) return true;
        } catch (e) {
            console.warn('PsmNative ImageSaver gagal:', e);
            errors.push('PsmNativeImage: ' + (e && e.message ? e.message : e));
        }

        try {
            if (await saveImageWithJavascriptInterface(dataUrl, filename)) return true;
        } catch (e) {
            console.warn('AndroidImageSaver gagal:', e);
            errors.push('AndroidImageSaver: ' + (e && e.message ? e.message : e));
        }

        try {
            if (await saveImageWithCapacitorPlugin(dataUrl, filename)) return true;
        } catch (e) {
            console.warn('ImageSaver Capacitor plugin gagal:', e);
            errors.push('ImageSaverPlugin: ' + (e && e.message ? e.message : e));
        }

        // V33 fallback: jika plugin/JavascriptInterface belum ketemu, paksa WebView download.
        // MainActivity V31 punya DownloadListener yang menangkap data:image dan menyimpan ke Download/PSM SAWIT/Gambar.
        if (isNativeApp() && triggerWebViewDownload(dataUrl, filename, 'image')) {
            toast('Gambar dikirim ke penyimpanan');
            alert('✅ Gambar diproses untuk disimpan\n\nFolder tujuan: Download/PSM SAWIT/Gambar\nNama file: ' + sanitizeImageFilename(filename) + '\n\nJika belum terlihat, buka File Manager lalu refresh folder Download.');
            return true;
        }

        if (isNativeApp()) {
            if (!(options && options.silentOnMissing)) {
                alert('Gambar belum berhasil disimpan.\n\nDetail teknis:\n' + (errors.length ? errors.join('\n') : 'Native ImageSaver belum aktif.'));
            }
            return false;
        }

        // Browser/PWA fallback.
        return triggerWebViewDownload(dataUrl, filename, 'image');
    }


    function sanitizeCsvFilename(filename) {
        const raw = String(filename || 'Backup_PSM.csv').trim();
        let safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!safe.toLowerCase().endsWith('.csv')) safe += '.csv';
        return safe;
    }

    function csvSaverJsReady() {
        try {
            return !!(window.AndroidCsvSaver && typeof window.AndroidCsvSaver.save === 'function');
        } catch (_) {
            return false;
        }
    }

    async function waitForCsvSaverBridge(maxMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            if (csvSaverJsReady()) return true;
            await delay(250);
        }
        return csvSaverJsReady();
    }

    async function saveCsvWithPsmNative(csvText, filename) {
        const safeName = sanitizeCsvFilename(filename);
        const res = await callPsmNative('saveCsv', {
            text: String(csvText || ''),
            filename: safeName
        });
        if (!res) return false;
        console.log('PsmNative saveCsv result:', res);
        toast('Backup CSV tersimpan di folder PSM SAWIT');
        return res || { ok: true, filename: safeName, method: 'PsmNative.saveCsv' };
    }

    async function saveCsvWithJavascriptInterface(csvText, filename) {
        if (!csvSaverJsReady()) {
            await waitForCsvSaverBridge(8000);
        }
        if (!csvSaverJsReady()) return false;

        const safeName = sanitizeCsvFilename(filename);
        const rawResult = window.AndroidCsvSaver.save(String(csvText || ''), safeName);
        const result = parseNativeJsonResult(rawResult, 'AndroidCsvSaver');
        console.log('AndroidCsvSaver save result:', result);

        if (result && result.ok) {
            toast('Backup CSV tersimpan di folder PSM SAWIT');
            return result;
        }

        throw new Error(result && result.message ? result.message : 'AndroidCsvSaver gagal menyimpan CSV');
    }

    async function saveCsvWithCapacitorPlugin(csvText, filename) {
        if (!isNativeApp()) return false;

        const safeName = sanitizeCsvFilename(filename);
        const res = await callNativePlugin('CsvSaver', 'save', {
            text: String(csvText || ''),
            filename: safeName
        });

        if (!res) return false;

        console.log('CsvSaver native save result:', res);
        toast('Backup CSV tersimpan di folder PSM SAWIT');
        return res || { ok: true, filename: safeName, method: 'CsvSaver' };
    }

    async function saveCsv(csvText, filename, options = {}) {
        const safeName = sanitizeCsvFilename(filename);
        const silent = !!(options && options.silent);
        if (!csvText || String(csvText).trim().length === 0) {
            if (!silent) alert('Data backup CSV kosong.');
            return false;
        }

        const errors = [];

        try {
            const result = await saveCsvWithPsmNative(csvText, safeName);
            if (result) {
                if (!silent) alert('✅ Backup CSV tersimpan\n\nNama file: ' + (result.filename || safeName) + '\nFolder: Download/PSM SAWIT/Backup');
                return true;
            }
        } catch (e) {
            console.warn('PsmNative CsvSaver gagal:', e);
            errors.push('PsmNativeCsv: ' + (e && e.message ? e.message : e));
        }

        try {
            const result = await saveCsvWithJavascriptInterface(csvText, safeName);
            if (result) {
                if (!silent) alert('✅ Backup CSV tersimpan di folder PSM SAWIT\n\nNama file: ' + (result.filename || safeName) + '\nFolder: Download/PSM SAWIT/Backup');
                return true;
            }
        } catch (e) {
            console.warn('AndroidCsvSaver gagal:', e);
            errors.push('AndroidCsvSaver: ' + (e && e.message ? e.message : e));
        }

        try {
            const result = await saveCsvWithCapacitorPlugin(csvText, safeName);
            if (result) {
                if (!silent) alert('✅ Backup CSV tersimpan di folder PSM SAWIT\n\nNama file: ' + (result.filename || safeName) + '\nFolder: Download/PSM SAWIT/Backup');
                return true;
            }
        } catch (e) {
            console.warn('CsvSaver Capacitor plugin gagal:', e);
            errors.push('CsvSaverPlugin: ' + (e && e.message ? e.message : e));
        }

        // V33 fallback: paksa download data:text/csv.
        // MainActivity V31 menangkap data:text/csv dan menyimpan ke Download/PSM SAWIT/Backup.
        const csvDataUrl = buildCsvDataUrl(csvText);
        if (isNativeApp() && triggerWebViewDownload(csvDataUrl, safeName, 'csv')) {
            toast('Backup dikirim ke penyimpanan');
            if (!silent) alert('✅ Backup CSV diproses untuk disimpan\n\nFolder tujuan: Download/PSM SAWIT/Backup\nNama file: ' + safeName + '\n\nJika belum terlihat, buka File Manager lalu refresh folder Download.');
            return true;
        }

        if (isNativeApp()) {
            if (!silent) alert('Backup CSV belum berhasil disimpan.\n\nDetail teknis:\n' + (errors.length ? errors.join('\n') : 'Native CsvSaver belum aktif.'));
            return false;
        }

        return triggerWebViewDownload(csvDataUrl, safeName, 'csv');
    }

    async function init() {
        await initStatusBar();
        initBackButton();
    }

    return {
        isNativeApp,
        init,
        printRawBT,
        printRawBTBase64Bytes,
        saveImage,
        saveCsv,
        openExternalUrl,
        androidRawBTReady
    };
})();

window.NativeBridge = NativeBridge;

document.addEventListener('DOMContentLoaded', () => {
    NativeBridge.init();
});
