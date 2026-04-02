"use client";

import { useReducer, useCallback, useMemo } from "react";
import type { EmailSection, EmailBrand } from "@/lib/marketing/email-renderer";

// ── State ──

export interface CampaignFormState {
  // Step
  step: "template" | "editor" | "send";

  // Campaign metadata
  campaignName: string;
  subject: string;
  preheader: string;

  // Template
  selectedTemplateId: string | null;
  templateName: string;

  // Sections (source of truth for email content)
  sections: EmailSection[];

  // Brand
  brandKit: EmailBrand | null;
  showLogo: boolean;
  showBrandName: boolean;
  logoSize: "normal" | "large" | "big";

  // Image (for legacy MMS support)
  imageUrl: string;
  imageSource: string;
  imageOverlayText: string;

  // Audience
  selectedContactListId: string;
  customEmails: string[];
  excludedContactIds: string[];

  // Schedule
  scheduleType: "now" | "later";
  scheduledDate: string;
  scheduledTime: string;

  // UI state
  isGenerating: boolean;
  isSaving: boolean;
  isSending: boolean;

  // Edit mode
  editCampaignId: string | null;
}

// ── Actions ──

type Action =
  | { type: "SET_STEP"; step: CampaignFormState["step"] }
  | { type: "SET_CAMPAIGN_NAME"; value: string }
  | { type: "SET_SUBJECT"; value: string }
  | { type: "SET_PREHEADER"; value: string }
  | { type: "LOAD_TEMPLATE"; templateId: string; templateName: string; sections: EmailSection[]; subject?: string; preheader?: string }
  | { type: "SET_SECTIONS"; sections: EmailSection[] }
  | { type: "ADD_SECTION"; section: EmailSection; index?: number }
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<EmailSection> }
  | { type: "DELETE_SECTION"; id: string }
  | { type: "DUPLICATE_SECTION"; id: string }
  | { type: "REORDER_SECTIONS"; activeId: string; overId: string }
  | { type: "SET_BRAND_KIT"; brandKit: EmailBrand | null }
  | { type: "SET_BRAND_OPTIONS"; showLogo?: boolean; showBrandName?: boolean; logoSize?: "normal" | "large" | "big" }
  | { type: "SET_IMAGE"; imageUrl: string; imageSource: string }
  | { type: "SET_IMAGE_OVERLAY"; value: string }
  | { type: "SET_CONTACT_LIST"; id: string }
  | { type: "ADD_CUSTOM_EMAIL"; email: string }
  | { type: "REMOVE_CUSTOM_EMAIL"; email: string }
  | { type: "SET_CUSTOM_EMAILS"; emails: string[] }
  | { type: "TOGGLE_EXCLUDE_CONTACT"; contactId: string }
  | { type: "SET_EXCLUDED_CONTACTS"; ids: string[] }
  | { type: "SET_SCHEDULE"; scheduleType: "now" | "later"; date?: string; time?: string }
  | { type: "SET_GENERATING"; value: boolean }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_SENDING"; value: boolean }
  | { type: "LOAD_CAMPAIGN"; state: Partial<CampaignFormState> };

// ── Initial state ──

const initialState: CampaignFormState = {
  step: "template",
  campaignName: "",
  subject: "",
  preheader: "",
  selectedTemplateId: null,
  templateName: "",
  sections: [],
  brandKit: null,
  showLogo: true,
  showBrandName: true,
  logoSize: "normal",
  imageUrl: "",
  imageSource: "",
  imageOverlayText: "",
  selectedContactListId: "",
  customEmails: [],
  excludedContactIds: [],
  scheduleType: "now",
  scheduledDate: "",
  scheduledTime: "",
  isGenerating: false,
  isSaving: false,
  isSending: false,
  editCampaignId: null,
};

// ── Reducer ──

