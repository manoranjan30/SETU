import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const BackButton: React.FC = () => {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-white rounded-md transition-all border border-transparent hover:border-gray-200 shadow-sm hover:shadow"
        >
            <ArrowLeft className="w-4 h-4" />
            Back
        </button>
    );
};

export default BackButton;
