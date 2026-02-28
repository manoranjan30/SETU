import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, CheckCircle, RotateCcw } from 'lucide-react';
import api from '../../api/axios';

/** Manual trim: extracts just the drawn area from a canvas, bypassing broken trim-canvas dep */
function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    let top = height, left = width, right = 0, bottom = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 0) {
                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
    }
    if (right <= left || bottom <= top) return canvas.toDataURL('image/png');
    const pad = 10;
    const tLeft = Math.max(0, left - pad);
    const tTop = Math.max(0, top - pad);
    const tWidth = Math.min(width, right - left + pad * 2);
    const tHeight = Math.min(height, bottom - top + pad * 2);
    const trimmed = document.createElement('canvas');
    trimmed.width = tWidth;
    trimmed.height = tHeight;
    trimmed.getContext('2d')!.putImageData(
        ctx.getImageData(tLeft, tTop, tWidth, tHeight), 0, 0
    );
    return trimmed.toDataURL('image/png');
}

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSign: (signatureData: string, reuseExisting?: boolean) => void;
    title?: string;
    description?: string;
    actionLabel?: string;
}

export default function SignatureModal({
    isOpen,
    onClose,
    onSign,
    title = 'Digital Signature Required',
    description = 'Please provide your signature to proceed.',
    actionLabel = 'Authorize Action'
}: SignatureModalProps) {
    const sigCanvas = useRef<any>(null);
    const [savedSignature, setSavedSignature] = useState<string | null>(null);
    const [useSaved, setUseSaved] = useState<boolean>(true);

    useEffect(() => {
        if (isOpen) {
            // Fetch user's saved signature if any
            api.get('/users/me/signature').then(res => {
                if (res.data?.signatureData) {
                    setSavedSignature(res.data.signatureData);
                    setUseSaved(true);
                } else {
                    setSavedSignature(null);
                    setUseSaved(false);
                }
            }).catch(err => {
                console.error('Failed to load signature', err);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const clear = () => {
        sigCanvas.current?.clear();
    };

    const handleConfirm = () => {
        if (useSaved && savedSignature) {
            onSign(savedSignature, true);
        } else {
            if (sigCanvas.current?.isEmpty()) {
                alert('Please provide a signature.');
                return;
            }
            const dataUrl = trimCanvasToDataUrl(sigCanvas.current.getCanvas());
            onSign(dataUrl, false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-gray-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6">
                    {savedSignature && (
                        <div className="mb-6 flex space-x-4">
                            <label className={`flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${useSaved ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}>
                                <input type="radio" className="hidden" checked={useSaved} onChange={() => setUseSaved(true)} />
                                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2">Use Saved Profile Signature</div>
                                <div className="h-16 w-full flex items-center justify-center">
                                    <img src={savedSignature} alt="Saved Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                </div>
                            </label>

                            <label className={`flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${!useSaved ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}>
                                <input type="radio" className="hidden" checked={!useSaved} onChange={() => setUseSaved(false)} />
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Draw New Signature</div>
                                <div className="h-16 w-full flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">Draw Manually</span>
                                </div>
                            </label>
                        </div>
                    )}

                    {(!savedSignature || !useSaved) && (
                        <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 relative overflow-hidden group">
                            <SignatureCanvas
                                ref={sigCanvas}
                                penColor="blue"
                                canvasProps={{ className: 'w-full h-40 cursor-crosshair' }}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={clear} className="bg-white text-gray-600 p-1.5 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-xs font-medium">
                                    <RotateCcw size={14} /> Clear
                                </button>
                            </div>
                            <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                                <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Sign Here</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                            <CheckCircle size={18} />
                            {actionLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
