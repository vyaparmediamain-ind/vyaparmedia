"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  X,
  UploadCloud,
  Camera,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  History,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button, Input, Textarea, Modal, BottomSheet } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import {
  formatFileSize,
  uploadFileDirectly,
  validateDeliverableFile,
} from "@/lib/direct-upload";
import { detectContactLeak } from "@/lib/contact-leak-detector";
import { haptic } from "@/lib/haptics";
import {
  formatContractDate,
  getFlatDeliverablesList,
  parseContractTerms,
  ContentSubmission,
  ContentUrlEntry,
  DealDetail,
} from "./DealDetailHelpers";

interface ContentSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: DealDetail;
  onSuccess?: () => void;
}

type Step = "media" | "details" | "review" | "success";

interface DeliverableItemState {
  type: string;
  label: string;
  url: string;
  isApproved: boolean;
  existingFeedback?: string | undefined;
  file?: File | undefined;
  previewUrl?: string | undefined;
  mediaType?: "image" | "video" | "document" | undefined;
  uploadProgress: number; // 0 - 100
  isUploading: boolean;
  uploadError?: string | undefined;
  useExternalLink: boolean;
  abortController?: AbortController | undefined;
}

export function ContentSubmissionModal({
  isOpen,
  onClose,
  deal,
  onSuccess,
}: ContentSubmissionModalProps) {
  // Step state
  const [step, setStep] = useState<Step>("media");
  const [showHistory, setShowHistory] = useState(false);
  const [showCancelConfirmSheet, setShowCancelConfirmSheet] = useState(false);

  // Form metadata
  const [notes, setNotes] = useState("");
  const [primaryLink, setPrimaryLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedVersion, setSubmittedVersion] = useState<number>(1);

  // Deliverables mapping
  const flatDeliverables = useMemo(() => getFlatDeliverablesList(deal), [deal]);
  const pastSubmissions: ContentSubmission[] = useMemo(
    () => deal?.contentSubmissions || [],
    [deal?.contentSubmissions],
  );

  const latestSubmission = pastSubmissions[0];
  const nextVersionNumber = (latestSubmission?.version || 0) + 1;
  const isRevision = deal?.status === "REVISION_REQUESTED" || (latestSubmission?.status === "REVISION_REQUESTED");

  // Per-deliverable state map
  const [deliverablesState, setDeliverablesState] = useState<Record<string, DeliverableItemState>>({});

  // Hidden inputs for file & camera
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState<string | null>(null);

  // Initialize state on open or deal update
  useEffect(() => {
    if (!isOpen) return;

    const initialMap: Record<string, DeliverableItemState> = {};
    const existingUrls: ContentUrlEntry[] = Array.isArray(latestSubmission?.contentUrls)
      ? latestSubmission.contentUrls
      : [];

    flatDeliverables.forEach((item) => {
      const prevEntry = existingUrls.find((u) => u.type === item.type);
      const isApproved = prevEntry?.status === "APPROVED";

      initialMap[item.type] = {
        type: item.type,
        label: item.label,
        url: prevEntry?.url || "",
        isApproved,
        existingFeedback: prevEntry?.feedback || undefined,
        uploadProgress: prevEntry?.url ? 100 : 0,
        isUploading: false,
        useExternalLink: Boolean(prevEntry?.url && !prevEntry.url.includes("/uploads/")),
      };
    });

    // Default fallback if no contract deliverables
    if (flatDeliverables.length === 0) {
      initialMap["primary_deliverable"] = {
        type: "primary_deliverable",
        label: "Deliverable Content",
        url: latestSubmission?.contentUrl || "",
        isApproved: false,
        uploadProgress: latestSubmission?.contentUrl ? 100 : 0,
        isUploading: false,
        useExternalLink: false,
      };
    }

    setDeliverablesState(initialMap);
    setNotes(latestSubmission?.notes || "");
    setPrimaryLink(latestSubmission?.contentUrl || "");
    setStep("media");
    setSubmitError(null);
  }, [isOpen, deal, flatDeliverables, latestSubmission]);

  // Contact leak detection on submission notes
  const contactLeak = useMemo(() => detectContactLeak(notes), [notes]);

  // Check if all deliverables have valid content
  const deliverableItems = Object.values(deliverablesState);
  const missingItems = deliverableItems.filter((item) => !item.url.trim());
  const hasActiveUploads = deliverableItems.some((item) => item.isUploading);

  const canProceedToDetails = deliverableItems.length > 0 && missingItems.length === 0 && !hasActiveUploads;
  const canSubmit = canProceedToDetails && !isSubmitting && !contactLeak.hasLeak;

  // Active item for media preview
  const previewItem =
    deliverableItems.find((d) => d.previewUrl || d.url) || deliverableItems[0];

  // Helper for type-safe deliverable state updates
  const updateItem = (type: string, updater: (item: DeliverableItemState) => DeliverableItemState) => {
    setDeliverablesState((prev) => {
      const existing = prev[type];
      if (!existing) return prev;
      return {
        ...prev,
        [type]: updater(existing),
      };
    });
  };

  const handleStartUpload = async (type: string, file: File) => {
    // 1. Client-side fail-fast validation BEFORE network
    const validation = validateDeliverableFile(file);
    if (!validation.valid) {
      updateItem(type, (item) => ({
        ...item,
        uploadError: validation.error,
        isUploading: false,
      }));
      return;
    }

    // Create instant local preview URL
    const localPreviewUrl = URL.createObjectURL(file);
    const abortController = new AbortController();

    updateItem(type, (item) => ({
      ...item,
      file,
      previewUrl: localPreviewUrl,
      mediaType: validation.mediaType,
      isUploading: true,
      uploadProgress: 0,
      uploadError: undefined,
      abortController,
    }));

    try {
      const result = await uploadFileDirectly(file, {
        folder: "content",
        signal: abortController.signal,
        onProgress: (percent) => {
          updateItem(type, (item) => ({
            ...item,
            uploadProgress: percent,
          }));
        },
      });

      // Upload successful
      updateItem(type, (item) => ({
        ...item,
        url: result.fileUrl,
        isUploading: false,
        uploadProgress: 100,
        uploadError: undefined,
      }));

      // If this is the first deliverable, set as primary link fallback
      if (!primaryLink) {
        setPrimaryLink(result.fileUrl);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateItem(type, (item) => ({
          ...item,
          isUploading: false,
          uploadProgress: 0,
          uploadError: "Upload cancelled.",
        }));
      } else {
        const errorMsg = formatUserError(err, "Failed to upload file to storage. Please try again.");
        updateItem(type, (item) => ({
          ...item,
          isUploading: false,
          uploadProgress: 0,
          uploadError: errorMsg,
        }));
      }
    }
  };

  const cancelUpload = (type: string) => {
    const item = deliverablesState[type];
    if (item?.abortController) {
      item.abortController.abort();
    }
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleStartUpload(type, droppedFile);
    }
  };

  // Final submission API call
  const handleSubmitContent = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submissionUrls = deliverableItems.map((item) => ({
        type: item.type,
        url: item.url.trim(),
        status: item.isApproved ? "APPROVED" : "PENDING",
      }));

      const finalPrimaryUrl = submissionUrls[0]?.url || primaryLink || "";

      await apiClient.deals.action({
        action: "submit_content",
        dealId: deal.id,
        contentUrl: finalPrimaryUrl,
        contentUrls: submissionUrls,
        notes: notes.trim() || undefined,
      });

      setSubmittedVersion(nextVersionNumber);
      haptic.success();
      setStep("success");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(formatUserError(err, "Failed to submit content. Please try again."));
    } finally {
      setIsSubmitting(false);
    }

  };

  const handleModalClose = () => {
    if (hasActiveUploads) {
      setShowCancelConfirmSheet(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Modal
      open={isOpen}
      onClose={handleModalClose}
      maxWidth="56rem"
      className="p-0 overflow-hidden sm:max-w-4xl sm:max-h-[92vh] sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl text-foreground"
      bodyClassName="p-0 flex flex-col overflow-hidden max-h-[92vh]"
    >
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
        onChange={(e) => {
          if (activeUploadType && e.target.files?.[0]) {
            handleStartUpload(activeUploadType, e.target.files[0]);
            e.target.value = "";
          }
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        capture="environment"
        className="hidden"
        accept="video/*,image/*"
        onChange={(e) => {
          if (activeUploadType && e.target.files?.[0]) {
            handleStartUpload(activeUploadType, e.target.files[0]);
            e.target.value = "";
          }
        }}
      />
        
        {/* ==================== MODAL HEADER ==================== */}
        <header className="flex items-center justify-between px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <div className="flex items-center gap-2.5">
            {step !== "media" && step !== "success" && (
              <button
                type="button"
                onClick={() => setStep(step === "review" ? "details" : "media")}
                className="w-11 h-11 -ml-1 text-secondary hover:text-foreground rounded-xl hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Previous step"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  {step === "success"
                    ? "Submission Confirmed"
                    : isRevision
                    ? `Submit Revision`
                    : `Submit Deliverables`}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap">
                  {step === "success" ? `v${submittedVersion}` : `v${nextVersionNumber}`}
                </span>
              </div>
              <p className="text-xs text-secondary truncate max-w-[200px] sm:max-w-md">
                {deal?.campaign?.title || "Collaboration Deliverable"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {pastSubmissions.length > 0 && step !== "success" && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                  showHistory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
                title="View previous submission history"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span> ({pastSubmissions.length})
              </button>
            )}

            <button
              type="button"
              onClick={handleModalClose}
              className="w-11 h-11 text-secondary hover:text-foreground rounded-xl hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ==================== STEP PROGRESS BAR ==================== */}
        {step !== "success" && (
          <div className="flex items-center border-b border-border bg-secondary/30 px-3 sm:px-6 py-1.5 text-xs">
            <div className="flex items-center justify-between w-full max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setStep("media")}
                className={`flex items-center gap-1.5 font-medium min-h-[44px] px-2 rounded-lg transition-colors cursor-pointer ${
                  step === "media"
                    ? "text-primary font-bold"
                    : "text-secondary hover:text-foreground"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === "media" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
                }`}>
                  1
                </span>
                <span>Upload Media</span>
              </button>

              <div className={`h-0.5 flex-1 mx-2 ${canProceedToDetails ? "bg-primary/50" : "bg-border"}`} />

              <button
                type="button"
                disabled={!canProceedToDetails}
                onClick={() => setStep("details")}
                className={`flex items-center gap-1.5 font-medium min-h-[44px] px-2 rounded-lg transition-colors ${
                  step === "details"
                    ? "text-primary font-bold cursor-pointer"
                    : canProceedToDetails
                    ? "text-secondary hover:text-foreground cursor-pointer"
                    : "text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === "details" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
                }`}>
                  2
                </span>
                <span>Details</span>
              </button>

              <div className={`h-0.5 flex-1 mx-2 ${canProceedToDetails ? "bg-primary/50" : "bg-border"}`} />

              <button
                type="button"
                disabled={!canProceedToDetails}
                onClick={() => setStep("review")}
                className={`flex items-center gap-1.5 font-medium min-h-[44px] px-2 rounded-lg transition-colors ${
                  step === "review"
                    ? "text-primary font-bold cursor-pointer"
                    : canProceedToDetails
                    ? "text-secondary hover:text-foreground cursor-pointer"
                    : "text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === "review" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
                }`}>
                  3
                </span>
                <span>Review</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== PROMINENT REVISION FEEDBACK BANNER ==================== */}
        {isRevision && step !== "success" && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm">
                <div className="font-bold flex items-center gap-2">
                  <span>Brand Requested Revisions for v{nextVersionNumber}</span>
                  {latestSubmission?.version && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      from v{latestSubmission.version}
                    </span>
                  )}
                </div>

                {latestSubmission?.feedback ? (
                  <p className="mt-1.5 font-medium bg-amber-500/15 p-2.5 rounded-lg border border-amber-500/20 text-foreground">
                    &ldquo;{latestSubmission.feedback}&rdquo;
                  </p>
                ) : (
                  <p className="mt-1 text-secondary">
                    The brand requested revisions on your previous deliverable. Please address their notes below before resubmitting.
                  </p>
                )}

                {/* Specific per-deliverable revision comments */}
                {Array.isArray(latestSubmission?.contentUrls) && (
                  <div className="mt-2 space-y-1">
                    {latestSubmission.contentUrls
                      .filter((u: ContentUrlEntry) => u.status === "REVISION_REQUESTED" && u.feedback)
                      .map((u: ContentUrlEntry) => (
                        <div key={u.type} className="text-xs flex items-center gap-1.5">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            • {u.type.replace(/_\d+$/, "").replaceAll("_", " ")}:
                          </span>
                          <span>{u.feedback}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MAIN BODY ==================== */}
        <div className="flex-1 overflow-y-auto relative p-4 sm:p-6">

          {/* ==================== STEP 1: UPLOAD MEDIA ==================== */}
          {step === "media" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base">Select Deliverables to Submit</h3>
                  <p className="text-xs text-secondary">
                    Direct-to-storage uploads support high-res video (MP4/MOV up to 100MB) without UI freezing.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-secondary font-medium text-secondary">
                  {deliverableItems.filter((d) => Boolean(d.url)).length} / {deliverableItems.length} Ready
                </span>
              </div>

              {/* Deliverable Items List */}
              <div className="space-y-4">
                {deliverableItems.map((item) => {
                  const hasFile = Boolean(item.url || item.previewUrl);
                  const isVideo = item.mediaType === "video" || item.file?.type.startsWith("video/") || item.url.match(/\.(mp4|mov|webm)$/i);

                  return (
                    <div
                      key={item.type}
                      className={`p-4 rounded-xl border transition-all ${
                        item.isApproved
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : hasFile
                          ? "border-primary/40 bg-card shadow-sm"
                          : "border-border bg-card/60 hover:border-border/80"
                      }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, item.type)}
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm capitalize">
                            {item.label}
                          </span>
                          {item.isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          ) : item.existingFeedback ? (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                              Needs Revision
                            </span>
                          ) : null}
                        </div>

                        {!item.isApproved && (
                          <button
                            type="button"
                            onClick={() => {
                              updateItem(item.type, (d) => ({
                                ...d,
                                useExternalLink: !d.useExternalLink,
                              }));
                            }}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            {item.useExternalLink ? "Upload file directly" : "Paste Drive/Live URL"}
                          </button>
                        )}
                      </div>

                      {/* Deliverable Specific Feedback if any */}
                      {item.existingFeedback && (
                        <div className="mb-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-2 rounded-lg">
                          <strong>Brand note:</strong> {item.existingFeedback}
                        </div>
                      )}

                      {/* APPROVED STATE */}
                      {item.isApproved ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium truncate max-w-sm">
                            Approved in previous version: {item.url}
                          </span>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-bold flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : item.useExternalLink ? (
                        /* EXTERNAL URL MODE */
                        <div className="space-y-2">
                          <Input
                            type="url"
                            placeholder="https://drive.google.com/file/... or live post URL"
                            value={item.url}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateItem(item.type, (d) => ({
                                ...d,
                                url: val,
                              }));
                            }}
                            className="text-xs sm:text-sm"
                          />
                          <p className="text-[11px] text-secondary">
                            Ensure link permissions are set to &ldquo;Anyone with link can view&rdquo;.
                          </p>
                        </div>
                      ) : (
                        /* DIRECT STORAGE UPLOAD MODE */
                        <div>
                          {item.isUploading ? (
                            /* UPLOADING PROGRESS STATE */
                            <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                  <span className="font-semibold truncate max-w-[200px]">
                                    {item.file?.name || "Uploading..."}
                                  </span>
                                  {item.file && (
                                    <span className="text-secondary text-[11px]">
                                      ({formatFileSize(item.file.size)})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-primary">
                                    {item.uploadProgress}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => cancelUpload(item.type)}
                                    className="text-xs text-rose-500 hover:underline font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all duration-150 ease-out"
                                  style={{ width: `${item.uploadProgress}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-secondary">
                                Direct upload to storage. UI stays responsive even with 100MB files.
                              </p>
                            </div>
                          ) : hasFile ? (
                            /* FILE UPLOADED STATE WITH PREVIEW */
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                                  {isVideo ? (
                                    <Film className="w-6 h-6 text-primary" />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 text-primary" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs truncate max-w-[220px]">
                                      {item.file?.name || item.url.split("/").pop()}
                                    </span>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                  </div>
                                  <p className="text-[11px] text-secondary">
                                    {item.file ? formatFileSize(item.file.size) : "Ready for review"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <a
                                  href={item.previewUrl || item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold px-3.5 py-2.5 min-h-[44px] rounded-xl bg-secondary hover:bg-secondary/80 text-foreground inline-flex items-center justify-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Preview
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveUploadType(item.type);
                                    fileInputRef.current?.click();
                                  }}
                                  className="text-xs font-semibold px-3.5 py-2.5 min-h-[44px] rounded-xl border border-border hover:bg-secondary text-secondary hover:text-foreground inline-flex items-center justify-center"
                                >
                                  Replace
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* DROPZONE EMPTY STATE */
                            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-secondary/10">
                              <UploadCloud className="w-8 h-8 text-secondary mx-auto mb-2" />
                              <p className="text-xs sm:text-sm font-semibold mb-1">
                                Drag & drop your deliverable file here
                              </p>
                              <p className="text-[11px] text-secondary mb-3">
                                MP4, MOV, WEBM, JPG, PNG or WEBP (up to 100 MB)
                              </p>

                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setActiveUploadType(item.type);
                                    fileInputRef.current?.click();
                                  }}
                                  className="text-xs"
                                >
                                  Browse Files
                                </Button>

                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setActiveUploadType(item.type);
                                    cameraInputRef.current?.click();
                                  }}
                                  className="text-xs gap-1.5"
                                >
                                  <Camera className="w-3.5 h-3.5" /> Shoot / Camera
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Upload Error Banner */}
                          {item.uploadError && (
                            <div className="mt-2 text-xs p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span>{item.uploadError}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== STEP 2: DETAILS & CAPTION ==================== */}
          {step === "details" && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="font-bold text-base">Deliverable Details & Notes</h3>
                <p className="text-xs text-secondary">
                  Provide context for the brand reviewer (e.g. caption, hashtags used, scheduled publish dates).
                </p>
              </div>

              {/* Primary Content URL / Drive Folder */}
              <div>
                <label className="label text-xs font-semibold mb-1 block" htmlFor="primary-link-input">
                  Main Content Link (Optional)
                </label>
                <Input
                  id="primary-link-input"
                  type="url"
                  placeholder="https://..."
                  value={primaryLink}
                  onChange={(e) => setPrimaryLink(e.target.value)}
                  className="text-xs sm:text-sm"
                />
                <p className="text-[11px] text-secondary mt-1">
                  If you have a cloud folder with raw footage or high-bitrate masters, add it here.
                </p>
              </div>

              {/* Submission Notes / Caption */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="label text-xs font-semibold mb-0" htmlFor="deliverable-notes-input">
                    Submission Notes & Caption Draft
                  </label>
                  <span className={`text-[11px] ${notes.length > 500 ? "text-rose-500 font-bold" : "text-secondary"}`}>
                    {notes.length} / 500
                  </span>
                </div>
                <Textarea
                  id="deliverable-notes-input"
                  rows={4}
                  placeholder="Paste the caption draft, mention tags used, or explain how you addressed revision comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs sm:text-sm resize-none"
                  fullWidth
                />
              </div>

              {/* Contact Leak Warning Banner */}
              {contactLeak.hasLeak && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Contact Details Detected</span>
                  </div>
                  <p>
                    {contactLeak.warningMessage ||
                      "Sharing personal contact info (phone numbers, external emails, social IDs) removes your escrow protection."}
                  </p>
                  <p className="text-[11px] text-secondary">
                    Please remove contact information before submitting.
                  </p>
                </div>
              )}

              {/* Deliverable Summary Cards */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">
                  Attached Deliverables ({deliverableItems.length})
                </h4>
                <div className="space-y-2">
                  {deliverableItems.map((d) => (
                    <div key={d.type} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                      <span className="font-medium capitalize">{d.label}</span>
                      <span className="text-secondary font-mono truncate max-w-[200px]">
                        {d.file?.name || d.url.split("/").pop()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== STEP 3: REVIEW BEFORE SUBMIT ==================== */}
          {step === "review" && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="font-bold text-base">Review Before Submitting</h3>
                <p className="text-xs text-secondary">
                  Ensure all requested assets match brand requirements. Brand will be notified immediately upon submission.
                </p>
              </div>

              {/* Instagram-styled preview mock */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-lg max-w-sm mx-auto">
                {/* Simulated Header */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs text-primary border border-primary/30">
                      {deal?.influencer?.displayName?.[0] || "C"}
                    </div>
                    <div>
                      <span className="text-xs font-bold block leading-none">
                        {deal?.influencer?.displayName || "Creator Deliverable"}
                      </span>
                      <span className="text-[10px] text-secondary">Draft Preview</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                    v{nextVersionNumber}
                  </span>
                </div>

                {/* Media Preview Box */}
                <div className="relative aspect-square sm:aspect-video bg-background/90 flex items-center justify-center overflow-hidden">
                  {previewItem?.mediaType === "video" || previewItem?.url?.match(/\.(mp4|mov|webm)$/i) ? (
                    <video
                      src={previewItem.previewUrl || previewItem.url}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : previewItem?.url || previewItem?.previewUrl ? (
                    <img
                      src={previewItem.previewUrl || previewItem.url}
                      alt="Deliverable preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-6 text-white/50 text-xs">
                      <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      External link deliverable
                    </div>
                  )}
                </div>

                {/* Simulated Caption */}
                <div className="p-3 text-xs space-y-2 bg-card">
                  {notes.trim() ? (
                    <p className="text-foreground leading-relaxed line-clamp-3">
                      <strong className="mr-1">{deal?.influencer?.displayName || "creator"}:</strong>
                      {notes}
                    </p>
                  ) : (
                    <p className="text-secondary italic">No caption notes attached.</p>
                  )}
                  <div className="text-[10px] text-secondary font-mono">
                    {deliverableItems.length} deliverable assets attached
                  </div>
                </div>
              </div>

              {/* Escrow & Trust Reassurance */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-primary">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Escrow Safe: {formatCurrency(parseContractTerms(deal?.contractTerms)?.totalAmount ?? deal?.amount ?? 0)} Protected</span>
                </div>
                <p className="text-secondary">
                  Brand payment is already locked in escrow. Once submitted, the brand has 72 hours to review and approve your work.
                </p>
              </div>

              {/* Error Banner if submit failed */}
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* ==================== SUCCESS STATE: WHAT HAPPENS NEXT ==================== */}
          {step === "success" && (
            <div className="py-8 px-4 text-center max-w-md mx-auto space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Deliverable v{submittedVersion} Submitted!
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Your work has been successfully recorded and sent for brand review.
                </p>
              </div>

              {/* Next Steps Timeline */}
              <div className="text-left bg-secondary/30 border border-border rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">
                  What Happens Next
                </h4>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="block text-foreground">Brand Notified</strong>
                      <span className="text-secondary text-[11px]">
                        The brand receives an instant notification with preview access.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="block text-foreground">72-Hour Review SLA</strong>
                      <span className="text-secondary text-[11px]">
                        Brand reviews your deliverable. If they don&apos;t respond within 72 hours, auto-approval triggers.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="block text-foreground">Instant Escrow Payout</strong>
                      <span className="text-secondary text-[11px]">
                        Upon brand approval, funds are immediately unlocked and credited to your wallet.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={onClose}
                fullWidth
                className="font-bold py-2.5"
              >
                Return to Deal
              </Button>
            </div>
          )}

          {/* ==================== VERSION HISTORY DRAWER ==================== */}
          {showHistory && (
            <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-card border-l border-border shadow-2xl p-4 overflow-y-auto z-30 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <h4 className="font-bold text-sm">Submission Iterations</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="p-1 text-secondary hover:text-foreground rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {pastSubmissions.map((sub, idx) => {
                  const versionNum = sub.version || (pastSubmissions.length - idx);
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={sub.id || idx}
                      className={`p-3 rounded-xl border text-xs space-y-2 ${
                        isLatest ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Version {versionNum}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : sub.status === "REVISION_REQUESTED"
                            ? "bg-rose-500/15 text-rose-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}>
                          {sub.status || "PENDING"}
                        </span>
                      </div>

                      <div className="text-[11px] text-secondary">
                        Submitted {formatContractDate(sub.submittedAt || sub.createdAt)}
                      </div>

                      {sub.feedback && (
                        <div className="p-2 rounded bg-secondary text-[11px] text-foreground">
                          <strong>Brand Feedback:</strong> &ldquo;{sub.feedback}&rdquo;
                        </div>
                      )}

                      {Array.isArray(sub.contentUrls) && sub.contentUrls.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {sub.contentUrls.map((u: ContentUrlEntry) => (
                            <a
                              key={u.type}
                              href={u.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {u.type.replace(/_\d+$/, "").replaceAll("_", " ")}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ==================== MODAL FOOTER ==================== */}
        {step !== "success" && (
          <footer className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-card/80 backdrop-blur-md sticky bottom-0 z-20 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
            <div className="text-xs text-secondary">
              {step === "media" && missingItems.length > 0 && (
                <span>{missingItems.length} deliverable(s) remaining</span>
              )}
              {step === "details" && contactLeak.hasLeak && (
                <span className="text-amber-500 font-semibold">Remove contact info</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px] px-3.5"
              >
                Cancel
              </Button>

              {step === "media" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!canProceedToDetails}
                  onClick={() => setStep("details")}
                  className="gap-1 font-semibold min-h-[44px] px-4"
                >
                  <span>Next: Details</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}

              {step === "details" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={contactLeak.hasLeak}
                  onClick={() => setStep("review")}
                  className="gap-1 font-semibold min-h-[44px] px-4"
                >
                  <span>Next: Review</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}

              {step === "review" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!canSubmit}
                  onClick={handleSubmitContent}
                  className="gap-1.5 font-bold min-h-[44px] px-4"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Submit Deliverables (v{nextVersionNumber})</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </footer>
        )}
    </Modal>

    {/* Cancel In-Flight Upload Confirmation BottomSheet */}
    <BottomSheet
      open={showCancelConfirmSheet}
      onClose={() => setShowCancelConfirmSheet(false)}
      title="Discard Active Uploads?"
      maxWidth="440px"
    >
      <div className="space-y-4 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          You have file uploads currently in progress. Closing now will terminate the active uploads and discard unsaved progress.
        </p>
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowCancelConfirmSheet(false)}
            className="w-full sm:w-auto text-xs"
          >
            Continue Uploading
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              Object.keys(deliverablesState).forEach((type) => cancelUpload(type));
              setShowCancelConfirmSheet(false);
              onClose();
            }}
            className="w-full sm:w-auto text-xs font-bold"
          >
            Discard &amp; Close
          </Button>
        </div>
      </div>
    </BottomSheet>
  </>
  );
}
