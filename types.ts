
export type ScaleName = 'Major' | 'Minor' | 'Pentatonic' | 'Blues';
export type SoundPreset = 'pluck' | 'voicy';

export interface SimulationParams {
    speed: number;
    maxCycle: number;
    fade: number;
}

export interface SynthesisParams {
    decay: number;
    soundPreset: SoundPreset;
    reverb: number;
}

export interface HarmonyParams {
    baseNote: number;
    scale: ScaleName;
}

export interface P5SketchProps {
    simulationParams: SimulationParams;
    synthesisParams: SynthesisParams;
    harmonyParams: HarmonyParams;
    playableNotes: string[];
    resetSignal: number;
}
