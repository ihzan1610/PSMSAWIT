PSM SAWIT FIX

Paket bersih siap upload GitHub.

Isi penting:
- www/ aplikasi utama
- assets/ ikon APK dan splash
- scripts/ patch Android native RAWBT, simpan gambar, backup CSV, icon APK
- .github/workflows/ build debug, generate keystore, build release
- package.json
- capacitor.config.json

Perbaikan utama:
1. Klik baris data menampilkan data lengkap dalam mode lihat.
2. Tombol edit tetap muncul.
3. Saat masuk edit, tanggal dan jam lama tetap muncul.
4. Jika tanggal/jam tidak diubah, nilainya tetap seperti data lama.
5. Icon APK dipaksa memakai logo PSM SAWIT, bukan default Capacitor/GitHub.
6. Native saver gambar dan backup CSV tetap aktif.
7. RAWBT tetap aktif.

Cara pakai:
1. Upload isi folder ZIP ini ke repo GitHub.
2. Jalankan Actions: Build Android Debug APK - PSM SAWIT FIX.
3. Download artifact PSM-SAWIT-FIX-debug-apk.
4. Uninstall APK lama, restart HP jika perlu, install APK baru.
