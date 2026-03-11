import { X } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  altText?: string;
}

export default function ImageModal({
  isOpen,
  imageUrl,
  onClose,
  altText = "Image",
}: ImageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 md:-right-12 p-2 bg-surface-card/10 hover:bg-surface-card/20 text-white rounded-full transition-colors backdrop-blur-md"
          title="Close preview"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Image Container */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl shadow-2xl">
          <img
            src={imageUrl}
            alt={altText}
            className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
          />
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10 cursor-pointer"
        onClick={onClose}
      />
    </div>
  );
}
