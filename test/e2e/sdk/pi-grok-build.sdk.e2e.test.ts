import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionContext,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const repoRoot = process.cwd();
let agentDir: string;

before(async () => {
  agentDir = await mkdtemp(join(tmpdir(), "pi-grok-build-e2e-"));
});

after(async () => {
  if (agentDir) {
    await rm(agentDir, { recursive: true, force: true });
  }
});

test("Pi SDK discovers the project-local pi-grok-build extension", async () => {
  const loader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();

  const extensions = loader.getExtensions();
  assert.deepEqual(extensions.errors, []);
  assert.ok(
    extensions.extensions.some((extension) =>
      extension.resolvedPath.endsWith(".pi/extensions/pi-grok-build/index.ts"),
    ),
    "expected DefaultResourceLoader to discover .pi/extensions/pi-grok-build/index.ts",
  );
});

test("Pi SDK exposes pi-grok-build commands and tools through live runtime", async () => {
  const loader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd: repoRoot,
    agentDir,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(repoRoot),
    noTools: "all",
  });

  try {
    await session.bindExtensions({});

    const localGrokCommand = session.extensionRunner.getCommand("local-grok");
    assert.ok(localGrokCommand, "expected /local-grok command to be registered");

    const toolNames = session.extensionRunner
      .getAllRegisteredTools()
      .map((tool) => tool.definition.name);

    assert.ok(
      toolNames.includes("local_grok_inspect"),
      "expected local_grok_inspect tool to be registered",
    );
    assert.ok(
      toolNames.includes("local_grok_run"),
      "expected local_grok_run tool to be registered",
    );
    assert.ok(
      toolNames.includes("local_grok_models"),
      "expected local_grok_models tool to be registered",
    );
    assert.ok(
      toolNames.includes("local_grok_sessions"),
      "expected local_grok_sessions tool to be registered",
    );
    assert.ok(
      toolNames.includes("local_grok_memory"),
      "expected local_grok_memory tool to be registered",
    );
    assert.equal(
      toolNames.includes("local_grok_imagine_image"),
      Boolean(process.env.XAI_API_KEY || process.env.GROK_CODE_XAI_API_KEY),
      "local_grok_imagine_image should only be registered when an xAI API key is configured",
    );
    assert.equal(
      toolNames.includes("local_grok_imagine_video"),
      Boolean(process.env.XAI_API_KEY || process.env.GROK_CODE_XAI_API_KEY),
      "local_grok_imagine_video should only be registered when an xAI API key is configured",
    );
    assert.equal(
      toolNames.includes("local_grok_imagine_video_status"),
      Boolean(process.env.XAI_API_KEY || process.env.GROK_CODE_XAI_API_KEY),
      "local_grok_imagine_video_status should only be registered when an xAI API key is configured",
    );
    assert.equal(toolNames.includes("local_grok_tts"), false);
    assert.equal(toolNames.includes("local_grok_stt"), false);

    // Execute grok_inspect tool live
    const inspectTool = session.extensionRunner.getToolDefinition("local_grok_inspect");
    assert.ok(inspectTool, "expected local_grok_inspect definition to be retrievable");
    const inspectResult = await inspectTool.execute(
      "call-inspect",
      {},
      undefined,
      undefined,
      session.createReplacedSessionContext() as ExtensionContext,
    );
    const details = inspectResult.details as { version: string; authed: boolean };
    assert.ok(typeof details.version === "string");
    assert.ok(typeof details.authed === "boolean");

    // Execute grok_models tool live
    const notifications: Array<{ message: string; type?: string }> = [];
    await localGrokCommand.handler("models", {
      cwd: repoRoot,
      ui: {
        notify: (message: string, type?: string) => {
          const entry: { message: string; type?: string } = { message };
          if (type !== undefined) entry.type = type;
          notifications.push(entry);
        },
      },
    } as any);
    assert.ok(
      notifications.some((entry) => entry.message.includes("grok-build")),
      "expected /local-grok models command to report CLI-discovered grok-build model",
    );

    const modelsTool = session.extensionRunner.getToolDefinition("local_grok_models");
    assert.ok(modelsTool, "expected local_grok_models definition to be retrievable");
    const modelsResult = await modelsTool.execute(
      "call-models",
      {},
      undefined,
      undefined,
      session.createReplacedSessionContext() as ExtensionContext,
    );
    const modelsDetails = modelsResult.details as {
      models: Array<{ id: string; name: string }>;
      providerModels: Array<{ id: string; name: string; reasoning: boolean; input: string[] }>;
      source: string;
    };
    assert.ok(Array.isArray(modelsDetails.models));
    assert.equal(modelsDetails.source, "grok models");
    assert.deepEqual(
      modelsDetails.providerModels.map((model) => model.id),
      modelsDetails.models.map((model) => model.id),
    );
    assert.ok(
      modelsDetails.providerModels.every((model) => model.reasoning === true),
      "expected provider models to advertise reasoning support",
    );
    assert.ok(
      modelsDetails.providerModels.every(
        (model) => model.input.length === 1 && model.input[0] === "text",
      ),
      "expected provider models to only claim proven text input",
    );
  } finally {
    session.dispose();
  }
});
