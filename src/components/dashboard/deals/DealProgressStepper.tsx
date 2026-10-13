"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  AlertTriangle,
  XCircle,
  FileCheck2,
  Sparkles,
  Lock,
  UploadCloud,
  Eye,
  CheckCircle,
  IndianRupee,
} from "lucide-react";

export interface DealProgressStepperProps {
  status: string;
  justUpdated?: boolean;
}

export interface DealStageConfig {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

export const DEAL_STAGES: DealStageConfig[] = [
  {
    id: "APPLIED",
    label: "Applied",
    sublabel: "Contract & Signature",
    icon: FileCheck2,
  },
  {
    id: "ACCEPTED",
    label: "Accepted",
    sublabel: "Escrow Locked",
    icon: Lock,
  },
  {
    id: "SUBMITTED",
    label: "Submitted",
    sublabel: "Content Drafts",
    icon: UploadCloud,
  },
  {
    id: "UNDER_REVIEW",
    label: "Under Review",
    sublabel: "Brand Evaluation",
    icon: Eye,
  },
  {
    id: "APPROVED",
    label: "Approved",
    sublabel: "Live Verification",
    icon: CheckCircle,
  },
  {
    id: "PAYOUT",
    label: "Payout",
    sublabel: "Settled to Wallet",
    icon: IndianRupee,
  },
];

export function getStageIndex(status: string): number {
  switch (status) {
    case "PENDING_SIGNATURE":
    case "PAYMENT_PENDING":
      return 0;
    case "PAYMENT_HELD":
    case "ACTIVE":
      return 1;
    case "CONTENT_SUBMITTED":
      return 2;
    case "REVISION_REQUESTED":
      return 3;
    case "CONTENT_APPROVED":
    case "POSTED":
    case "VERIFICATION_PENDING":
    case "VERIFIED":
      return 4;
    case "COMPLETED":
      return 5;
    case "DISPUTED":
      return 3;
    case "CANCELLED":
      return 0;
    default:
      return 0;
  }
}

export function DealProgressStepper({ status, justUpdated }: DealProgressStepperProps) {
  const currentStageIndex = getStageIndex(status);
  const shouldReduceMotion = useReducedMotion();
  const isDisputed = status === "DISPUTED";
  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  const progressPercent = Math.min(
    100,
    Math.max(0, (currentStageIndex / (DEAL_STAGES.length - 1)) * 100)
  );

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm mb-6 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-heading font-bold text-foreground">
              Milestone Progress
            </h2>
            {justUpdated && (
              <motion.span
                initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap"
              >
                <Sparkles className={`w-3 h-3 ${shouldReduceMotion ? "" : "animate-spin"}`} />
                Updated Just Now
              </motion.span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Stage {isCompleted ? 6 : currentStageIndex + 1} of 6:{" "}
            <span className="font-semibold text-foreground">
              {isCancelled
                ? "Deal Cancelled"
                : isDisputed
                ? "Dispute Under Mediation"
                : DEAL_STAGES[currentStageIndex]?.label}
            </span>
          </p>
        </div>

        {isDisputed && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5" />
            Dispute in Progress
          </div>
        )}
        {isCancelled && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled & Refunded
          </div>
        )}
        {isCompleted && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
            <Check className="w-3.5 h-3.5" />
            Completed & Settled
          </div>
        )}
      </div>

      {/* Desktop Stepper */}
      <div className="hidden lg:block relative my-4">
        <div className="absolute top-5 left-8 right-8 h-1 bg-muted rounded-full -z-0" />
        <motion.div
          className="absolute top-5 left-8 h-1 bg-primary rounded-full -z-0"
          initial={{ width: shouldReduceMotion ? (isCancelled ? "0%" : `calc(${progressPercent}% * 0.94)`) : 0 }}
          animate={{
            width: isCancelled ? "0%" : `calc(${progressPercent}% * 0.94)`,
          }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 18 }}
        />

        <div className="relative z-10 flex justify-between items-start">
          {DEAL_STAGES.map((stage, idx) => {
            const isStageCompleted = !isCancelled && (currentStageIndex > idx || isCompleted);
            const isCurrent = !isCancelled && currentStageIndex === idx && !isCompleted;
            const StageIcon = stage.icon;

            return (
              <div
                key={stage.id}
                className="flex flex-col items-center text-center w-28 group"
              >
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isStageCompleted
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : isCurrent
                      ? "bg-card border-primary text-primary ring-4 ring-primary/20 shadow-md"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                  animate={
                    !shouldReduceMotion && isCurrent && justUpdated
                      ? {
                          scale: [1, 1.2, 1],
                        }
                      : isCurrent && !shouldReduceMotion
                      ? { scale: 1.05 }
                      : { scale: 1 }
                  }
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
                >
                  {isStageCompleted ? (
                    <motion.div
                      initial={{ scale: shouldReduceMotion ? 1 : 0 }}
                      animate={{ scale: 1 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </motion.div>
                  ) : (
                    <StageIcon className="w-4 h-4" />
                  )}
                </motion.div>

                <div className="mt-2.5">
                  <p
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? "text-primary"
                        : isStageCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-medium leading-tight">
                    {stage.sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stepper */}
      <div className="lg:hidden space-y-4 pt-2">
        {DEAL_STAGES.map((stage, idx) => {
          const isStageCompleted = !isCancelled && (currentStageIndex > idx || isCompleted);
          const isCurrent = !isCancelled && currentStageIndex === idx && !isCompleted;
          const StageIcon = stage.icon;

          return (
            <div key={stage.id} className="flex items-start gap-3 relative">
              {idx < DEAL_STAGES.length - 1 && (
                <div
                  className={`absolute left-4 top-8 bottom-0 w-0.5 ${
                    isStageCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}

              <motion.div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  isStageCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-card border-primary text-primary ring-2 ring-primary/20 shadow-sm"
                    : "bg-muted border-border text-muted-foreground"
                }`}
                animate={
                  !shouldReduceMotion && isCurrent && justUpdated
                    ? { scale: [1, 1.25, 1] }
                    : { scale: 1 }
                }
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
              >
                {isStageCompleted ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <StageIcon className="w-3.5 h-3.5" />
                )}
              </motion.div>

              <div className="pt-0.5 pb-2">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-bold ${
                      isCurrent
                        ? "text-primary"
                        : isStageCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Current Stage
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stage.sublabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
