const fs = require('fs');
const path = require('path');

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error('Wajib ada tetapi tidak ditemukan: ' + p);
}
function mustContain(file, text) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(text)) throw new Error(file + ' tidak berisi: ' + text);
}
function checkJs(file) {
  require('child_process').execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const required = [
  'package.json',
  'capacitor.config.json',
  'www/index.html',
  'www/js/form.js',
  'www/js/native.js',
  'www/js/report.js',
  'www/js/backup.js',
  'www/js/thermal.js',
  'www/assets/login-lock-bg.png',
  'www/assets/icons/header-nota-default.png',
  'assets/android-icons/mipmap-mdpi/ic_launcher.png',
  'assets/android-icons/mipmap-hdpi/ic_launcher.png',
  'assets/android-icons/mipmap-xhdpi/ic_launcher.png',
  'assets/android-icons/mipmap-xxhdpi/ic_launcher.png',
  'assets/android-icons/mipmap-xxxhdpi/ic_launcher.png',
  'assets/android-icons/mipmap-anydpi-v26/ic_launcher.xml',
  'scripts/patch-android-icons.js',
  'scripts/patch-android-icon.js',
  'scripts/patch-android-psmnative.js',
  'scripts/patch-android-imagesaver.js',
  'scripts/patch-android-csvsaver.js',
  'scripts/patch-android-rawbt.js',
  'scripts/patch-android-final-native.js',
  '.github/workflows/build-debug-apk.yml',
  '.github/workflows/build-release-apk.yml',
  '.github/workflows/generate-keystore.yml'
];
required.forEach(mustExist);

[...fs.readdirSync('scripts').filter(f => f.endsWith('.js')).map(f => 'scripts/' + f),
 ...fs.readdirSync('www/js').filter(f => f.endsWith('.js')).map(f => 'www/js/' + f)
].forEach(checkJs);

mustContain('capacitor.config.json', 'PSM SAWIT');
mustContain('capacitor.config.json', 'com.psmsawit.timbangan');
mustContain('www/js/form.js', 'resolveFormDateForSave');
mustContain('www/js/form.js', 'resolveFormTimeForSave');
mustContain('www/js/form.js', 'normalizeDateForInput(d.date');
mustContain('www/js/form.js', 'normalizeTimeForInput(d.time');
mustContain('www/js/native.js', 'saveImageWithPsmNative');
mustContain('www/js/native.js', 'saveCsvWithPsmNative');
mustContain('scripts/patch-android-icons.js', 'mipmap-xxxhdpi');
mustContain('scripts/patch-android-icons.js', 'android:icon="@mipmap/ic_launcher"');
mustContain('.github/workflows/build-debug-apk.yml', 'Build Android Debug APK - PSM SAWIT FIX');
mustContain('.github/workflows/build-release-apk.yml', 'Build Signed Release APK - PSM SAWIT FIX');
mustContain('.github/workflows/generate-keystore.yml', 'Generate PSM SAWIT Release Keystore');

console.log('✅ PSM SAWIT FIX package self-check passed.');
