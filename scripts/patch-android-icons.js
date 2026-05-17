const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcRoot = path.join(root, 'assets', 'android-icons');
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

function rmIfExists(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) throw new Error('Source icon tidak ditemukan: ' + src);
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Hapus icon bawaan Capacitor/GitHub/default supaya tidak tersisa.
const iconDirs = [
  'mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi','mipmap-anydpi-v26'
];
for (const dir of iconDirs) {
  const full = path.join(resRoot, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  for (const f of fs.readdirSync(full)) {
    if (f.startsWith('ic_launcher') || f.startsWith('ic_launcher_round')) {
      rmIfExists(path.join(full, f));
    }
  }
}

copyDir(srcRoot, resRoot);

const valuesDir = path.join(resRoot, 'values');
fs.mkdirSync(valuesDir, { recursive: true });
const colorsPath = path.join(valuesDir, 'colors.xml');
let colors = fs.existsSync(colorsPath) ? fs.readFileSync(colorsPath, 'utf8') : '<resources>\n</resources>\n';
if (colors.includes('name="ic_launcher_background"')) {
  colors = colors.replace(/<color\s+name="ic_launcher_background">[\s\S]*?<\/color>/, '<color name="ic_launcher_background">#FFFFFF</color>');
} else {
  colors = colors.replace('</resources>', '    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>');
}
fs.writeFileSync(colorsPath, colors, 'utf8');

if (fs.existsSync(manifestPath)) {
  let m = fs.readFileSync(manifestPath, 'utf8');
  if (m.includes('android:icon=')) {
    m = m.replace(/android:icon="[^"]*"/, 'android:icon="@mipmap/ic_launcher"');
  } else {
    m = m.replace(/<application\b/, '<application android:icon="@mipmap/ic_launcher"');
  }
  if (m.includes('android:roundIcon=')) {
    m = m.replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@mipmap/ic_launcher_round"');
  } else {
    m = m.replace(/<application\b/, '<application android:roundIcon="@mipmap/ic_launcher_round"');
  }
  fs.writeFileSync(manifestPath, m, 'utf8');
}

console.log('Icon launcher Android PSM SAWIT sudah dipasang total.');
console.log('Manifest icon diarahkan ke @mipmap/ic_launcher dan @mipmap/ic_launcher_round.');
