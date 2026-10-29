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
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 text-verified">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 text-disputed">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 text-primary">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function Toast({ toast, onClose }: Readonly<ToastProps>) {
  const icon = getToastIcon(toast.type);

  const typeBorderStyles: Record<ToastType, string> = {
    success: "border-verified/40 shadow-verified/5",
    error: "border-destructive/40 shadow-destructive/5",
    info: "border-primary/40 shadow-primary/5",
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`app-toast app-toast-${toast.type} ${typeBorderStyles[toast.type]} text-xs sm:text-sm font-semibold flex items-center justify-between w-full rounded-2xl bg-card text-foreground border shadow-xl backdrop-blur-md transition-all px-4 py-3`}
    >
      <span className="flex items-center gap-2.5 min-w-0 pr-2">
        <span className="shrink-0">{icon}</span>
        <span className="text-foreground leading-snug">{toast.message}</span>
      </span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label={`Dismiss ${toast.type} notification`}
        className="app-toast-close cursor-pointer text-lg leading-none text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/80 transition-colors shrink-0 ml-1.5"
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
