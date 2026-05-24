import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imagineImage, imagineVideo } from "../../../src/xai-api.ts";

const hasApiKey = Boolean(process.env.XAI_API_KEY || process.env.GROK_CODE_XAI_API_KEY);
const runMediaE2e = process.env.PI_GROK_BUILD_RUN_MEDIA_E2E === "1" && hasApiKey;
const mediaDescribe = runMediaE2e ? describe : describe.skip;

mediaDescribe("pi-grok-build manual xAI media e2e", () => {
  it("generates an image through the documented xAI Images endpoint", async () => {
    const result = await imagineImage({
      prompt: "A tiny neon pixel-art robot holding a sign that says PI_GROK_OK",
      n: 1,
      response_format: "url",
    });

    assert.equal(result.ok, true, result.error);
    assert.ok(result.images.length > 0, JSON.stringify(result));
    assert.ok(
      result.images.some((image) => image.url || image.b64_json),
      JSON.stringify(result),
    );
  });

  it("starts a video generation request through the documented xAI Videos endpoint", async () => {
    const result = await imagineVideo({
      prompt: "A three-second pixel-art robot waving hello",
      duration: 3,
      resolution: "480p",
      poll: false,
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(result.status, "pending");
    assert.ok(result.request_id, JSON.stringify(result));
  });
});
