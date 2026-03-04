import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Briefcase, Camera, Save, Fingerprint, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import SignatureCanvas from 'react-signature-canvas';

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

export default function UserProfilePage() {
    const [profile, setProfile] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Signature state
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signatureUpdatedAt, setSignatureUpdatedAt] = useState<string | null>(null);
    const sigCanvas = useRef<any>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const [profRes, sigRes] = await Promise.all([
                    api.get('/users/me'),
                    api.get('/users/me/signature')
                ]);
                setProfile(profRes.data);
                if (sigRes.data?.signatureData) {
                    setSignatureData(sigRes.data.signatureData);
                    setSignatureUpdatedAt(sigRes.data.signatureUpdatedAt);
                }
            } catch (error) {
                console.error('Failed to load profile data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            await api.put('/users/me', {
                displayName: profile.displayName,
                email: profile.email,
                designation: profile.designation,
                phone: profile.phone
            });
            alert('Profile updated successfully.');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSignature = async () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            return alert('Please draw a signature first.');
        }
        try {
            setSaving(true);
            const dataUrl = trimCanvasToDataUrl(sigCanvas.current.getCanvas());
            await api.put('/users/me/signature', { signatureData: dataUrl });
            setSignatureData(dataUrl);
            setSignatureUpdatedAt(new Date().toISOString());
            sigCanvas.current.clear();
            alert('Digital signature stored securely.');
        } catch (error: any) {
            console.error('Signature save error:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to update signature.';
            const status = error.response?.status ? ` (Status: ${error.response.status})` : '';
            alert(`${msg}${status}`);
        } finally {
            setSaving(false);
        }
    };

    const clearCanvas = () => {
        sigCanvas.current?.clear();
    };

    if (loading) return <div className="p-8 text-gray-500">Loading profile...</div>;

    return (
        <div className="max-w-4xl flex gap-8 animate-in fade-in p-8">
            <div className="w-2/3 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                        <User className="w-5 h-5 text-indigo-500" />
                        Personal Information
                    </h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
                            <input
                                name="displayName"
                                value={profile.displayName || ''}
                                onChange={handleProfileChange}
                                className="w-full bg-gray-50 border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                placeholder="E.g., John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                value={profile.email || ''}
                                onChange={handleProfileChange}
                                className="w-full bg-gray-50 border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Designation</label>
                            <input
                                name="designation"
                                value={profile.designation || ''}
                                onChange={handleProfileChange}
                                className="w-full bg-gray-50 border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                placeholder="Site Engineer, QC Manager"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                            <input
                                name="phone"
                                value={profile.phone || ''}
                                onChange={handleProfileChange}
                                className="w-full bg-gray-50 border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                        >
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Details'}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                        <Fingerprint className="w-5 h-5 text-amber-500" />
                        Digital Signature
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Your digital signature is used for signing off RFIs and workflow approvals. Hand-draw your signature below.
                    </p>

                    <div className="flex gap-6">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Update Signature</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 relative overflow-hidden group h-40">
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor="blue"
                                    canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={clearCanvas} className="bg-white text-gray-600 p-1.5 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-xs font-medium">
                                        <RefreshCw size={14} /> Clear
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleSaveSignature}
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                                >
                                    <Save className="w-4 h-4" /> Save New Signature
                                </button>
                            </div>
                        </div>

                        {signatureData && (
                            <div className="w-1/3">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Signature</label>
                                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center h-40">
                                    <img src={signatureData} alt="Current Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                </div>
                                {signatureUpdatedAt && (
                                    <p className="text-[10px] text-gray-400 text-center mt-2">
                                        Last updated: {new Date(signatureUpdatedAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-1/3">
                <div className="bg-gradient-to-br from-indigo-500 flex-col items-center to-purple-600 rounded-2xl shadow-lg p-6 text-white text-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full mx-auto flex items-center justify-center mb-4 ring-4 ring-white/10 backdrop-blur-sm relative overflow-hidden group">
                        <span className="text-4xl font-black">{profile.displayName?.charAt(0) || profile.username?.charAt(0) || 'U'}</span>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold">{profile.displayName || profile.username}</h3>
                    <p className="text-white/80 text-sm font-medium mt-1">{profile.role}</p>

                    <div className="mt-8 pt-6 border-t border-white/20 text-left space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg"><Mail className="w-4 h-4" /></div>
                            <div className="text-sm font-medium">{profile.email || 'No email provided'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg"><Phone className="w-4 h-4" /></div>
                            <div className="text-sm font-medium">{profile.phone || 'No phone provided'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                            <div className="text-sm font-medium">{profile.designation || 'No designation'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
