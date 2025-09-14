
import React from 'react';

interface ButtonProps {
    onClick: () => void;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children }) => {
    return (
        <button
            onClick={onClick}
            className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75"
        >
            {children}
        </button>
    );
};
