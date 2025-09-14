import React, { useRef, useEffect } from 'react';
import p5 from 'p5';
import type { P5SketchProps } from '../types';
import { SCALES, NOTE_NAMES } from '../constants';

export const P5Sketch: React.FC<P5SketchProps> = (props) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const sketchInstance = useRef<p5 | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const sketch = (p: p5) => {
            let cubes: Cube[] = [];
            let synths: { pluck?: p5.PolySynth, voicy?: p5.PolySynth } = {};
            let reverb: p5.Reverb;
            let currentProps = props;

            class Cube {
                p: p5;
                pos: p5.Vector;
                angle: number;
                radius: number;
                len: number;
                velocity: number;
                bounceCount: number = 0;
                isFading: boolean = false;
                opacity: number = 75;
                size: number = 20;
                hue: number;
                lastAngle: number;
                
                constructor(p: p5) {
                    this.p = p;
                    const isHorizontal = p.width > p.height;
                    const cylinderLength = isHorizontal ? p.width * 0.6 : p.height * 0.7;

                    this.radius = isHorizontal ? p.height * 0.25 : p.width * 0.3;
                    this.len = p.random(-cylinderLength / 2, cylinderLength / 2);
                    this.angle = p.random(p.TWO_PI);
                    this.lastAngle = this.angle;
                    this.velocity = p.random(0.005, 0.015);
                    this.pos = p.createVector(0,0,0);
                    this.hue = p.random(280, 340);
                }

                update() {
                    this.lastAngle = this.angle;
                    this.angle += this.velocity * currentProps.simulationParams.speed * 0.2;
                    if (this.angle > this.p.TWO_PI) {
                        this.angle -= this.p.TWO_PI;
                        this.lastAngle -= this.p.TWO_PI;
                    }

                    // Collision check
                    if (this.lastAngle < 0 && this.angle >= 0) {
                        this.bounceCount++;
                        this.triggerNote();
                    }
                    
                    if (this.bounceCount >= currentProps.simulationParams.maxCycle) {
                        this.isFading = true;
                    }

                    if (this.isFading) {
                        this.opacity -= (255 / (currentProps.simulationParams.fade / 16.67));
                    }
                }

                triggerNote() {
                    const isHorizontal = this.p.width > this.p.height;
                    const cylinderLength = isHorizontal ? this.p.width * 0.6 : this.p.height * 0.7;
                    const normalizedPos = this.p.map(this.len, -cylinderLength / 2, cylinderLength / 2, 0, 1);
                    
                    const laneIndex = this.p.floor(this.p.constrain(normalizedPos * 12, 0, 11));

                    const scaleIntervals = SCALES[currentProps.harmonyParams.scale];
                    const numNotesInScale = scaleIntervals.length;

                    const noteInScaleIndex = laneIndex % numNotesInScale;
                    const octaveOffset = Math.floor(laneIndex / numNotesInScale);
                    
                    const scaleInterval = scaleIntervals[noteInScaleIndex];
                    const midiNote = currentProps.harmonyParams.baseNote + scaleInterval + (octaveOffset * 12);

                    const noteIndex = midiNote % 12;
                    const octave = Math.floor(midiNote / 12) - 1;
                    const note = `${NOTE_NAMES[noteIndex]}${octave}`;
                    
                    const synth = currentProps.synthesisParams.soundPreset === 'pluck' ? synths.pluck : synths.voicy;
                    if (synth) {
                        const decaySeconds = currentProps.synthesisParams.decay / 1000;
                        synth.play(note, 0.5, 0, decaySeconds);
                    }
                }

                display() {
                    this.p.push();
                    const isHorizontal = this.p.width > this.p.height;

                    if (isHorizontal) {
                        this.p.translate(this.len, 0, 0);
                        this.p.rotateX(this.angle);
                        this.p.translate(0, this.radius, 0);
                    } else {
                        this.p.translate(0, this.len, 0);
                        this.p.rotateY(this.angle);
                        this.p.translate(this.radius, 0, 0);
                    }
                    
                    this.p.noStroke();
                    this.p.emissiveMaterial(this.hue, 90, 80, this.opacity);
                    this.p.box(this.size);
                    this.p.pop();
                }
            }

            const updateAudioParams = () => {
                if(reverb && synths.pluck && synths.voicy) {
                    const reverbLevel = currentProps.synthesisParams.reverb / 100;
                    reverb.drywet(reverbLevel);

                    const decaySeconds = currentProps.synthesisParams.decay / 1000;
                    synths.pluck.setADSR(0.01, decaySeconds, 0, 0.1);
                    synths.voicy.setADSR(0.2, decaySeconds, 0.2, 0.5);
                }
            };
            
            p.updateWithProps = (newProps: P5SketchProps) => {
                if (currentProps.resetSignal !== newProps.resetSignal) {
                    cubes = [];
                }
                currentProps = newProps;
                updateAudioParams();
            };

            p.setup = () => {
                p.createCanvas(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight, p.WEBGL);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                
                synths.pluck = new p5.PolySynth();
                synths.voicy = new p5.PolySynth();

                if (synths.pluck && synths.voicy) {
                    reverb = new p5.Reverb();
                    reverb.process(synths.pluck, 3, 2);
                    reverb.process(synths.voicy, 3, 2);
                    updateAudioParams();
                }
            };
            
            p.draw = () => {
                p.background(0);
                p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -2000, 2000);
                p.ambientLight(50);
                p.pointLight(300, 100, 100, 0, -p.height, 0);
                p.pointLight(240, 100, 100, 0, p.height, 0);

                if (p.frameCount % 15 === 0 && cubes.length < 30) {
                    cubes.push(new Cube(p));
                }

                cubes.forEach(cube => {
                    cube.update();
                    cube.display();
                });

                cubes = cubes.filter(cube => cube.opacity > 0);

                const isHorizontal = p.width > p.height;
                const cylinderLength = isHorizontal ? p.width * 0.6 : p.height * 0.7;
                const cylinderRadius = isHorizontal ? p.height * 0.25 : p.width * 0.3;
                const noteCount = 12;

                // Draw Cylinder
                p.push();
                if (isHorizontal) {
                    p.rotateZ(p.HALF_PI);
                }
                p.noStroke();
                p.specularMaterial(280, 80, 30, 40);
                p.shininess(50);
                p.cylinder(cylinderRadius, cylinderLength, 24, 1, false, false);
                p.pop();

                // Draw Scale Lines
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
                        const x = cylinderRadius * p.cos(angle);
                        const z = cylinderRadius * p.sin(angle);
                        p.vertex(x, 0, z);
                    }
                    p.endShape(p.CLOSE);
                    p.pop();
                }
                p.pop();

                // 2D Overlay for Note Labels
                p.push();
                p.resetMatrix();
                p.translate(-p.width/2, -p.height/2);
                p.fill(255);
                p.noStroke();
                p.textFont("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
                p.textSize(14);
                
                const scaleIntervals = SCALES[currentProps.harmonyParams.scale];
                const numNotesInScale = scaleIntervals.length;

                const getNoteNameForLane = (i: number) => {
                    if (!scaleIntervals) return '';
                    const noteInScaleIndex = i % numNotesInScale;
                    const octaveOffset = Math.floor(i / numNotesInScale);
                    const scaleInterval = scaleIntervals[noteInScaleIndex];
                    const midiNote = currentProps.harmonyParams.baseNote + scaleInterval + (octaveOffset * 12);
                    return `${NOTE_NAMES[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
                };

                if (isHorizontal) {
                    p.textAlign(p.CENTER, p.TOP);
                    for (let i = 0; i < noteCount; i++) {
                        const laneCenterX_world = p.map(i + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                        const screenX = laneCenterX_world + p.width / 2;
                        p.text(getNoteNameForLane(i), screenX, 20);
                    }
                } else { // Vertical
                    p.textAlign(p.LEFT, p.CENTER);
                    for (let i = 0; i < noteCount; i++) {
                        const laneCenterY_world = p.map(i + 0.5, 0, noteCount, -cylinderLength / 2, cylinderLength / 2);
                        const screenY = laneCenterY_world + p.height / 2;
                        p.text(getNoteNameForLane(i), 20, screenY);
                    }
                }
                p.pop();
            };
            
            p.windowResized = () => {
                if (canvasRef.current) {
                    p.resizeCanvas(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
                }
                cubes = []; // Reset cubes on resize to re-calculate dimensions
            };
        };
        
        sketchInstance.current = new p5(sketch, canvasRef.current);

        return () => {
            sketchInstance.current?.remove();
        };
    }, []);

    useEffect(() => {
        if (sketchInstance.current && 'updateWithProps' in sketchInstance.current) {
            (sketchInstance.current as any).updateWithProps(props);
        }
    }, [props]);

    return <div ref={canvasRef} className="w-full h-full" />;
};
