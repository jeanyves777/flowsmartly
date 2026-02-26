export interface WhatsAppAccount {
  id: string;
  platform: string;
  platformUserId: string;
  platformUsername: string;
  platformDisplayName: string;
  platformAvatarUrl: string | null;
  connectedAt: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
}

export interface Conversation {
  id: string;
  userId: string;
  socialAccountId: string;
  customerPhone: string;
  customerName: string | null;
  customerAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  unreadCount: number;
  status: "open" | "closed" | "archived";
  assignedTo: string | null;
  tags: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  socialAccount?: {
    id: string;
    platformUsername: string;
    platformDisplayName: string;
  };
  lastMessage?: {
    content: string;
    messageType: string;
    direction: string;
    timestamp: string;
  } | null;
}

export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId: string | null;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "video" | "document" | "audio" | "location" | "template";
  content: string;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  templateName: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
  metadata: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  userId: string;
  socialAccountId: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  headerType: string | null;
  headerText: string | null;
  headerMediaUrl: string | null;
  bodyText: string;
  footerText: string | null;
  buttons: string | null;
  templateConfig: string | null;
  whatsappTemplateId: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
  userId: string;
  socialAccountId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: "keyword" | "new_conversation" | "inbound_message" | "missed_chat" | "schedule";
  triggerConfig: string | null;
  actionType: "send_message" | "send_template" | "assign_to" | "add_tag" | "webhook";
  actionValue: string | null;
  actionConfig: string | null;
  priority: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  socialAccount?: {
    id: string;
    platformUsername: string;
    platformDisplayName: string;
  };
}
