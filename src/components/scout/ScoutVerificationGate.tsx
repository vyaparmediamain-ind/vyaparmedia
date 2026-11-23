"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button, Input } from "@/components/ui";
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Camera,
  RefreshCw,
  UploadCloud,
  User,
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { apiClient } from "@/lib/api-client";

interface ScoutVerificationData {
  isRegistered: boolean;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REGISTERED";
  rejectionReason: string | null;
  scoutCode: string | null;
  scoutProfile: {
    fullName: string;
    city: string;
    college: string | null;
    selfieUrl?: string | null;
  } | null;
}

export default function ScoutVerificationGate({
  onApproved,
}: {
  onApproved?: () => void;
}) {
  const { data, mutate, isLoading } = useSWR<{ success: boolean } & ScoutVerificationData>(
    "/api/scout/verification",
    fetcher
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [college, setCollege] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const status = data?.verificationStatus || "NOT_REGISTERED";

  if (status === "APPROVED" && onApproved) {
    onApproved();
  }

  const handleSelfieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Selfie photo size must be under 10MB.");
      return;
    }

    setIsUploadingSelfie(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.upload.file(file, "scouts");
      const url = res.data?.url || res.url;
      if (!url) throw new Error("Upload failed. Could not retrieve photo URL.");
      setSelfieUrl(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload selfie photo.");
    } finally {
      setIsUploadingSelfie(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !phone.trim() || !city.trim() || !panNumber.trim() || !aadhaarNumber.trim()) {
      setErrorMsg("Please fill in all mandatory fields (Name, Phone, City, PAN, Aadhaar).");
      return;
    }

    if (!selfieUrl) {
      setErrorMsg("Please take or upload your front-facing selfie photo to complete verification.");
      return;
    }

    if (!/^[A-Za-z0-9]{10}$/.test(panNumber.trim())) {
      setErrorMsg("PAN number must be exactly 10 alphanumeric characters (e.g. ABCDE1234F).");
      return;
    }

    if (!/^\d{12}$/.test(aadhaarNumber.replaceAll(/\s/g, ""))) {
      setErrorMsg("Aadhaar number must be exactly 12 digits.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/scout/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          city,
          state,
          college,
          panNumber: panNumber.trim().toUpperCase(),
          aadhaarNumber: aadhaarNumber.replaceAll(/\s/g, ""),
          selfieUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to submit verification details.");
      }

      await mutate();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // PENDING state
  if (status === "PENDING") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pending-muted text-pending">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Scout Verification Under Review</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aapki 18+ Scout application aur Aadhaar/PAN details verification ke liye submit ho chuki hain.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-left">
            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-border/60">
              {data?.scoutProfile?.selfieUrl ? (
                <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary shadow-xs shrink-0">
                  <Image
                    src={data.scoutProfile.selfieUrl}
                    alt={data?.scoutProfile?.fullName || "Scout"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">{data?.scoutProfile?.fullName || "—"}</h3>
                <p className="text-xs text-muted-foreground">{data?.scoutProfile?.city || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Selfie Photo:</span>
                <p className="font-semibold text-verified">Uploaded &amp; Secured</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-semibold text-pending">Review in Progress</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Time:</span>
                <p className="font-semibold text-foreground">Within 24 Hours</p>
              </div>
              <div>
                <span className="text-muted-foreground">Royalty Rate:</span>
                <p className="font-semibold text-foreground">1.0% Lifetime GMV</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Approve hote hi aapka Scout Dashboard unlock ho jayega aur aapka 1% Lifetime Royalty Link active ho jayega.
          </p>
        </div>
      </div>
    );
  }

  // Form for NOT_REGISTERED or REJECTED
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Vyapar Scout — 18+ Identity Verification</h1>
            <p className="text-xs text-muted-foreground">
              Complete PAN & Aadhaar verification to unlock your 1% Lifetime Passive Royalty Dashboard.
            </p>
          </div>
        </div>

        {status === "REJECTED" && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Verification was not approved</p>
              <p className="text-xs mt-0.5">{data?.rejectionReason || "Please correct your details and re-submit."}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Full Name (As on PAN/Aadhaar) *</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">WhatsApp Mobile Number *</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground">City *</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Jaipur, Indore, Lucknow"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">State (Optional)</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Rajasthan, MP"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">College / University / Organization (Optional)</label>
            <Input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. MNIT Jaipur / Freelance Marketer"
              className="mt-1"
            />
          </div>

          {/* Live Front-Facing Selfie Verification */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Camera className="h-4 w-4 text-primary" />
                Live Front-Facing Selfie Verification *
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Face Audit</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Please upload or capture a clear live front-facing photo of your face. Required by platform compliance to match your PAN/Aadhaar identity.
            </p>

            <input
              type="file"
              ref={selfieInputRef}
              accept="image/*"
              capture="user"
              aria-label="Upload front-facing selfie photo"
              className="hidden"
              onChange={handleSelfieChange}
            />

            {selfieUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-card border border-verified/30">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-verified shadow-xs shrink-0">
                  <Image
                    src={selfieUrl}
                    alt="Scout Selfie"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-verified">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selfie Captured Successfully</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Clear lighting detected. Ready for administrator review.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => selfieInputRef.current?.click()}
                  disabled={isUploadingSelfie}
                  className="gap-1.5 text-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => selfieInputRef.current?.click()}
                disabled={isUploadingSelfie}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card hover:bg-muted/40 transition-all cursor-pointer group text-center"
              >
                {isUploadingSelfie ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-xs font-semibold text-primary">Uploading &amp; Securing Selfie Photo...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Take Live Selfie or Upload Photo
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        JPG, PNG, WebP up to 10MB • Opens front camera on mobile
                      </span>
                    </div>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-verified" />
              Government Compliance & 18+ Age Verification
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground">PAN Card Number *</label>
                <Input
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  required
                  className="mt-1 font-mono uppercase"
                />
                <span className="text-[10px] text-muted-foreground">Required for Section 194H TDS payout ledger</span>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">12-Digit Aadhaar Number *</label>
                <Input
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder="1234 5678 9012"
                  maxLength={14}
                  required
                  className="mt-1 font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Only masked last 4 digits stored for age audit</span>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full gap-2 text-sm font-semibold mt-4"
          >
            {isSubmitting ? "Submitting for Verification..." : "Submit 18+ Verification & Unlock Scout"}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-[11px] text-muted-foreground mt-2">
            By submitting, you declare you are 18 years or older. All payouts are processed via RBI-compliant Escrow.
          </p>
        </form>
      </div>
    </div>
  );
}
