/**
 * xAI Imagine REST API client for image and video generation.
 *
 * These APIs are separate from the local Grok Build CLI. They require an xAI
 * platform API key via XAI_API_KEY or GROK_CODE_XAI_API_KEY; the extension does
 * not read or reuse private Grok CLI cached tokens from ~/.grok.
 *
 * Evidence: xAI docs for /v1/images/generations and /v1/videos/generations.
 */

const XAI_BASE_URL = "https://api.x.ai";
export const DEFAULT_IMAGE_MODEL = "grok-imagine-image-quality";
export const DEFAULT_VIDEO_MODEL = "grok-imagine-video";

export function getXaiApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.XAI_API_KEY || env.GROK_CODE_XAI_API_KEY;
}

function requireApiKey(): string {
  const key = getXaiApiKey();
  if (!key) {
    throw new Error("xAI API key not found. Set XAI_API_KEY or GROK_CODE_XAI_API_KEY.");
  }
  return key;
}

function jsonHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  return `HTTP ${res.status}: ${text}`;
}

/** Result of an image generation request. */
export interface ImagineImageResult {
  ok: boolean;
  images: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  error?: string;
}

/** Generate images from a text prompt using the documented xAI Imagine image endpoint. */
export async function imagineImage(options: {
  prompt: string;
  model?: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: "1k" | "2k" | string;
  response_format?: "url" | "b64_json";
}): Promise<ImagineImageResult> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: options.model ?? DEFAULT_IMAGE_MODEL,
        prompt: options.prompt,
        ...(options.n !== undefined ? { n: options.n } : {}),
        ...(options.aspect_ratio ? { aspect_ratio: options.aspect_ratio } : {}),
        ...(options.resolution ? { resolution: options.resolution } : {}),
        ...(options.response_format ? { response_format: options.response_format } : {}),
      }),
    });

    if (!res.ok) return { ok: false, images: [], error: await readError(res) };

    const data = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    return { ok: true, images: data.data ?? [] };
  } catch (err: unknown) {
    return { ok: false, images: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export type VideoGenerationStatus = "pending" | "done" | "expired" | "failed" | string;

export interface StartVideoGenerationResult {
  ok: boolean;
  request_id?: string;
  error?: string;
}

export interface PollVideoGenerationResult {
  ok: boolean;
  status?: VideoGenerationStatus;
  video?: { url?: string; duration?: number; respect_moderation?: boolean };
  model?: string;
  error?: string;
}

/** Start text-to-video or image-to-video generation using the documented xAI endpoint. */
export async function startVideoGeneration(options: {
  prompt: string;
  model?: string;
  image?: string;
  duration?: number;
  aspect_ratio?: string;
  resolution?: "480p" | "720p" | string;
}): Promise<StartVideoGenerationResult> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/v1/videos/generations`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: options.model ?? DEFAULT_VIDEO_MODEL,
        prompt: options.prompt,
        ...(options.image ? { image: options.image } : {}),
        ...(options.duration !== undefined ? { duration: options.duration } : {}),
        ...(options.aspect_ratio ? { aspect_ratio: options.aspect_ratio } : {}),
        ...(options.resolution ? { resolution: options.resolution } : {}),
      }),
    });

    if (!res.ok) return { ok: false, error: await readError(res) };

    const data = (await res.json()) as { request_id?: string };
    if (!data.request_id)
      return { ok: false, error: "xAI video response did not include request_id." };
    return { ok: true, request_id: data.request_id };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Poll a video generation request using the documented xAI status endpoint. */
export async function pollVideoGeneration(requestId: string): Promise<PollVideoGenerationResult> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/v1/videos/${encodeURIComponent(requestId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${requireApiKey()}` },
    });

    if (!res.ok) return { ok: false, error: await readError(res) };

    const data = (await res.json()) as {
      status?: VideoGenerationStatus;
      video?: { url?: string; duration?: number; respect_moderation?: boolean };
      model?: string;
      error?: { code?: string; message?: string };
    };

    if (data.status === "failed") {
      return {
        ok: false,
        status: data.status,
        ...(data.model ? { model: data.model } : {}),
        error: data.error?.message ?? data.error?.code ?? "xAI video generation failed.",
      };
    }

    return {
      ok: true,
      ...(data.status ? { status: data.status } : {}),
      ...(data.video ? { video: data.video } : {}),
      ...(data.model ? { model: data.model } : {}),
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Generate a video and optionally poll until completion. */
export async function imagineVideo(options: {
  prompt: string;
  model?: string;
  image?: string;
  duration?: number;
  aspect_ratio?: string;
  resolution?: "480p" | "720p" | string;
  poll?: boolean;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}): Promise<PollVideoGenerationResult & { request_id?: string }> {
  const started = await startVideoGeneration(options);
  if (!started.ok || !started.request_id) {
    return { ok: false, error: started.error ?? "xAI video generation did not start." };
  }

  if (options.poll === false) {
    return { ok: true, status: "pending", request_id: started.request_id };
  }

  const intervalMs = options.pollIntervalMs ?? 5_000;
  const timeoutMs = options.pollTimeoutMs ?? 10 * 60_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const polled = await pollVideoGeneration(started.request_id);
    if (!polled.ok) return { ...polled, request_id: started.request_id };
    if (polled.status === "done" || polled.status === "expired" || polled.status === "failed") {
      return { ...polled, request_id: started.request_id };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    ok: false,
    status: "pending",
    request_id: started.request_id,
    error: `Timed out waiting for xAI video generation after ${timeoutMs}ms.`,
  };
}
