const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const pkgPath = appId.split('.').join(path.sep);
const javaDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', pkgPath);
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const rawbtPluginPath = path.join(javaDir, 'RawBTPlugin.java');
const resXmlDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'xml');
const filePathsPath = path.join(resXmlDir, 'psm_file_paths.xml');

fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resXmlDir, { recursive: true });

const mainActivityJava = `package ${appId};

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RawBTPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
                this.bridge.getWebView().addJavascriptInterface(new RawBTJavascriptBridge(), "AndroidRawBT");
            }
        } catch (Exception ignored) {}
    }

    public class RawBTJavascriptBridge {
        @android.webkit.JavascriptInterface
        public String print(final String text) {
            final String[] result = new String[]{"QUEUED"};
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    RawBTPrinter.PrintResult r = RawBTPrinter.print(MainActivity.this, text);
                    result[0] = r.toJson();
                }
            });
            return result[0];
        }

        @android.webkit.JavascriptInterface
        public boolean isReady() {
            return RawBTPrinter.isInstalled(MainActivity.this);
        }
    }
}
`;

const rawbtPluginJava = `package ${appId};

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "RawBT")
public class RawBTPlugin extends Plugin {
    @PluginMethod
    public void print(final PluginCall call) {
        final String text = call.getString("text", "");
        final Activity activity = getActivity();

        if (activity == null) {
            call.reject("Activity tidak tersedia");
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
                if (result.ok) {
                    call.resolve(ret);
                } else {
                    call.reject(result.message);
                }
            }
        });
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("installed", RawBTPrinter.isInstalled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void test(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity tidak tersedia");
            return;
        }
        RawBTPrinter.PrintResult result = RawBTPrinter.print(activity, "PSM SAWIT TEST RAWBT\\nJika tulisan ini keluar, jalur RAWBT aktif.\\n\\n\\n");
        JSObject ret = new JSObject();
        ret.put("ok", result.ok);
        ret.put("method", result.method);
        ret.put("message", result.message);
        if (result.ok) call.resolve(ret); else call.reject(result.message);
    }
}

class RawBTPrinter {
    static final String RAWBT_PACKAGE = "ru.a402d.rawbtprinter";
    static final String RAWBT_ACTION = "ru.a402d.rawbtprinter.action.PRINT_RAWBT";
    static final String RAWBT_EXTRA_DATA = "ru.a402d.rawbtprinter.extra.DATA";

    static class PrintResult {
        boolean ok;
        String method;
        String message;
        PrintResult(boolean ok, String method, String message) {
            this.ok = ok;
            this.method = method;
            this.message = message;
        }
        String toJson() {
            return "{\\\"ok\\\":" + ok + ",\\\"method\\\":\\\"" + method + "\\\",\\\"message\\\":\\\"" + message.replace("\\\"", "'") + "\\\"}";
        }
    }

    static boolean isInstalled(Context context) {
        if (context == null) return false;
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(RAWBT_PACKAGE, 0);
            return info != null;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    static byte[] getPrinterBytes(String text) {
        if (text == null) text = "";
        try {
            return text.getBytes(Charset.forName("CP437"));
        } catch (Exception e) {
            try {
                return text.getBytes(Charset.forName("CP866"));
            } catch (Exception ignored) {
                return text.getBytes(StandardCharsets.UTF_8);
            }
        }
    }

    static PrintResult start(Context context, Intent intent, String method) {
        try {
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.setPackage(RAWBT_PACKAGE);
            if (!(context instanceof Activity)) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }
            context.startActivity(intent);
            return new PrintResult(true, method, "Dikirim ke RAWBT via " + method);
        } catch (ActivityNotFoundException e) {
            return new PrintResult(false, method, "RAWBT tidak menerima intent " + method + ": " + e.getMessage());
        } catch (Exception e) {
            return new PrintResult(false, method, "Gagal " + method + ": " + e.getMessage());
        }
    }

    static PrintResult print(Context context, String text) {
        if (context == null) return new PrintResult(false, "none", "Context tidak tersedia");
        if (text == null) text = "";

        if (!isInstalled(context)) {
            try {
                Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + RAWBT_PACKAGE));
                market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(market);
            } catch (Exception ignored) {}
            Toast.makeText(context, "RAWBT belum terinstall.", Toast.LENGTH_LONG).show();
            return new PrintResult(false, "installed-check", "RAWBT belum terinstall");
        }

        byte[] bytes = getPrinterBytes(text);
        String base64Default = "base64," + Base64.encodeToString(bytes, Base64.DEFAULT);
        String base64NoWrap = "base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);

        // 1) Metode resmi RawBT untuk raw byte: ACTION_VIEW rawbt:base64,<data>.
        PrintResult r;
        r = start(context, new Intent(Intent.ACTION_VIEW, Uri.parse("rawbt:" + base64Default)), "rawbt-scheme-base64-default");
        if (r.ok) return r;

        // 2) Sama, tanpa newline base64.
        r = start(context, new Intent(Intent.ACTION_VIEW, Uri.parse("rawbt:" + base64NoWrap)), "rawbt-scheme-base64-nowrap");
        if (r.ok) return r;

        // 3) Metode resmi RawBT: PRINT_RAWBT extra DATA base64.
        Intent i3 = new Intent(RAWBT_ACTION);
        i3.putExtra(RAWBT_EXTRA_DATA, base64Default);
        r = start(context, i3, "print-rawbt-extra-base64-default");
        if (r.ok) return r;

        // 4) PRINT_RAWBT extra DATA text langsung.
        Intent i4 = new Intent(RAWBT_ACTION);
        i4.putExtra(RAWBT_EXTRA_DATA, text);
        r = start(context, i4, "print-rawbt-extra-text");
        if (r.ok) return r;

        // 5) Android SEND text/plain. RawBT manifest mendukung ACTION_SEND.
        Intent i5 = new Intent(Intent.ACTION_SEND);
        i5.setType("text/plain");
        i5.putExtra(Intent.EXTRA_TEXT, text);
        r = start(context, i5, "action-send-text");
        if (r.ok) return r;

        // 6) FileProvider content:// text/plain fallback untuk RawBT PrintContentActivity.
        try {
            File dir = new File(context.getCacheDir(), "rawbt");
            if (!dir.exists()) dir.mkdirs();
            File file = new File(dir, "psm_rawbt.txt");
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.flush();
            fos.close();
            Uri uri = FileProvider.getUriForFile(context, "${appId}.fileprovider", file);
            context.grantUriPermission(RAWBT_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            Intent i6 = new Intent(Intent.ACTION_VIEW);
            i6.setDataAndType(uri, "text/plain");
            i6.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            r = start(context, i6, "content-file-text-plain");
            if (r.ok) return r;
        } catch (Exception e) {
            r = new PrintResult(false, "content-file-text-plain", e.getMessage());
        }

        try {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(RAWBT_PACKAGE);
            if (launch != null) {
                if (!(context instanceof Activity)) launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launch);
                return new PrintResult(false, "open-rawbt", "RAWBT dibuka, tetapi perintah cetak belum diterima. Cek setting printer di RAWBT.");
            }
        } catch (Exception ignored) {}

        return new PrintResult(false, "all", "Semua jalur RAWBT gagal. Cek apakah RAWBT bisa print test langsung.");
    }
}
`;

const filePathsXml = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="rawbt_cache" path="." />
    <external-cache-path name="rawbt_external_cache" path="." />
    <files-path name="rawbt_files" path="." />
</paths>
`;

fs.writeFileSync(mainActivityPath, mainActivityJava);
fs.writeFileSync(rawbtPluginPath, rawbtPluginJava);
fs.writeFileSync(filePathsPath, filePathsXml);
console.log('MainActivity.java patched with official RawBT plugin registration:', mainActivityPath);
console.log('RawBTPlugin.java written:', rawbtPluginPath);
console.log('FileProvider paths written:', filePathsPath);
