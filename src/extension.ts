/**
 * Grok Build extension for Pi Coding Agent.
 *
 * Provides:
 * 1. LLM Provider — routes inference through Grok Build CLI
 * 2. Tools — grok_inspect, grok_run, grok_models, grok_sessions, grok_share, grok_memory
 * 3. Command — /grok for CLI status, inspection, models, sessions, and more
 */

import { Type } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import {
  validateGrokAuth,
  getGrokVersion,
  runGrokInspect,
  runGrokCommand,
  runGrokModels,
  runGrokSessions,
  runGrokMemory,
  runGrokShare,
  killAllProcesses,
  parseGrokModelsOutput,
} from "./grok-runner.ts";
import type { GrokModelDescriptor, GrokRunResult } from "./types.ts";
import { createDiagnostics, formatGrokFailure, classifyGrokFailure } from "./diagnostics.ts";
import { streamViaGrok } from "./provider.ts";
import {
  GROK_BUILD_PROVIDER_ID,
  GROK_JSONL_INTEGRATION_MODE,
  buildGrokProviderModels,
  fallbackGrokBuildModel,
} from "./model-metadata.ts";
import { imagineImage, imagineVideo, textToSpeech, speechToText } from "./xai-api.ts";

// Kill all active Grok subprocesses on exit to prevent orphans
process.on("exit", killAllProcesses);

const PROVIDER_ID = GROK_BUILD_PROVIDER_ID;
const diagnostics = createDiagnostics("extension");

const EMPTY_SCHEMA = Type.Object({}, { additionalProperties: false });

const RUN_SCHEMA = Type.Object(
  {
    args: Type.Array(Type.String(), { description: "Arguments to pass to grok" }),
    timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds" })),
    cwd: Type.Optional(Type.String({ description: "Working directory" })),
  },
  { additionalProperties: false },
);

const SESSION_SCHEMA = Type.Object(
  {
    action: Type.String({ description: "Action: list, restore, or share a session" }),
    sessionId: Type.Optional(Type.String({ description: "Session ID for restore/share" })),
  },
  { additionalProperties: false },
);

const IMAGINE_IMAGE_SCHEMA = Type.Object(
  {
    prompt: Type.String({ description: "Text prompt describing the image to generate" }),
    model: Type.Optional(Type.String({ description: "Model ID, e.g. grok-2-image" })),
    n: Type.Optional(Type.Number({ description: "Number of images (1-10)" })),
    aspect_ratio: Type.Optional(Type.String({ description: "Aspect ratio, e.g. 16:9" })),
    resolution: Type.Optional(Type.String({ description: "Resolution, e.g. 1024x1024" })),
  },
  { additionalProperties: false },
);

const IMAGINE_VIDEO_SCHEMA = Type.Object(
  {
    prompt: Type.String({ description: "Text prompt describing the video to generate" }),
    model: Type.Optional(Type.String({ description: "Model ID, e.g. grok-2-video" })),
    image_url: Type.Optional(Type.String({ description: "Optional source image URL or base64 data URI" })),
    duration: Type.Optional(Type.Number({ description: "Duration in seconds (up to 15)" })),
    aspect_ratio: Type.Optional(Type.String({ description: "Aspect ratio, e.g. 16:9" })),
    resolution: Type.Optional(Type.String({ description: "Resolution, e.g. 720p" })),
  },
  { additionalProperties: false },
);

const TTS_SCHEMA = Type.Object(
  {
    text: Type.String({ description: "Text to convert to speech" }),
    voice_id: Type.Optional(Type.String({ description: "Voice: eve, ara, rex, sal, leo" })),
    language: Type.Optional(Type.String({ description: "Language code, e.g. en" })),
    format: Type.Optional(Type.String({ description: "Output format, e.g. mp3" })),
  },
  { additionalProperties: false },
);

