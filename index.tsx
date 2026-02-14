import { Soundfont } from 'smplr';

// p5.js is loaded globally via the script tag in index.html.
declare const p5: any;

// --- Global Parameters and Constants ---

/**
 * A centralized object holding all adjustable parameters.
 */
const params = {
    simulation: { bpm: 45, maxCycle: 9, infiniteLifespan: false },
    synthesis: { gain: 70, soundPreset: 'Piano', reverb: 40, reverbTime: 40 },
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
    
    // Audio objects
    let instruments: Record<string, any> = {};
    let masterGain: any; // Native AudioNode
    let reverb: any; // p5.Reverb
    
    let audioStarted = false;
    let instrumentsLoaded = false;
    
    let font: any;
    let uiLayer: any;

    /**
     * Calculates cylinder dimensions based on the current canvas size.
     */
    function getCylinderDimensions() {
        const isHorizontal = p.width > p.height;
        const cylinderLength = isHorizontal ? p.width * 0.9 : p.height * 0.9;
        const cylinderRadius = isHorizontal ? p.height * 0.35 : p.width * 0.35;
        return { isHorizontal, cylinderLength, cylinderRadius };
    }

    /**
     * @class Cube - Represents a single rotating, sound-producing cube.
     */
    class Cube {
        p: any;
        size: number;
        radius: number;
        len: number;
        startAngle: number;
        angle: number;
        lastAngle: number;
        hue: number;
        bounceCount: number;
        opacity: number;
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
            // Ensure integer and valid range
            let midiNote = Math.floor(baseMidiNote);
            midiNote = this.p.constrain(midiNote, 21, 108);
            
            const gain = params.synthesis.gain / 100;
            const preset = params.synthesis.soundPreset;
            
            const instrument = instruments[preset];
            if (instrument && audioStarted) {
                try {
                    // Velocity mapping could be dynamic, but fixed is fine for this UI
                    // Ensure note is an integer MIDI number
                    instrument.start({ 
                        note: midiNote, 
                        velocity: Math.floor(gain * 100), 
                        duration: 2.0 // Allow some ring out
                    });
                } catch (e) {
                    console.warn("Error playing note:", e);
                }
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

    function updateReverbMix() {
        if (!reverb) return;
        const mix = params.synthesis.reverb / 100;
        reverb.drywet(mix);
    }

    function updateReverbTime() {
        if (!reverb) return;
        const reverbTimeSeconds = p.map(params.synthesis.reverbTime, 0, 100, 0.1, 8);
        const decayRate = 2.0;
        reverb.set(reverbTimeSeconds, decayRate);
    }

    function drawGradientCylinder(radius: any, height: any, detail: any) {
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
    
    // --- UI Setup ---
    function setupUI() {
        // --- Simulation Panel ---
        const inpBpm = document.getElementById('inp-bpm') as HTMLInputElement;
        const valBpm = document.getElementById('val-bpm');
        inpBpm.oninput = () => {
            params.simulation.bpm = parseInt(inpBpm.value);
            if (valBpm) valBpm.innerText = inpBpm.value;
        };

        const inpCycle = document.getElementById('inp-cycle') as HTMLInputElement;
        const valCycle = document.getElementById('val-cycle');
        inpCycle.oninput = () => {
            params.simulation.maxCycle = parseInt(inpCycle.value);
            if (valCycle) valCycle.innerText = inpCycle.value;
        };

        const inpInfinite = document.getElementById('inp-infinite') as HTMLInputElement;
        inpInfinite.onchange = () => {
            params.simulation.infiniteLifespan = inpInfinite.checked;
        };

        const btnRemove = document.getElementById('btn-remove');
        if (btnRemove) btnRemove.onclick = () => { if (cubes.length > 0) cubes.pop(); };
        
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) btnReset.onclick = () => { cubes = []; };

        // --- Sound Panel ---
        const inpVol = document.getElementById('inp-vol') as HTMLInputElement;
        const valVol = document.getElementById('val-vol');
        inpVol.oninput = () => {
            params.synthesis.gain = parseInt(inpVol.value);
            if (valVol) valVol.innerText = inpVol.value;
        };

        const inpInstrument = document.getElementById('inp-instrument') as HTMLSelectElement;
        inpInstrument.onchange = () => {
            params.synthesis.soundPreset = inpInstrument.value;
        };

        const inpRev = document.getElementById('inp-rev') as HTMLInputElement;
        const valRev = document.getElementById('val-rev');
        inpRev.oninput = () => {
            params.synthesis.reverb = parseInt(inpRev.value);
            if (valRev) valRev.innerText = inpRev.value;
            updateReverbMix();
        };

        const inpRevTime = document.getElementById('inp-revtime') as HTMLInputElement;
        const valRevTime = document.getElementById('val-revtime');
        inpRevTime.oninput = () => {
            params.synthesis.reverbTime = parseInt(inpRevTime.value);
            if (valRevTime) valRevTime.innerText = inpRevTime.value;
            updateReverbTime(); // Update continuously for smooth feel, or on change for perf
        };

        // --- Harmony Panel ---
        const inpBase = document.getElementById('inp-base') as HTMLInputElement;
        const valBase = document.getElementById('val-base');
        inpBase.oninput = () => {
            params.harmony.baseNote = parseInt(inpBase.value);
            if (valBase) valBase.innerText = inpBase.value;
        };

        const inpScale = document.getElementById('inp-scale') as HTMLSelectElement;
        inpScale.onchange = () => {
            params.harmony.scale = inpScale.value;
        };

        // --- Collapsible Logic ---
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', (e: any) => {
                const panel = e.target.closest('.glass-panel');
                panel.classList.toggle('collapsed');
            });
        });
    }

    p.preload = () => {
        font = 'monospace';
    };

    p.setup = () => {
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;
        p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, p.WEBGL);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        
        uiLayer = p.createGraphics(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);
        
        // --- Audio Setup ---
        const ac = p.getAudioContext();
        
        // Create a Master Gain Node to route instruments through
        masterGain = ac.createGain();
        masterGain.connect(ac.destination); // Connect dry signal to output
        
        // Initialize Reverb
        reverb = new p5.Reverb();
        reverb.process(masterGain, 3, 2); // Connect masterGain to reverb, init with 3s, 2 decay
        reverb.drywet(0.4); // Initial wet amount
        
        const loadInstrument = async (name: string, presetId: string) => {
            try {
                const instrument = new Soundfont(ac, { 
                    instrument: presetId,
                    destination: masterGain
                });
                await instrument.load;
                instruments[name] = instrument;
                console.log(`Loaded ${name}`);
            } catch (e) {
                console.error(`Failed to load ${name}`, e);
            }
        };

        // Load Piano, Guitar, Xylophone, Music Box, Rhodes
        Promise.all([
            loadInstrument('Piano', 'acoustic_grand_piano'),
            loadInstrument('Guitar', 'acoustic_guitar_nylon'),
            loadInstrument('Xylophone', 'xylophone'),
            loadInstrument('Music Box', 'music_box'),
            loadInstrument('Rhodes', 'electric_piano_1')
        ]).then(() => {
            instrumentsLoaded = true;
            const startBtn = document.getElementById('start-button');
            if (startBtn) {
                startBtn.textContent = "Tap to Start";
                startBtn.removeAttribute('disabled');
            }
        });

        // Initialize UI Logic
        setupUI();
        updateReverbMix();
        updateReverbTime();

        // Start Button Logic
        const startButton = document.getElementById('start-button');
        const startOverlay = document.getElementById('start-overlay');
        
        // Initial button state
        if (startButton) {
            startButton.setAttribute('disabled', 'true');
            startButton.textContent = "Loading Instruments...";
        }

        const startExperience = async (event: any) => {
            event.preventDefault();
            if (audioStarted || !instrumentsLoaded) return;
            
            try {
                await p.userStartAudio();
                audioStarted = true;
                startOverlay?.classList.add('hidden');
                
                // Init effects params again to ensure state
                updateReverbMix();
                updateReverbTime();
                
                startButton?.removeEventListener('click', startExperience);
                startButton?.removeEventListener('touchend', startExperience);
            } catch (e) {
                console.error("Audio Start Failed", e);
            }
        };

        if (startButton) {
            startButton.addEventListener('click', startExperience);
            startButton.addEventListener('touchend', startExperience);
        }
    }
    
    p.draw = () => {
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

        // @ts-ignore
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
            uiLayer.textAlign(p.CENTER, p.BOTTOM);
            for (let i = 0; i < noteCount; i++) {
                const screenX = p.map(i + 0.5, 0, noteCount, p.width/2 - cylinderLength/2, p.width/2 + cylinderLength/2);
                uiLayer.text(getNoteNameForLane(i), screenX, p.height - 30);
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
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;
        p.resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
        
        uiLayer.resizeCanvas(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);

        cubes = [];
    };

    p.mouseClicked = () => {
        if (!audioStarted) return;
        
        // Check if mouse is interacting with UI to prevent creating cubes underneath
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
             const rect = uiContainer.getBoundingClientRect();
             // Simple check: if mouse is in the UI header strip area. 
             // Note: The glass panels take up width but pointer-events: none is on container.
             // We need to check if we are over a panel specifically.
             // Since we added pointer-events: auto to panels, DOM events propagate.
             // However, p5 interaction happens on canvas. 
             // Canvas is z-index 0, UI is z-index 10. 
             // If we click a UI element, the browser handles it.
             // But clicks "through" the gap might trigger canvas.
             // Let's explicitly check targets.
        }

        // We can just rely on Event bubbling. 
        // If a click hit a UI element, it likely wouldn't reach the canvas click handler 
        // if we stop propagation, but p5 listens to the canvas.
        // A simple coordinate check for the top UI area is safest.
        
        // Approximate check: If mouseY is within the visible UI area (first ~200px if expanded, or ~50px if collapsed).
        // A more robust way: use elementFromPoint
        const target = document.elementFromPoint(p.mouseX, p.mouseY);
        if (target && target.closest('.glass-panel')) {
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
            // @ts-ignore
            const normalizedClickPos = p.map(clickPosOnAxis, -cylinderLength / 2, cylinderLength / 2, 0, 1);
            const noteIndex = p.floor(normalizedClickPos * noteCount);
            const quantizedPos = p.map(noteIndex + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
            cubes.push(new Cube(quantizedPos));
        }
    };
};

new p5(sketch, document.getElementById('canvas-container'));