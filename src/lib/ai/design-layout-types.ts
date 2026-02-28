/**
 * AI Design Layout Schema
 *
 * Defines the structured JSON that Claude generates to describe
 * a design as individual canvas elements (not a flat image).
 *
 * Coordinates use percentage-based positioning (0-100) so layouts
 * scale to any canvas size. The client converter translates these
 * to absolute pixel values based on the actual canvas dimensions.
 */

export interface AIDesignLayout {
  /** Canvas background configuration */
  background: {
    type: "solid" | "gradient";
    color?: string;
    gradient?: {
      type: "linear" | "radial";
      colorStops: Array<{ offset: number; color: string }>;
      angle?: number;
    };
  };

  /** Ordered list of elements (bottom to top z-order) */
  elements: AILayoutElement[];
}

export type AILayoutElement =
  | AITextElement
  | AIShapeElement
  | AIDividerElement
  | AIImagePlaceholder;

interface AIBaseElement {
  /** Unique element ID */
  id: string;
  /** Position as percentage of canvas (0-100) */
  x: number;
  y: number;
  /** Size as percentage of canvas width (0-100) */
  width: number;
  /** Height as percentage of canvas height (0-100) */
  height?: number;
  /** Element opacity 0.0-1.0 */
  opacity?: number;
  /** Rotation in degrees */
  angle?: number;
}

export interface AITextElement extends AIBaseElement {
  type: "text";
  text: string;
  role:
    | "headline"
    | "subheadline"
    | "body"
    | "cta"
    | "caption"
    | "label"
    | "contact";
  fontSize: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: string;
  fill: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  charSpacing?: number;
  shadow?: string;
  /** Background color behind text (for CTA buttons) */
  backgroundColor?: string;
}

export interface AIShapeElement extends AIBaseElement {
  type: "shape";
  shape: "rect" | "circle" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
  /** For circles: radius as percentage of canvas width */
  radius?: number;
}

export interface AIDividerElement extends AIBaseElement {
  type: "divider";
  stroke?: string;
  strokeWidth?: number;
  dashArray?: number[];
}

export interface AIImagePlaceholder extends AIBaseElement {
  type: "image";
  imageRole: "hero" | "decoration" | "icon" | "logo-placeholder";
  /** Prompt for AI image generation (hero photos, decorative illustrations) */
  imagePrompt?: string;
  /** Whether to generate with transparent background */
  transparent?: boolean;
}