function reducer(state: CampaignFormState, action: Action): CampaignFormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };

    case "SET_CAMPAIGN_NAME":
      return { ...state, campaignName: action.value };

    case "SET_SUBJECT":
      return { ...state, subject: action.value };

    case "SET_PREHEADER":
      return { ...state, preheader: action.value };

    case "LOAD_TEMPLATE":
      return {
        ...state,
        selectedTemplateId: action.templateId,
        templateName: action.templateName,
        sections: action.sections,
        subject: action.subject || state.subject,
        preheader: action.preheader || state.preheader,
        step: "editor",
      };

    case "SET_SECTIONS":
      return { ...state, sections: action.sections };

    case "ADD_SECTION": {
      const sections = [...state.sections];
      const idx = action.index !== undefined ? action.index : sections.length;
      sections.splice(idx, 0, action.section);
      return { ...state, sections };
    }

    case "UPDATE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
      };

    case "DELETE_SECTION":
      return { ...state, sections: state.sections.filter((s) => s.id !== action.id) };

    case "DUPLICATE_SECTION": {
      const idx = state.sections.findIndex((s) => s.id === action.id);
      if (idx === -1) return state;
      const original = state.sections[idx];
      const dup: EmailSection = { ...original, id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
      const sections = [...state.sections];
      sections.splice(idx + 1, 0, dup);
      return { ...state, sections };
    }

    case "REORDER_SECTIONS": {
      const oldIdx = state.sections.findIndex((s) => s.id === action.activeId);
      const newIdx = state.sections.findIndex((s) => s.id === action.overId);
      if (oldIdx === -1 || newIdx === -1) return state;
      const sections = [...state.sections];
      const [moved] = sections.splice(oldIdx, 1);
      sections.splice(newIdx, 0, moved);
      return { ...state, sections };
    }

    case "SET_BRAND_KIT":
      return { ...state, brandKit: action.brandKit };

    case "SET_BRAND_OPTIONS":
      return {
        ...state,
        showLogo: action.showLogo ?? state.showLogo,
        showBrandName: action.showBrandName ?? state.showBrandName,
        logoSize: action.logoSize ?? state.logoSize,
      };

    case "SET_IMAGE":
      return { ...state, imageUrl: action.imageUrl, imageSource: action.imageSource };

    case "SET_IMAGE_OVERLAY":
      return { ...state, imageOverlayText: action.value };

    case "SET_CONTACT_LIST":
      return { ...state, selectedContactListId: action.id };

    case "ADD_CUSTOM_EMAIL":
      if (state.customEmails.includes(action.email)) return state;
      return { ...state, customEmails: [...state.customEmails, action.email] };

    case "REMOVE_CUSTOM_EMAIL":
      return { ...state, customEmails: state.customEmails.filter((e) => e !== action.email) };

    case "SET_CUSTOM_EMAILS":
      return { ...state, customEmails: action.emails };

    case "TOGGLE_EXCLUDE_CONTACT": {
      const excluded = state.excludedContactIds.includes(action.contactId)
        ? state.excludedContactIds.filter((id) => id !== action.contactId)
        : [...state.excludedContactIds, action.contactId];
      return { ...state, excludedContactIds: excluded };
    }

    case "SET_EXCLUDED_CONTACTS":
      return { ...state, excludedContactIds: action.ids };

    case "SET_SCHEDULE":
      return {
        ...state,
        scheduleType: action.scheduleType,
        scheduledDate: action.date ?? state.scheduledDate,
        scheduledTime: action.time ?? state.scheduledTime,
      };

    case "SET_GENERATING":
      return { ...state, isGenerating: action.value };

    case "SET_SAVING":
      return { ...state, isSaving: action.value };

    case "SET_SENDING":
      return { ...state, isSending: action.value };

    case "LOAD_CAMPAIGN":
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── Hook ──

export function useCampaignForm(initial?: Partial<CampaignFormState>) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...initial });

  const canProceedToEditor = useMemo(
    () => state.sections.length > 0,
    [state.sections]
  );

  const canProceedToSend = useMemo(
    () => state.subject.trim().length > 0 && state.sections.length > 0,
    [state.subject, state.sections]
  );

  const canSend = useMemo(
    () =>
      canProceedToSend &&
      (state.selectedContactListId || state.customEmails.length > 0) &&
      (state.campaignName.trim().length > 0 || state.subject.trim().length > 0),
    [canProceedToSend, state.selectedContactListId, state.customEmails, state.campaignName, state.subject]
  );

  const goToStep = useCallback((step: CampaignFormState["step"]) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  return { state, dispatch, canProceedToEditor, canProceedToSend, canSend, goToStep };
}
