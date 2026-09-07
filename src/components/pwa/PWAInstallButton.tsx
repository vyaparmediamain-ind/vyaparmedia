"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

type InstallPlatform = "auto" | "ios" | "android";
type InstallVariant = "icon" | "store";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Exclude<InstallPlatform, "auto"> | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (userAgent.includes("android")) return "android";
  return "desktop";
}

function DownloadIcon({ size = 19 }: Readonly<{ size?: number }>) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PhoneIcon({ size = 19 }: Readonly<{ size?: number }>) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function getPlatformCopy(platform: InstallPlatform) {
  if (platform === "ios") {
    return {
      title: "Install on iPhone",
      label: "iOS App",
      subtitle: "Add to Home Screen",
      steps: ["Open this site in Safari.", "Tap the Share button.", "Choose Add to Home Screen, then tap Add."],
    };
  }
  if (platform === "android") {
    return {
      title: "Install on Android",
      label: "Android App",
      subtitle: "Install PWA",
      steps: ["Open this site in Chrome.", "Tap Install when prompted, or open the browser menu.", "Choose Install app or Add to Home screen."],
    };
  }
  return {
    title: "Install VyaparMedia",
    label: "Install App",
    subtitle: "Desktop & Mobile",
    steps: [
      "On Desktop, click the install icon in the browser address bar (top right).",
      "On Android, tap 'Install' when prompted or choose 'Install app' from Chrome's menu.",
      "On iPhone, open this site in Safari, tap the Share button, and choose 'Add to Home Screen'."
    ],
  };
}

export default function PWAInstallButton({
  className,
  label,
  platform = "auto",
  variant,
}: Readonly<{
  className?: string;
  label?: string;
  platform?: InstallPlatform;
  variant?: InstallVariant;
}>) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsInstalled(isStandaloneDisplay());

    // Check if the event was already captured globally
    if (typeof window !== "undefined" && window.deferredPrompt) {
      setPromptEvent(window.deferredPrompt);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleDeferredPromptReady = (event: Event) => {
      const customEvent = event as CustomEvent<BeforeInstallPromptEvent>;
      if (customEvent.detail) {
        setPromptEvent(customEvent.detail);
      }
    };

    const handleInstalled = () => {
      setPromptEvent(null);
      setShowFallback(false);
      setIsInstalled(true);
      if (typeof window !== "undefined") {
        window.deferredPrompt = null;
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("deferredpromptready", handleDeferredPromptReady);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("deferredpromptready", handleDeferredPromptReady);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  let resolvedPlatform: Exclude<InstallPlatform, "auto"> | "desktop" = "desktop";
  if (isMounted) {
    resolvedPlatform = platform === "auto" ? detectPlatform() : platform;
  }
  const copy = getPlatformCopy(resolvedPlatform === "desktop" ? "auto" : resolvedPlatform);
  const resolvedVariant = variant || (label ? "store" : "icon");

  const install = async () => {
    const activePrompt = promptEvent || (typeof window !== "undefined" ? window.deferredPrompt : null);
    if (activePrompt && resolvedPlatform !== "ios") {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setPromptEvent(null);
          if (typeof window !== "undefined") {
            window.deferredPrompt = null;
          }
          return;
        }
        setShowFallback(true);
      } catch {
        setShowFallback(true);
      }
      return;
    }
    setShowFallback(true);
  };

  if (resolvedVariant === "icon") {
    return (
      <>
        <button
          type="button"
          className={className}
          onClick={install}
          aria-label={label || copy.title}
          title={label || copy.title}
        >
          <DownloadIcon />
        </button>

        {showFallback && (
          <dialog open className="pwa-install-overlay" aria-modal="true">
            <div className="pwa-install-dialog">
              <div className="pwa-install-icon">
                <DownloadIcon />
              </div>
              <h2>{copy.title}</h2>
              <p>
                VyaparMedia is a secure PWA. Install it from the browser and use it like a mobile app on your home screen.
              </p>
              <ol className="pwa-install-steps">
                {copy.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="pwa-install-actions">
                <Button variant="primary" onClick={() => setShowFallback(false)}>Got it</Button>
                <Button variant="secondary" onClick={() => setShowFallback(false)}>Close</Button>
              </div>
            </div>
          </dialog>
        )}
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        className={className || "pwa-store-button"}
        onClick={install}
        aria-label={label || copy.title}
        title={label || copy.title}
      >
        <span className="pwa-store-button-icon">
          {platform === "ios" || platform === "android" ? <PhoneIcon /> : <DownloadIcon />}
        </span>
        <span className="pwa-store-button-copy">
          <span>{label || copy.label}</span>
          <small>{copy.subtitle}</small>
        </span>
      </Button>

      {showFallback && (
        <dialog open className="pwa-install-overlay" aria-modal="true">
          <div className="pwa-install-dialog">
            <div className="pwa-install-icon">
              <DownloadIcon />
            </div>
            <h2>{copy.title}</h2>
            <p>
              VyaparMedia is a secure PWA. Install it from the browser and use it like a mobile app on your home screen.
            </p>
            <ol className="pwa-install-steps">
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="pwa-install-actions">
              <Button variant="primary" onClick={() => setShowFallback(false)}>Got it</Button>
              <Button variant="secondary" onClick={() => setShowFallback(false)}>Close</Button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
