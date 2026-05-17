const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const pkgPath = appId.split('.').join(path.sep);
const javaDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', pkgPath);
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const psmNativePath = path.join(javaDir, 'PsmNativePlugin.java');

if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

const java = `package ${appId};

import android.app.Activity;
import android.webkit.JavascriptInterface;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PsmNative")
public class PsmNativePlugin extends Plugin {
    @Override
    public void load() {
        super.load();
        installJavascriptInterfaces();
    }

    private void installJavascriptInterfaces() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
                this.bridge.getWebView().addJavascriptInterface(new PsmImageSaverBridge(), "AndroidImageSaver");
                this.bridge.getWebView().addJavascriptInterface(new PsmCsvSaverBridge(), "AndroidCsvSaver");
                this.bridge.getWebView().addJavascriptInterface(new PsmRawBTBridge(), "AndroidRawBT");
            }
        } catch (Exception ignored) {}
    }

    private void putResult(JSObject ret, boolean ok, String method, String message, String filename, String uri) {
        ret.put("ok", ok);
        ret.put("method", method == null ? "PsmNative" : method);
        ret.put("message", message == null ? "" : message);
        ret.put("filename", filename == null ? "" : filename);
        ret.put("uri", uri == null ? "" : uri);
    }

    @PluginMethod
    public void ping(PluginCall call) {
        installJavascriptInterfaces();
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("message", "PsmNative aktif");
        call.resolve(ret);
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        installJavascriptInterfaces();
        final String dataUrl = call.getString("dataUrl", "");
        final String filename = call.getString("filename", "PSM_STRUK.png");
        try {
            ImageSaverResult result = ImageSaverHelper.save(getContext(), dataUrl, filename);
            JSObject ret = new JSObject();
            putResult(ret, result.ok, result.method, result.message, result.filename, result.uri);
            if (result.ok) call.resolve(ret); else call.reject(result.message);
        } catch (Exception e) {
            call.reject("PsmNative gagal menyimpan gambar: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveCsv(PluginCall call) {
        installJavascriptInterfaces();
        final String text = call.getString("text", "");
        final String filename = call.getString("filename", "Backup_PSM.csv");
        try {
            CsvSaverResult result = CsvSaverHelper.save(getContext(), text, filename);
            JSObject ret = new JSObject();
            putResult(ret, result.ok, result.method, result.message, result.filename, result.uri);
            if (result.ok) call.resolve(ret); else call.reject(result.message);
        } catch (Exception e) {
            call.reject("PsmNative gagal menyimpan CSV: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printRawBT(PluginCall call) {
        installJavascriptInterfaces();
        final String text = call.getString("text", "");
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity Android tidak tersedia");
            return;
        }
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                RawBTPrinter.PrintResult result = RawBTPrinter.print(activity, text);
                JSObject ret = new JSObject();
                ret.put("ok", result.ok);
                ret.put("method", result.method);
                ret.put("message", result.message);
                if (result.ok) call.resolve(ret); else call.reject(result.message);
            }
        });
    }

    @PluginMethod
    public void printRawBTBase64Bytes(PluginCall call) {
        installJavascriptInterfaces();
        final String base64 = call.getString("base64", "");
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity Android tidak tersedia");
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

    public class PsmImageSaverBridge {
        @JavascriptInterface
        public String save(final String dataUrl, final String filename) {
            try {
                ImageSaverResult result = ImageSaverHelper.save(getContext(), dataUrl, filename);
                return result.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"PsmNative.AndroidImageSaver\\\",\\\"message\\\":\\\"" + ImageSaverHelper.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }
        @JavascriptInterface
        public boolean isReady() { return true; }
    }

    public class PsmCsvSaverBridge {
        @JavascriptInterface
        public String save(final String text, final String filename) {
            try {
                CsvSaverResult result = CsvSaverHelper.save(getContext(), text, filename);
                return result.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"PsmNative.AndroidCsvSaver\\\",\\\"message\\\":\\\"" + CsvSaverHelper.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }
        @JavascriptInterface
        public boolean isReady() { return true; }
    }

    public class PsmRawBTBridge {
        @JavascriptInterface
        public String print(final String text) {
            try {
                RawBTPrinter.PrintResult r = RawBTPrinter.print(getContext(), text);
                return r.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"PsmNative.AndroidRawBT\\\",\\\"message\\\":\\\"" + RawBTPrinter.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }
        @JavascriptInterface
        public String printBase64Bytes(final String base64) {
            try {
                RawBTPrinter.PrintResult r = RawBTPrinter.printBase64Bytes(getContext(), base64);
                return r.toJson();
            } catch (Exception e) {
                return "{\\\"ok\\\":false,\\\"method\\\":\\\"PsmNative.AndroidRawBTBytes\\\",\\\"message\\\":\\\"" + RawBTPrinter.jsonEscape(e.getMessage()) + "\\\"}";
            }
        }
        @JavascriptInterface
        public boolean isReady() { return RawBTPrinter.isInstalled(getContext()); }
    }
}
`;

fs.writeFileSync(psmNativePath, java);

let main = fs.readFileSync(mainActivityPath, 'utf8');
if (!main.includes('registerPlugin(PsmNativePlugin.class);')) {
  if (main.includes('registerPlugin(RawBTPlugin.class);')) {
    main = main.replace('registerPlugin(RawBTPlugin.class);', 'registerPlugin(PsmNativePlugin.class);\n        registerPlugin(RawBTPlugin.class);');
  } else {
    main = main.replace('super.onCreate(savedInstanceState);', 'registerPlugin(PsmNativePlugin.class);\n        super.onCreate(savedInstanceState);');
  }
}
fs.writeFileSync(mainActivityPath, main);

console.log('PsmNativePlugin.java written:', psmNativePath);
console.log('MainActivity.java patched with PsmNativePlugin:', mainActivityPath);
