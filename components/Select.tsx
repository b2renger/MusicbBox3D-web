
import React from 'react';

interface SelectProps<T extends string> {
    label: string;
    value: T;
    options: T[];
    onChange: (value: T) => void;
}

export const Select = <T extends string,>({ label, value, options, onChange }: SelectProps<T>) => {
    return (
        <div className="flex flex-col gap-2 text-sm">
            <label className="font-medium text-gray-300">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value as T)}
                    className="w-full appearance-none bg-gray-800 border border-gray-700 text-white py-2 px-3 rounded-md leading-tight focus:outline-none focus:bg-gray-700 focus:border-purple-500"
                >
                    {options.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
