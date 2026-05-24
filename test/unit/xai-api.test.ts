import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imagineImage, imagineVideo, speechToText, textToSpeech } from "../../src/xai-api.ts";

describe("xai-api client exports", () => {
  it("exports all four API functions", () => {
    assert.equal(typeof imagineImage, "function");
    assert.equal(typeof imagineVideo, "function");
    assert.equal(typeof textToSpeech, "function");
    assert.equal(typeof speechToText, "function");
  });
});

describe("speechToText validation", () => {
  it("returns error when neither filePath nor base64Data is provided", async () => {
    const result = await speechToText({});
    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("filePath") || result.error?.includes("base64Data"));
  });
});

describe("textToSpeech validation", () => {
  it("returns error when API key is missing", async () => {
    const originalKey = process.env.GROK_CODE_XAI_API_KEY;
    const originalXai = process.env.XAI_API_KEY;
    delete process.env.GROK_CODE_XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    const result = await textToSpeech({ text: "hello" });

    if (originalKey) process.env.GROK_CODE_XAI_API_KEY = originalKey;
    if (originalXai) process.env.XAI_API_KEY = originalXai;

    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("API key"));
  });
});

describe("imagineImage validation", () => {
  it("returns error when API key is missing", async () => {
    const originalKey = process.env.GROK_CODE_XAI_API_KEY;
    const originalXai = process.env.XAI_API_KEY;
    delete process.env.GROK_CODE_XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    const result = await imagineImage({ prompt: "a cat" });

    if (originalKey) process.env.GROK_CODE_XAI_API_KEY = originalKey;
    if (originalXai) process.env.XAI_API_KEY = originalXai;

    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("API key"));
  });
});

describe("imagineVideo validation", () => {
  it("returns error when API key is missing", async () => {
    const originalKey = process.env.GROK_CODE_XAI_API_KEY;
    const originalXai = process.env.XAI_API_KEY;
    delete process.env.GROK_CODE_XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    const result = await imagineVideo({ prompt: "a dog running" });

    if (originalKey) process.env.GROK_CODE_XAI_API_KEY = originalKey;
    if (originalXai) process.env.XAI_API_KEY = originalXai;

    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("API key"));
  });
});
