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
    simulation: { bpm: 45, maxCycle: 9 },
    synthesis: { decay: 50, soundPreset: 'pluck', reverb: 48 },
    harmony: { baseNote: 60, scale: 'Pentatonic' },
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
    let synths: { pluck?: any, voicy?: any } = {};
    let reverb: any;
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
            
            if (this.bounceCount >= params.simulation.maxCycle) {
                this.opacity = 0;
            } else {
                this.opacity = this.p.map(this.bounceCount, 0, params.simulation.maxCycle, 100, 30);
            }
            this.opacity = this.p.max(this.opacity, 0);

            if (this.glow > 0.01) {
                this.glow *= 0.92;
            } else {
                this.glow = 0;
            }
        }

        triggerNote() {
            this.glow = 1.0;

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
            
            const brightness = this.p.lerp(70, 100, this.glow);
            const saturation = this.p.lerp(90, 100, this.glow);
            const currentSize = this.size + this.glow * 10;
            
            this.p.noStroke();
            this.p.emissiveMaterial(this.hue, saturation, brightness, this.opacity);
            this.p.box(currentSize);
            this.p.pop();
        }
    }

    /**
     * Applies current audio synthesis parameters to the p5.sound objects.
     */
    function updateAudioParams() {
        if (!reverb || !synths.pluck || !synths.voicy) return;
        reverb.drywet(params.synthesis.reverb / 100);
        
        const decaySeconds = params.synthesis.decay / 1000;
        synths.pluck.setADSR(0.01, decaySeconds, 0, 0.1);
        synths.voicy.setADSR(0.2, decaySeconds, 0.2, 0.5);
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
        
        // Initialize and configure the separate 2D graphics layer for the UI
        uiLayer = p.createGraphics(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);
        
        // Initialize synthesizers and reverb using the global p5 object
        synths.pluck = new p5.PolySynth(undefined, 16);
        synths.voicy = new p5.PolySynth(undefined, 16);
        reverb = new p5.Reverb();
        reverb.process(synths.pluck, 3, 2);
        reverb.process(synths.voicy, 3, 2);

        // --- GUI Setup using lil-gui ---
        gui = new GUI();
        gui.domElement.style.opacity = '0.9';

        const simFolder = gui.addFolder('Simulation');
        simFolder.add(params.simulation, 'bpm', 30, 120, 1).name('BPM');
        simFolder.add(params.simulation, 'maxCycle', 1, 20, 1).name('Max Cycle');
        simFolder.add({ reset: () => { cubes = []; } }, 'reset').name('Reset');

        const synthFolder = gui.addFolder('Synthesis');
        synthFolder.add(params.synthesis, 'decay', 50, 1000, 10).name('Decay').onChange(updateAudioParams);
        synthFolder.add(params.synthesis, 'soundPreset', ['pluck', 'voicy']).name('Sound Preset');
        synthFolder.add(params.synthesis, 'reverb', 0, 100, 1).name('Reverb').onChange(updateAudioParams);
        
        const harmonyFolder = gui.addFolder('Harmony');
        harmonyFolder.add(params.harmony, 'baseNote', 36, 72, 1).name('Base Note (MIDI)');
        harmonyFolder.add(params.harmony, 'scale', Object.keys(SCALES)).name('Scale');
        
        // --- Event Listeners ---
        document.getElementById('start-button')?.addEventListener('click', () => {
            p.userStartAudio(); // Required to start audio context in browsers
            document.getElementById('start-overlay')?.classList.add('hidden');
        });

        updateAudioParams(); // Apply initial audio parameters
    };
    
    /**
     * p5.js draw function. Runs on every frame.
     */
    p.draw = () => {
        if (!audioStarted && p.getAudioContext()?.state === 'running') {
            audioStarted = true;
        }
        
        p.background(0);
        p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -2000, 2000);
        
        p.ambientLight(50);
        p.pointLight(300, 100, 100, 0, -p.height, 0);
        p.pointLight(240, 100, 100, 0, p.height, 0);

        // Update and display all cubes, removing ones that have faded
        for (let i = cubes.length - 1; i >= 0; i--) {
            cubes[i].update();
            cubes[i].display();
            if (cubes[i].opacity <= 0) {
                cubes.splice(i, 1);
            }
        }
        
        const { isHorizontal, cylinderLength, cylinderRadius } = getCylinderDimensions();
        const noteCount = 12;

        // Draw central cylinder
        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);
        p.noStroke();
        p.specularMaterial(280, 80, 30, 40);
        p.shininess(50);
        p.cylinder(cylinderRadius, cylinderLength, 24, 1, false, false);
        p.pop();

        // Draw note lane lines on the cylinder
        p.push();
        if (isHorizontal) p.rotateZ(p.HALF_PI);
        p.stroke(200, 0, 100, 50);
        p.strokeWeight(2);
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

        // --- Draw 2D overlay using the dedicated UI layer ---
        uiLayer.clear(); // Clear the buffer for fresh drawing
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
                uiLayer.text(getNoteNameForLane(i), screenX, 20);
            }
        } else {
            uiLayer.textAlign(p.LEFT, p.CENTER);
            for (let i = 0; i < noteCount; i++) {
                const screenY = p.map(i + 0.5, 0, noteCount, p.height/2 - cylinderLength/2, p.height/2 + cylinderLength/2);
                uiLayer.text(getNoteNameForLane(i), 20, screenY);
            }
        }
        
        // Draw the UI layer onto the main canvas
        p.image(uiLayer, -p.width / 2, -p.height / 2);
    };
    
    p.windowResized = () => {
        const canvasContainer = document.getElementById('canvas-container')!;
        p.resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
        
        // Resize the UI layer and re-apply settings
        uiLayer.resizeCanvas(p.width, p.height);
        uiLayer.colorMode(p.HSB, 360, 100, 100, 100);
        uiLayer.textFont(font);
        uiLayer.textSize(14);

        cubes = []; // Clear cubes on resize to avoid positioning issues
    };

    p.mouseClicked = () => {
        if (!audioStarted) return;

        // Prevent click-through from the GUI
        const guiRect = gui.domElement.getBoundingClientRect();
        if (
            p.mouseX >= guiRect.left &&
            p.mouseX <= guiRect.right &&
            p.mouseY >= guiRect.top &&
            p.mouseY <= guiRect.bottom
        ) {
            return; // Click was inside the GUI, so don't spawn a cube.
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

// Instantiate the p5 sketch using the global p5 constructor
// and attach it to the container div
new p5(sketch, document.getElementById('canvas-container')!);
