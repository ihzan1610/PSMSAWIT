const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const appId = config.appId || 'com.psmsawit.timbangan';
const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('AndroidManifest.xml belum ada, skip patch.');
  process.exit(0);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

function addBeforeApplication(tag) {
  if (!xml.includes(tag)) {
    xml = xml.replace('<application', '    ' + tag + '\n\n    <application');
  }
}

addBeforeApplication('<uses-permission android:name="ru.a402d.rawbtprinter.PERMISSION" />');
addBeforeApplication('<uses-permission android:name="ru.a402d.rawbtprinter.permission.PRINT" />');
addBeforeApplication('<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />');
addBeforeApplication('<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />');

const queriesNeeded = [
`        <package android:name="ru.a402d.rawbtprinter" />`,
`        <intent>\n            <action android:name="android.intent.action.VIEW" />\n            <data android:scheme="rawbt" />\n        </intent>`,
`        <intent>\n            <action android:name="ru.a402d.rawbtprinter.action.PRINT_RAWBT" />\n        </intent>`,
`        <intent>\n            <action android:name="android.intent.action.SEND" />\n            <data android:mimeType="text/plain" />\n        </intent>`,
`        <intent>\n            <action android:name="android.intent.action.VIEW" />\n            <data android:mimeType="text/plain" />\n        </intent>`
];

if (!xml.includes('<queries>')) {
  xml = xml.replace('<application', '    <queries>\n' + queriesNeeded.join('\n') + '\n    </queries>\n\n    <application');
} else {
  for (const q of queriesNeeded) {
    const marker = q.includes('package android:name') ? 'ru.a402d.rawbtprinter' : q.split('\n')[1]?.trim() || q;
    if (!xml.includes(marker)) {
      xml = xml.replace('</queries>', q + '\n    </queries>');
    }
  }
}

const provider = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${appId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/psm_file_paths" />
        </provider>
`;

if (!xml.includes(`${appId}.fileprovider`)) {
  xml = xml.replace('</application>', provider + '\n    </application>');
}

xml = xml.replace(/android:theme="@[^"]+"/g, 'android:theme="@style/AppTheme"');

fs.writeFileSync(manifestPath, xml);
console.log('AndroidManifest.xml patched untuk RAWBT official routes, FileProvider, queries, permissions.');
