const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const pkgPath = appId.split('.').join(path.sep);
const javaDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', pkgPath);
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const csvSaverPluginPath = path.join(javaDir, 'CsvSaverPlugin.java');

if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

function patchMainActivity() {
  if (!fs.existsSync(mainActivityPath)) {
    throw new Error('MainActivity.java belum ada. Jalankan cap sync dan patch native sebelumnya dulu.');
  }

  let main = fs.readFileSync(mainActivityPath, 'utf8');

  if (!main.includes('registerPlugin(CsvSaverPlugin.class);')) {
    if (main.includes('registerPlugin(ImageSaverPlugin.class);')) {
      main = main.replace('registerPlugin(ImageSaverPlugin.class);', 'registerPlugin(ImageSaverPlugin.class);\n        registerPlugin(CsvSaverPlugin.class);');
    } else if (main.includes('registerPlugin(RawBTPlugin.class);')) {
      main = main.replace('registerPlugin(RawBTPlugin.class);', 'registerPlugin(RawBTPlugin.class);\n        registerPlugin(CsvSaverPlugin.class);');
    } else if (main.includes('super.onCreate(savedInstanceState);')) {
      main = main.replace('super.onCreate(savedInstanceState);', 'registerPlugin(CsvSaverPlugin.class);\n        super.onCreate(savedInstanceState);');
    }
  }

  if (!main.includes('addJavascriptInterface(new CsvSaverJavascriptBridge(), "AndroidCsvSaver")')) {
    const imageLine = 'this.bridge.getWebView().addJavascriptInterface(new ImageSaverJavascriptBridge(), "AndroidImageSaver");';
    const rawbtLine = 'this.bridge.getWebView().addJavascriptInterface(new RawBTJavascriptBridge(), "AndroidRawBT");';
    if (main.includes(imageLine)) {
      main = main.replace(imageLine, imageLine + '\n                this.bridge.getWebView().addJavascriptInterface(new CsvSaverJavascriptBridge(), "AndroidCsvSaver");');
    } else if (main.includes(rawbtLine)) {
      main = main.replace(rawbtLine, rawbtLine + '\n                this.bridge.getWebView().addJavascriptInterface(new CsvSaverJavascriptBridge(), "AndroidCsvSaver");');
    } else if (main.includes('this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);')) {
      main = main.replace('this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);', 'this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);\n                this.bridge.getWebView().addJavascriptInterface(new CsvSaverJavascriptBridge(), "AndroidCsvSaver");');
    }
  }

  if (!main.includes('class CsvSaverJavascriptBridge')) {
    const bridgeClass = `

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
`;
    const idx = main.lastIndexOf('\n}');
    if (idx === -1) throw new Error('Format MainActivity.java tidak dikenali');
    main = main.slice(0, idx) + bridgeClass + main.slice(idx);
  }

  fs.writeFileSync(mainActivityPath, main);
}

const csvSaverJava = `package ${appId};

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CsvSaver")
public class CsvSaverPlugin extends Plugin {
    @PluginMethod
    public void save(final PluginCall call) {
        final String text = call.getString("text", "");
        final String filename = call.getString("filename", "Backup_PSM.csv");

        try {
            CsvSaverResult result = CsvSaverHelper.save(getContext(), text, filename);
            JSObject ret = new JSObject();
            ret.put("ok", result.ok);
            ret.put("method", result.method);
            ret.put("message", result.message);
            ret.put("filename", result.filename);
            ret.put("uri", result.uri);
            if (result.ok) call.resolve(ret); else call.reject(result.message);
        } catch (Exception e) {
            call.reject("Gagal menyimpan CSV: " + e.getMessage());
        }
    }
}

class CsvSaverResult {
    boolean ok;
    String method;
    String message;
    String filename;
    String uri;

    CsvSaverResult(boolean ok, String method, String message, String filename, String uri) {
        this.ok = ok;
        this.method = method;
        this.message = message;
        this.filename = filename;
        this.uri = uri;
    }

    String toJson() {
        return "{\\\"ok\\\":" + ok +
            ",\\\"method\\\":\\\"" + CsvSaverHelper.jsonEscape(method) + "\\\"" +
            ",\\\"message\\\":\\\"" + CsvSaverHelper.jsonEscape(message) + "\\\"" +
            ",\\\"filename\\\":\\\"" + CsvSaverHelper.jsonEscape(filename) + "\\\"" +
            ",\\\"uri\\\":\\\"" + CsvSaverHelper.jsonEscape(uri) + "\\\"}";
    }
}

class CsvSaverHelper {
    static CsvSaverResult save(Context context, String text, String filename) throws Exception {
        if (context == null) throw new Exception("Context Android tidak tersedia");

        String safeName = safeFileName(filename);
        String rawText = text == null ? "" : text;
        if (rawText.trim().length() == 0) throw new Exception("Isi CSV kosong");

        byte[] bytes = rawText.getBytes(StandardCharsets.UTF_8);
        String uri = saveCsvToDownloads(context, bytes, safeName);
        return new CsvSaverResult(true, "MediaStoreDownloads", "CSV tersimpan di folder PSM SAWIT", safeName, uri);
    }

    static String safeFileName(String input) {
        String raw = input == null ? "Backup_PSM.csv" : input.trim();
        if (raw.length() == 0) raw = "Backup_PSM.csv";
        raw = raw.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!raw.toLowerCase().endsWith(".csv")) raw += ".csv";
        return raw;
    }

    static String saveCsvToDownloads(Context context, byte[] bytes, String filename) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, "text/csv");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + "PSM SAWIT" + File.separator + "Backup");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("MediaStore Downloads gagal membuat file");

            OutputStream out = null;
            try {
                out = resolver.openOutputStream(uri);
                if (out == null) throw new Exception("OutputStream CSV tidak tersedia");
                out.write(bytes);
                out.flush();
            } finally {
                if (out != null) out.close();
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            MediaScannerConnection.scanFile(context, new String[]{ uri.toString() }, new String[]{ "text/csv" }, null);
            return uri.toString();
        }

        File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File folder = new File(new File(downloads, "PSM SAWIT"), "Backup");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Folder Download/PSM SAWIT/Backup gagal dibuat");

        File file = new File(folder, filename);
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(file);
            out.write(bytes);
            out.flush();
        } finally {
            if (out != null) out.close();
        }

        MediaScannerConnection.scanFile(context, new String[]{ file.getAbsolutePath() }, new String[]{ "text/csv" }, null);
        return file.getAbsolutePath();
    }

    static String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\\\", "\\\\\\\\").replace("\\\"", "'").replace("\\n", " ").replace("\\r", " ");
    }
}
`;

patchMainActivity();
fs.writeFileSync(csvSaverPluginPath, csvSaverJava);
console.log('CsvSaverPlugin.java written:', csvSaverPluginPath);
console.log('MainActivity.java patched with AndroidCsvSaver bridge and CsvSaverPlugin:', mainActivityPath);