const STT_SCHEMA = Type.Object(
  {
    filePath: Type.Optional(Type.String({ description: "Path to audio file" })),
    base64Data: Type.Optional(Type.String({ description: "Base64-encoded audio data" })),
    mimeType: Type.Optional(Type.String({ description: "MIME type of audio, e.g. audio/mpeg" })),
  },
  { additionalProperties: false },
);

export interface GrokBuildOptions {
  commandName?: string;
  toolNamePrefix?: string;
}

export function createGrokBuildExtension(options: GrokBuildOptions = {}) {
  const commandName = options.commandName ?? "grok";
  const toolNamePrefix = options.toolNamePrefix ?? "";

  return {
    register(pi: ExtensionAPI): void {
      try {
        const authed = validateGrokAuth();
        if (!authed) {
          diagnostics.warn("grok cli is unavailable or unauthenticated at extension registration");
        }

        // --- Provider Registration ---
        // This provider routes through the local Grok CLI, so only advertise model IDs
        // the CLI itself accepts. Pi's xAI model catalog may contain API model IDs that
        // Grok Build rejects, which makes the UI selectable but dead at submit time.
        const cliModelResult = runGrokModels();
        const cliModels = cliModelResult.ok ? parseGrokModelsOutput(cliModelResult.stdout) : [];
        const modelSource = cliModels.length > 0 ? "grok models" : "fallback";
        if (!cliModelResult.ok) {
          diagnostics.warn("falling back to default grok-build model list", () => ({
            stderr: cliModelResult.stderr,
            exitCode: cliModelResult.exitCode,
          }));
        }
        const models = cliModels.length > 0
          ? buildGrokProviderModels(cliModels)
          : [fallbackGrokBuildModel()];

        pi.registerProvider(PROVIDER_ID, {
          baseUrl: "pi-grok-build",
          apiKey: "unused",
          api: "pi-grok-build",
          models,
          streamSimple: (model, context, streamOptions) => {
            return streamViaGrok(model, context, {
              ...streamOptions,
            });
          },
        });

        // --- Commands ---
        pi.registerCommand(commandName, {
          description: `Grok Build CLI integration (0.1.216): /${commandName} status | inspect | models | sessions | memory | completions | logout | import | run <args>`,
          handler: async (args: string, ctx: ExtensionCommandContext) => {
            const trimmed = args.trim();
            const [action, ...rest] = trimmed.split(/\s+/);

            if (!action || action === "status") {
              const version = getGrokVersion();
              const isAuthed = validateGrokAuth();
              const status = version === "unknown"
                ? "Grok CLI missing or unavailable on PATH"
                : `Grok Build CLI v${version}`;
              ctx.ui.notify(
                `${status} | Auth: ${isAuthed ? "✅" : "❌"} | Provider: ${PROVIDER_ID} (${models.length} models)`,
                version === "unknown" ? "error" : "info",
              );
            } else if (action === "inspect") {
              const result = runGrokInspect({ cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "models") {
              const result = runGrokModels({ cwd: ctx.cwd });
              if (result.ok) {
                const discovered = parseGrokModelsOutput(result.stdout);
                const list = discovered
                  .map((m) => `${m.id} — ${m.name}`)
                  .join("\n");
                ctx.ui.notify(list || result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "sessions") {
              const result = runGrokSessions({ cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "memory") {
              const result = runGrokMemory({ cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "completions" || action === "logout" || action === "import") {
              // New top-level commands in 0.1.216
              const cmdArgs = [action, ...rest];
              const result = runGrokCommand(cmdArgs, { cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "run") {
              const runArgs = rest.length > 0 ? rest : ["--help"];
              const result = runGrokCommand(runArgs, { cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else {
              ctx.ui.notify(
                `Unknown /${commandName} action "${action}". Try: status, inspect, models, sessions, memory, completions, logout, import, run <args>`,
                "warning",
              );
            }
          },
        });

        // --- Tools ---

        const inspectTool: ToolDefinition<
          typeof EMPTY_SCHEMA,
          {
            version: string;
            authed: boolean;
            providerId: string;
            integrationMode: string;
            modelSource: string;
            models: Array<{ id: string; name: string }>;
            inspect: GrokRunResult;
          },
          unknown
        > = {
          name: `${toolNamePrefix}grok_inspect`,
          label: "Grok Inspect",
          description:
            "Show Grok Build CLI status: version, authentication, and available models.",
          parameters: EMPTY_SCHEMA,
          async execute() {
            const version = getGrokVersion();
            const authed = validateGrokAuth();
            const inspect = runGrokInspect();
            const details = {
              version,
              authed,
              providerId: PROVIDER_ID,
              integrationMode: GROK_JSONL_INTEGRATION_MODE,
              modelSource,
              models: models.map((m) => ({ id: m.id, name: m.name })),
              inspect,
            };
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(details, null, 2),
                },
              ],
              details,
            };
          },
        };

        const runTool: ToolDefinition<
          typeof RUN_SCHEMA,
          { ok: boolean; stdout: string; stderr: string; exitCode: number | null },
          unknown
        > = {
          name: `${toolNamePrefix}grok_run`,
          label: "Grok Run",
          description:
            "Run an arbitrary Grok CLI command with arguments. Example: grok_run with args [\"models\"] lists models.",
          parameters: RUN_SCHEMA,
          async execute(_toolCallId, params) {
            const cmdOpts: { cwd?: string; timeout?: number } = {};
            if (params.cwd !== undefined) cmdOpts.cwd = params.cwd;
            if (params.timeout !== undefined) cmdOpts.timeout = params.timeout;
            const result = runGrokCommand(params.args, cmdOpts);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      ok: result.ok,
                      exitCode: result.exitCode,
                      stdout: result.stdout,
                      stderr: result.stderr,
                    },
                    null,
                    2,
                  ),
                },
              ],
              details: result,
            };
          },
        };

        const modelsTool: ToolDefinition<
          typeof EMPTY_SCHEMA,
          { models: Array<{ id: string; name: string }> },
          unknown
        > = {
          name: `${toolNamePrefix}grok_models`,
          label: "Grok Models",
          description: "List available Grok models from the CLI.",
          parameters: EMPTY_SCHEMA,
          async execute() {
            const result = runGrokModels();
            const discovered = result.ok ? parseGrokModelsOutput(result.stdout) : [];
            const providerModels = buildGrokProviderModels(discovered);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      models: discovered,
                      providerModels,
                      source: "grok models",
                      raw: result.stdout.slice(0, 5000),
                    },
                    null,
                    2,
                  ),
                },
              ],
              details: { models: discovered, providerModels, source: "grok models" },
            };
          },
        };

        const sessionsTool: ToolDefinition<
          typeof SESSION_SCHEMA,
          GrokRunResult,
          unknown
        > = {
          name: `${toolNamePrefix}grok_sessions`,
          label: "Grok Sessions",
          description:
            "List, restore, or share Grok sessions. Action: 'list', 'restore', or 'share'. Provide sessionId for restore/share.",
          parameters: SESSION_SCHEMA,
          async execute(_toolCallId, params) {
            const args = ["sessions"];
            if (params.action === "restore" && params.sessionId) {
              args.push("restore", params.sessionId);
            } else if (params.action === "share" && params.sessionId) {
              const shareResult = runGrokShare(params.sessionId);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      { ok: shareResult.ok, stdout: shareResult.stdout, stderr: shareResult.stderr },
                      null,
                      2,
                    ),
                  },
                ],
                details: shareResult,
              };
            }
            const result = runGrokCommand(args);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, stdout: result.stdout.slice(0, 5000), stderr: result.stderr },
                    null,
                    2,
                  ),
                },
              ],
              details: result,
            };
          },
        };

        const memoryTool: ToolDefinition<
          typeof EMPTY_SCHEMA,
          GrokRunResult,
          unknown
        > = {
          name: `${toolNamePrefix}grok_memory`,
          label: "Grok Memory",
          description: "Show Grok cross-session memory entries.",
          parameters: EMPTY_SCHEMA,
          async execute() {
            const result = runGrokMemory();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, stdout: result.stdout.slice(0, 5000), stderr: result.stderr },
                    null,
                    2,
                  ),
                },
              ],
              details: result,
            };
          },
        };

        const imagineImageTool: ToolDefinition<
          typeof IMAGINE_IMAGE_SCHEMA,
          { images: Array<{ url: string; revised_prompt?: string }> },
          unknown
        > = {
          name: `${toolNamePrefix}grok_imagine_image`,
          label: "Grok Imagine Image",
          description: "Generate images from a text prompt using the xAI Imagine API.",
          parameters: IMAGINE_IMAGE_SCHEMA,
          async execute(_toolCallId, params) {
            const result = await imagineImage(params);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, images: result.images, error: result.error },
                    null,
                    2,
                  ),
                },
              ],
              details: { images: result.images },
            };
          },
        };

        const imagineVideoTool: ToolDefinition<
          typeof IMAGINE_VIDEO_SCHEMA,
          { url?: string; request_id?: string },
          unknown
        > = {
          name: `${toolNamePrefix}grok_imagine_video`,
          label: "Grok Imagine Video",
          description: "Generate video from text or an image using the xAI Imagine API.",
          parameters: IMAGINE_VIDEO_SCHEMA,
          async execute(_toolCallId, params) {
            const result = await imagineVideo(params);
            const details: Record<string, unknown> = {};
            if (result.url !== undefined) details.url = result.url;
            if (result.request_id !== undefined) details.request_id = result.request_id;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, url: result.url, request_id: result.request_id, error: result.error },
                    null,
                    2,
                  ),
                },
              ],
              details,
            };
          },
        };

        const ttsTool: ToolDefinition<
          typeof TTS_SCHEMA,
          { audioBase64?: string },
          unknown
        > = {
          name: `${toolNamePrefix}grok_tts`,
          label: "Grok TTS",
          description: "Convert text to speech using the xAI Voice API.",
          parameters: TTS_SCHEMA,
          async execute(_toolCallId, params) {
            const result = await textToSpeech(params);
            const details: Record<string, unknown> = {};
            if (result.audioBase64 !== undefined) details.audioBase64 = result.audioBase64;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, audioLength: result.audioBase64?.length ?? 0, error: result.error },
                    null,
                    2,
                  ),
                },
              ],
              details,
            };
          },
        };

        const sttTool: ToolDefinition<
          typeof STT_SCHEMA,
          { text?: string },
          unknown
        > = {
          name: `${toolNamePrefix}grok_stt`,
          label: "Grok STT",
          description: "Transcribe audio to text using the xAI Voice API. Provide filePath or base64Data.",
          parameters: STT_SCHEMA,
          async execute(_toolCallId, params) {
            const result = await speechToText(params);
            const details: Record<string, unknown> = {};
            if (result.text !== undefined) details.text = result.text;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ok: result.ok, text: result.text, error: result.error },
                    null,
                    2,
                  ),
                },
              ],
              details,
            };
          },
        };

        pi.registerTool(inspectTool);
        pi.registerTool(runTool);
        pi.registerTool(modelsTool);
        pi.registerTool(sessionsTool);
        pi.registerTool(memoryTool);
        pi.registerTool(imagineImageTool);
        pi.registerTool(imagineVideoTool);
        pi.registerTool(ttsTool);
        pi.registerTool(sttTool);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        diagnostics.error("failed to register extension", () => ({
          diagnostic: classifyGrokFailure({ message }),
        }));
        throw new Error(formatGrokFailure(classifyGrokFailure({ message })), { cause: err });
      }
    },
  };
}
