/**
 * xAI REST API client for Imagine and Voice capabilities.
 *
 * These APIs are separate from the Grok Build CLI and use the
 * xAI platform endpoints (api.x.ai). They require an API key
 * via GROK_CODE_XAI_API_KEY or XAI_API_KEY.
 */

import { readFileSync } from "node:fs";

const XAI_BASE_URL = "https://api.x.ai";

function getApiKey(): string | undefined {
  return process.env.GROK_CODE_XAI_API_KEY || process.env.XAI_API_KEY;
}

function apiHeaders(): Record<string, string> {
  const key = getApiKey();
  if (!key) {
    throw new Error("xAI API key not found. Set GROK_CODE_XAI_API_KEY or XAI_API_KEY.");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** Result of an image generation request. */
export interface ImagineImageResult {
  ok: boolean;
  images: Array<{ url: string; revised_prompt?: string }>;
  error?: string;
}

/** Generate images from a text prompt. */
export async function imagineImage(options: {
  prompt: string;
  model?: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: string;
}): Promise<ImagineImageResult> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        prompt: options.prompt,
        model: options.model ?? "grok-2-image",
        n: options.n ?? 1,
        ...(options.aspect_ratio ? { aspect_ratio: options.aspect_ratio } : {}),
        ...(options.resolution ? { resolution: options.resolution } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, images: [], error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as {
      data?: Array<{ url: string; revised_prompt?: string }>;
    };
    return { ok: true, images: data.data ?? [] };
  } catch (err: unknown) {
    return {
      ok: false,
      images: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Result of a video generation request. */
export interface ImagineVideoResult {
  ok: boolean;
  url?: string | undefined;
  request_id?: string | undefined;
  error?: string;
}

/** Generate video from text or image. */
export async function imagineVideo(options: {
  prompt: string;
  model?: string;
  image_url?: string;
  duration?: number;
  aspect_ratio?: string;
  resolution?: string;
}): Promise<ImagineVideoResult> {
  try {
    const body: Record<string, unknown> = {
      prompt: options.prompt,
      model: options.model ?? "grok-2-video",
      ...(options.duration ? { duration: options.duration } : {}),
      ...(options.aspect_ratio ? { aspect_ratio: options.aspect_ratio } : {}),
      ...(options.resolution ? { resolution: options.resolution } : {}),
    };
    if (options.image_url) {
      body.image_url = options.image_url;
    }

    const res = await fetch(`${XAI_BASE_URL}/v1/video-generations`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as {
      url?: string;
      request_id?: string;
    };
    return { ok: true, url: data.url ?? undefined, request_id: data.request_id ?? undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Result of a text-to-speech request. */
export interface TtsResult {
  ok: boolean;
  audioBase64?: string;
  error?: string;
}

/** Convert text to speech. */
export async function textToSpeech(options: {
  text: string;
  voice_id?: string;
  language?: string;
  format?: string;
}): Promise<TtsResult> {
  try {
    const res = await fetch(`${XAI_BASE_URL}/v1/tts`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        text: options.text,
        voice_id: options.voice_id ?? "eve",
        language: options.language ?? "en",
        ...(options.format ? { format: options.format } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const buffer = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buffer).toString("base64");
    return { ok: true, audioBase64 };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Result of a speech-to-text request. */
export interface SttResult {
  ok: boolean;
  text?: string | undefined;
  error?: string;
}

/** Transcribe audio to text. Accepts a file path or base64 data. */
export async function speechToText(options: {
  filePath?: string;
  base64Data?: string;
  mimeType?: string;
}): Promise<SttResult> {
  try {
    let body: Buffer;
    let contentType: string;

    if (options.filePath) {
      body = readFileSync(options.filePath);
      contentType = options.mimeType ?? "audio/mpeg";
    } else if (options.base64Data) {
      body = Buffer.from(options.base64Data, "base64");
      contentType = options.mimeType ?? "audio/mpeg";
    } else {
      return { ok: false, error: "Provide filePath or base64Data" };
    }

    const key = getApiKey();
    if (!key) {
      throw new Error("xAI API key not found. Set GROK_CODE_XAI_API_KEY or XAI_API_KEY.");
    }

    const res = await fetch(`${XAI_BASE_URL}/v1/stt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { text?: string };
    return { ok: true, text: data.text ?? undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
