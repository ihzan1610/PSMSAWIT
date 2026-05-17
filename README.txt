PSM SAWIT FIX SETTINGS LOCKED

Isi paket penting saja:
- www
- assets
- scripts
- .github/workflows
- package.json
- capacitor.config.json
- .gitignore

Perbaikan utama:
1. Format Nota, Efek Suara, dan Ubah PIN dipindahkan ke Menu Setelan Lanjutan.
2. Menu Setelan Lanjutan wajib PIN sebelum bisa dibuka.
3. Default baru: logo nota gambar aktif, logo thermal hitam putih aktif, suara tombol aktif.
4. Backup dan fitur urgent tetap ada di halaman pengaturan utama.
5. Format thermal potongan lebih adaptif agar nominal rupiah tidak mudah turun baris.
6. Autocomplete pemilik/sopir tetap dipertahankan.
7. Monitoring data, RAWBT, simpan gambar, backup CSV, icon Android, dan fitur lama tetap dipertahankan.

Cara build:
1. Upload isi ZIP ke GitHub.
2. Jalankan Actions: Build Android Debug APK - PSM SAWIT FIX.
3. Download artifact APK.
4. Uninstall APK lama, restart HP, lalu install APK baru.
