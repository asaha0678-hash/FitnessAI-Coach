/**
 * FitnessAI-Coach - Voice & Sound Feedback Engine
 * Provides synthesized voice guidance and audio effects for workout feedback.
 */

class AudioCoach {
    constructor() {
        this.enabled = true;
        this.voiceEnabled = true;
        this.sfxEnabled = true;
        this.audioCtx = null;
        this.lastSpokenTime = 0;
        this.speechThrottleMs = 1600; // Minimum time between voice prompts
        this.synth = window.speechSynthesis || null;
        this.activeUtterance = null;
        this.preferredVoice = null;

        this.initAudioContext();
        this.initVoice();
    }

    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch (e) {
            console.warn("AudioContext not supported in this browser", e);
        }
    }

    initVoice() {
        if (!this.synth) return;
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            // Look for a pleasant English voice
            this.preferredVoice = voices.find(v => (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David')))) ||
                                  voices.find(v => v.lang.startsWith('en')) ||
                                  voices[0] || null;
        };

        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
    }

    ensureAudioContext() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Speak feedback phrase with intelligent throttling
     */
    speak(text, priority = false) {
        if (!this.enabled || !this.voiceEnabled || !this.synth) return;

        const now = Date.now();
        if (!priority && (now - this.lastSpokenTime < this.speechThrottleMs)) {
            return;
        }

        if (priority) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.preferredVoice) {
            utterance.voice = this.preferredVoice;
        }
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 0.95;

        this.lastSpokenTime = now;
        this.synth.speak(utterance);
    }

    /**
     * Play tone for rep completion
     */
    playRepTone() {
        if (!this.enabled || !this.sfxEnabled) return;
        this.ensureAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    /**
     * Play warning tone for form error
     */
    playFormWarningTone() {
        if (!this.enabled || !this.sfxEnabled) return;
        this.ensureAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(180, now + 0.1);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.28);
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    /**
     * Play celebration fanfare upon finishing target workout
     */
    playMilestoneFanfare() {
        if (!this.enabled || !this.sfxEnabled) return;
        this.ensureAudioContext();
        if (!this.audioCtx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const now = this.audioCtx.currentTime + idx * 0.12;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.28);
        });
    }

    setMuted(muted) {
        this.enabled = !muted;
        if (muted && this.synth) {
            this.synth.cancel();
        }
    }
}

window.AudioCoach = AudioCoach;
