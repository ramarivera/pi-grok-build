import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createGrokBuildExtension,
  type GrokBuildOptions,
} from "./extension.ts";

export type { GrokBuildOptions };
export { createGrokBuildExtension };

export { streamViaGrok, buildGrokPrompt } from "./provider.ts";
export { spawnGrok, runGrokCommand, runGrokInspect, validateGrokPresence, validateGrokAuth, getGrokVersion } from "./grok-runner.ts";
export { createGrokEventBridge } from "./grok-bridge.ts";
export { parseGrokLine, isStreamEvent, isResultEvent, isSystemEvent } from "./grok-parser.ts";
export type { GrokNdjsonMessage, GrokStreamEvent, GrokResultEvent, GrokSystemEvent, GrokRunResult, TrackedBlock, TrackedContentBlock, TrackedToolBlock, GrokSpawnOptions } from "./types.ts";

export default function piGrokBuildExtension(pi: ExtensionAPI): void {
  createGrokBuildExtension().register(pi);
}
