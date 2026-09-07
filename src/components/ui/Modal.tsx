"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string | undefined;
  readonly maxWidth?: string | undefined;
  readonly children: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  maxWidth = "480px",
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const uniqueId = React.useId().replace(/:/g, "");
  const modalClass = `modal-container-${uniqueId}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="modal-overlay">
          {/* Backdrop blur overlay */}
          <motion.button
            type="button"
            aria-label="Close modal"
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <style>{`
            .${modalClass} {
              max-width: ${maxWidth};
            }
          `}</style>
          <motion.div
            className={`modal-container ${modalClass}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title-id" : undefined}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            {/* Header */}
            {title && (
              <div className="modal-header">
                <span id="modal-title-id" className="modal-title">{title}</span>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Body */}
            <div className="modal-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
