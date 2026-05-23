import type { ServiceProposalContent } from "./proposal-agent";

function clean(value: unknown, max = 300) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function clientProofHeadline(proposal: ServiceProposalContent): string {
  const fromProof = proposal.proofPoints?.find((p) => clean(p.label))?.label;
  if (fromProof) return clean(fromProof, 80);
  return "Findings & Evidence";
}

export function clientProofBody(proposal: ServiceProposalContent): string {
  const fromExec = clean(proposal.executiveSummary, 280);
  if (fromExec) return fromExec;
  const fromNote = proposal.proofPoints?.find((p) => clean(p.note))?.note;
  if (fromNote) return clean(fromNote, 280);
  return "";
}

export function isInternalProofCopy(value: unknown): boolean {
  return /raw context|this section|proof points?|the client can see|proposal builder/i.test(clean(value, 300));
}
