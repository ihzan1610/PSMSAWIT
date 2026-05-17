PSM SAWIT FIX SETTING TERKUNCI

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


PSM SAWIT FIX AUTOCOMPLETE:
- Pemilik/Sopir tidak menampilkan daftar saat kolom kosong.
- Daftar muncul saat mengetik huruf atau klik tombol panah.
- Klik nama sopir sekarang mengisi kolom sopir.
- Input manual tetap bisa.


FIX MONITORING ORDER:
- Kolom cloud/status dipindah ke samping nomor.
- Ongkos Langsir, Jalan, Panen tampil di Monitoring Data.
- Tabel tidak disortir otomatis berdasarkan tanggal/jam; edit tanggal/jam tidak mengubah nomor atau posisi baris.


FIX SETTING TERKUNCI:
- Format Nota, Efek Suara, dan Ubah PIN dipindah ke Menu Terkunci.
- Untuk membuka menu terkunci harus memasukkan PIN aplikasi.
- Default logo nota gambar aktif.
- Default logo thermal hitam putih aktif.
- Default suara tombol aktif.
- Manajemen Data & Backup tetap di halaman pengaturan utama agar mudah dipakai.
