"use client";

import { useState, useRef } from "react";
import { logger } from "@/lib/logger-client";
import { VerificationData } from "../VerificationTab";

export function useDocUpload(
showToast: (msg: string, type: "success" | "error" | "info") => void,
setVerificationData: (data: VerificationData | null) => void
) {
const [isUploading, setIsUploading] = useState(false);
const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
const [isConnectingDigiLocker, setIsConnectingDigiLocker] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

const handleUpload = (type: string) => {
setUploadingDocType(type);
if (fileInputRef.current) {
fileInputRef.current.click();
}
};

const handleDigiLockerConnect = async () => {
setIsConnectingDigiLocker(true);
try {
const res = await fetch("/api/auth/digilocker/authorize");
const data = await res.json();
if (!res.ok || !data.url) {
showToast(data.error || "Failed to initiate DigiLocker connection", "error");
return;
}
window.location.href = data.url;
} catch {
showToast("An error occurred while connecting to DigiLocker", "error");
} finally {
setIsConnectingDigiLocker(false);
}
};

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocType) return;

    // Client-side size guard — mirrors backend /api/verification limit exactly.
    // Fail-fast before any network I/O to save bandwidth on slow/mobile connections.
    const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_DOC_SIZE) {
      showToast("File too large. Maximum document size is 10 MB.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", uploadingDocType);

    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Document uploaded! Verification pending.", "success");
        // Refresh data
        const refresh = await fetch("/api/verification");
        const newData = await refresh.json();
        setVerificationData(newData);
      } else {
        showToast(data.error || "Upload failed", "error");
      }
    } catch (error) {
      logger.error("[verification-tab] Failed to upload document:", error);
      showToast("An error occurred", "error");
    } finally {
      setIsUploading(false);
      setUploadingDocType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

return {
isUploading,
uploadingDocType,
isConnectingDigiLocker,
fileInputRef,
handleUpload,
handleDigiLockerConnect,
handleFileChange,
};
}
