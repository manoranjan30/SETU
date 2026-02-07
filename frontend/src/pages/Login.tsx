import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
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

            // Fetch profile
            const profileRes = await api.get('/auth/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });

            // profileRes.data should be { username, roles, ... }
            login(token, profileRes.data);
            navigate('/dashboard');
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
