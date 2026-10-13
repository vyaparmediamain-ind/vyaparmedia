"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  MapPin,
  FileText,
  AlertCircle,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { BottomSheet, Button } from "@/components/ui";
import { DealDetail } from "./DealDetailHelpers";
import { formatDate } from "@/lib/utils-client";

interface ShipmentTrackingModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly deal: DealDetail | null;
  readonly isBrand?: boolean | undefined;
  readonly isInfluencer?: boolean | undefined;
  readonly onConfirmReceived?: (() => void) | undefined;
  readonly onStatusUpdated?: (() => void) | undefined;
}

interface Checkpoint {
  date: string;
  status: string;
  activity: string;
  location: string;
}

interface TrackingData {
  awbCode: string;
  currentStatus: string;
  courierName?: string;
  deliveredDate?: string | null;
  scans: Checkpoint[];
}

function getStepIndex(status: string): number {
  const norm = status.toUpperCase();
  if (norm.includes("DELIVER")) return 3;
  if (norm.includes("OUT") || norm.includes("REACHED")) return 2;
  if (norm.includes("TRANSIT") || norm.includes("SHIPPED") || norm.includes("DISPATCH")) return 1;
  return 0; // PICKUP_SCHEDULED or default
}

export function ShipmentTrackingModal({
  open,
  onClose,
  deal,
  isBrand: _isBrand = false,
  isInfluencer = false,
  onConfirmReceived,
  onStatusUpdated,
}: ShipmentTrackingModalProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const awbCode = (deal?.shippingAwbCode || deal?.dispatchTrackingNumber || deal?.trackingNumber || "") as string;
  const courier = (deal?.shippingCourierName || deal?.dispatchCarrier || deal?.carrier || "Courier Partner") as string;
  const initialStatus = (deal?.shippingStatus || deal?.productFulfillmentStatus || "DISPATCHED") as string;

  const fetchLiveTracking = useCallback(async () => {
    if (!deal?.id || !open) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/product`, {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load live tracking");
      }
      if (data.tracking) {
        setTracking(data.tracking);
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error refreshing tracking";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [deal?.id, open, onStatusUpdated]);

  useEffect(() => {
    if (open) {
      // If deal has stored tracking history, populate it initially
      const rawHistory = deal?.shippingTrackingHistory;
      if (Array.isArray(rawHistory) && rawHistory.length > 0) {
        setTracking({
          awbCode,
          currentStatus: initialStatus,
          courierName: courier,
          scans: rawHistory as Checkpoint[],
        });
      }
      // Also fetch fresh live updates
      fetchLiveTracking();
    }
  }, [open, deal?.id, awbCode, courier, initialStatus, fetchLiveTracking, deal?.shippingTrackingHistory]);

  const copyAwb = async () => {
    if (!awbCode) return;
    const ok = await copyToClipboard(awbCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentStatus = tracking?.currentStatus || initialStatus;
  const currentStep = getStepIndex(currentStatus);
  const isDelivered = currentStep === 3 || deal?.productFulfillmentStatus === "RECEIVED";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Live Shipment & Tracking"
      maxWidth="620px"
    >
      <div className="space-y-5 py-1">
        {/* Top Header Card */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{tracking?.courierName || courier}</span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                    isDelivered
                      ? "bg-verified-muted text-verified border-verified-border"
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}
                >
                  {currentStatus.replaceAll("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">AWB: {awbCode || "Pending"}</span>
                {awbCode && (
                  <button
                    type="button"
                    onClick={copyAwb}
                    className="text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                    title="Copy AWB Number"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-verified" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px] font-semibold">{copied ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchLiveTracking}
              disabled={loading}
              className="text-xs gap-1.5 min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Updating..." : "Refresh Status"}</span>
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4-Step Progress Bar */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Delivery Progress
          </h4>
          <div className="grid grid-cols-4 gap-1 sm:gap-2 relative">
            {[
              { label: "Booked", code: "PICKUP_SCHEDULED" },
              { label: "In Transit", code: "IN_TRANSIT" },
              { label: "Out for Delivery", code: "OUT_FOR_DELIVERY" },
              { label: "Delivered", code: "DELIVERED" },
            ].map((step, idx) => {
              const isActive = idx <= currentStep;
              const isCurrent = idx === currentStep;

              return (
                <div key={step.code} className="flex flex-col items-center text-center gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground border border-border"
                    } ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                  >
                    {idx < currentStep || isDelivered ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-semibold leading-tight ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shiprocket Documents: Label & Manifest */}
        {(deal?.shippingLabelUrl || deal?.shippingManifestUrl) && (
          <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Logistics Documentation:</span>
            </div>
            <div className="flex items-center gap-2">
              {deal?.shippingLabelUrl && (
                <a
                  href={deal.shippingLabelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                >
                  <span>Download Shipping Label</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {deal?.shippingManifestUrl && (
                <a
                  href={deal.shippingManifestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-all border border-border"
                >
                  <span>Download Manifest</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Checkpoint Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Tracking Checkpoints</span>
          </h4>

          <div className="max-h-[240px] overflow-y-auto space-y-3 pr-1 deal-modal-scroll-container">
            {tracking?.scans && tracking.scans.length > 0 ? (
              tracking.scans.map((scan, i) => (
                <div key={i} className="flex gap-3 text-xs relative pb-3 last:pb-0">
                  {i < tracking.scans.length - 1 && (
                    <div className="absolute left-[13px] top-6 bottom-0 w-[2px] bg-border" />
                  )}
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                      i === 0
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {i === 0 ? <Truck className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{scan.activity || scan.status}</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(scan.date, "Recently")}
                      </span>
                    </div>
                    {scan.location && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{scan.location}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
                <Package className="w-5 h-5 mx-auto text-muted-foreground/60" />
                <p>Shipment created. Awaiting first courier partner scan checkpoint.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          {isInfluencer && !isDelivered && onConfirmReceived && (
            <Button
              variant="primary"
              onClick={() => {
                onConfirmReceived();
                onClose();
              }}
              className="flex-1 min-h-[44px] gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm I Received This Product</span>
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
