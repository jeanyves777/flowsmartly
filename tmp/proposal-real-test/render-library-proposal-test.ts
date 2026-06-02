import "dotenv/config";
import { readFile, writeFile, mkdir } from "fs/promises";
import sharp from "sharp";
import { attachProposalLibraryVisuals } from "../../src/lib/pitch/proposal-asset-library";
import { runServiceProposalDeckAgent } from "../../src/lib/pitch/proposal-deck-agent";
import { generateServiceProposalPDF } from "../../src/lib/pitch/pdf-generator";
import type { ServiceProposalContent, ServiceProposalInput } from "../../src/lib/pitch/proposal-agent";

async function main() {
  const raw = await readFile("tmp/proposal-real-test/proposal-content-v2-1779153858358.json", "utf8");
  const proposal = JSON.parse(raw) as ServiceProposalContent;
  let withAssets = await attachProposalLibraryVisuals({
    proposal,
    preset: proposal.preset,
    serviceTitle: proposal.serviceTitle,
    targetName: proposal.preparedFor,
    brandKit: {
      industry: "SaaS / Technology",
      niche: "Local business growth",
      targetAudience: "local business owners",
    },
  });

  const request: ServiceProposalInput = {
    userId: "real-test",
    targetName: proposal.preparedFor,
    preset: proposal.preset,
    serviceTitle: proposal.serviceTitle,
    serviceDescription: proposal.executiveSummary,
    price: proposal.pricing.amount,
    originalPrice: proposal.pricing.originalAmount,
    billingInterval: proposal.pricing.interval,
    terms: proposal.terms.join("; "),
  };
  const deck = await runServiceProposalDeckAgent({
    proposal: withAssets,
    request,
    brandKit: withAssets.brandSnapshot,
  });
  withAssets = { ...withAssets, deckPlan: deck.plan };

  const logo = await readFile("public/logo.png");
  const logoMeta = await sharp(logo).metadata();
  const pdf = await generateServiceProposalPDF(withAssets, {
    name: "FlowSmartly",
    primaryColor: "#0ea5e9",
    secondaryColor: "#8b5cf6",
    accentColor: "#ef4444",
    logo: `data:image/png;base64,${logo.toString("base64")}`,
    logoAspectRatio: (logoMeta.width || 1) / (logoMeta.height || 1),
  });

  await mkdir("tmp/proposal-real-test/library-rendered", { recursive: true });
  await writeFile("tmp/proposal-real-test/abc-dental-flow-proposal-library.pdf", pdf);
  await writeFile(
    "tmp/proposal-real-test/proposal-content-library.json",
    JSON.stringify(withAssets, null, 2),
  );

  console.log("PDF", pdf.length);
  console.log(withAssets.visualAssets?.images.map((image) => ({
    kind: image.kind,
    url: image.url,
    provider: image.provider,
    model: image.model,
  })));
  console.log("Deck model", deck.plan.generatedBy, deck.usage, deck.toolsUsed);
  console.log(deck.plan.slides.map((slide) => ({
    role: slide.role,
    headline: slide.headline,
    visuals: slide.visuals?.map((visual) => visual.id),
  })));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
