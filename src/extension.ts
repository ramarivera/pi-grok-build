/**
 * Grok Build extension for Pi Coding Agent.
 *
 * Provides:
 * 1. LLM Provider — routes inference through Grok Build CLI
 * 2. Tools — grok_inspect, grok_run for interacting with Grok CLI
 * 3. Command — /grok for CLI status and inspection
 */

import { Type, getModels } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import {
  validateGrokPresence,
  validateGrokAuth,
  getGrokVersion,
  runGrokInspect,
  killAllProcesses,
} from "./grok-runner.ts";
import { streamViaGrok } from "./provider.ts";

// Kill all active Grok subprocesses on exit to prevent orphans
process.on("exit", killAllProcesses);

const PROVIDER_ID = "pi-grok-build";

const EMPTY_SCHEMA = Type.Object({}, { additionalProperties: false });

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
        // Startup validation
        validateGrokPresence(); // throws if not on PATH

        const authed = validateGrokAuth();
        if (!authed) {
          console.warn(
            "[pi-grok-build] Grok CLI is not authenticated. Run 'grok' to authenticate via browser.",
          );
        }

        // --- Provider Registration ---
        // Map xAI/Grok models from Pi's model catalog
        const xaiModels = getModels("xai");
        const models =
          xaiModels.length > 0
            ? xaiModels.map((m) => ({
                id: m.id,
                name: m.name,
                reasoning: m.reasoning ?? false,
                input: (m.input ?? ["text"]) as ("text" | "image")[],
                cost: m.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: m.contextWindow ?? 1_000_000,
                maxTokens: m.maxTokens ?? 128_000,
              }))
            : [
                // Fallback: define a default grok model if none in catalog
                {
                  id: "grok-4.1",
                  name: "Grok 4.1",
                  reasoning: true as const,
                  input: ["text" as const],
                  contextWindow: 1_000_000,
                  maxTokens: 128_000,
                  cost: {
                    input: 2,
                    output: 8,
                    cacheRead: 0.5,
                    cacheWrite: 0,
                  },
                },
              ];

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
          description: `Grok Build CLI integration: /${commandName} status | /${commandName} inspect | /${commandName} models`,
          handler: async (args: string, ctx: ExtensionCommandContext) => {
            const trimmed = args.trim();
            const [action] = trimmed.split(/\s+/);

            if (!action || action === "status") {
              const version = getGrokVersion();
              const isAuthed = validateGrokAuth();
              ctx.ui.notify(
                `Grok Build CLI v${version} | Auth: ${isAuthed ? "✅" : "❌"} | Provider: ${PROVIDER_ID} (${models.length} models)`,
                "info",
              );
            } else if (action === "inspect") {
              const result = runGrokInspect({ cwd: ctx.cwd });
              if (result.ok) {
                ctx.ui.notify(result.stdout.slice(0, 2000), "info");
              } else {
                ctx.ui.notify(result.stderr.slice(0, 500), "error");
              }
            } else if (action === "models") {
              const list = models
                .map(
                  (m) =>
                    `${m.id} (${m.contextWindow?.toLocaleString() ?? "?"} ctx, $${m.cost?.input ?? "?"}/$${m.cost?.output ?? "?"} per 1M tokens)`,
                )
                .join("\n");
              ctx.ui.notify(list, "info");
            } else {
              ctx.ui.notify(
                `Unknown /${commandName} action "${action}". Try: status, inspect, models`,
                "warning",
              );
            }
          },
        });

        // --- Tools ---
        const inspectTool: ToolDefinition<
          typeof EMPTY_SCHEMA,
          { version: string; authed: boolean; models: Array<{ id: string; name: string }> },
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
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      version,
                      authed,
                      models: models.map((m) => ({ id: m.id, name: m.name })),
                    },
                    null,
                    2,
                  ),
                },
              ],
              details: { version, authed, models },
            };
          },
        };
        pi.registerTool(inspectTool);
      } catch (err) {
        console.error(`[pi-grok-build] Failed to register extension:`, err);
      }
    },
  };
}
