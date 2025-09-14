// FIX: Removed the global declaration for 'p5' to resolve a "Duplicate identifier" error. The project's setup provides this type automatically.
// --- Global Parameters and Constants ---
const params = {
    simulation: { bpm: 60, maxCycle: 9 },
    synthesis: { decay: 50, soundPreset: 'pluck', reverb: 48 },
    harmony: { baseNote: 60, scale: 'Pentatonic' },
};

const SCALES: Record<string, number[]> = {
    Major: [0, 2, 4, 5, 7, 9, 11],
    Minor: [0, 2, 3, 5, 7, 8, 10],
    Pentatonic: [0, 2, 4, 7, 9],
    Blues: [0, 3, 5, 6, 7, 10],
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11],
    'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let playableNotes: string[] = [];

function generateScale() {
    const baseNote = params.harmony.baseNote;
    const scaleIntervals = SCALES[params.harmony.scale];
    const notes: string[] = [];
    scaleIntervals.forEach(interval => {
        const midiNote = baseNote + interval;
        const noteIndex = midiNote % 12;
        const octave = Math.floor(midiNote / 12) - 1;
        notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
    });
    playableNotes = notes;
}

// --- p5.js Sketch ---
// FIX: Type the p5 instance to 'any' to allow property access.
const sketch = (p: any) => {
    let cubes: Cube[] = [];
    // FIX: Type synths as 'any' to allow adding properties dynamically.
    let synths: any = {};
    let reverb: any;
    
    let audioStarted = false;

    function getCylinderDimensions() {
        const isHorizontal = p.width > p.height;
        // Maximise the cylinder size
        const cylinderLength = isHorizontal ? p.width * 0.8 : p.height * 0.8;
        const cylinderRadius = isHorizontal ? p.height * 0.4 : p.width * 0.4;
        return { isHorizontal, cylinderLength, cylinderRadius };
    }

    class Cube {
        // FIX: Declare class properties to fix "Property does not exist on type 'Cube'" errors.
        p: any;
        radius: number;
        len: number;
        angle: number;
        startAngle: number;
        lastAngle: number;
        pos: any;
        hue: number;
        bounceCount: number;
        opacity: number;
        size: number;
        glow: number;

        constructor(lenVal: number) {
            this.p = p;
            this.size = 30; // Increased cube size
            const { isHorizontal, cylinderRadius } = getCylinderDimensions();
            
            this.radius = cylinderRadius + (this.size / 2); // Position edge of cube on cylinder surface

            this.len = lenVal;

            // Set a fixed starting angle so cubes are created at the "front"
            // of the cylinder. This startAngle will also be the trigger point for the note.
            if (isHorizontal) {
                this.startAngle = this.p.HALF_PI; // Corresponds to z > 0 for rotateX
            } else {
                this.startAngle = -this.p.HALF_PI; // Corresponds to z > 0 for rotateY
            }
            this.angle = this.startAngle;

            this.lastAngle = this.angle;
            this.pos = p.createVector(0, 0, 0);
            this.hue = p.random(280, 340);
            
            this.bounceCount = 0;
            this.opacity = 100; // Start fully opaque
            this.glow = 0;

            // Trigger sound immediately on creation
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
            
            // --- Opacity and Glow Logic ---
            if (this.bounceCount >= params.simulation.maxCycle) {
                this.opacity = 0; // Disappear immediately
            } else {
                // Map bounce count to opacity from 100% down to 30%
                this.opacity = this.p.map(this.bounceCount, 0, params.simulation.maxCycle, 100, 30);
            }
            this.opacity = this.p.max(this.opacity, 0); // Clamp opacity

            // Decay the glow effect
            if (this.glow > 0.01) {
                this.glow *= 0.92; // Exponential decay
            } else {
                this.glow = 0;
            }
        }

        triggerNote() {
            this.glow = 1.0; // Activate glow on sound trigger

            const { cylinderLength } = getCylinderDimensions();
            const normalizedPos = this.p.map(this.len, -cylinderLength / 2, cylinderLength / 2, 0, 1);
            const laneIndex = this.p.floor(this.p.constrain(normalizedPos * 12, 0, 11));

            const scaleIntervals = SCALES[params.harmony.scale];
            const numNotesInScale = scaleIntervals.length;

            const noteInScaleIndex = laneIndex % numNotesInScale;
            const octaveOffset = Math.floor(laneIndex / numNotesInScale);
            
            const scaleInterval = scaleIntervals[noteInScaleIndex];
            const midiNote = params.harmony.baseNote + scaleInterval + (octaveOffset * 12);

            const noteIndex = midiNote % 12;
            const octave = Math.floor(midiNote / 12) - 1;
            const note = `${NOTE_NAMES[noteIndex]}${octave}`;
            
            const synth = params.synthesis.soundPreset === 'pluck' ? synths.pluck : synths.voicy;
            if (synth) {
                const decaySeconds = params.synthesis.decay / 1000;
                synth.play(note, 0.5, 0, decaySeconds);
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
            
            // Glow effect: interpolate brightness, saturation, and size for more impact
            const brightness = this.p.lerp(70, 100, this.glow); // Increased contrast
            const saturation = this.p.lerp(90, 100, this.glow); // Saturate color on glow
            const currentSize = this.size + this.glow * 10; // More significant size increase
            
            this.p.noStroke();
            this.p.emissiveMaterial(this.hue, saturation, brightness, this.opacity);
            this.p.box(currentSize);
            this.p.pop();
        }
    }

    function setupControls() {
        const controls = {
            bpm: { slider: 'bpm', value: 'bpm-value', param: 'bpm', obj: 'simulation', fixed: 0 },
            maxCycle: { slider: 'maxCycle', value: 'maxCycle-value', param: 'maxCycle', obj: 'simulation', fixed: 0 },
            decay: { slider: 'decay', value: 'decay-value', param: 'decay', obj: 'synthesis', fixed: 0 },
            reverb: { slider: 'reverb', value: 'reverb-value', param: 'reverb', obj: 'synthesis', fixed: 0 },
        };

        for (const key in controls) {
            const c = controls[key as keyof typeof controls];
            // FIX: Cast element to HTMLInputElement to access 'value' property.
            const slider = document.getElementById(c.slider) as HTMLInputElement;
            const valueSpan = document.getElementById(c.value);
            
            if (slider && valueSpan) {
                slider.value = String((params as any)[c.obj][c.param]);
                valueSpan.textContent = parseFloat(slider.value).toFixed(c.fixed);

                slider.addEventListener('input', (e) => {
                    // FIX: Cast event target to HTMLInputElement to access 'value' property.
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    (params as any)[c.obj][c.param] = value;
                    valueSpan.textContent = value.toFixed(c.fixed);
                    if (key === 'decay' || key === 'reverb') updateAudioParams();
                });
            }
        }
        
        // FIX: Cast element to HTMLInputElement to access 'value' property.
        const baseNoteSlider = document.getElementById('baseNote') as HTMLInputElement;
        const baseNoteValue = document.getElementById('baseNote-value');
        if (baseNoteSlider && baseNoteValue) {
            const updateBaseNoteUI = () => {
                const val = params.harmony.baseNote;
                baseNoteValue.textContent = `${NOTE_NAMES[val % 12]}${Math.floor(val / 12) - 1}`;
            };
            baseNoteSlider.value = String(params.harmony.baseNote);
            updateBaseNoteUI();
            baseNoteSlider.addEventListener('input', (e) => {
                // FIX: Cast event target to HTMLInputElement to access 'value' property.
                params.harmony.baseNote = parseInt((e.target as HTMLInputElement).value);
                updateBaseNoteUI();
                generateScale();
            });
        }

        // FIX: Cast element to HTMLSelectElement to access 'value' property.
        const scaleSelect = document.getElementById('scale') as HTMLSelectElement;
        if(scaleSelect) {
            scaleSelect.value = params.harmony.scale;
            scaleSelect.addEventListener('change', (e) => {
                // FIX: Cast event target to HTMLSelectElement to access 'value' property.
                (params.harmony as any).scale = (e.target as HTMLSelectElement).value;
                generateScale();
            });
        }
        
        // FIX: Cast element to HTMLSelectElement to access 'value' property.
        const soundPresetSelect = document.getElementById('soundPreset') as HTMLSelectElement;
        if (soundPresetSelect) {
            soundPresetSelect.value = params.synthesis.soundPreset;
            soundPresetSelect.addEventListener('change', (e) => {
                // FIX: Cast event target to HTMLSelectElement to access 'value' property.
                (params.synthesis as any).soundPreset = (e.target as HTMLSelectElement).value;
            });
        }

        document.getElementById('reset-button')?.addEventListener('click', () => { cubes = []; });
        
        document.getElementById('start-button')?.addEventListener('click', () => {
            p.userStartAudio();
            document.getElementById('start-overlay')?.classList.add('hidden');
        });

        // Setup collapsible GUI panels
        const panelHeaders = document.querySelectorAll('.gui-panel h2');
        panelHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.parentElement;
                panel?.classList.toggle('collapsed');
            });
        });
    }

    function updateAudioParams() {
        if (!reverb) return;
        reverb.drywet(params.synthesis.reverb / 100);
        
        if (synths.pluck && synths.voicy) {
            const decaySeconds = params.synthesis.decay / 1000;
            // setADSR(attackTime, decayTime, susRatio, releaseTime)
            synths.pluck.setADSR(0.01, decaySeconds, 0, 0.1);
            synths.voicy.setADSR(0.2, decaySeconds, 0.2, 0.5);
        }
    }
    
    p.setup = () => {
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            const canvas = p.createCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight, p.WEBGL);
            p.colorMode(p.HSB, 360, 100, 100, 100);

            // FIX: Cast p5 to 'any' to access p5.sound properties (PolySynth, Reverb) which are not included in the default p5 TypeScript definitions, resolving property access errors.
            synths.pluck = new (p5 as any).PolySynth(undefined, 16);
            synths.voicy = new (p5 as any).PolySynth(undefined, 16);
            
            reverb = new (p5 as any).Reverb();
            reverb.process(synths.pluck, 3, 2);
            reverb.process(synths.voicy, 3, 2);

            generateScale();
            setupControls();
            updateAudioParams();
        }
    };
    
    p.draw = () => {
        if (!audioStarted && p.getAudioContext()?.state === 'running') {
            audioStarted = true;
        }
        
        p.background(0);
        p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -2000, 2000);
        p.ambientLight(50);
        p.pointLight(300, 100, 100, 0, -p.height, 0);
        p.pointLight(240, 100, 100, 0, p.height, 0);

        for (let i = cubes.length - 1; i >= 0; i--) {
            cubes[i].update();
            cubes[i].display();
            if (cubes[i].opacity <= 0) {
                cubes.splice(i, 1);
            }
        }
        
        const { isHorizontal, cylinderLength, cylinderRadius } = getCylinderDimensions();

        // Draw Cylinder
        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);

        p.noStroke();
        p.specularMaterial(280, 80, 30, 40); // Made more transparent
        p.shininess(50);
        p.cylinder(cylinderRadius, cylinderLength, 24, 1, false, false);
        p.pop();

        // Draw Scale Lines
        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);

        const noteCount = 12; // Always 12 lanes for a full octave
        if (noteCount > 0) {
            // Draw lines between note zones
            p.stroke(200, 0, 100, 50); // More visible white lines
            p.strokeWeight(2);
            p.noFill();
            for (let i = 0; i <= noteCount; i++) { // Draws 13 lines for 12 segments
                const yPos = p.map(i, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                p.push();
                p.translate(0, yPos, 0);
                p.beginShape();
                for (let angle = 0; angle < p.TWO_PI; angle += p.PI / 16) {
                    const x = cylinderRadius * p.cos(angle);
                    const z = cylinderRadius * p.sin(angle);
                    p.vertex(x, 0, z);
                }
                p.endShape(p.CLOSE);
                p.pop();
            }
        }
        p.pop();

        // --- 2D Overlay for Note Labels ---
        p.push();
        p.resetMatrix();
        p.translate(-p.width/2, -p.height/2); // Set origin to top-left for 2D screen drawing

        p.fill(200, 0, 100, 100); // White text
        p.noStroke();
        p.textFont("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
        p.textSize(14);
        
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
            p.textAlign(p.CENTER, p.TOP);
            for (let i = 0; i < noteCount; i++) {
                const laneCenterX_world = p.map(i + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                const screenX = laneCenterX_world + p.width / 2;
                const noteName = getNoteNameForLane(i);
                p.text(noteName, screenX, 20); // Display 20px from the top
            }
        } else { // Vertical
            p.textAlign(p.LEFT, p.CENTER);
            for (let i = 0; i < noteCount; i++) {
                const laneCenterY_world = p.map(i + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                const screenY = laneCenterY_world + p.height / 2;
                const noteName = getNoteNameForLane(i);
                p.text(noteName, 20, screenY); // Display 20px from the left
            }
        }
        p.pop();
    };
    
    p.windowResized = () => {
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
             p.resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
             cubes = [];
        }
    };

    p.mouseClicked = () => {
        // Only allow adding cubes after the experience has started.
        if (!audioStarted) {
            return;
        }

        const { isHorizontal, cylinderLength, cylinderRadius } = getCylinderDimensions();

        const worldX = p.mouseX - p.width / 2;
        const worldY = p.mouseY - p.height / 2;

        let clickPosOnAxis;
        let isHit = false;

        if (isHorizontal) {
            if (Math.abs(worldY) <= cylinderRadius && Math.abs(worldX) <= cylinderLength / 2) {
                isHit = true;
                clickPosOnAxis = worldX;
            }
        } else { // Vertical
            if (Math.abs(worldX) <= cylinderRadius && Math.abs(worldY) <= cylinderLength / 2) {
                isHit = true;
                clickPosOnAxis = worldY;
            }
        }

        if (isHit) {
            const noteCount = 12; // Always 12 lanes
            if (noteCount > 0) {
                // Normalize click position to a 0-1 range along the cylinder axis.
                const normalizedClickPos = p.map(clickPosOnAxis, -cylinderLength / 2, cylinderLength / 2, 0, 1);
                
                // Find the index of the note lane that was clicked.
                const noteIndex = p.floor(normalizedClickPos * noteCount);
                
                // Calculate the center position of that lane. This quantizes the position.
                const quantizedPos = p.map(noteIndex + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                
                // Create the cube immediately.
                if (cubes.length < 50) {
                    cubes.push(new Cube(quantizedPos));
                }
            }
        }
    };
};

// FIX: Pass the container element to the p5 constructor. This resolves the "Expected 2 arguments" error by matching the required signature and also handles canvas attachment.
new p5(sketch, document.getElementById('canvas-container')!);
