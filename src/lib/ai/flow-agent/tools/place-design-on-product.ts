import type { FlowAgentTool } from "../registry";

/**
 * place_design_on_product — place artwork onto the product-print mockup open in
 * the Print Studio (t-shirt, hi-vis vest, mug, tote), and/or set the garment
 * variant, colour, face and placement zone. It emits a `canvas_update` carrying
 * a `__product` marker the client routes to the mockup's controls.
 *
 * The artwork itself is generated/uploaded SEPARATELY — generate it first with
 * `generate_image` (a transparent PNG for logos/graphics) or use an uploaded /
 * library image URL, then call this with that `artworkUrl` to drop it in the
 * print area. Only exposed when the Print Studio is open (gated in agent-loop),
 * free + non-mutating — an instant UI placement (the image gen was already
 * billed). [[agent-operates-account-full-crud]]
 */
export const placeDesignOnProduct: FlowAgentTool = {
  name: "place_design_on_product",
  description:
    "Place artwork on the product-print mockup open in the Print Studio (t-shirt, hi-vis vest, mug, or tote) and/or set the garment variant, colour, face and placement. FIRST generate the artwork with generate_image (use a TRANSPARENT PNG for a logo/graphic so it sits cleanly on the garment) or use an uploaded/library image URL, THEN call this with that `artworkUrl`. `product`: tee | vest | mug | tote. `face`: front | back. `placement`: a zone like left-chest, full-front, full-back, wrap, badge, center. You can also just set `color` (garment hex) or switch `product`/`face` without artwork. Only works while a product mockup is open. Free (the image generation is billed separately).",
  input_schema: {
    type: "object",
    properties: {
      artworkUrl: { type: "string", description: "URL of the artwork/logo image to place (generate it first, or use an uploaded/library URL). Transparent PNG looks best on garments." },
      product: { type: "string", enum: ["tee", "vest", "mug", "tote"], description: "Which product to show." },
      face: { type: "string", enum: ["front", "back"], description: "Which side to print on / show." },
      placement: { type: "string", description: "Placement zone: left-chest, full-front, full-back, wrap, badge, or center." },
      color: { type: "string", description: "Garment colour as a hex (e.g. #2563eb). Optional." },
    },
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const patch: Record<string, unknown> = {};
    if (typeof input.artworkUrl === "string" && /^https?:\/\//.test(input.artworkUrl)) patch.artworkUrl = input.artworkUrl;
    if (typeof input.product === "string" && ["tee", "vest", "mug", "tote"].includes(input.product)) patch.kind = input.product;
    if (input.face === "front" || input.face === "back") patch.face = input.face;
    if (typeof input.placement === "string") patch.placement = input.placement;
    if (typeof input.color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input.color)) patch.color = input.color;

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Pass an artworkUrl (generate it first) and/or product/face/placement/color to update the mockup." };
    }
    ctx.emit({ type: "canvas_update", patch: { __product: patch } });
    return {
      ok: true,
      data: {
        applied: Object.keys(patch),
        userMessage:
          (patch.artworkUrl ? "Placed the artwork on the product mockup. " : "Updated the product mockup. ") +
          "If the user wants it on the other side too, generate that artwork and place it with face set accordingly. Confirm what you set up in ONE short sentence.",
      },
    };
  },
};
