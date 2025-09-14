
import GUI from 'lil-gui';

// Informs TypeScript that a 'p5' variable exists in the global scope,
// which is loaded via the script tag in index.html.
declare var p5: any;

// --- Global Parameters and Constants ---

/**
 * A centralized object holding all adjustable parameters.
 * lil-gui will directly bind to and modify this object.
 */
const params = {
    simulation: { bpm: 45, maxCycle: 9, infiniteLifespan: false },
    synthesis: { gain: 70, decay: 200, soundPreset: '303 Acid', reverb: 48, reverbTime: 30 },
    harmony: { baseNote: 48, scale: 'Pentatonic' },
};

/**
 * A dictionary mapping scale names to their interval patterns in semitones.
 */
const SCALES: Record<string, number[]> = {
    Major: [0, 2, 4, 5, 7, 9, 11],
    Minor: [0, 2, 3, 5, 7, 8, 10],
    Pentatonic: [0, 2, 4, 7, 9],
    Blues: [0, 3, 5, 6, 7, 10],
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11],
    HarmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

/**
 * An array of note names for converting MIDI numbers to musical notation.
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// --- p5.js Sketch ---



const sketch = (p: any) => {
    let cubes: Cube[] = [];
    let synths: { [key: string]: any } = {};
    let kickSynth: any, snareSynth: any, hatSynth: any;
    let reverb: any, compressor: any, reverbWetGain: any;
    let audioStarted = false;
    let font: string;
    let uiLayer: any; // Off-screen buffer for 2D UI elements
    let gui: GUI; // Declare gui in sketch scope to access it in mouseClicked

    /**
     * Calculates cylinder dimensions based on the current canvas size.
     */
    function getCylinderDimensions() {
        const isHorizontal = p.width > p.height;
        // Adjusted: shorter length, wider radius
        const cylinderLength = isHorizontal ? p.width * 0.9 : p.height * 0.9;
        const cylinderRadius = isHorizontal ? p.height * 0.35 : p.width * 0.35;
        return { isHorizontal, cylinderLength, cylinderRadius };
    }

    /**
     * @class Cube - Represents a single rotating, sound-producing cube.
     */
    class Cube {
        p: any;
        radius: number;
        len: number;
        angle: number;
        startAngle: number;
        lastAngle: number;
        hue: number;
        bounceCount: number;
        opacity: number;
        size: number;
        glow: number;

        constructor(lenVal: number) {
            this.p = p;
            this.size = 30;
            const { isHorizontal, cylinderRadius } = getCylinderDimensions();
            
            this.radius = cylinderRadius + (this.size / 2);
            this.len = lenVal;

            if (isHorizontal) {
                this.startAngle = this.p.HALF_PI;
            } else {
                this.startAngle = -this.p.HALF_PI;
            }
            this.angle = this.startAngle;

            this.lastAngle = this.angle;
            this.hue = p.random(280, 340);
            this.bounceCount = 0;
            this.opacity = 100;
            this.glow = 0;

            this.triggerNote();
        }

        update() {
            const revolutionsPerSecond = params.simulation.bpm / 60;
            const radiansPerSecond = revolutionsPerSecond * this.p.TWO_PI;
            const angleChange = radiansPerSecond * (this.p.deltaTime / 1000);

            this.lastAngle = this.angle;
            this.angle += angleChange;

            const angleOffset = this.startAngle;
            const lastAdjustedAngle = this.lastAngle - angleOffset;
            const adjustedAngle = this.angle - angleOffset;

            const oldRevolutions = Math.floor(lastAdjustedAngle / this.p.TWO_PI);
            const newRevolutions = Math.floor(adjustedAngle / this.p.TWO_PI);

            if (newRevolutions > oldRevolutions) {
                this.bounceCount++;
                this.triggerNote();
            }
            
            if (params.simulation.infiniteLifespan) {
                this.opacity = 100;
            } else {
                if (this.bounceCount >= params.simulation.maxCycle) {
                    this.opacity = 0;
                } else {
                    this.opacity = this.p.map(this.bounceCount, 0, params.simulation.maxCycle, 100, 30);
                }
                this.opacity = this.p.max(this.opacity, 0);
            }

            if (this.glow > 0.01) {
                this.glow *= 0.92;
            } else {
                this.glow = 0;
            }
        }

        triggerNote() {
            this.glow = 1.0;

            // Common calculations for note placement
            const { cylinderLength } = getCylinderDimensions();
            const normalizedPos = this.p.map(this.len, -cylinderLength / 2, cylinderLength / 2, 0, 1);
            const laneIndex = this.p.floor(this.p.constrain(normalizedPos * 12, 0, 11));

            const scaleIntervals = SCALES[params.harmony.scale];
            const numNotesInScale = scaleIntervals.length;
            const noteInScaleIndex = laneIndex % numNotesInScale;
            const octaveOffset = Math.floor(laneIndex / numNotesInScale);
            const scaleInterval = scaleIntervals[noteInScaleIndex];
            const baseMidiNote = params.harmony.baseNote + scaleInterval + (octaveOffset * 12);
            const noteName = `${NOTE_NAMES[baseMidiNote % 12]}${Math.floor(baseMidiNote / 12) - 1}`;

            const gain = params.synthesis.gain / 100;

            switch (params.synthesis.soundPreset) {
                case '808 Kick':
                    if (kickSynth) {
                        // The kick's pitch is now tuned to the specific note lane
                        const kickFreq = this.p.midiToFreq(baseMidiNote);
                        // Start high for the 'click' of the beater
                        kickSynth.osc.freq(kickFreq * 3, 0.001);
                        // Quickly drop to the fundamental resonant frequency
                        kickSynth.osc.freq(kickFreq, 0.08);
                        kickSynth.envelope.play();
                    }
                    break;

                case '808 Snare':
                    if (snareSynth) {
                        snareSynth.noiseEnv.play();
                        // The snare's tonal body is now tuned to the specific note lane
                        snareSynth.tone.freq(this.p.midiToFreq(baseMidiNote));
                        snareSynth.toneEnv.play();
                    }
                    break;
                
                case '808 Hat':
                    if (hatSynth && hatSynth.filter) {
                        // Modulate the high-pass filter to give a sense of pitch.
                        // A higher note will sound brighter. The `true` flag constrains the output.
                        const filterFreq = this.p.map(baseMidiNote, 36, 96, 6000, 15000, true);
                        hatSynth.filter.freq(filterFreq);
                        hatSynth.envelope.play();
                    }
                    break;

                case '808 Cowbell':
                    if (synths['808 Cowbell']) {
                        // Generate two frequencies based on the note lane for a classic metallic sound
                        const freq1 = this.p.midiToFreq(baseMidiNote);
                        // The second frequency is a perfect fifth higher, characteristic of the 808 cowbell
                        const freq2 = freq1 * 1.5; 
                        synths['808 Cowbell'].play(freq1, gain * 0.6, 0, 0.05);
                        synths['808 Cowbell'].play(freq2, gain * 0.5, 0, 0.05);
                    }
                    break;
                    
                default:
                    // Handle all other PolySynth-based presets
                    const synth = synths[params.synthesis.soundPreset];
                    if (synth) {
                        synth.play(noteName, gain * 0.8, 0, 0.1);
                    }
                    break;
            }
        }

        display() {
            this.p.push();
            const { isHorizontal } = getCylinderDimensions();

            if (isHorizontal) {
                this.p.translate(this.len, 0, 0);
                this.p.rotateX(this.angle);
                this.p.translate(0, this.radius, 0);
            } else {
                this.p.translate(0, this.len, 0);
                this.p.rotateY(this.angle);
                this.p.translate(this.radius, 0, 0);
            }
            
            const brightness = this.p.lerp(70, 100, this.glow);
            const saturation = this.p.lerp(90, 100, this.glow);
            const currentSize = this.size + this.glow * 10;
            
            this.p.noStroke();
            this.p.emissiveMaterial(this.hue, saturation, brightness, this.opacity);
            this.p.box(currentSize);

            // --- Visual Highlight ---
            if (this.glow > 0.01) {
                this.p.push();
                const highlightOpacity = this.p.map(this.glow, 0, 1, 0, 80);
                const highlightSize = currentSize * 1.25;
                this.p.noFill();
                this.p.strokeWeight(this.p.map(this.glow, 0, 1, 0, 4));
                this.p.stroke(this.hue, 10, 100, highlightOpacity);
                this.p.box(highlightSize);
                this.p.pop();
            }
            
            this.p.pop();
        }
    }

    /**
     * Updates reverb mix smoothly by ramping the gain on the wet signal path.
     */
    function updateReverbMix() {
        if (!reverbWetGain) return;
        const wetLevel = params.synthesis.reverb / 100;
        reverbWetGain.amp(wetLevel, 0.05); // Ramp gain over 50ms
    }

    /**
     * Updates reverb time. Called on slider release to avoid audio artifacts.
     */
    function updateReverbTime() {
        if (!reverb) return;
        const reverbTimeSeconds = p.map(params.synthesis.reverbTime, 0, 100, 0.01, 8);
        const decayRate = 1.5;
        reverb.set(reverbTimeSeconds, decayRate, false);
    }

    /**
     * Updates gain and decay envelopes for all synthesizers.
     */
    function updateSynthEnvelopes() {
        const gain = params.synthesis.gain / 100;
        const decaySeconds = params.synthesis.decay / 1000;

        // --- PolySynth ADSR Configurations ---
        if (synths['303 Acid']) synths['303 Acid'].setADSR(0.01, decaySeconds * 0.3, 0, 0.2);
        if (synths['Moog Bass']) synths['Moog Bass'].setADSR(0.02, decaySeconds * 0.5, 0.1, 0.4);
        if (synths['Moog Lead']) synths['Moog Lead'].setADSR(0.1, decaySeconds, 0.7, 0.5);
        if (synths['FM Bell']) synths['FM Bell'].setADSR(0.01, decaySeconds * 1.5, 0, 0.5);
        if (synths['Soft Pad']) synths['Soft Pad'].setADSR(0.8, decaySeconds, 0.5, 0.8);
        if (synths['Pluck']) synths['Pluck'].setADSR(0.01, decaySeconds * 0.8, 0, 0.1);
        if (synths['808 Cowbell']) synths['808 Cowbell'].setADSR(0.005, decaySeconds * 0.1, 0, 0.05);

        // --- Custom Synth Envelope Configurations ---
        if (kickSynth) {
            kickSynth.envelope.setADSR(0.001, decaySeconds * 0.8, 0.01, 0.1);
            kickSynth.envelope.setRange(gain * 0.8, 0);
        }
        if (snareSynth) {
            snareSynth.noiseEnv.setADSR(0.001, decaySeconds * 0.2, 0, 0.01);
            snareSynth.toneEnv.setADSR(0.001, decaySeconds * 0.1, 0, 0.01);
            snareSynth.noiseEnv.setRange(gain * 0.7, 0);
            snareSynth.toneEnv.setRange(gain * 0.7, 0);
        }
        if (hatSynth) {
            hatSynth.envelope.setADSR(0.001, decaySeconds * 0.05, 0, 0.01);
            hatSynth.envelope.setRange(gain * 0.3, 0);
        }
    }

    /**
     * Draws a cylinder with a vertical gradient fill along its main axis.
     */
    function drawGradientCylinder(radius: number, height: number, detail: number) {
        const colorBottom = p.color(260, 40, 30, 80);
        const colorTop = p.color(290, 60, 85, 80);

        p.beginShape(p.TRIANGLE_STRIP);
        for (let i = 0; i <= detail; i++) {
            const angle = p.map(i, 0, detail, 0, p.TWO_PI);
            const x = p.cos(angle) * radius;
            const z = p.sin(angle) * radius;
            p.fill(colorBottom); p.vertex(x, -height / 2, z);
            p.fill(colorTop); p.vertex(x, height / 2, z);
        }
        p.endShape();
        
        p.beginShape(p.TRIANGLE_FAN);
        p.fill(colorTop);
        p.vertex(0, height / 2, 0);
        for (let i = 0; i <= detail; i++) {
            const angle = p.map(i, 0, detail, 0, p.TWO_PI);
            const x = p.cos(angle) * radius;
            const z = p.sin(angle) * radius;
            p.vertex(x, height / 2, z);
        }
        p.endShape();

        p.beginShape(p.TRIANGLE_FAN);
        p.fill(colorBottom);
        p.vertex(0, -height / 2, 0);
        for (let i = detail; i >= 0; i--) {
            const angle = p.map(i, 0, detail, 0, p.TWO_PI);
            const x = p.cos(angle) * radius;
            const z = p.sin(angle) * radius;
            p.vertex(x, -height / 2, z);
        }
        p.endShape();
    }
    
    /**
     * Helper function to set the oscillator waveform for all voices in a PolySynth.
     */
    function setSynthWaveform(synth: any, waveform: string) {
        if (synth && synth.voices) {
            for (const voice of synth.voices) {
                if (voice.oscillator) {
                    voice.oscillator.setType(waveform);
                }
            }
        }
    }

    /**
     * p5.js preload function. Ensures assets are loaded before setup.
     */
    p.preload = () => {
        font = 'monospace';
    };

    /**
     * p5.js setup function.
     */
    p.setup = () => {
        const canvasContainer = document.getElementById('canvas-container')!;
        p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, p.WEBGL);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        
        uiLayer = p.createGraphics(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);
        
        // --- Initialize Synthesizers ---
        const polySynthNames = ['303 Acid', 'Moog Bass', 'Moog Lead', 'FM Bell', 'Soft Pad', 'Pluck', '808 Cowbell'];
        polySynthNames.forEach(name => {
            synths[name] = new p5.PolySynth(undefined, 16);
        });
        
        // --- Custom Percussion Synths ---
        kickSynth = (() => {
            const osc = new p5.Oscillator('sine');
            const envelope = new p5.Envelope();
            envelope.setRange(1.0, 0);
            osc.amp(envelope);
            osc.start();
            return { osc, envelope };
        })();
        
        snareSynth = (() => {
            const noise = new p5.Noise('white');
            const noiseEnv = new p5.Envelope();
            noiseEnv.setRange(1.0, 0);
            noise.amp(noiseEnv);

            const tone = new p5.Oscillator('sine');
            const toneEnv = new p5.Envelope();
            toneEnv.setRange(0.7, 0);
            tone.amp(toneEnv);
            
            noise.start();
            tone.start();
            return { noise, noiseEnv, tone, toneEnv };
        })();

        hatSynth = (() => {
            const noise = new p5.Noise('white');
            const envelope = new p5.Envelope();
            const filter = new p5.HighPass();
            filter.freq(7000);
            noise.connect(filter);
            envelope.setRange(0.3, 0);
            noise.amp(envelope);
            noise.start();
            return { noise, envelope, filter };
        })();


        // --- Configure Oscillator Timbre for PolySynths ---
        setSynthWaveform(synths['303 Acid'], 'square');
        setSynthWaveform(synths['Moog Bass'], 'sawtooth');
        setSynthWaveform(synths['Moog Lead'], 'sawtooth');
        setSynthWaveform(synths['FM Bell'], 'sine');
        setSynthWaveform(synths['Soft Pad'], 'triangle');
        setSynthWaveform(synths['Pluck'], 'triangle');
        setSynthWaveform(synths['808 Cowbell'], 'square');

        // --- Master Audio Chain Setup for Smooth Reverb Control ---
        reverb = new p5.Reverb();
        compressor = new p5.Compressor();
        reverbWetGain = new p5.Gain(); // Gain node to control the wet signal level

        // Set compressor to act as a limiter to prevent clipping
        compressor.set(0.001, 30, 12, -24, 0.3);
        
        // Set reverb to output only the wet signal
        reverb.drywet(1);

        // Create the wet signal path: Reverb -> Wet Gain -> Compressor
        reverb.connect(reverbWetGain);
        reverbWetGain.connect(compressor);

        // Function to route a sound source to both dry and wet paths
        const routeToEffects = (source: any) => {
            // Dry path: source -> compressor
            source.connect(compressor);
            // Wet path: source -> reverb
            reverb.process(source); // (same as source.connect(reverb))
        };

        // Route all sound sources
        Object.values(synths).forEach(routeToEffects);
        routeToEffects(kickSynth.osc);
        routeToEffects(snareSynth.noise);
        routeToEffects(snareSynth.tone);
        routeToEffects(hatSynth.noise);


        // --- GUI Setup ---
        gui = new GUI();
        gui.domElement.style.opacity = '0.9';

        const simFolder = gui.addFolder('Simulation');
        simFolder.add(params.simulation, 'bpm', 30, 120, 1).name('BPM');
        simFolder.add(params.simulation, 'maxCycle', 1, 20, 1).name('Max Cycle');
        simFolder.add(params.simulation, 'infiniteLifespan').name('Infinite Lifespan');
        simFolder.add({ removeLast: () => { if (cubes.length > 0) cubes.pop(); } }, 'removeLast').name('Remove Last Cube');
        simFolder.add({ reset: () => { cubes = []; } }, 'reset').name('Reset');

        const synthFolder = gui.addFolder('Synthesis');
        const presetNames = ['808 Kick', '808 Snare', '808 Hat', '808 Cowbell', '303 Acid', 'Moog Bass', 'Moog Lead', 'FM Bell', 'Soft Pad', 'Pluck'];
        synthFolder.add(params.synthesis, 'gain', 0, 100, 1).name('Gain').onChange(updateSynthEnvelopes);
        synthFolder.add(params.synthesis, 'decay', 50, 1000, 10).name('Decay').onChange(updateSynthEnvelopes);
        synthFolder.add(params.synthesis, 'soundPreset', presetNames).name('Sound Preset');
        synthFolder.add(params.synthesis, 'reverb', 0, 100, 1).name('Reverb Mix').onChange(updateReverbMix);
        synthFolder.add(params.synthesis, 'reverbTime', 0, 100, 1).name('Reverb Time').onFinishChange(updateReverbTime);
        
        const harmonyFolder = gui.addFolder('Harmony');
        harmonyFolder.add(params.harmony, 'baseNote', 36, 72, 1).name('Base Note (MIDI)');
        harmonyFolder.add(params.harmony, 'scale', Object.keys(SCALES)).name('Scale');
        
        gui.close();

        const startButton = document.getElementById('start-button');
        const startOverlay = document.getElementById('start-overlay');
        let experienceStarted = false;

        const startExperience = (event: MouseEvent | TouchEvent) => {
            event.preventDefault();
            if (experienceStarted) return;
            experienceStarted = true;

            p.userStartAudio();
            startOverlay?.classList.add('hidden');

            // Clean up listeners
            startButton?.removeEventListener('click', startExperience);
            startButton?.removeEventListener('touchend', startExperience);
        };

        if (startButton) {
            startButton.addEventListener('click', startExperience);
            startButton.addEventListener('touchend', startExperience);
        }

        // Initialize all audio parameters
        updateReverbMix();
        updateReverbTime();
        updateSynthEnvelopes();
    }
    
    /**
     * p5.js draw function. Runs on every frame.
     */
    p.draw = () => {
        if (!audioStarted && p.getAudioContext()?.state === 'running') {
            audioStarted = true;
        }
        
        p.background(280, 10, 8);
        p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -2000, 2000);
        
        const lightDist = Math.max(p.width, p.height);
        p.ambientLight(280, 20, 10);
        p.pointLight(220, 30, 90, p.width / 3, -p.height / 2, lightDist);
        p.pointLight(300, 20, 40, -p.width / 3, p.height / 2, lightDist / 2);
        p.pointLight(320, 80, 100, 0, -p.height / 3, -lightDist);

        for (let i = cubes.length - 1; i >= 0; i--) {
            cubes[i].update();
            cubes[i].display();
            if (cubes[i].opacity <= 0) {
                cubes.splice(i, 1);
            }
        }
        
        const { isHorizontal, cylinderLength, cylinderRadius } = getCylinderDimensions();
        const noteCount = 12;

        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);
        p.noStroke();
        drawGradientCylinder(cylinderRadius, cylinderLength, 24);
        p.pop();

        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);
        p.stroke(200, 0, 100, 40);
        p.strokeWeight(8);
        p.noFill();
        for (let i = 0; i <= noteCount; i++) {
            const yPos = p.map(i, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
            p.push();
            p.translate(0, yPos, 0);
            p.beginShape();
            for (let angle = 0; angle < p.TWO_PI; angle += p.PI / 16) {
                p.vertex(cylinderRadius * p.cos(angle), 0, cylinderRadius * p.sin(angle));
            }
            p.endShape(p.CLOSE);
            p.pop();
        }
        p.pop();

        uiLayer.clear();
        uiLayer.fill(200, 0, 100, 100);
        uiLayer.noStroke();

        const scaleIntervals = SCALES[params.harmony.scale];
        const numNotesInScale = scaleIntervals.length;

        const getNoteNameForLane = (i: number) => {
            const noteInScaleIndex = i % numNotesInScale;
            const octaveOffset = Math.floor(i / numNotesInScale);
            const scaleInterval = scaleIntervals[noteInScaleIndex];
            const midiNote = params.harmony.baseNote + scaleInterval + (octaveOffset * 12);
            return `${NOTE_NAMES[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
        };

        if (isHorizontal) {
            uiLayer.textAlign(p.CENTER, p.TOP);
            for (let i = 0; i < noteCount; i++) {
                const screenX = p.map(i + 0.5, 0, noteCount, p.width/2 - cylinderLength/2, p.width/2 + cylinderLength/2);
                uiLayer.text(getNoteNameForLane(i), screenX, 50);
            }
        } else {
            uiLayer.textAlign(p.LEFT, p.CENTER);
            for (let i = 0; i < noteCount; i++) {
                const screenY = p.map(i + 0.5, 0, noteCount, p.height/2 - cylinderLength/2, p.height/2 + cylinderLength/2);
                uiLayer.text(getNoteNameForLane(i), 20, screenY);
            }
        }
        
        p.image(uiLayer, -p.width / 2, -p.height / 2);
    };
    
    p.windowResized = () => {
        const canvasContainer = document.getElementById('canvas-container')!;
        p.resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
        
        uiLayer.resizeCanvas(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);

        cubes = [];
    };

    p.mouseClicked = () => {
        if (!audioStarted) return;

        const guiRect = gui.domElement.getBoundingClientRect();
        if (
            p.mouseX >= guiRect.left &&
            p.mouseX <= guiRect.right &&
            p.mouseY >= guiRect.top &&
            p.mouseY <= guiRect.bottom
        ) {
            return;
        }

        const { isHorizontal, cylinderLength, cylinderRadius } = getCylinderDimensions();
        const worldX = p.mouseX - p.width / 2;
        const worldY = p.mouseY - p.height / 2;
        const noteCount = 12;

        let clickPosOnAxis;
        let isHit = false;

        if (isHorizontal) {
            if (Math.abs(worldY) <= cylinderRadius && Math.abs(worldX) <= cylinderLength / 2) {
                isHit = true;
                clickPosOnAxis = worldX;
            }
        } else {
            if (Math.abs(worldX) <= cylinderRadius && Math.abs(worldY) <= cylinderLength / 2) {
                isHit = true;
                clickPosOnAxis = worldY;
            }
        }

        if (isHit && cubes.length < 50) {
            const normalizedClickPos = p.map(clickPosOnAxis, -cylinderLength / 2, cylinderLength / 2, 0, 1);
            const noteIndex = p.floor(normalizedClickPos * noteCount);
            const quantizedPos = p.map(noteIndex + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
            cubes.push(new Cube(quantizedPos));
        }
    };
};

new p5(sketch, document.getElementById('canvas-container')!);
