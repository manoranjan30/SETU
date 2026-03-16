import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const BackButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-text-secondary shadow-sm transition-all hover:border-border-default hover:bg-surface-card hover:text-primary hover:shadow"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
};

export default BackButton;
