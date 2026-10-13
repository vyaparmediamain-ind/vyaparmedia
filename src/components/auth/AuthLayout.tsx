"use client";

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BackButton } from "@/components/ui/BackButton";

interface AuthLayoutProps {
  children: React.ReactNode;
  wideCard?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
}

export function AuthLayout({
  children,
  wideCard = false,
  pageTitle,
  pageSubtitle,
}: AuthLayoutProps) {
  return (
    <div className="auth-split-wrapper">
      {/* Left Showcase Panel (Desktop) */}
      <aside className="auth-showcase-panel" aria-label="VyaparMedia Platform Highlights">
        {/* Ambient Backdrops */}
        <div className="auth-showcase-backdrop" aria-hidden="true">
          <div className="auth-showcase-orb-1" />
          <div className="auth-showcase-orb-2" />
        </div>

        {/* Brand Header */}
        <div className="auth-showcase-header">
          <Logo href="/" />
        </div>

        {/* Showcase Core Content */}
        <div className="auth-showcase-content">
          <div>
            <div className="auth-badge">
              <span className="auth-badge-dot" aria-hidden="true" />
              <span>Bharat&apos;s #1 Creator Escrow Platform</span>
            </div>
            <h1 className="auth-showcase-title">
              Where Brands &amp; Creators Build Trusted Business.
            </h1>
            <p className="auth-showcase-desc">
              Experience zero-risk collaborations with milestone-locked escrow payouts, government KYC vetting, and automated tax compliance.
            </p>
          </div>

          {/* Trust Highlights */}
          <div className="auth-trust-list">
            <div className="auth-trust-item">
              <div className="auth-trust-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="auth-trust-meta">
                <h4>100% Escrow Guarantee</h4>
                <p>Funds are deposited in secure, RBI-compliant escrow before work begins and released only upon milestone approval.</p>
              </div>
            </div>

            <div className="auth-trust-item">
              <div className="auth-trust-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <polyline points="16 11 18 13 22 9" />
                </svg>
              </div>
              <div className="auth-trust-meta">
                <h4>Verified Bharat Network</h4>
                <p>Multi-layer Aadhaar, PAN, GST and social authenticity verification on every creator &amp; brand partner.</p>
              </div>
            </div>

            <div className="auth-trust-item">
              <div className="auth-trust-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="auth-trust-meta">
                <h4>Automated Contracts &amp; TDS</h4>
                <p>Legally enforceable smart contracts generated instantly with automated TDS withholding and GST compliance.</p>
              </div>
            </div>
          </div>

          {/* Social Proof Stats */}
          <div className="auth-stats-ribbon">
            <div className="auth-stat-col">
              <span className="auth-stat-num">₹50L+</span>
              <span className="auth-stat-label">Escrow Secured</span>
            </div>
            <div className="auth-stat-col">
              <span className="auth-stat-num">2,400+</span>
              <span className="auth-stat-label">Active Vyaparis</span>
            </div>
            <div className="auth-stat-col">
              <span className="auth-stat-num">99.8%</span>
              <span className="auth-stat-label">On-Time Release</span>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="auth-showcase-footer">
          <div className="auth-security-chips">
            <span className="auth-security-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              256-Bit SSL
            </span>
            <span className="auth-security-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              RBI-Compliant
            </span>
          </div>
          <span>ISO 27001 Ready</span>
        </div>
      </aside>

      {/* Right Form Panel */}
      <main className="auth-form-panel">
        {/* Top Navigation Row */}
        <div className="auth-top-nav">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo href="/" />
            </div>
          </div>

          <div className="auth-top-actions flex items-center gap-2">
            <BackButton variant="ghost" label="Back" fallbackHref="/" className="auth-home-link" />
            <ThemeToggle size="sm" />
          </div>
        </div>

        {/* Centered Auth Card */}
        <div className="auth-form-center">
          <div className={`auth-card-container ${wideCard ? "auth-wide-card" : ""}`}>
            <div className="auth-card">
              {(pageTitle || pageSubtitle) && (
                <div className="auth-header-section">
                  <div className="auth-mobile-logo-wrap">
                    <Logo href="/" />
                  </div>
                  {pageTitle && <h2 className="auth-title">{pageTitle}</h2>}
                  {pageSubtitle && <p className="auth-subtitle">{pageSubtitle}</p>}
                </div>
              )}
              {children}
            </div>
          </div>
        </div>

        {/* Panel Footer */}
        <footer className="auth-panel-footer">
          <p>
            &copy; {new Date().getFullYear()} VyaparMedia Technologies Pvt Ltd. &middot;{" "}
            <Link href="/terms">Terms</Link> &middot;{" "}
            <Link href="/privacy">Privacy</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default AuthLayout;
