import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "medium" | "large" | "xl" | "fullscreen";
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "medium",
  headerClassName = "",
  contentClassName = "",
  titleClassName = "",
}) => {
  if (!isOpen) return null;

  const sizeClass = {
    medium: "max-w-2xl",
    large: "max-w-4xl",
    xl: "max-w-6xl",
    fullscreen: "h-full w-full max-w-none rounded-none", // Fullscreen styles
  };

  const containerClass = size === "fullscreen" ? "p-0" : "p-4";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay overflow-hidden ${containerClass}`}
    >
      <div
        className={`bg-surface-card shadow-2xl w-full ui-animate-card ${sizeClass[size]} ${size === "fullscreen" ? "h-full border-0" : "max-h-[90vh] rounded-3xl border border-border-default"} flex flex-col`}
      >
        <div
          className={`flex justify-between items-center p-6 border-b border-border-default flex-shrink-0 bg-surface-base ${headerClassName}`}
        >
          <h3
            className={`text-xl font-extrabold tracking-tight text-text-primary ${titleClassName}`}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-raised rounded-xl transition-colors text-text-muted hover:text-text-secondary border border-transparent hover:border-border-default"
          >
            <X size={20} />
          </button>
        </div>
        <div className={`p-6 overflow-y-auto flex-1 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
