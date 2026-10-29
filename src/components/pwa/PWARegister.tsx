"use client";


import { logger } from "@/lib/logger-client";
import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const allowPwaInDev =
      window.location.search.includes("pwa=true") ||
      localStorage.getItem("pwa") === "true";

    if (process.env.NODE_ENV !== "production" && !allowPwaInDev) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          if (registration.scope.includes(window.location.origin)) {
            registration.unregister();
          }
        });
      });
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        logger.error("[pwa-register] Service worker registration failed:", error);
      }
    };

    register();
  }, []);

return null;
}
