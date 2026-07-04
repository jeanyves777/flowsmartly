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
    "Place artwork on the product-print mockup open in the Print Studio (t-shirt, hoodie, hi-vis vest, cap, tote, mug, or water bottle) and/or set the garment variant, colour, face and placement. FIRST generate the artwork with generate_image (use a TRANSPARENT PNG for a logo/graphic so it sits cleanly on the product) or use an uploaded/library image URL, THEN call this with that `artworkUrl`. `product`: tee | hoodie | vest | cap | tote | mug | bottle. `face`: front | back. Position it EITHER with a named `placement` zone (left-chest, full-front, full-back, wrap, badge, center, body) OR — to honour where the USER dragged the print box — with an exact `area` {l,t,w,h} in PERCENT of the mockup (l/t = top-left corner, w/h = size). When the user asks you to generate & place at their positioned box, ALWAYS pass that `area`. You can also just set `color` (product hex) or switch `product`/`face` without artwork. Only works while a product mockup is open. Free (the image generation is billed separately).",
  input_schema: {
    type: "object",
    properties: {
      artworkUrl: { type: "string", description: "URL of the artwork/logo image to place (generate it first, or use an uploaded/library URL). Transparent PNG looks best on products." },
      product: { type: "string", enum: ["tee", "hoodie", "vest", "cap", "tote", "mug", "bottle"], description: "Which product to show." },
      face: { type: "string", enum: ["front", "back"], description: "Which side to print on / show." },
      placement: { type: "string", description: "Named placement zone: left-chest, full-front, full-back, wrap, badge, center, body. Ignored if `area` is given." },
      area: {
        type: "object",
        description: "Exact placement rectangle in PERCENT of the mockup box — use this to place the design at the precise coordinates the user positioned. Overrides `placement`.",
        properties: {
          l: { type: "number", description: "Left edge, 0–100 (% from the mockup's left)." },
          t: { type: "number", description: "Top edge, 0–100 (% from the mockup's top)." },
          w: { type: "number", description: "Width, 1–100 (% of the mockup width)." },
          h: { type: "number", description: "Height, 1–100 (% of the mockup height)." },
        },
        required: ["l", "t", "w", "h"],
      },
      color: { type: "string", description: "Product colour as a hex (e.g. #2563eb). Optional." },
    },
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const patch: Record<string, unknown> = {};
    if (typeof input.artworkUrl === "string" && /^https?:\/\//.test(input.artworkUrl)) patch.artworkUrl = input.artworkUrl;
    if (typeof input.product === "string" && ["tee", "hoodie", "vest", "cap", "tote", "mug", "bottle"].includes(input.product)) patch.kind = input.product;
    if (input.face === "front" || input.face === "back") patch.face = input.face;
    if (typeof input.placement === "string") patch.placement = input.placement;
    if (typeof input.color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input.color)) patch.color = input.color;
    const a = input.area as Record<string, unknown> | undefined;
    if (a && typeof a === "object" && ["l", "t", "w", "h"].every((k) => typeof a[k] === "number")) {
      patch.area = { l: a.l as number, t: a.t as number, w: a.w as number, h: a.h as number };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Pass an artworkUrl (generate it first) and/or product/face/placement/area/color to update the mockup." };
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
