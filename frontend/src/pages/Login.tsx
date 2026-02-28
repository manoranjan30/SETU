import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isPasswordChangeMode, setIsPasswordChangeMode] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [tempToken, setTempToken] = useState<string | null>(null);
    const [tempProfile, setTempProfile] = useState<any>(null);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/login', { username, password });
            // Assuming response.data contains { access_token }
            // We also need user details. For MVP, we might need a separate call or return it in login.
            // Let's assume login returns token. Then we fetch profile.

            const token = response.data.access_token;
            const profileRes = await api.get('/auth/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (profileRes.data.isFirstLogin) {
                setTempToken(token);
                setTempProfile(profileRes.data);
                setIsPasswordChangeMode(true);
            } else {
                login(token, profileRes.data);
                navigate('/dashboard');
            }
        } catch (err: any) {
            console.error('Login Failed:', err);
            // Check for specific error message from backend
            if (err.response && err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('Invalid credentials');
            }
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        try {
            await api.put('/users/me/password', {
                oldPassword: password,
                newPassword: newPassword
            }, {
                headers: { Authorization: `Bearer ${tempToken}` }
            });
            // Proceed to login
            login(tempToken as string, { ...tempProfile, isFirstLogin: false });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update password');
        }
    };

    if (isPasswordChangeMode) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg w-96">
                    <h3 className="text-2xl font-bold text-center text-gray-800">Change Temporary Password</h3>
                    <p className="text-sm text-gray-500 mt-2 text-center">For security, please set a new password before continuing.</p>
                    <form onSubmit={handlePasswordChange}>
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
                                <Lock className="h-5 w-5 text-gray-400" />
                                <input
                                    className="pl-2 outline-none border-none w-full"
                                    type="password"
                                    placeholder="New Password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
                                <Lock className="h-5 w-5 text-gray-400" />
                                <input
                                    className="pl-2 outline-none border-none w-full"
                                    type="password"
                                    placeholder="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
                        <div className="flex items-baseline justify-between mt-6">
                            <button className="px-6 py-2 mt-4 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 w-full font-bold">Update & Continue</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg w-96">
                <h3 className="text-2xl font-bold text-center text-gray-800">Login to SETU</h3>
                <form onSubmit={handleSubmit}>
                    <div className="mt-4">
                        <div className="flex items-center border-2 py-2 px-3 rounded-2xl mb-4">
                            <User className="h-5 w-5 text-gray-400" />
                            <input
                                className="pl-2 outline-none border-none w-full"
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
                            <Lock className="h-5 w-5 text-gray-400" />
                            <input
                                className="pl-2 outline-none border-none w-full"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
                    <div className="flex items-baseline justify-between mt-6">
                        <button className="px-6 py-2 mt-4 text-white bg-blue-600 rounded-lg hover:bg-blue-900 w-full font-bold">Login</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
