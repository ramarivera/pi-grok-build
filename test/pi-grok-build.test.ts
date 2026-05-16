import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGrokBuildExtension } from "../src/index.ts";

describe("createGrokBuildExtension", () => {
  it("returns register function", () => {
    const ext = createGrokBuildExtension();
    assert.ok(ext);
    assert.equal(typeof ext.register, "function");
  });

  it("accepts custom command name", () => {
    const ext = createGrokBuildExtension({ commandName: "custom-grok" });
    assert.ok(ext.register);
  });

  it("accepts custom tool prefix", () => {
    const ext = createGrokBuildExtension({ toolNamePrefix: "grok_" });
    assert.ok(ext.register);
  });

  it("registers command on the extension API", (_ctx, done) => {
    const ext = createGrokBuildExtension();
    const registeredCommands: string[] = [];

    const mockPi = {
      registerCommand(name: string, _def: unknown) {
        registeredCommands.push(name);
      },
      registerTool(_def: unknown) {},
      on(_hook: string, _handler: unknown) {},
    } as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI;

    ext.register(mockPi);
    assert.deepEqual(registeredCommands, ["grok"]);
    done();
  });
});
