"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function HeroProductMockup() {
const [view, setView] = useState<"influencer" | "brand">("influencer");

return (
<div className="hero-product-mockup animate-fade-in flex flex-col items-center gap-4 w-full max-w-840">
{/* Mockup View Selector */}
<div
className="inline-flex bg-secondary p-1 border-card rounded-full"
>
<Button
type="button"
variant="ghost"
onClick={() => setView("influencer")}
className="mockup-view-toggle text-sm font-semibold border-none px-4-py-2 rounded-full"
data-active={view === "influencer"}
>
Influencer View
</Button>
<Button
type="button"
variant="ghost"
onClick={() => setView("brand")}
className="mockup-view-toggle text-sm font-semibold border-none px-4-py-2 rounded-full"
data-active={view === "brand"}
>
Brand View
</Button>
</div>

{/* Main Glassmorphic Container */}
<div
className="mockup-panel w-full p-6 text-left relative overflow-hidden bg-glass rounded-xl backdrop-blur-lg"
>
{/* Glow Effects */}
<div
className="mockup-glow mockup-glow-primary absolute rounded-full pointer-events-none bg-color-primary"
/>
<div
className="mockup-glow mockup-glow-secondary absolute rounded-full pointer-events-none"
/>

{/* Mockup Header */}
<div
className="mockup-header flex items-center justify-between mb-5 pb-4"
>
<div className="flex items-center gap-2">
<span
className="mockup-live-dot rounded-full"
/>
<span className="text-sm font-bold text-white">
{view === "influencer" ? "Influencer Workspace" : "Brand Campaign Control"}
</span>
</div>
<span className="text-xs text-muted">
Live Escrow Protection Active
</span>
</div>

{view === "influencer" ? (
/* ============ INFLUENCER DASHBOARD MOCK ============ */
<div className="flex flex-col gap-5">
{/* Top Stats Row */}
<div className="grid gap-4 grid-auto-140">
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">Wallet Balance</span>
<span className="text-xl font-extrabold text-white">42,850</span>
</div>
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">Trust Score</span>
<span className="text-xl font-extrabold text-emerald">98% <span className="text-xs font-normal">(Excellent)</span></span>
</div>
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">Gamification Tier</span>
<span className="text-xl font-extrabold text-amber">Gold IV </span>
</div>
</div>

{/* Active Deal Status */}
<div className="mockup-section p-4 bg-glass rounded-lg">
<div className="flex justify-between mb-3">
<div>
<h4 className="text-sm font-bold mb-1 text-white">Nike India: Air Max Launch</h4>
<span className="text-xs text-secondary">Deliverable: 1 Instagram Reel + 1 Story</span>
</div>
<div className="fit-content inline-flex text-xs font-semibold bg-emerald-subtle text-emerald rounded-sm px-2 py-1">
25,000 in Escrow
</div>
</div>

{/* Status Stepper */}
<div className="flex items-center justify-between relative mt-5">
{/* Stepper Background Line */}
<div className="mockup-step-line absolute z-0" />

{/* Stepper Active Line */}
<div className="mockup-step-line-active absolute bg-color-primary z-0" />

{/* Step 1: Signed */}
<div className="flex flex-col items-center relative gap-1.5 z-1">
<div className="flex items-center justify-center text-xs font-bold rounded-full text-white w-24 h-24 bg-color-primary">✓</div>
<span className="font-semibold text-2xs text-white">Signed</span>
</div>

{/* Step 2: Escrow Verified */}
<div className="flex flex-col items-center relative gap-1.5 z-1">
<div className="flex items-center justify-center text-xs font-bold rounded-full text-white w-24 h-24 bg-color-primary">✓</div>
<span className="font-semibold text-2xs text-white">Escrowed</span>
</div>

{/* Step 3: Submission Under Review */}
<div className="flex flex-col items-center relative gap-1.5 z-1">
<div className="mockup-step-current flex items-center justify-center text-xs rounded-full bg-tertiary text-white w-24 h-24">●</div>
<span className="font-semibold text-2xs text-white">Reviewing</span>
</div>

{/* Step 4: Complete & Disbursed */}
<div className="flex flex-col items-center relative gap-1.5 z-1">
<div className="mockup-step-locked flex items-center justify-center text-muted rounded-full bg-tertiary text-2xs w-24 h-24">
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
</div>
<span className="text-muted text-2xs">Payout</span>
</div>
</div>
</div>
</div>
) : (
/* ============ BRAND DASHBOARD MOCK ============ */
<div className="flex flex-col gap-5">
{/* Top Stats Row */}
<div className="grid gap-4 grid-auto-140">
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">Active Campaigns</span>
<span className="text-xl font-extrabold text-white">3 Campaigns</span>
</div>
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">Secured Escrow</span>
<span className="text-xl font-extrabold text-cyan">1,85,000</span>
</div>
<div className="mockup-stat bg-glass rounded-lg px-4 py-3">
<span className="text-muted block text-xs">ROI Index</span>
<span className="text-xl font-extrabold text-emerald">3.8x Profit</span>
</div>
</div>

{/* Campaign Submissions */}
<div className="mockup-section p-4 bg-glass rounded-lg">
<div className="flex justify-between items-center mb-3">
<h4 className="text-sm font-bold text-white">Submissions Awaiting Approval (1)</h4>
<span className="flex items-center gap-1 text-xs text-amber">
<span className="mockup-timer-dot rounded-full h-6" />{" "}
48h Review Timer Running
</span>
</div>

{/* Creator Submission list item */}
<div className="mockup-submission flex items-center justify-between p-3 flex-wrap bg-glass rounded-md gap-2.5">
<div className="flex items-center gap-2.5">
<div className="flex items-center justify-center font-extrabold text-xs rounded-full text-white w-32 h-32 bg-color-primary">
AM
</div>
<div>
<span className="text-sm font-semibold block text-white">Ananya Mehta</span>
<span className="text-secondary text-xs">Instagram post content ready for review</span>
</div>
</div>
<div className="flex gap-2">
<Button type="button" variant="secondary" className="mockup-secondary-action text-xs rounded-sm px-3-py-1 bg-none text-white">
View Draft
</Button>
<Button type="button" variant="primary" className="mockup-primary-action font-semibold border-none text-xs rounded-sm px-3-py-1 bg-gradient-primary text-white">
Approve
</Button>
</div>
</div>
</div>
</div>
)}
</div>
</div>
);
}
