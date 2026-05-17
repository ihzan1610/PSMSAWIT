// ===============================
// PSM SAWIT - storage.js
// Step 2 modular split.
// ===============================

    function saveDraft() {
        if(curIdx !== -1) return;
        let d = { 
            o: document.getElementById('in-owner').value, d: document.getElementById('in-driver').value, 
            w1: document.getElementById('in-w1').value, w2: document.getElementById('in-w2').value,
            fl: document.getElementById('in-fl').value, fj: document.getElementById('in-fj').value, fp: document.getElementById('in-fp').value,
            date: document.getElementById('in-date').value, time: document.getElementById('in-time').value
        };
        localStorage.setItem('psm_draft', JSON.stringify(d));
    }
    function loadDraft() {
        let d = JSON.parse(localStorage.getItem('psm_draft'));
        if(d && curIdx === -1) { 
            document.getElementById('in-owner').value = d.o||''; document.getElementById('in-driver').value = d.d||''; 
            document.getElementById('in-w1').value = d.w1||''; document.getElementById('in-w2').value = d.w2||''; 
            if(d.fl) document.getElementById('in-fl').value = d.fl;
            if(d.fj) document.getElementById('in-fj').value = d.fj;
            if(d.fp) document.getElementById('in-fp').value = d.fp;
            if(d.date) document.getElementById('in-date').value = d.date;
            if(d.time) document.getElementById('in-time').value = d.time;
            validateWeights(); 
        }
    }
    function bersihkanForm() {
        if(!confirm("Bersihkan form isian?")) return;
        beepClick();
        localStorage.removeItem('psm_draft'); resetForm();
    }
