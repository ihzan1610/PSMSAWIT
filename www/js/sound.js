// ===============================
// PSM SAWIT - sound.js
// Step 2 modular split.
// ===============================

    let audioCtx = null;
    function getAudioCtx() {
        if (!audioCtx) {
            const AudioClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioClass) return null;
            audioCtx = new AudioClass();
        }
        return audioCtx;
    }
    function playBeep(freq, type, dur) {
        const ctx = getAudioCtx();
        if(!ctx) return;
        if(ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
    }
    
    const isSoundOn = () => localStorage.getItem('psm_sound_fx') !== 'false';
    const beepClick = () => { if(isSoundOn()) playBeep(600, 'sine', 0.05); };
    const beepSuccess = () => { if(isSoundOn()) { playBeep(800, 'sine', 0.1); setTimeout(()=>playBeep(1200, 'sine', 0.15), 100); } };
    const beepError = () => { playBeep(300, 'sawtooth', 0.4); };

    function toggleSuara() {
        let isChecked = document.getElementById('setting-suara').checked;
        localStorage.setItem('psm_sound_fx', isChecked ? 'true' : 'false');
        if(isChecked) playBeep(800, 'sine', 0.1);
    }
