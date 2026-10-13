"use client";

import { useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { logger } from "@/lib/logger-client";
import type { VerificationData } from "./types";

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
      const data = (await apiClient.users.authorizeDigilocker()) as {
        url?: string;
        error?: string;
      };
      if (!data?.url) {
        showToast(data?.error || "Failed to initiate DigiLocker connection", "error");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      showToast(
        formatUserError(err, "An error occurred while connecting to DigiLocker. Please try again."),
        "error",
      );
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

    if (uploadingDocType === "AADHAAR") {
      showToast(
        "Physical Aadhaar uploads are prohibited under Section 29(4) of the Aadhaar Act. Please use DigiLocker or OTP verification.",
        "error",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", uploadingDocType);

    try {
      const data = (await apiClient.users.submitVerification(formData)) as {
        success?: boolean;
        error?: string;
      };
      if (data?.success) {
        showToast("Document uploaded! Verification pending.", "success");
        // Refresh data
        const newData = (await apiClient.users.getVerification()) as VerificationData;
        setVerificationData(newData);
      } else {
        showToast(data?.error || "Upload failed", "error");
      }
    } catch (error) {
      logger.error("[verification-tab] Failed to upload document:", error);
      showToast(
        formatUserError(error, "Failed to upload document. Please ensure it is a PDF or image under 10MB."),
        "error",
      );
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
