
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'medium' | 'large' | 'xl' | 'fullscreen';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'medium' }) => {
    if (!isOpen) return null;

    const sizeClass = {
        medium: 'max-w-2xl',
        large: 'max-w-4xl',
        xl: 'max-w-6xl',
        fullscreen: 'h-full w-full max-w-none rounded-none md:rounded-3xl' // Fullscreen styles
    };

    // For "fullscreen within layout", we use padding to simulate margins from the screen edge
    // creating a "card" effect that fills most of the space but shows the background app
    const containerClass = size === 'fullscreen' ? 'p-4 md:p-6 lg:p-8' : 'p-4';

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-hidden ${containerClass}`}>
            <div className={`bg-white shadow-2xl w-full ${sizeClass[size]} ${size === 'fullscreen' ? 'h-full' : 'max-h-[90vh] rounded-3xl'} flex flex-col border border-white/20`}>
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
