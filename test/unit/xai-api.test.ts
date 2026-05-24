import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  getXaiApiKey,
  imagineImage,
  imagineVideo,
  pollVideoGeneration,
  startVideoGeneration,
} from "../../src/xai-api.ts";

const originalFetch = globalThis.fetch;
const originalXaiKey = process.env.XAI_API_KEY;
const originalGrokCodeKey = process.env.GROK_CODE_XAI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalXaiKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = originalXaiKey;
  if (originalGrokCodeKey === undefined) delete process.env.GROK_CODE_XAI_API_KEY;
  else process.env.GROK_CODE_XAI_API_KEY = originalGrokCodeKey;
});

function installJsonFetch(handler: (url: string, init: RequestInit | undefined) => unknown): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const value = handler(String(input), init);
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("xAI API key resolution", () => {
  it("prefers XAI_API_KEY and supports GROK_CODE_XAI_API_KEY", () => {
    assert.equal(
      getXaiApiKey({ XAI_API_KEY: "xai", GROK_CODE_XAI_API_KEY: "grok-code" } as any),
      "xai",
    );
    assert.equal(getXaiApiKey({ GROK_CODE_XAI_API_KEY: "grok-code" } as any), "grok-code");
  });
});

describe("imagineImage", () => {
  it("returns error when API key is missing", async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_CODE_XAI_API_KEY;

    const result = await imagineImage({ prompt: "a cat" });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /xAI API key not found/);
  });

  it("uses the documented image endpoint and default model", async () => {
    process.env.XAI_API_KEY = "test-key";
    let capturedBody: Record<string, unknown> | undefined;
    installJsonFetch((url, init) => {
      assert.equal(url, "https://api.x.ai/v1/images/generations");
      capturedBody = JSON.parse(String(init?.body));
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      return { data: [{ url: "https://example.com/image.png" }] };
    });

    const result = await imagineImage({ prompt: "a neon cat", aspect_ratio: "1:1" });

    assert.equal(result.ok, true);
    assert.equal(capturedBody?.model, DEFAULT_IMAGE_MODEL);
    assert.equal(capturedBody?.prompt, "a neon cat");
    assert.equal(capturedBody?.aspect_ratio, "1:1");
    assert.deepEqual(result.images, [{ url: "https://example.com/image.png" }]);
  });
});

describe("xAI video generation", () => {
  it("starts video generation using the documented endpoint and default model", async () => {
    process.env.XAI_API_KEY = "test-key";
    let capturedBody: Record<string, unknown> | undefined;
    installJsonFetch((url, init) => {
      assert.equal(url, "https://api.x.ai/v1/videos/generations");
      capturedBody = JSON.parse(String(init?.body));
      return { request_id: "vid-123" };
    });

    const result = await startVideoGeneration({ prompt: "a dog running", duration: 5 });

    assert.equal(result.ok, true);
    assert.equal(result.request_id, "vid-123");
    assert.equal(capturedBody?.model, DEFAULT_VIDEO_MODEL);
    assert.equal(capturedBody?.duration, 5);
  });

  it("polls video status using the documented request endpoint", async () => {
    process.env.XAI_API_KEY = "test-key";
    installJsonFetch((url, init) => {
      assert.equal(url, "https://api.x.ai/v1/videos/vid-123");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      return { status: "done", video: { url: "https://example.com/video.mp4", duration: 5 } };
    });

    const result = await pollVideoGeneration("vid-123");

    assert.equal(result.ok, true);
    assert.equal(result.status, "done");
    assert.equal(result.video?.url, "https://example.com/video.mp4");
  });

  it("can return request_id without polling", async () => {
    process.env.XAI_API_KEY = "test-key";
    installJsonFetch(() => ({ request_id: "vid-123" }));

    const result = await imagineVideo({ prompt: "a bird", poll: false });

    assert.equal(result.ok, true);
    assert.equal(result.status, "pending");
    assert.equal(result.request_id, "vid-123");
  });
});
