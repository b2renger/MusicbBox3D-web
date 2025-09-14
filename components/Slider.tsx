
import React from 'react';

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    displayValue?: string;
}

export const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, displayValue }) => {
    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
                <label className="font-medium text-gray-300">{label}</label>
                <span className="text-purple-300 font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {displayValue !== undefined ? displayValue : value.toFixed(label === 'Speed' ? 1 : 0)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
    );
};
