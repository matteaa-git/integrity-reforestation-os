"use client";

interface FilePreviewModalProps {
  url: string;
  name: string;
  type?: string;
  onClose: () => void;
}

function isImage(name: string, type?: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name) || (type ?? "").startsWith("image/");
}

function isPdf(name: string, type?: string) {
  return /\.pdf$/i.test(name) || type === "application/pdf";
}

export default function FilePreviewModal({ url, name, type, onClose }: FilePreviewModalProps) {
  const image = isImage(name, type);
  const pdf   = isPdf(name, type);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ height: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              image ? "bg-blue-500/15 text-blue-400" :
              pdf   ? "bg-red-500/15 text-red-400"  :
                      "bg-gray-500/15 text-gray-400"
            }`}>
              {image ? "IMG" : pdf ? "PDF" : "FILE"}
            </span>
            <span className="text-xs font-medium text-text-primary truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <a
              href={url}
              download={name}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              ↓ Download
            </a>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-surface-secondary flex items-center justify-center">
          {image ? (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-full object-contain"
            />
          ) : pdf ? (
            <iframe
              src={url}
              title={name}
              className="w-full h-full border-0"
            />
          ) : (
            /* Generic: try iframe, fallback message */
            <div className="flex flex-col items-center gap-4">
              <iframe
                src={url}
                title={name}
                className="w-full border-0 rounded-xl"
                style={{ height: "70vh", minWidth: "600px" }}
              />
              <p className="text-xs text-text-tertiary">
                If the file doesn&apos;t display, use the Download button above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
