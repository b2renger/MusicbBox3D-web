
import React, { useState, useEffect, useCallback } from 'react';
import { P5Sketch } from './components/P5Sketch';
import { GuiPanel } from './components/GuiPanel';
import { Slider } from './components/Slider';
import { Button } from './components/Button';
import { Select } from './components/Select';
import type { SimulationParams, SynthesisParams, HarmonyParams, ScaleName, SoundPreset } from './types';
import { DEFAULT_PARAMS, SCALES, NOTE_NAMES } from './constants';

const App: React.FC = () => {
    const [isStarted, setIsStarted] = useState(false);
    const [simulationParams, setSimulationParams] = useState<SimulationParams>(DEFAULT_PARAMS.simulation);
    const [synthesisParams, setSynthesisParams] = useState<SynthesisParams>(DEFAULT_PARAMS.synthesis);
    const [harmonyParams, setHarmonyParams] = useState<HarmonyParams>(DEFAULT_PARAMS.harmony);
    const [playableNotes, setPlayableNotes] = useState<string[]>([]);
    const [resetSignal, setResetSignal] = useState(0);

    const generateScale = useCallback(() => {
        const baseNote = harmonyParams.baseNote;
        const scaleIntervals = SCALES[harmonyParams.scale];
        const notes: string[] = [];
        scaleIntervals.forEach(interval => {
            const midiNote = baseNote + interval;
            const noteIndex = midiNote % 12;
            const octave = Math.floor(midiNote / 12) - 1;
            notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
        });
        setPlayableNotes(notes);
    }, [harmonyParams.baseNote, harmonyParams.scale]);
    
    useEffect(() => {
        generateScale();
    }, [generateScale]);

    const handleStart = () => {
        setIsStarted(true);
    };

    const handleReset = () => {
        setResetSignal(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans flex flex-col md:flex-row p-4 gap-4">
            {!isStarted && (
                <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
                    <button
                        onClick={handleStart}
                        className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors text-2xl animate-pulse"
                    >
                        Click to Start
                    </button>
                </div>
            )}

            <div className="flex-grow relative h-[50vh] md:h-auto">
                {isStarted && <P5Sketch 
                    simulationParams={simulationParams}
                    synthesisParams={synthesisParams}
                    harmonyParams={harmonyParams}
                    playableNotes={playableNotes}
                    resetSignal={resetSignal}
                />}
            </div>

            <div className="flex flex-col gap-4 w-full md:w-80 flex-shrink-0">
                <GuiPanel title="Simulation">
                    <Slider
                        label="Speed"
                        value={simulationParams.speed}
                        min={1}
                        max={10}
                        step={0.1}
                        onChange={value => setSimulationParams(p => ({ ...p, speed: value }))}
                    />
                    <Slider
                        label="Max Cycle"
                        value={simulationParams.maxCycle}
                        min={1}
                        max={20}
                        step={1}
                        onChange={value => setSimulationParams(p => ({ ...p, maxCycle: value }))}
                    />
                    <Slider
                        label="Fade"
                        value={simulationParams.fade}
                        min={100}
                        max={1000}
                        step={10}
                        onChange={value => setSimulationParams(p => ({ ...p, fade: value }))}
                    />
                    <Button onClick={handleReset}>Reset</Button>
                </GuiPanel>

                <GuiPanel title="Synthesis">
                    <Slider
                        label="Decay"
                        value={synthesisParams.decay}
                        min={50}
                        max={1000}
                        step={10}
                        onChange={value => setSynthesisParams(p => ({ ...p, decay: value }))}
                    />
                    <Select<SoundPreset>
                        label="Sound Preset"
                        value={synthesisParams.soundPreset}
                        options={['pluck', 'voicy']}
                        onChange={value => setSynthesisParams(p => ({ ...p, soundPreset: value as SoundPreset }))}
                    />
                    <Slider
                        label="Reverb"
                        value={synthesisParams.reverb}
                        min={0}
                        max={100}
                        step={1}
                        onChange={value => setSynthesisParams(p => ({ ...p, reverb: value }))}
                    />
                </GuiPanel>

                <GuiPanel title="Harmony">
                     <Slider
                        label="Base Note"
                        value={harmonyParams.baseNote}
                        min={36}
                        max={72}
                        step={1}
                        onChange={value => setHarmonyParams(p => ({ ...p, baseNote: value }))}
                        displayValue={`${NOTE_NAMES[harmonyParams.baseNote % 12]}${Math.floor(harmonyParams.baseNote / 12) - 1}`}
                    />
                    <Select<ScaleName>
                        label="Scale"
                        value={harmonyParams.scale}
                        options={Object.keys(SCALES) as ScaleName[]}
                        onChange={value => setHarmonyParams(p => ({ ...p, scale: value as ScaleName }))}
                    />
                </GuiPanel>
            </div>
        </div>
    );
};

export default App;
