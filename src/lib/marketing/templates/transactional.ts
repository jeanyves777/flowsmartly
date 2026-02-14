// ---------------------------------------------------------------------------
// Transactional Email & SMS Templates
// System-triggered messages for orders, authentication, and support
// ---------------------------------------------------------------------------

import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

export const TRANSACTIONAL_TEMPLATES: MarketingTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. Order Confirmation
  // -------------------------------------------------------------------------
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description:
      "Confirm a new order with a summary of items, confirmation number, and next steps.",
    category: "transactional",
    icon: "\u{1F4E6}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "order.created",
    defaultEmail: {
      subject: "Order Confirmed \u2014 Thank You, {{firstName}}!",
      preheader:
        "Your order has been received and is being prepared. Here are your details.",
      content:
        "Thank you for your order, {{firstName}}! We have received your order and it is now being processed. Your confirmation number is {{confirmationNumber}}. We will send you another email once your order has shipped. In the meantime, you can review your order details or reach out to our support team if you have any questions.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Thank You for Your Order, {{firstName}}!",
        },
        {
          type: "text",
          content:
            "Great news \u2014 your order has been received and is now being processed. We appreciate your purchase and are working to get everything ready for you as quickly as possible.",
        },
        {
          type: "highlight",
          content:
            "<strong>Confirmation Number:</strong> {{confirmationNumber}}<br><strong>Order Date:</strong> {{orderDate}}<br><strong>Order Total:</strong> {{orderTotal}}",
        },
        {
          type: "text",
          content:
            "<strong>What happens next?</strong>",
        },
        {
          type: "text",
          content:
            "\u2022 We are preparing your order for shipment<br>\u2022 You will receive a shipping confirmation email with tracking details<br>\u2022 Estimated processing time is 1\u20132 business days",
        },
        {
          type: "button",
          content: "View Your Order",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "If you have any questions about your order, feel free to reply to this email or contact our support team. We are here to help!",
        },
        {
          type: "text",
          content: "Thank you for choosing us,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms:
      "Your order is confirmed, {{firstName}}! Order details: [link]. Thank you for your purchase!",
    aiPromptHint:
      "Write a clear, professional order confirmation email. Include the confirmation number, order summary, and next steps. Keep the tone appreciative and informative. Let the customer know what to expect and how to get help if needed.",
    suggestedMergeTags: ["firstName", "email"],
  },

  // -------------------------------------------------------------------------
  // 2. Shipping / Delivery Notification
  // -------------------------------------------------------------------------
  {
    id: "shipping-notification",
    name: "Shipping / Delivery Notification",
    description:
      "Notify customers that their order has shipped with tracking information and estimated delivery.",
    category: "transactional",
    icon: "\u{1F69A}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "order.shipped",
    defaultEmail: {
      subject: "Your Order Has Shipped, {{firstName}}!",
      preheader:
        "Your order is on its way. Track your package with the details below.",
      content:
        "Good news, {{firstName}}! Your order has been shipped and is on its way to you. You can track your package using the tracking number below. Estimated delivery is within 3 to 5 business days. If you have any questions about your delivery, do not hesitate to reach out to our support team.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Your Order Is on Its Way! \u{1F69A}",
        },
        {
          type: "text",
          content:
            "Great news, {{firstName}}! Your order has been packed, shipped, and is now heading your way. Here are your shipment details:",
        },
        {
          type: "highlight",
          content:
            "<strong>Tracking Number:</strong> {{trackingNumber}}<br><strong>Carrier:</strong> {{carrier}}<br><strong>Estimated Delivery:</strong> {{estimatedDelivery}}",
        },
        {
          type: "button",
          content: "Track Your Package",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "<strong>Delivery tips:</strong>",
        },
        {
          type: "text",
          content:
            "\u2022 Make sure someone is available to receive the package if a signature is required<br>\u2022 Check your mailbox or doorstep on the estimated delivery date<br>\u2022 Contact us immediately if your package does not arrive within the expected window",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "If you have any questions about your shipment, feel free to reply to this email or contact our support team. We are happy to help!",
        },
        {
          type: "text",
          content: "Happy unboxing,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms:
      "Good news {{firstName}}! Your order has shipped. Track it: [link].",
    aiPromptHint:
      "Write a clear shipping notification email. Include tracking number, carrier, and estimated delivery date. Provide a prominent track button. Keep the tone positive and helpful with delivery tips.",
    suggestedMergeTags: ["firstName", "email"],
  },

  // -------------------------------------------------------------------------
  // 3. Invoice / Receipt
  // -------------------------------------------------------------------------
  {
    id: "invoice-receipt",
    name: "Invoice / Receipt",
    description:
      "Send a payment receipt with transaction details, amount, and a downloadable invoice link.",
    category: "transactional",
    icon: "\u{1F9FE}",
    channels: ["email"],
    automatable: true,
    triggerEvent: "payment.received",
    defaultEmail: {
      subject: "Your Receipt from {{company}}",
      preheader:
        "Payment received. Here is your receipt with full transaction details.",
      content:
        "Hi {{firstName}}, this email confirms that we have received your payment. Your transaction details are below. Amount: {{amount}}. Payment Date: {{paymentDate}}. Payment Method: {{paymentMethod}}. You can download a PDF copy of your invoice for your records. If you have any billing questions, our support team is ready to help.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Payment Receipt",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, this email confirms that we have successfully received your payment. Thank you!",
        },
        {
          type: "highlight",
          content:
            "<strong>Amount Paid:</strong> {{amount}}<br><strong>Payment Date:</strong> {{paymentDate}}<br><strong>Payment Method:</strong> {{paymentMethod}}<br><strong>Transaction ID:</strong> {{transactionId}}",
        },
        {
          type: "text",
          content:
            "A detailed breakdown of your charges is included below for your records:",
        },
        {
          type: "highlight",
          content:
            "{{invoiceLineItems}}",
        },
        {
          type: "button",
          content: "Download Invoice (PDF)",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Please keep this receipt for your records. If you have any billing questions or believe there is an error, reply to this email or contact our support team and we will sort it out right away.",
        },
        {
          type: "text",
          content: "Thank you for your business,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a professional payment receipt email. Include the amount, date, payment method, and transaction ID. Provide a link to download the full invoice as a PDF. Keep the tone clear and professional. Mention how to get help with billing questions.",
    suggestedMergeTags: ["firstName", "email", "company"],
  },

  // -------------------------------------------------------------------------
  // 4. Password Reset
  // -------------------------------------------------------------------------
  {
    id: "password-reset",
    name: "Password Reset",
    description:
      "Send a secure password reset link with clear instructions and a security notice.",
    category: "transactional",
    icon: "\u{1F510}",
    channels: ["email"],
    automatable: true,
    triggerEvent: "auth.password_reset",
    defaultEmail: {
      subject: "Reset Your Password",
      preheader:
        "You requested a password reset. Click the link inside to create a new password.",
      content:
        "Hi {{firstName}}, we received a request to reset the password for your account. Click the button below to create a new password. This link will expire in 60 minutes for security purposes. If you did not request a password reset, you can safely ignore this email. Your password will not be changed unless you click the link above and create a new one.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Reset Your Password",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, we received a request to reset the password associated with your account. No worries \u2014 it happens to the best of us!",
        },
        {
          type: "text",
          content:
            "Click the button below to create a new password. For your security, this link will expire in <strong>60 minutes</strong>.",
        },
        {
          type: "button",
          content: "Reset My Password",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "highlight",
          content:
            "<strong>Did not request this?</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.",
        },
        {
          type: "text",
          content:
            "For your security, please do not forward this email to anyone. The password reset link is unique to your account.",
        },
        {
          type: "text",
          content:
            "If you continue to have trouble accessing your account, contact our support team for assistance.",
        },
        {
          type: "text",
          content: "Stay secure,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a clear, security-conscious password reset email. Include a prominent reset button, mention the link expiration time, and add a note for users who did not request the reset. Keep the tone helpful and reassuring.",
    suggestedMergeTags: ["firstName"],
  },

  // -------------------------------------------------------------------------
  // 5. Email Verification
  // -------------------------------------------------------------------------
  {
    id: "email-verification",
    name: "Email Verification",
    description:
      "Ask new users to verify their email address with a confirmation link and expiry notice.",
    category: "transactional",
    icon: "\u2709\uFE0F",
    channels: ["email"],
    automatable: true,
    triggerEvent: "auth.verify_email",
    defaultEmail: {
      subject: "Verify Your Email Address",
      preheader:
        "Please confirm your email address to complete your account setup.",
      content:
        "Hi {{firstName}}, welcome aboard! To complete your account setup, please verify your email address by clicking the button below. This verification link will expire in 24 hours. If you did not create an account, no action is needed and you can disregard this email.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Verify Your Email Address",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, welcome aboard! We are excited to have you. To get started, please confirm your email address by clicking the button below.",
        },
        {
          type: "button",
          content: "Verify My Email",
          href: "#",
        },
        {
          type: "text",
          content:
            "This verification link will expire in <strong>24 hours</strong>. If the link has expired, you can request a new one from the login page.",
        },
        { type: "divider", content: "" },
        {
          type: "highlight",
          content:
            "<strong>Why verify?</strong> Email verification helps us protect your account, ensure you receive important notifications, and keep our community secure.",
        },
        {
          type: "text",
          content:
            "If you did not create an account with us, no action is needed \u2014 you can safely ignore this email.",
        },
        {
          type: "text",
          content:
            "If you have any trouble verifying your email, reply to this message or contact our support team.",
        },
        {
          type: "text",
          content: "Welcome to the team,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a friendly email verification message for new users. Include a prominent verify button, mention when the link expires, explain why verification is important, and add a note for people who did not sign up. Keep the tone welcoming and clear.",
    suggestedMergeTags: ["firstName"],
  },

  // -------------------------------------------------------------------------
  // 6. Two-Factor Authentication Code
  // -------------------------------------------------------------------------
  {
    id: "two-factor-code",
    name: "Two-Factor Authentication",
    description:
      "Deliver a time-sensitive verification code for two-factor authentication with security guidance.",
    category: "transactional",
    icon: "\u{1F511}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "auth.2fa",
    defaultEmail: {
      subject: "Your Verification Code",
      preheader:
        "Your two-factor authentication code is ready. It expires in 10 minutes.",
      content:
        "Hi {{firstName}}, your verification code is {{verificationCode}}. This code is valid for 10 minutes. Enter it on the verification page to complete your sign-in. If you did not attempt to sign in, someone may be trying to access your account. Please change your password immediately and contact our support team.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Your Verification Code",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, use the code below to complete your sign-in. This code is valid for <strong>10 minutes</strong>.",
        },
        {
          type: "highlight",
          content:
            "Your verification code: <strong style=\"font-size: 28px; letter-spacing: 4px;\">{{verificationCode}}</strong>",
        },
        {
          type: "text",
          content:
            "Enter this code on the verification page to continue. Do not share this code with anyone, including anyone claiming to be from our team.",
        },
        { type: "divider", content: "" },
        {
          type: "highlight",
          content:
            "<strong>Did not request this code?</strong> If you did not attempt to sign in, your account credentials may have been compromised. We recommend changing your password immediately and contacting our support team.",
        },
        {
          type: "text",
          content:
            "For your protection, our team will never ask you for this code via phone, email, or chat.",
        },
        {
          type: "text",
          content: "Stay safe,<br>The {{company}} Team",
        },
      ]),
    },
    defaultSms:
      "Your verification code is: {{verificationCode}}. Valid for 10 minutes. Don\u2019t share this code.",
    aiPromptHint:
      "Write a concise two-factor authentication email. Display the verification code prominently. Mention the expiration time, warn against sharing the code, and include a note for users who did not initiate the request. Keep the tone direct and security-focused.",
    suggestedMergeTags: ["firstName"],
  },

  // -------------------------------------------------------------------------
  // 7. Support Ticket Created
  // -------------------------------------------------------------------------
  {
    id: "support-ticket-created",
    name: "Support Ticket Created",
    description:
      "Acknowledge a new support request with a ticket number, expected response time, and next steps.",
    category: "transactional",
    icon: "\u{1F3AB}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "support.ticket_created",
    defaultEmail: {
      subject: "We\u2019ve Received Your Request, {{firstName}}",
      preheader:
        "Your support ticket has been created. We will get back to you shortly.",
      content:
        "Hi {{firstName}}, thank you for reaching out. We have received your support request and a ticket has been created. Your ticket number is {{ticketNumber}}. Our support team typically responds within 24 hours during business days. You can check the status of your ticket or add additional information at any time by visiting your support portal.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "We\u2019ve Received Your Request",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, thank you for reaching out to us. We want you to know that your message has been received and a support ticket has been created on your behalf.",
        },
        {
          type: "highlight",
          content:
            "<strong>Ticket Number:</strong> {{ticketNumber}}<br><strong>Subject:</strong> {{ticketSubject}}<br><strong>Priority:</strong> {{ticketPriority}}<br><strong>Created:</strong> {{ticketDate}}",
        },
        {
          type: "text",
          content:
            "<strong>What happens next?</strong>",
        },
        {
          type: "text",
          content:
            "\u2022 A member of our support team will review your request<br>\u2022 You can expect an initial response within <strong>24 hours</strong> during business days<br>\u2022 You will receive email updates as your ticket progresses<br>\u2022 You can reply to this email to add more details at any time",
        },
        {
          type: "button",
          content: "View Your Ticket",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "In the meantime, you may find answers to common questions in our help center. If your issue is urgent, please let us know by replying with \"URGENT\" and we will prioritize your request.",
        },
        {
          type: "text",
          content: "We are here for you,<br>The {{company}} Support Team",
        },
      ]),
    },
    defaultSms:
      "Hi {{firstName}}, we got your support request. We\u2019ll respond within 24hrs. Track it: [link].",
    aiPromptHint:
      "Write a professional support ticket confirmation email. Include the ticket number, expected response time, and next steps. Let the customer know how to add more details and where to check status. Keep the tone reassuring and helpful.",
    suggestedMergeTags: ["firstName", "email"],
  },

  // -------------------------------------------------------------------------
  // 8. Support Ticket Resolved
  // -------------------------------------------------------------------------
  {
    id: "support-ticket-resolved",
    name: "Support Ticket Resolved",
    description:
      "Notify the customer that their support ticket has been resolved with a summary and satisfaction survey.",
    category: "transactional",
    icon: "\u2705",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "support.ticket_resolved",
    defaultEmail: {
      subject:
        "Your Support Request Has Been Resolved, {{firstName}}",
      preheader:
        "Your support ticket has been resolved. Let us know how we did.",
      content:
        "Hi {{firstName}}, we are happy to let you know that your support ticket {{ticketNumber}} has been resolved. Here is a summary of the resolution. If this does not fully address your concern, you can reopen the ticket by simply replying to this email. We would also appreciate your feedback on the support experience so we can continue to improve.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Your Request Has Been Resolved",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, we are happy to let you know that your support ticket has been resolved. Here are the details:",
        },
        {
          type: "highlight",
          content:
            "<strong>Ticket Number:</strong> {{ticketNumber}}<br><strong>Subject:</strong> {{ticketSubject}}<br><strong>Status:</strong> Resolved<br><strong>Resolved On:</strong> {{resolvedDate}}",
        },
        {
          type: "text",
          content:
            "<strong>Resolution Summary:</strong>",
        },
        {
          type: "highlight",
          content: "{{resolutionSummary}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "We hope this resolves your concern. If you feel this issue has not been fully addressed, you can reopen your ticket by simply replying to this email and we will pick up right where we left off.",
        },
        {
          type: "text",
          content:
            "<strong>How did we do?</strong> Your feedback helps us improve. Please take a moment to rate your support experience:",
        },
        {
          type: "button",
          content: "Rate Your Experience",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Thank you for giving us the opportunity to help, {{firstName}}. We are always here if you need anything else.",
        },
        {
          type: "text",
          content: "All the best,<br>The {{company}} Support Team",
        },
      ]),
    },
    defaultSms:
      "Hi {{firstName}}, your support ticket has been resolved. Need more help? Reply to this message.",
    aiPromptHint:
      "Write a professional support resolution email. Include the ticket number, resolution summary, and a link to a satisfaction survey. Explain how to reopen the ticket if the issue is not fully resolved. Keep the tone warm and professional.",
    suggestedMergeTags: ["firstName", "email"],
  },
];
