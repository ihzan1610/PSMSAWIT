// ===============================
// PSM SAWIT - security.js
// Step 2 modular split.
// ===============================

    function getPin() { 
        let p = localStorage.getItem('psm_px'); 
        if(p) return atob(p);
        let oldP = localStorage.getItem('psm_pin');
        if(oldP) { savePin(oldP); localStorage.removeItem('psm_pin'); return oldP; }
        return "1234";
    }
    function savePin(newP) { localStorage.setItem('psm_px', btoa(newP)); }

    function cekPin() {
        if(document.getElementById('input-pin').value === getPin()) {
            sessionStorage.setItem('psm_unlocked', 'true');
            document.getElementById('lock-screen').style.display = 'none';
            beepClick();
            mulaiAplikasi();
        } else { beepError(); alert("PIN Salah!"); document.getElementById('input-pin').value = ""; }
    }
    const inputPinEl = document.getElementById('input-pin');
    if (inputPinEl) {
        inputPinEl.addEventListener("keypress", function(e) { if (e.key === "Enter") cekPin(); });
    }

    function ubahPin() {
        beepClick();
        let oldP = document.getElementById('pin-lama').value;
        let newP = document.getElementById('pin-baru').value;
        if(oldP !== getPin()) { beepError(); return alert("PIN Lama Anda salah!"); }
        if(newP.length < 4) { beepError(); return alert("PIN Baru harus minimal 4 angka!"); }
        savePin(newP); 
        beepSuccess();
        alert("PIN berhasil diubah! Ingat PIN baru Anda.");
        document.getElementById('pin-lama').value = ""; document.getElementById('pin-baru').value = "";
    }


function showGuestInfo() {
    beepClick();
    alert('Mode tamu tidak diaktifkan pada APK lapangan agar data tetap aman. Silakan masuk memakai PIN akses.');
}
