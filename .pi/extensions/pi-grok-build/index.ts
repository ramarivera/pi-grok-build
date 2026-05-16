import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGrokBuildExtension } from "../../../src/index.ts";

function localPiGrokBuildExtension(pi: ExtensionAPI): void {
  createGrokBuildExtension({ commandName: "local-grok", toolNamePrefix: "local_" }).register(pi);
}

export * from "../../../src/index.ts";
export default localPiGrokBuildExtension;
