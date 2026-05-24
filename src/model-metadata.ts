import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { GrokModelDescriptor } from "./types.ts";

export const GROK_BUILD_PROVIDER_ID = "pi-grok-build";
export const GROK_JSONL_INTEGRATION_MODE = "jsonl";

export const GROK_THINKING_LEVEL_MAP = {
  off: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
} as const;

export const GROK_PROVIDER_MODEL_DEFAULTS = {
  reasoning: true,
  thinkingLevelMap: GROK_THINKING_LEVEL_MAP,
  input: ["text"] as const,
  contextWindow: 1_000_000,
  maxTokens: 128_000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
} satisfies Omit<ProviderModelConfig, "id" | "name">;

export function buildGrokProviderModel(descriptor: GrokModelDescriptor): ProviderModelConfig {
  return {
    id: descriptor.id,
    name: descriptor.name,
    ...GROK_PROVIDER_MODEL_DEFAULTS,
  };
}

export function buildGrokProviderModels(
  descriptors: readonly GrokModelDescriptor[],
): ProviderModelConfig[] {
  return descriptors.map(buildGrokProviderModel);
}

export function fallbackGrokBuildModel(): ProviderModelConfig {
  return buildGrokProviderModel({ id: "grok-build", name: "Grok Build" });
}
