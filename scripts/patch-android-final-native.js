const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const pkgPath = appId.split('.').join(path.sep);
const javaDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', pkgPath);
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const rawbtPluginPath = path.join(javaDir, 'RawBTPlugin.java');
const downloadFallbackHelperPath = path.join(javaDir, 'DownloadFallbackHelper.java');

if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

const mainActivityJava = `package ${appId};

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RawBTPlugin.class);
        registerPlugin(ImageSaverPlugin.class);
        registerPlugin(CsvSaverPlugin.class);
        super.onCreate(savedInstanceState);
        installJavascriptBridgesRepeated();
        installDownloadFallbackOnce();
    }

    @Override
    public void onResume() {
        super.onResume();
        installJavascriptBridgesRepeated();
        installDownloadFallbackOnce();
    }

    private void installJavascriptBridgesRepeated() {
        final Handler handler = new Handler(Looper.getMainLooper());
        for (int i = 0; i < 60; i++) {
            final int delayMs = i * 1000;
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    installJavascriptBridgesOnce();
                }
            }, delayMs);
        }
    }

    private void installJavascriptBridgesOnce() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
                this.bridge.getWebView().addJavascriptInterface(new RawBTJavascriptBridge(), "AndroidRawBT");
                this.bridge.getWebView().addJavascriptInterface(new ImageSaverJavascriptBridge(), "AndroidImageSaver");
                this.bridge.getWebView().addJavascriptInterface(new CsvSaverJavascriptBridge(), "AndroidCsvSaver");
            }
        } catch (Exception ignored) {}
    }

    private void installDownloadFallbackOnce() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                final android.webkit.WebView webView = this.bridge.getWebView();
                webView.setDownloadListener(new android.webkit.DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                        try {
                            DownloadFallbackHelper.SaveResult result = DownloadFallbackHelper.saveFromDownload(
                                MainActivity.this,
                                webView,
                                url,
                                contentDisposition,
                                mimeType
                            );
                            android.widget.Toast.makeText(MainActivity.this, result.message, android.widget.Toast.LENGTH_LONG).show();
                        } catch (Exception e) {
                            android.widget.Toast.makeText(MainActivity.this, "Gagal menyimpan file: " + e.getMessage(), android.widget.Toast.LENGTH_LONG).show();
                        }
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    public class RawBTJavascriptBridge {
        @android.webkit.JavascriptInterface
        public String print(final String text) {
            try {
                RawBTPrinter.PrintResult r = RawBTPrinter.print(MainActivity.this, text);
                return r.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"AndroidRawBT\\\",\\\"message\\\":\\\"" + RawBTPrinter.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }

        @android.webkit.JavascriptInterface
        public String printBase64Bytes(final String base64) {
            try {
                RawBTPrinter.PrintResult r = RawBTPrinter.printBase64Bytes(MainActivity.this, base64);
                return r.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"AndroidRawBTBytes\\\",\\\"message\\\":\\\"" + RawBTPrinter.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }

        @android.webkit.JavascriptInterface
        public boolean isReady() {
            return RawBTPrinter.isInstalled(MainActivity.this);
        }
    }

    public class ImageSaverJavascriptBridge {
        @android.webkit.JavascriptInterface
        public String save(final String dataUrl, final String filename) {
            try {
                ImageSaverResult result = ImageSaverHelper.save(MainActivity.this, dataUrl, filename);
                return result.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"AndroidImageSaver\\\",\\\"message\\\":\\\"" + ImageSaverHelper.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }

        @android.webkit.JavascriptInterface
        public boolean isReady() {
            return true;
        }
    }

    public class CsvSaverJavascriptBridge {
        @android.webkit.JavascriptInterface
        public String save(final String text, final String filename) {
            try {
                CsvSaverResult result = CsvSaverHelper.save(MainActivity.this, text, filename);
                return result.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"AndroidCsvSaver\\\",\\\"message\\\":\\\"" + CsvSaverHelper.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }

        @android.webkit.JavascriptInterface
        public boolean isReady() {
            return true;
        }
    }
}
`;

