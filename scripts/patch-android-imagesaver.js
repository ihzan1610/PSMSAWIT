const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const pkgPath = appId.split('.').join(path.sep);
const javaDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', pkgPath);
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const imageSaverPluginPath = path.join(javaDir, 'ImageSaverPlugin.java');

if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

function patchMainActivity() {
  if (!fs.existsSync(mainActivityPath)) {
    throw new Error('MainActivity.java belum ada. Jalankan patch RAWBT / cap sync dulu.');
  }

  let main = fs.readFileSync(mainActivityPath, 'utf8');

  if (!main.includes('registerPlugin(ImageSaverPlugin.class);')) {
    if (main.includes('registerPlugin(RawBTPlugin.class);')) {
      main = main.replace('registerPlugin(RawBTPlugin.class);', 'registerPlugin(RawBTPlugin.class);\n        registerPlugin(ImageSaverPlugin.class);');
    } else if (main.includes('super.onCreate(savedInstanceState);')) {
      main = main.replace('super.onCreate(savedInstanceState);', 'registerPlugin(ImageSaverPlugin.class);\n        super.onCreate(savedInstanceState);');
    }
  }

  if (!main.includes('addJavascriptInterface(new ImageSaverJavascriptBridge(), "AndroidImageSaver")')) {
    const rawbtLine = 'this.bridge.getWebView().addJavascriptInterface(new RawBTJavascriptBridge(), "AndroidRawBT");';
    if (main.includes(rawbtLine)) {
      main = main.replace(rawbtLine, rawbtLine + '\n                this.bridge.getWebView().addJavascriptInterface(new ImageSaverJavascriptBridge(), "AndroidImageSaver");');
    } else if (main.includes('this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);')) {
      main = main.replace('this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);', 'this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);\n                this.bridge.getWebView().addJavascriptInterface(new ImageSaverJavascriptBridge(), "AndroidImageSaver");');
    }
  }

  if (!main.includes('class ImageSaverJavascriptBridge')) {
    const bridgeClass = `

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
`;
    const idx = main.lastIndexOf('\n}');
    if (idx === -1) throw new Error('Format MainActivity.java tidak dikenali');
    main = main.slice(0, idx) + bridgeClass + main.slice(idx);
  }

  fs.writeFileSync(mainActivityPath, main);
}

const imageSaverJava = `package ${appId};

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "ImageSaver")
public class ImageSaverPlugin extends Plugin {
    @PluginMethod
    public void saveBase64(final PluginCall call) {
        final String dataUrl = call.getString("dataUrl", "");
        final String filename = call.getString("filename", "PSM_STRUK.png");

        try {
            ImageSaverResult result = ImageSaverHelper.save(getContext(), dataUrl, filename);
            JSObject ret = new JSObject();
            ret.put("ok", result.ok);
            ret.put("method", result.method);
            ret.put("message", result.message);
            ret.put("filename", result.filename);
            ret.put("uri", result.uri);
            if (result.ok) call.resolve(ret); else call.reject(result.message);
        } catch (Exception e) {
            call.reject("Gagal menyimpan gambar: " + e.getMessage());
        }
    }
}

class ImageSaverResult {
    boolean ok;
    String method;
    String message;
    String filename;
    String uri;

    ImageSaverResult(boolean ok, String method, String message, String filename, String uri) {
        this.ok = ok;
        this.method = method;
        this.message = message;
        this.filename = filename;
        this.uri = uri;
    }

    String toJson() {
        return "{\\\"ok\\\":" + ok +
            ",\\\"method\\\":\\\"" + ImageSaverHelper.jsonEscape(method) + "\\\"" +
            ",\\\"message\\\":\\\"" + ImageSaverHelper.jsonEscape(message) + "\\\"" +
            ",\\\"filename\\\":\\\"" + ImageSaverHelper.jsonEscape(filename) + "\\\"" +
            ",\\\"uri\\\":\\\"" + ImageSaverHelper.jsonEscape(uri) + "\\\"}";
    }
}

class ImageSaverHelper {
    static ImageSaverResult save(Context context, String dataUrl, String filename) throws Exception {
        if (context == null) throw new Exception("Context Android tidak tersedia");

        String safeName = safeFileName(filename);
        byte[] bytes = decodePng(dataUrl);
        if (bytes.length == 0) throw new Exception("Data gambar kosong");

        String uri = savePngToPsmFolder(context, bytes, safeName);
        return new ImageSaverResult(true, "MediaStoreDownloads", "Gambar tersimpan di folder PSM SAWIT", safeName, uri);
    }

    static String safeFileName(String input) {
        String raw = input == null ? "PSM_STRUK.png" : input.trim();
        if (raw.length() == 0) raw = "PSM_STRUK.png";
        raw = raw.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!raw.toLowerCase().endsWith(".png")) raw += ".png";
        return raw;
    }

    static byte[] decodePng(String dataUrl) throws Exception {
        String raw = dataUrl == null ? "" : dataUrl.trim();
        int comma = raw.indexOf(',');
        if (raw.startsWith("data:image") && comma >= 0) raw = raw.substring(comma + 1);
        raw = raw.replace("\\n", "").replace("\\r", "").replace(" ", "");
        if (raw.length() == 0) throw new Exception("Base64 gambar kosong");
        return Base64.decode(raw, Base64.DEFAULT);
    }

    static String savePngToPsmFolder(Context context, byte[] bytes, String filename) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, "image/png");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + "PSM SAWIT" + File.separator + "Gambar");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("MediaStore Downloads gagal membuat file gambar");

            OutputStream out = null;
            try {
                out = resolver.openOutputStream(uri);
                if (out == null) throw new Exception("OutputStream gambar tidak tersedia");
                out.write(bytes);
                out.flush();
            } finally {
                if (out != null) out.close();
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            MediaScannerConnection.scanFile(context, new String[]{ uri.toString() }, new String[]{ "image/png" }, null);
            return uri.toString();
        }

        File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File folder = new File(new File(downloads, "PSM SAWIT"), "Gambar");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Folder Download/PSM SAWIT/Gambar gagal dibuat");

        File file = new File(folder, filename);
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(file);
            out.write(bytes);
            out.flush();
        } finally {
            if (out != null) out.close();
        }

        MediaScannerConnection.scanFile(context, new String[]{ file.getAbsolutePath() }, new String[]{ "image/png" }, null);
        return file.getAbsolutePath();
    }

    static String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\\\", "\\\\\\\\").replace("\\\"", "'").replace("\\n", " ").replace("\\r", " ");
    }
}
`;

patchMainActivity();
fs.writeFileSync(imageSaverPluginPath, imageSaverJava);
console.log('ImageSaverPlugin.java written:', imageSaverPluginPath);
console.log('MainActivity.java patched with AndroidImageSaver bridge and ImageSaverPlugin:', mainActivityPath);
