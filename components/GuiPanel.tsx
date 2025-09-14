
import React from 'react';

interface GuiPanelProps {
    title: string;
    children: React.ReactNode;
}

export const GuiPanel: React.FC<GuiPanelProps> = ({ title, children }) => {
    return (
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-bold text-purple-300 mb-4 border-b border-gray-700 pb-2">{title}</h2>
            <div className="flex flex-col gap-4">
                {children}
            </div>
        </div>
    );
};