let rawbt = fs.readFileSync(rawbtPluginPath, 'utf8');
if (!rawbt.includes('printBase64Bytes(final PluginCall call)')) {
  rawbt = rawbt.replace(`    @PluginMethod\n    public void isReady(PluginCall call) {`, `    @PluginMethod
    public void printBase64Bytes(final PluginCall call) {
        final String base64 = call.getString("base64", "");
        final Activity activity = getActivity();

        if (activity == null) {
            call.reject("Activity tidak tersedia");
            return;
        }

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                RawBTPrinter.PrintResult result = RawBTPrinter.printBase64Bytes(activity, base64);
                JSObject ret = new JSObject();
                ret.put("ok", result.ok);
                ret.put("method", result.method);
                ret.put("message", result.message);
                if (result.ok) call.resolve(ret); else call.reject(result.message);
            }
        });
    }

    @PluginMethod
    public void isReady(PluginCall call) {`);
}
if (!rawbt.includes('static PrintResult printBytes(Context context, byte[] bytes)')) {
  rawbt = rawbt.replace(`    static PrintResult print(Context context, String text) {`, `    static PrintResult printBase64Bytes(Context context, String base64) {
        try {
            if (base64 == null) base64 = "";
            base64 = base64.replaceAll("\\\\s+", "");
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return printBytes(context, bytes);
        } catch (Exception e) {
            return new PrintResult(false, "base64-bytes", "Data base64 thermal tidak valid: " + e.getMessage());
        }
    }

    static PrintResult printBytes(Context context, byte[] bytes) {
        if (context == null) return new PrintResult(false, "none", "Context tidak tersedia");
        if (bytes == null || bytes.length == 0) return new PrintResult(false, "bytes", "Data thermal kosong");

        if (!isInstalled(context)) {
            try {
                Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + RAWBT_PACKAGE));
                market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(market);
            } catch (Exception ignored) {}
            Toast.makeText(context, "RAWBT belum terinstall.", Toast.LENGTH_LONG).show();
            return new PrintResult(false, "installed-check", "RAWBT belum terinstall");
        }

        String base64Default = "base64," + Base64.encodeToString(bytes, Base64.DEFAULT);
        String base64NoWrap = "base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);

        PrintResult r;
        r = start(context, new Intent(Intent.ACTION_VIEW, Uri.parse("rawbt:" + base64Default)), "rawbt-bytes-base64-default");
        if (r.ok) return r;

        r = start(context, new Intent(Intent.ACTION_VIEW, Uri.parse("rawbt:" + base64NoWrap)), "rawbt-bytes-base64-nowrap");
        if (r.ok) return r;

        Intent i3 = new Intent(RAWBT_ACTION);
        i3.putExtra(RAWBT_EXTRA_DATA, base64Default);
        r = start(context, i3, "print-rawbt-bytes-extra-base64-default");
        if (r.ok) return r;

        try {
            File dir = new File(context.getCacheDir(), "rawbt");
            if (!dir.exists()) dir.mkdirs();
            File file = new File(dir, "psm_rawbt.bin");
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.flush();
            fos.close();
            Uri uri = FileProvider.getUriForFile(context, "${appId}.fileprovider", file);
            context.grantUriPermission(RAWBT_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            Intent i6 = new Intent(Intent.ACTION_VIEW);
            i6.setDataAndType(uri, "application/octet-stream");
            i6.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            r = start(context, i6, "content-file-binary");
            if (r.ok) return r;
        } catch (Exception e) {
            r = new PrintResult(false, "content-file-binary", e.getMessage());
        }

        return new PrintResult(false, "bytes-all", "Semua jalur RAWBT bytes gagal");
    }

    static String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\\\", "\\\\\\\\").replace("\\\"", "'").replace("\\n", " ").replace("\\r", " ");
    }

    static PrintResult print(Context context, String text) {`);
}



