import { Soundfont } from 'smplr';
import { Track, NoteEvent, Writer } from 'midi-writer-js';

// p5.js is loaded globally via the script tag in index.html.

const params = {
    simulation: { bpm: 45, maxCycle: 9, infiniteLifespan: false },
    synthesis: { gain: 70, soundPreset: 'Piano', reverb: 40, reverbTime: 40 },
    harmony: { baseNote: 48, scale: 'Pentatonic' },
};

const SCALES = {
    Major: [0, 2, 4, 5, 7, 9, 11],
    Minor: [0, 2, 3, 5, 7, 8, 10],
    Pentatonic: [0, 2, 4, 7, 9],
    Blues: [0, 3, 5, 6, 7, 10],
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11],
    HarmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const sketch = (p) => {
    let cubes = [];
    
    let instruments = {};
    let masterGain; 
    let reverb; 
    
    let audioStarted = false;
    let instrumentsLoaded = false;
    
    let recording = false;
    let recordStartTime = 0;
    let recordedNotes = [];
    let mediaRecorder;
    let audioChunks = [];
    
    let font;
    let uiLayer;

    function getCylinderDimensions() {
        const isHorizontal = p.width > p.height;
        const cylinderLength = isHorizontal ? p.width * 0.9 : p.height * 0.9;
        const cylinderRadius = isHorizontal ? p.height * 0.35 : p.width * 0.35;
        return { isHorizontal, cylinderLength, cylinderRadius };
    }

    class Cube {
        constructor(lenVal) {
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
                const totalAngle = this.angle - this.startAngle;
                const currentRevolutions = totalAngle / this.p.TWO_PI;
                const lifeProgress = currentRevolutions / params.simulation.maxCycle;

                if (lifeProgress >= 1.0) {
                    this.opacity = 0;
                } else {
                    this.opacity = (1.0 - lifeProgress) * 100;
                }
            }

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
            const baseMidiNote = params.harmony.baseNote + scaleInterval + (octaveOffset * 12);
            let midiNote = Math.floor(baseMidiNote);
            midiNote = this.p.constrain(midiNote, 21, 108);
            
            const gain = params.synthesis.gain / 100;
            const preset = params.synthesis.soundPreset;
            
            const instrument = instruments[preset];
            if (instrument && audioStarted) {
                try {
                    instrument.start({ 
                        note: midiNote, 
                        velocity: Math.floor(gain * 100), 
                        duration: 2.0 
                    });
                } catch (e) {
                    console.warn("Error playing note:", e);
                }
            }

            if (recording) {
                recordedNotes.push({
                    midiNote: midiNote,
                    time: (this.p.millis() - recordStartTime) / 1000,
                    duration: 0.5, // Shorter duration for percussive feel
                    velocity: Math.floor(gain * 100)
                });
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

            if (this.glow > 0.01) {
                this.p.push();
                const highlightOpacity = this.p.map(this.glow, 0, 1, 0, 80);
                const combinedHighlightOpacity = (highlightOpacity * this.opacity) / 100;
                
                const highlightSize = currentSize * 1.25;
                this.p.noFill();
                this.p.strokeWeight(this.p.map(this.glow, 0, 1, 0, 4));
                this.p.stroke(this.hue, 10, 100, combinedHighlightOpacity);
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

    function drawGradientCylinder(radius, height, detail) {
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
    
    function setupUI() {
        // --- Simulation Panel ---
        const inpBpm = document.getElementById('inp-bpm');
        const valBpm = document.getElementById('val-bpm');
        inpBpm.oninput = () => {
            params.simulation.bpm = parseInt(inpBpm.value);
            if (valBpm) valBpm.innerText = inpBpm.value;
        };

        const inpCycle = document.getElementById('inp-cycle');
        const valCycle = document.getElementById('val-cycle');
        inpCycle.oninput = () => {
            params.simulation.maxCycle = parseInt(inpCycle.value);
            if (valCycle) valCycle.innerText = inpCycle.value;
        };

        const inpInfinite = document.getElementById('inp-infinite');
        inpInfinite.onchange = () => {
            params.simulation.infiniteLifespan = inpInfinite.checked;
        };

        const btnRemove = document.getElementById('btn-remove');
        if (btnRemove) btnRemove.onclick = () => { if (cubes.length > 0) cubes.pop(); };
        
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) btnReset.onclick = () => { cubes = []; };

        const btnRecord = document.getElementById('btn-record');
        const inpRecordFormat = document.getElementById('inp-record-format');

        if (btnRecord) {
            btnRecord.onclick = () => {
                if (!recording) {
                    recording = true;
                    recordStartTime = p.millis();
                    recordedNotes = [];
                    
                    const format = inpRecordFormat ? inpRecordFormat.value : 'midi';
                    
                    if (format === 'audio') {
                        audioChunks = [];
                        if (mediaRecorder && mediaRecorder.state === 'inactive') {
                            mediaRecorder.start();
                        }
                    }

                    btnRecord.innerText = "Stop & Export";
                    btnRecord.style.backgroundColor = "rgba(255, 0, 0, 0.6)";
                    if (inpRecordFormat) inpRecordFormat.disabled = true;
                } else {
                    recording = false;
                    const format = inpRecordFormat ? inpRecordFormat.value : 'midi';

                    if (format === 'audio') {
                        if (mediaRecorder && mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                    } else {
                        exportMidi();
                    }

                    btnRecord.innerText = "Start Recording";
                    btnRecord.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
                    if (inpRecordFormat) inpRecordFormat.disabled = false;
                }
            };
        }

        // --- Sound Panel ---
        const inpVol = document.getElementById('inp-vol');
        const valVol = document.getElementById('val-vol');
        inpVol.oninput = () => {
            params.synthesis.gain = parseInt(inpVol.value);
            if (valVol) valVol.innerText = inpVol.value;
        };

        const inpInstrument = document.getElementById('inp-instrument');
        inpInstrument.onchange = () => {
            params.synthesis.soundPreset = inpInstrument.value;
        };

        const inpRev = document.getElementById('inp-rev');
        const valRev = document.getElementById('val-rev');
        inpRev.oninput = () => {
            params.synthesis.reverb = parseInt(inpRev.value);
            if (valRev) valRev.innerText = inpRev.value;
            updateReverbMix();
        };

        const inpRevTime = document.getElementById('inp-revtime');
        const valRevTime = document.getElementById('val-revtime');
        inpRevTime.oninput = () => {
            params.synthesis.reverbTime = parseInt(inpRevTime.value);
            if (valRevTime) valRevTime.innerText = inpRevTime.value;
            updateReverbTime();
        };

        // --- Harmony Panel ---
        const inpBase = document.getElementById('inp-base');
        const valBase = document.getElementById('val-base');
        inpBase.oninput = () => {
            params.harmony.baseNote = parseInt(inpBase.value);
            if (valBase) valBase.innerText = inpBase.value;
        };

        const inpScale = document.getElementById('inp-scale');
        inpScale.onchange = () => {
            params.harmony.scale = inpScale.value;
        };

        // --- Collapsible Logic ---
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const panel = e.target.closest('.glass-panel');
                panel.classList.toggle('collapsed');
            });
        });
        // --- Theme Toggle ---
    }

    function exportMidi() {
        if (recordedNotes.length === 0) {
            console.log("No notes recorded.");
            return;
        }

        // midi-writer-js default ticks per beat is 128
        const ticksPerBeat = 128;
        const ticksPerSecond = (params.simulation.bpm / 60) * ticksPerBeat;

        // Sort notes by start time to be safe
        recordedNotes.sort((a, b) => a.time - b.time);

        const track = new Track();
        track.setTempo(params.simulation.bpm);

        for (const note of recordedNotes) {
            const startTick = Math.round(note.time * ticksPerSecond);
            const durationTicks = Math.round(note.duration * ticksPerSecond);
            
            // Using 'tick' as the absolute tick position for the note event.
            // This allows for polyphony and correct timing regardless of overlap.
            track.addEvent(new NoteEvent({
                pitch: [note.midiNote],
                duration: 'T' + durationTicks,
                tick: startTick, // Use 'tick' for absolute positioning
                velocity: note.velocity
            }));
        }

        const write = new Writer(track);
        const dataUri = write.dataUri();
        
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = 'chime-wall-recording.mid';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        
        const ac = p.getAudioContext();
        
        // Create a MediaStreamDestination to record audio
        const dest = ac.createMediaStreamDestination();
        mediaRecorder = new MediaRecorder(dest.stream);
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'chime-wall-recording.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            audioChunks = []; // Reset chunks
        };

        masterGain = ac.createGain();
        masterGain.connect(ac.destination); 
        masterGain.connect(dest); // Connect master gain to recorder destination as well
        
        reverb = new p5.Reverb();
        reverb.process(masterGain, 3, 2); 
        reverb.drywet(0.4); 
        
        const loadInstrument = async (name, presetId) => {
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

        loadInstrument('Piano', 'acoustic_grand_piano').then(async () => {
            instrumentsLoaded = true;
            const startBtn = document.getElementById('start-button');
            if (startBtn) {
                startBtn.textContent = "Tap to Start";
                startBtn.removeAttribute('disabled');
            }
            
            await loadInstrument('Rhodes', 'electric_piano_1');
            await loadInstrument('Guitar', 'acoustic_guitar_nylon');
            await loadInstrument('Xylophone', 'xylophone');
            await loadInstrument('Music Box', 'music_box');
            console.log("All instruments loaded");
        });

        setupUI();
        updateReverbMix();
        updateReverbTime();

        const startButton = document.getElementById('start-button');
        const startOverlay = document.getElementById('start-overlay');
        
        if (startButton) {
            startButton.setAttribute('disabled', 'true');
            startButton.textContent = "Loading Instruments...";
        }

        const startExperience = async (event) => {
            event.preventDefault();
            if (audioStarted || !instrumentsLoaded) return;
            
            try {
                await p.userStartAudio();
                audioStarted = true;
                startOverlay?.classList.add('hidden');
                
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

        const scaleIntervals = SCALES[params.harmony.scale];
        const numNotesInScale = scaleIntervals.length;

        const getNoteNameForLane = (i) => {
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
        
        const uiContainer = document.getElementById('ui-container');
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
            const normalizedClickPos = p.map(clickPosOnAxis, -cylinderLength / 2, cylinderLength / 2, 0, 1);
            const noteIndex = p.floor(normalizedClickPos * noteCount);
            const quantizedPos = p.map(noteIndex + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
            cubes.push(new Cube(quantizedPos));
        }
    };
};

new p5(sketch, document.getElementById('canvas-container'));