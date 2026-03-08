import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: number;
    username: string;
    displayName?: string;
    roles: string[];
    permissions: string[];
    project_ids?: number[];
    isTempUser?: boolean;
    vendor?: { id: number; name: string };
}

interface AuthContextType {
    user: User | null;
    login: (token: string, userData: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = (token: string, userData: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const hasPermission = (permission: string) => {
        if (!user) return false;
        // Optimization: Admin role bypass
        if (user.roles.includes('Admin')) return true;
        
        // 1. Strict match
        if (user.permissions.includes(permission)) return true;

        // 2. Modular prefix match (if user has any sub-permission in this module, allow access to parent)
        // Modular code example: QUALITY.INSPECTION.READ
        const parts = permission.split('.');
        if (parts.length > 0) {
            const prefix = parts[0];
            return user.permissions.some(p => p.startsWith(prefix + '.'));
        }

        return false;
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