const downloadFallbackHelperJava = `package ${appId};

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.URLUtil;
import android.webkit.WebView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.util.Base64;

class DownloadFallbackHelper {
    static class SaveResult {
        boolean ok;
        String message;
        String filename;
        String uri;
        SaveResult(boolean ok, String message, String filename, String uri) {
            this.ok = ok;
            this.message = message;
            this.filename = filename;
            this.uri = uri;
        }
    }

    static SaveResult saveFromDownload(Context context, WebView webView, String url, String contentDisposition, String mimeType) throws Exception {
        if (context == null) throw new Exception("Context Android kosong");
        if (url == null || url.length() == 0) throw new Exception("URL download kosong");

        String title = webView != null ? webView.getTitle() : "";
        String filename = filenameFromTitle(title);
        if (filename.length() == 0) filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (filename == null || filename.trim().length() == 0) filename = "PSM_SAWIT_FILE_" + System.currentTimeMillis();

        if (url.startsWith("data:")) {
            ParsedData parsed = parseDataUrl(url);
            String lower = filename.toLowerCase();
            if (parsed.mime.contains("csv") || lower.endsWith(".csv")) {
                filename = ensureExt(safeFileName(filename), ".csv");
                String uri = saveBytes(context, parsed.bytes, filename, "text/csv", "Backup");
                return new SaveResult(true, "Backup CSV tersimpan: Download/PSM SAWIT/Backup", filename, uri);
            }
            filename = ensureExt(safeFileName(filename), ".png");
            String uri = saveBytes(context, parsed.bytes, filename, "image/png", "Gambar");
            return new SaveResult(true, "Gambar tersimpan: Download/PSM SAWIT/Gambar", filename, uri);
        }

        throw new Exception("Download fallback hanya menerima data URL dari aplikasi");
    }

    static String filenameFromTitle(String title) {
        if (title == null) return "";
        String prefixImg = "PSM_SAVE_IMAGE:";
        String prefixCsv = "PSM_SAVE_CSV:";
        if (title.startsWith(prefixImg)) return safeFileName(title.substring(prefixImg.length()));
        if (title.startsWith(prefixCsv)) return safeFileName(title.substring(prefixCsv.length()));
        return "";
    }

    static class ParsedData {
        String mime;
        byte[] bytes;
        ParsedData(String mime, byte[] bytes) { this.mime = mime; this.bytes = bytes; }
    }

    static ParsedData parseDataUrl(String url) throws Exception {
        int comma = url.indexOf(',');
        if (comma < 0) throw new Exception("Format data URL tidak valid");
        String meta = url.substring(5, comma).toLowerCase();
        String raw = url.substring(comma + 1);
        String mime = meta.split(";")[0];
        byte[] bytes;
        if (meta.contains("base64")) {
            raw = raw.replace("\\n", "").replace("\\r", "").replace(" ", "");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) bytes = Base64.getDecoder().decode(raw);
            else bytes = android.util.Base64.decode(raw, android.util.Base64.DEFAULT);
        } else {
            String decoded = URLDecoder.decode(raw, "UTF-8");
            bytes = decoded.getBytes("UTF-8");
        }
        if (bytes == null || bytes.length == 0) throw new Exception("Isi file kosong");
        return new ParsedData(mime == null ? "" : mime, bytes);
    }

    static String saveBytes(Context context, byte[] bytes, String filename, String mime, String subFolder) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + "PSM SAWIT" + File.separator + subFolder);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("MediaStore gagal membuat file");
            OutputStream out = null;
            try {
                out = resolver.openOutputStream(uri);
                if (out == null) throw new Exception("OutputStream tidak tersedia");
                out.write(bytes);
                out.flush();
            } finally {
                if (out != null) out.close();
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            MediaScannerConnection.scanFile(context, new String[]{ uri.toString() }, new String[]{ mime }, null);
            return uri.toString();
        }

        File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File folder = new File(new File(downloads, "PSM SAWIT"), subFolder);
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Folder gagal dibuat: " + folder.getAbsolutePath());
        File file = new File(folder, filename);
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(file);
            out.write(bytes);
            out.flush();
        } finally {
            if (out != null) out.close();
        }
        MediaScannerConnection.scanFile(context, new String[]{ file.getAbsolutePath() }, new String[]{ mime }, null);
        return file.getAbsolutePath();
    }

    static String safeFileName(String input) {
        String raw = input == null ? "" : input.trim();
        if (raw.length() == 0) raw = "PSM_SAWIT_FILE_" + System.currentTimeMillis();
        return raw.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    static String ensureExt(String name, String ext) {
        if (name == null || name.trim().length() == 0) name = "PSM_SAWIT_FILE_" + System.currentTimeMillis();
        if (!name.toLowerCase().endsWith(ext)) name += ext;
        return name;
    }
}
`;

fs.writeFileSync(mainActivityPath, mainActivityJava);
fs.writeFileSync(rawbtPluginPath, rawbt);
fs.writeFileSync(downloadFallbackHelperPath, downloadFallbackHelperJava);
console.log('Final native MainActivity + RawBT bytes + DownloadFallbackHelper patched.');
