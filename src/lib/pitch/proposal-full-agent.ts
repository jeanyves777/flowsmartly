import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import type { ProposalCustomSection, ServiceProposalContent } from "./proposal-agent";

type FullProposalSectionResponse = {
  sections?: Array<{
    title?: string;
    body?: string;
    bullets?: string[];
  }>;
};

function cleanText(value: unknown, max = 1400): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanBullets(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 220)).filter(Boolean).slice(0, 8)
    : [];
}

function parseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) as T : JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeSections(value: unknown): ProposalCustomSection[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray((value as FullProposalSectionResponse | null)?.sections)
      ? (value as FullProposalSectionResponse).sections || []
      : [];

  return source
    .map((section) => ({
      title: cleanText((section as { title?: unknown }).title, 90),
      body: cleanText((section as { body?: unknown }).body, 1500),
      bullets: cleanBullets((section as { bullets?: unknown }).bullets),
    }))
    .filter((section) => section.title && (section.body || section.bullets.length))
    .slice(0, 12);
}

function fallbackSections(proposal: ServiceProposalContent): ProposalCustomSection[] {
  const services = [
    ...(proposal.servicePackages || []),
    proposal.serviceTitle,
    ...(proposal.customAdditions || []),
  ].filter(Boolean);
  const proof = proposal.proofPoints
    .map((point) => `${point.metric} ${point.label}: ${point.note}`)
    .filter(Boolean);

  return [
    {
      title: "Current Opportunity",
      body: proposal.clientNeed || proposal.executiveSummary,
      bullets: proof.slice(0, 4),
    },
    {
      title: "Recommended Strategy",
      body: `The proposal combines ${services.join(", ") || "the selected services"} into one practical growth plan for ${proposal.preparedFor}.`,
      bullets: proposal.benefits.slice(0, 6),
    },
    {
      title: "Detailed Scope of Work",
      body: "The work is structured around clear deliverables, implementation checkpoints, and measurable client-facing improvements.",
      bullets: proposal.deliverables.map((item) => `${item.title}: ${item.description}`).slice(0, 8),
    },
    {
      title: "Measurement and Reporting",
      body: "Progress should be evaluated through visible business signals, not vague activity. Reporting keeps the work accountable and gives the client a practical view of what is improving.",
      bullets: proposal.proofPoints.map((point) => `${point.label}: ${point.note}`).slice(0, 6),
    },
    {
      title: "Launch Responsibilities",
      body: "A smooth launch depends on clear access, approvals, and timely feedback from both sides.",
      bullets: proposal.terms.slice(0, 6),
    },
    {
      title: "Why This Offer Fits",
      body: `This plan is built around the way ${proposal.preparedFor} is already evaluated by prospects: visible credibility, clear service positioning, and an easy next step. The selected scope keeps the work focused on improvements a customer can actually notice before they decide to call, visit, or inquire.`,
      bullets: proposal.benefits.slice(0, 6),
    },
    {
      title: "Success Criteria",
      body: "The work should be judged by practical movement in trust, visibility, engagement, and lead quality. Each reporting cycle should show what changed, what the client can verify, and which next improvements will make the strongest difference.",
      bullets: [
        ...proposal.proofPoints.map((point) => `${point.label}: ${point.note}`),
        ...proposal.timeline.map((step) => `${step.label}: ${step.title}`),
      ].slice(0, 6),
    },
    {
      title: "Decision Path",
      body: "The next step is to confirm the offer, complete onboarding, and move into implementation with a clear timeline.",
      bullets: proposal.nextSteps.slice(0, 6),
    },
  ].filter((section) => section.body || section.bullets.length);
}

export function hasFullProposalSections(proposal: ServiceProposalContent): boolean {
  if (proposal.fullProposalReady) return true;
  const sections = proposal.customSections || [];
  const substantialSections = sections.filter((section) =>
    cleanText(section.title) && (cleanText(section.body, 80).length >= 60 || (section.bullets || []).length >= 3),
  );
  return substantialSections.length >= 8;
}

export async function ensureFullProposalSections(proposal: ServiceProposalContent): Promise<ServiceProposalContent> {
  if (hasFullProposalSections(proposal)) {
    return {
      ...proposal,
      fullProposalReady: true,
      fullProposalGeneratedAt: proposal.fullProposalGeneratedAt || new Date().toISOString(),
    };
  }

  try {
    const response = await ai.generate(
      `Expand this service proposal into a complete client-ready proposal body.

Return ONLY JSON in this exact shape:
{"sections":[{"title":"...","body":"2-4 client-facing paragraphs","bullets":["3-6 specific bullets"]}]}

Rules:
- Generate 8-12 substantial sections.
- Do not repeat the cover, pricing, or contact page.
- Every section must speak to the client using "you" and "your".
- Use the selected services, custom additions, Google/local profile facts, proof points, terms, and timeline.
- Turn findings into closing arguments: what the fact means, why it matters, and what the work improves.
- Include service-specific scope and implementation details for every selected service or custom addition.
- No placeholders, no meta copy, no "this section", no "proposal builder", no internal instructions.
- Keep claims realistic; do not guarantee exact rankings, revenue, or outcomes.

Proposal JSON:
${JSON.stringify({
        preparedFor: proposal.preparedFor,
        preparedBy: proposal.preparedBy,
        preset: proposal.preset,
        proposalTypes: proposal.proposalTypes,
        servicePackages: proposal.servicePackages,
        customAdditions: proposal.customAdditions,
        serviceTitle: proposal.serviceTitle,
        executiveSummary: proposal.executiveSummary,
        aboutBrand: proposal.aboutBrand,
        clientNeed: proposal.clientNeed,
        commitments: proposal.commitments,
        benefits: proposal.benefits,
        deliverables: proposal.deliverables,
        timeline: proposal.timeline,
        proofPoints: proposal.proofPoints,
        pricing: proposal.pricing,
        terms: proposal.terms,
        nextSteps: proposal.nextSteps,
        clientProfile: proposal.clientProfile,
      }, null, 2)}`,
      {
        model: HAIKU_MODEL,
        maxTokens: 7000,
        temperature: 0.45,
        systemPrompt: "You write complete sales proposals for small businesses. Return strict JSON only.",
      },
    );
    const parsed = parseJson<FullProposalSectionResponse>(response);
    const generated = normalizeSections(parsed);
    if (generated.length >= 8) {
      return {
        ...proposal,
        customSections: generated,
        fullProposalReady: true,
        fullProposalGeneratedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn("[ProposalFullAgent] Expansion failed, using structured fallback:", error);
  }

  return {
    ...proposal,
    customSections: [...fallbackSections(proposal), ...(proposal.customSections || [])].slice(0, 12),
    fullProposalReady: true,
    fullProposalGeneratedAt: new Date().toISOString(),
  };
}
