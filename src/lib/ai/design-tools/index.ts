/**
 * Shared design-tool primitives for engine agents.
 *
 * Each engine agent (flat-image, editable-design, video) imports the
 * subset it needs, builds AgentTool definitions wrapping these
 * functions with a curated input schema, and runs its own loop.
 *
 * Re-export everything here so engines have one import path.
 */

export { ImageStore } from "./image-store";
export type { StoredImage } from "./image-store";

export {
  resolveToBuffer,
  generateImage,
  editImage,
  removeImageBackground,
  compositeImages,
  colorGrade,
  addDropShadow,
  rotateImage,
  cropImage,
  addPolaroidFrame,
  generateQrCode,
  loadBrandLogo,
  addDecorativeShape,
  composeDesign,
} from "./image-tools";

export { critiqueDesign } from "./critique-tool";
export type { CritiqueResult } from "./critique-tool";

export { getClaudeCodeBinaryPath } from "./sdk-binary-path";
