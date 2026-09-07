import React from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
id: string;
type: ToastType;
message: string;
}

export interface ToastProps {
toast: ToastItem;
onClose: (id: string) => void;
}

function getToastIcon(type: ToastType): React.ReactNode {
  if (type === "success") {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" style={{ color: "#34d399" }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" style={{ color: "#f87171" }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" style={{ color: "#60a5fa" }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function Toast({ toast, onClose }: Readonly<ToastProps>) {
  const icon = getToastIcon(toast.type);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`app-toast app-toast-${toast.type} text-sm font-medium flex items-center justify-between w-full rounded-lg text-white`}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{toast.message}</span>
      </span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label={`Dismiss ${toast.type} notification`}
        className="app-toast-close cursor-pointer text-sm border-none leading-none bg-none text-white ml-2 opacity-70"
      >
        &times;
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }: Readonly<{ toasts: ToastItem[]; onClose: (id: string) => void }>) {
if (toasts.length === 0) return null;
return (
<div
aria-label="Notifications"
className="app-toast-container fixed flex flex-col gap-2"
>
{toasts.map(t => (
<Toast key={t.id} toast={t} onClose={onClose} />
))}
</div>
);
}

export function useToasts() {
const [toasts, setToasts] = React.useState<ToastItem[]>([]);

const removeToast = React.useCallback((id: string) => {
setToasts((prev) => prev.filter((t) => t.id !== id));
}, []);

const showToast = React.useCallback((type: ToastType, message: string) => {
const id = typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function"
? window.crypto.randomUUID()
: `${Date.now()}-${Date.now() % 10000}`;
setToasts((prev) => [...prev, { id, type, message }]);
setTimeout(() => removeToast(id), 5000);
}, [removeToast]);

return { toasts, showToast, removeToast };
}
