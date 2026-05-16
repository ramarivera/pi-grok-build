import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export interface GrokBuildOptions {
  commandName?: string;
  toolNamePrefix?: string;
}

export function createGrokBuildExtension(options: GrokBuildOptions = {}) {
  const commandName = options.commandName ?? "grok";
  const toolNamePrefix = options.toolNamePrefix ?? "";

  return {
    register(pi: ExtensionAPI): void {
      pi.registerCommand(commandName, {
        description: `Run Grok CLI commands from Pi: /${commandName}`,
        handler: async (args: string, ctx: ExtensionCommandContext) => {
          ctx.ui.notify(`Grok Build extension v0.0.1 — CLI wrapper coming soon.`, "info");
        },
      });
    },
  };
}
