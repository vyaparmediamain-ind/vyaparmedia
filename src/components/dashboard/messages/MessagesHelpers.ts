import { z } from "zod";

export const reportUserSchema = z.object({
  reason: z.string().min(5, "Please select a valid report reason"),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().or(z.literal("")),
});

export const sendMessageSchema = z.object({
content: z.string().min(1, "Message content cannot be empty").max(2000, "Message cannot exceed 2000 characters"),
});

type MessageMetadata = Record<string, string | number | boolean | null | undefined>;

export interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  rawCreatedAt?: string;
  isMe?: boolean;
  isBlocked?: boolean;
  hasWarning?: boolean;
  isRead?: boolean;
  readAt?: string | null;
  messageType?: "TEXT" | "FILE" | "OFFER" | "CONTRACT_ACCEPTANCE" | "SYSTEM";
  fileUrl?: string | null;
  metadata?: MessageMetadata | null;
}

export function formatMessageDateDivider(timestamp?: string): string {
  if (!timestamp) return "Today";
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    const isSameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      ...(isSameYear ? {} : { year: "numeric" }),
    });
  } catch {
    return "";
  }
}

/** Raw shape returned from the /api/messages endpoint before client-side mapping */
export interface RawMessage {
id: string;
senderId: string;
content: string;
createdAt: string;
isBlocked?: boolean;
hasWarning?: boolean;
isRead?: boolean;
readAt?: string | null;
messageType?: "TEXT" | "FILE" | "OFFER" | "CONTRACT_ACCEPTANCE" | "SYSTEM";
fileUrl?: string | null;
metadata?: MessageMetadata | null;
}

export interface Conversation {
id: string;
userId: string;
name: string;
avatar: string | null;
userType: string;
lastMessage: string;
lastMessageTime: string;
unread: number;
isTyping?: boolean;
}

export type RawConversation = Record<string, unknown> & {
userId?: string;
id?: string;
name?: string;
avatar?: string | null;
userType?: string;
lastMessage?: string;
lastMessageTime?: string;
unread?: number;
unreadCount?: number;
latestMessage?: {
content?: string;
createdAt?: string;
};
presence?: {
isTyping?: boolean;
};
user?: {
userType?: string;
influencerProfile?: {
displayName?: string;
avatar?: string | null;
} | null;
brandProfile?: {
companyName?: string;
logo?: string | null;
} | null;
} | null;
};

export function normalizeConversation(raw: RawConversation): Conversation | null {
const userId = raw.userId || raw.id;
if (!userId) return null;

const fallbackName =
raw.user?.influencerProfile?.displayName ||
raw.user?.brandProfile?.companyName ||
"Unknown User";

return {
id: raw.id || userId,
userId,
name: raw.name || fallbackName,
avatar:
raw.avatar ??
raw.user?.influencerProfile?.avatar ??
raw.user?.brandProfile?.logo ??
null,
userType: raw.userType || raw.user?.userType || "USER",
lastMessage: raw.lastMessage || raw.latestMessage?.content || "",
lastMessageTime: raw.lastMessageTime || raw.latestMessage?.createdAt || "",
unread: Number(raw.unread ?? raw.unreadCount ?? 0),
isTyping: Boolean(raw.presence?.isTyping),
};
}
