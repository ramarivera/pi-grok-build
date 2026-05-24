import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createGrokBuildExtension,
  type GrokBuildOptions,
} from "./extension.ts";

export type { GrokBuildOptions };
export { createGrokBuildExtension };

export { streamViaGrok, buildGrokPrompt, contextHasImages, buildSpawnOptions } from "./provider.ts";
export {
  spawnGrok,
  runGrokCommand,
  runGrokInspect,
  runGrokModels,
  runGrokSessions,
  runGrokMemory,
  runGrokShare,
  runGrokTrace,
  validateGrokPresence,
  validateGrokAuth,
  getGrokVersion,
  detectGrokBinary,
  buildGrokArgs,
  registerProcess,
  forceKillProcess,
  killAllProcesses,
  captureStderr,
  parseGrokModelsOutput,
} from "./grok-runner.ts";
export { createGrokEventBridge } from "./grok-bridge.ts";
export {
  GrokCliError,
  classifyGrokFailure,
  createDiagnostics,
  formatGrokFailure,
  redactGrokArgs,
} from "./diagnostics.ts";
export type { GrokDiagnosticLevel, GrokFailureDiagnostic, GrokFailureKind } from "./diagnostics.ts";
export {
  parseGrokLine,
  isStreamEvent,
  isResultEvent,
  isSystemEvent,
  isErrorEvent,
  isTextEvent,
  isThoughtEvent,
  isEndEvent,
} from "./grok-parser.ts";
export {
  imagineImage,
  imagineVideo,
  textToSpeech,
  speechToText,
} from "./xai-api.ts";
export type {
  ImagineImageResult,
  ImagineVideoResult,
  TtsResult,
  SttResult,
} from "./xai-api.ts";
export type {
  GrokNdjsonMessage,
  GrokStreamEvent,
  GrokResultEvent,
  GrokSystemEvent,
  GrokErrorEvent,
  GrokTextEvent,
  GrokThoughtEvent,
  GrokEndEvent,
  GrokRunResult,
  TrackedBlock,
  TrackedContentBlock,
  TrackedToolBlock,
  GrokSpawnOptions,
  GrokEffortLevel,
  GrokPermissionMode,
  GrokReasoningEffort,
  GrokModelDescriptor,
  GrokSessionDescriptor,
} from "./types.ts";

export default function piGrokBuildExtension(pi: ExtensionAPI): void {
  createGrokBuildExtension().register(pi);
}
