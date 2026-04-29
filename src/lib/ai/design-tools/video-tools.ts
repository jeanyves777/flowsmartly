/**
 * Video-generation primitives for the Video Agent.
 *
 * Currently STUBBED for Google Veo 3.1 — see TODO. The real call needs
 * Vertex AI Model Garden access on the user's Google Cloud project
 * (gen-lang-client-0438435525). When credentials are confirmed:
 *   - Switch from the placeholder fetch to the official @google-cloud/aiplatform
 *     PredictionServiceClient OR REST endpoint:
 *     https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/veo-3.1-generate-001:predict
 *   - Auth: ADC via GOOGLE_APPLICATION_CREDENTIALS, service-account JSON,
 *     or `gcloud auth application-default login`.
 *
 * Until then, this returns a clearly-marked "stub" video URL so the
 * agent loop can be exercised end-to-end without burning real Veo
 * credits.
 */

export interface VeoGenerateInput {
  /** Prompt describing the video. */
  prompt: string;
  /** "16:9" | "9:16" | "1:1". */
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** Duration in seconds. Veo 3.1 supports ~5-8s clips. */
  durationSeconds: number;
  /** Optional reference image (data URL or HTTP URL) to animate from. */
  referenceImageUrl?: string;
  /** Optional negative prompt — what to avoid. */
  negativePrompt?: string;
}

export interface VeoGenerateResult {
  /** Final mp4 URL (or a stub placeholder during scaffolding). */
  videoUrl: string;
  /** Veo's job id — useful for polling and lineage. */
  jobId: string;
  /** "stub" while we're not actually calling Veo; "veo-3.1" once wired. */
  model: string;
  /** Duration of the produced clip in seconds. */
  durationSeconds: number;
}

const VEO_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0438435525";
const VEO_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const VEO_MODEL = "veo-3.1-generate-001";
const VEO_ENABLED = process.env.VEO_ENABLED === "true";

/**
 * Generate a video via Google Veo 3.1.
 *
 * STUB until VEO_ENABLED=true. When enabled, expects:
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON,
 *     OR ADC working via the runtime environment.
 *   - The service account having Vertex AI User role on the project.
 *
 * The Veo API is async — submit a long-running operation, poll until
 * `done`. This helper handles both submit + poll inside one call so
 * the agent sees a synchronous-looking result.
 */
export async function generateVideoVeo(input: VeoGenerateInput): Promise<VeoGenerateResult> {
  if (!VEO_ENABLED) {
    // Stub: pretend we generated a video. Useful while scaffolding the
    // agent and for unit tests that shouldn't burn real credits.
    return {
      videoUrl: `https://stub.flowsmartly.local/veo-stub-${Date.now()}.mp4`,
      jobId: `stub-${Date.now()}`,
      model: "stub",
      durationSeconds: input.durationSeconds,
    };
  }

  // TODO(veo-3.1 wiring): implement when GOOGLE_APPLICATION_CREDENTIALS
  // is confirmed in this environment. The Vertex AI REST endpoint shape
  // for veo-3.1-generate-001 is:
  //
  //   POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/veo-3.1-generate-001:predictLongRunning
  //   Headers:
  //     Authorization: Bearer {access_token}
  //     Content-Type: application/json
  //   Body:
  //     { "instances": [{ "prompt": "...", "image": { "bytesBase64Encoded": "..." } }],
  //       "parameters": { "aspectRatio": "16:9", "durationSeconds": 8, "negativePrompt": "...",
  //                       "sampleCount": 1, "personGeneration": "allow_adult" } }
  //
  // Then poll the returned operation:
  //   GET https://{LOCATION}-aiplatform.googleapis.com/v1/{operation.name}
  // until { done: true, response: { videos: [{ gcsUri | bytesBase64Encoded }] } }.
  //
  // Acquire a short-lived access token via google-auth-library:
  //   import { GoogleAuth } from "google-auth-library";
  //   const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  //   const client = await auth.getClient();
  //   const { token } = await client.getAccessToken();
  //
  // For now, throw a clear error so the agent can route around it.
  throw new Error(
    `Veo 3.1 is not yet wired in this environment. Set VEO_ENABLED=true and ensure GOOGLE_APPLICATION_CREDENTIALS points at a service account with Vertex AI User on project ${VEO_PROJECT} in ${VEO_LOCATION}.`,
  );
}
