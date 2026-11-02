/**
 * Formatter utilities for displaying human-readable English descriptions
 * of AuditLog and ActivityLog events in the admin interface.
 */

export function humanizeString(str: string): string {
  if (!str) return "";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatCurrencyPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}

export interface AuditLogLike {
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeJSON?: unknown;
  afterJSON?: unknown;
  ipAddress?: string | null;
}

export function formatAuditLogDetails(log: AuditLogLike): string {
  const before =
    log.beforeJSON && typeof log.beforeJSON === "object"
      ? (log.beforeJSON as Record<string, unknown>)
      : null;
  const after =
    log.afterJSON && typeof log.afterJSON === "object"
      ? (log.afterJSON as Record<string, unknown>)
      : null;

  const action = (log.actionType || "").toUpperCase();

  switch (action) {
    case "LOGIN": {
      if (after?.email && typeof after.email === "string") {
        return `Signed in with ${after.email}`;
      }
      return "User signed in successfully";
    }

    case "LOGOUT":
      return "User signed out";

    case "REGISTER":
      return "New user account registered";

    case "PASSWORD_RESET":
      return "Password reset completed";

    case "TWO_FACTOR_ENABLED":
      return "Two-factor authentication (2FA) enabled";

    case "TWO_FACTOR_DISABLED": {
      const method = after?.reAuthMethod ? ` via ${after.reAuthMethod}` : "";
      return `Two-factor authentication disabled${method}`;
    }

    case "SECURITY_LEDGER_ALERT": {
      const reason =
        (typeof after?.reason === "string" && after.reason) ||
        (typeof before?.reason === "string" && before.reason);
      const drift =
        (typeof after?.drift === "number" && after.drift) ||
        (typeof (after?.summary as Record<string, unknown>)?.ledgerToWalletDriftPaise === "number" &&
          ((after?.summary as Record<string, unknown>).ledgerToWalletDriftPaise as number));

      const driftText =
        drift !== false && typeof drift === "number"
          ? ` (Drift: ${formatCurrencyPaise(Math.abs(drift))})`
          : "";

      if (reason) {
        return `${reason}${driftText}`;
      }
      return `Ledger balance mismatch alert${driftText}`;
    }

    case "SECURITY_LEDGER_AUTO_CORRECTED":
      return "Ledger balance auto-corrected by reconciliation engine";

    case "SECURITY_ALERT": {
      if (after?.type === "IMPOSSIBLE_TRAVEL") {
        const dist =
          typeof after.distance === "number"
            ? ` (${Math.round(after.distance)} km distance)`
            : "";
        return `Impossible travel detected${dist}`;
      }
      if (typeof after?.reason === "string" && after.reason) {
        return after.reason;
      }
      if (typeof after?.type === "string" && after.type) {
        return `Security alert: ${humanizeString(after.type)}`;
      }
      return "Security alert triggered";
    }

    case "FRAUD_APPEAL_RESOLVED": {
      const decision =
        after?.decision === "APPROVE_APPEAL"
          ? "Approved"
          : after?.decision === "REJECT_APPEAL"
          ? "Rejected"
          : after?.decision
          ? humanizeString(String(after.decision))
          : "Resolved";
      const notes = after?.notes ? ` — ${after.notes}` : "";
      return `Fraud appeal ${decision}${notes}`;
    }

    case "FRAUD_APPEAL_SUBMITTED":
      return "Fraud suspension appeal submitted for review";

    case "XP_AWARDED": {
      const xp = after?.xpAwarded ?? after?.rawXp;
      const reason = after?.reason
        ? ` for ${humanizeString(String(after.reason))}`
        : "";
      return `Awarded ${xp !== undefined ? `${xp} ` : ""}XP${reason}`.trim();
    }

    case "CAMPAIGN_AUTO_PAUSED": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Campaign auto-paused${reason}`;
    }

    case "CREATE_CAMPAIGN":
    case "CAMPAIGN_CREATE":
      return "New campaign created";

    case "CANCEL_CAMPAIGN":
    case "CAMPAIGN_CANCEL": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Campaign cancelled${reason}`;
    }

    case "CAMPAIGN_UPDATE":
      return "Campaign details updated";

    case "ACTIVATE_CAMPAIGN":
      return "Campaign activated";

    case "SUBMIT_APPLICATION":
    case "APPLICATION_SUBMIT":
      return "Creator application submitted";

    case "ACCEPT_APPLICATION":
    case "APPLICATION_ACCEPT":
      return "Application accepted and deal created";

    case "REJECT_APPLICATION":
    case "APPLICATION_REJECT": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Application rejected${reason}`;
    }

    case "DEAL_STATUS_TRANSITION":
    case "POST_STATUS_CHANGE": {
      const from = after?.fromState || before?.status;
      const to = after?.toState || after?.newStatus || after?.status;
      const reason = after?.reason ? ` (${after.reason})` : "";
      if (from && to) {
        return `Status changed from ${humanizeString(String(from))} to ${humanizeString(String(to))}${reason}`;
      }
      if (to) {
        return `Status updated to ${humanizeString(String(to))}${reason}`;
      }
      return `Deal status transitioned${reason}`;
    }

    case "CONTRACT_SIGNED": {
      const role = after?.role ? humanizeString(String(after.role)) : "Party";
      const signedStatus = after?.isFullySigned
        ? " (Fully executed)"
        : " (Awaiting countersignature)";
      return `Contract signed by ${role}${signedStatus}`;
    }

    case "CANCEL_DEAL":
    case "DEAL_CANCEL": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      const refund =
        typeof after?.refundAmount === "number"
          ? ` (Refund: ${formatCurrencyPaise(after.refundAmount)})`
          : "";
      return `Deal cancelled${reason}${refund}`;
    }

    case "KYC_SUBMITTED":
      return "KYC identity verification submitted";

    case "KYC_APPROVED":
      return "KYC identity verification approved";

    case "KYC_REJECTED": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `KYC identity verification rejected${reason}`;
    }

    case "ACCOUNT_SUSPENDED":
    case "TEMP_SUSPENSION": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Account suspended${reason}`;
    }

    case "ACCOUNT_BANNED":
    case "PERMANENT_BAN": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Account permanently banned${reason}`;
    }

    case "ACCOUNT_ACTIVATED":
      return "Account activated";

    case "PAYMENT_INITIATED":
      return "Escrow payment initiated";

    case "PAYMENT_COMPLETED":
      return "Escrow payment completed";

    case "PAYMENT_REFUNDED":
      return "Escrow payment refunded to brand";

    case "WITHDRAWAL_REQUESTED":
      return "Payout withdrawal requested";

    case "DISPUTE_RAISED": {
      const reason = after?.reason ? `: ${after.reason}` : "";
      return `Dispute opened${reason}`;
    }

    case "DISPUTE_RESOLVED":
    case "DISPUTE_RESOLUTION": {
      const res = after?.resolution || after?.decision;
      return `Dispute resolved${res ? `: ${res}` : ""}`;
    }

    case "PROFILE_UPDATE":
      return "User profile information updated";

    default:
      break;
  }

  // Generic heuristic fallbacks
  if (typeof after?.reason === "string" && after.reason.trim()) {
    return after.reason.trim();
  }
  if (typeof before?.reason === "string" && before.reason.trim()) {
    return before.reason.trim();
  }
  if (typeof after?.message === "string" && after.message.trim()) {
    return after.message.trim();
  }
  if (typeof after?.notes === "string" && after.notes.trim()) {
    return after.notes.trim();
  }
  if (typeof after?.description === "string" && after.description.trim()) {
    return after.description.trim();
  }

  const fromState = after?.fromState || before?.status || before?.state;
  const toState = after?.toState || after?.newStatus || after?.status || after?.state;
  if (fromState && toState && fromState !== toState) {
    return `Changed from ${humanizeString(String(fromState))} to ${humanizeString(String(toState))}`;
  }

  if (before && after) {
    const changedKeys = Object.keys(after).filter(
      (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])
    );
    if (changedKeys.length > 0) {
      const keyList = changedKeys.slice(0, 3).map(humanizeString).join(", ");
      const extra = changedKeys.length > 3 ? ` (+${changedKeys.length - 3} more)` : "";
      return `Updated: ${keyList}${extra}`;
    }
  }

  if (after && Object.keys(after).length > 0) {
    const entries = Object.entries(after)
      .filter(([_, v]) => v !== null && typeof v !== "object")
      .slice(0, 2)
      .map(([k, v]) => `${humanizeString(k)}: ${String(v)}`);
    if (entries.length > 0) {
      return entries.join(" • ");
    }
  }

  if (!before && !after) {
    return "No changes recorded";
  }

  return humanizeString(log.actionType) || "Activity recorded";
}

