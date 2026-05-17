const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.min.js');
const targetDir = path.join(__dirname, '..', 'www', 'vendor');
const target = path.join(targetDir, 'html2canvas.min.js');

if (!fs.existsSync(source)) {
  console.error('html2canvas belum ditemukan. Jalankan npm install terlebih dahulu.');
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('html2canvas lokal siap:', target);
