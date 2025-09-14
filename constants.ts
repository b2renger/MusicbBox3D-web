
import type { SimulationParams, SynthesisParams, HarmonyParams, ScaleName } from './types';

export const DEFAULT_PARAMS: {
    simulation: SimulationParams;
    synthesis: SynthesisParams;
    harmony: HarmonyParams;
} = {
    simulation: {
        speed: 5.0,
        maxCycle: 9,
        fade: 500,
    },
    synthesis: {
        decay: 468,
        soundPreset: 'pluck',
        reverb: 48,
    },
    harmony: {
        baseNote: 48, // C3
        scale: 'Pentatonic',
    },
};

export const SCALES: Record<ScaleName, number[]> = {
    Major: [0, 2, 4, 5, 7, 9, 11],
    Minor: [0, 2, 3, 5, 7, 8, 10],
    Pentatonic: [0, 2, 4, 7, 9],
    Blues: [0, 3, 5, 6, 7, 10],
};

export const NOTE_NAMES: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
