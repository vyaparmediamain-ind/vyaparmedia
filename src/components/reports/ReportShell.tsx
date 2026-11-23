"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui";

export interface ReportShellProps {
  children: React.ReactNode;
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  className?: string | undefined;
}

export function ReportShell({
  children,
  onClose,
  title = "Report Preview",
  className = "",
}: ReportShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("printable-modal-active", "overflow-hidden");
    return () => {
      document.body.classList.remove("printable-modal-active", "overflow-hidden");
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="printable-modal-overlay fixed inset-0 z-[100] overflow-y-auto bg-background/90 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 pt-16 pb-12 print:p-0 print:bg-card print:static print:inset-auto print:block"
    >
      {/* Floating Action Bar (Hidden in Print View) */}
      <div className="fixed top-4 right-4 z-[110] flex items-center gap-2.5 no-print bg-card/90 backdrop-blur-md p-2 rounded-2xl border border-border shadow-xl">
        <Button
          onClick={handlePrint}
          variant="primary"
          size="sm"
          className="gap-1.5 font-bold shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </Button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close Preview"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Official A4 Document Container */}
      <article
        className={`printable-document w-full max-w-4xl bg-card text-foreground rounded-2xl shadow-2xl p-6 sm:p-10 my-auto border border-border print:border-none print:shadow-none print:p-0 print:my-0 print:rounded-none ${className}`}
      >
        {children}
      </article>
    </div>,
    document.body
  );
}

export default ReportShell;
