import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGrokBuildExtension, type GrokBuildOptions } from "./extension.ts";

export type { GrokBuildOptions };
export { createGrokBuildExtension };

export default function piGrokBuildExtension(pi: ExtensionAPI): void {
  createGrokBuildExtension().register(pi);
}
