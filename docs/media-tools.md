# Image and video tools

Bead: `pgb-010` — ground and implement/remove image/video generation tools.

## Evidence

Local Grok Build CLI help (`grok --help`, `grok agent --help`, `grok agent headless --help`) does **not** expose image or video generation commands. The CLI provider path stays text-only.

Official xAI docs expose Imagine over the xAI REST API:

- Image generation: `POST https://api.x.ai/v1/images/generations`
- Default image model for new requests: `grok-imagine-image-quality`
- Video generation start: `POST https://api.x.ai/v1/videos/generations`
- Video polling: `GET https://api.x.ai/v1/videos/{request_id}`
- Default video model: `grok-imagine-video`

The old extension code used ungrounded/stale model and endpoint assumptions, including `grok-2-image`, `grok-2-video`, `/v1/video-generations`, `/v1/tts`, and `/v1/stt`. Those are not advertised anymore.

## Shipped behavior

The extension registers these tools only when an xAI API key is available via environment:

- `grok_imagine_image`
- `grok_imagine_video`
- `grok_imagine_video_status`

Accepted env vars:

```bash
XAI_API_KEY=...
GROK_CODE_XAI_API_KEY=...
```

`XAI_API_KEY` wins when both are set.

When no key is configured, the tools are not registered. This avoids advertising a fake media surface in normal Pi installations.

## Not shipped

The extension intentionally does **not** register voice/TTS/STT tools. The previous `grok_tts` and `grok_stt` tools were removed because the active goal asked for image/video and the old endpoints were not grounded in current evidence.

The extension also does **not** read private Grok CLI cached auth tokens from `~/.grok`. ACP initialize advertises a cached token for Grok CLI auth, but the xAI Imagine docs use platform API keys. Reusing the CLI cache for API calls is not currently proven or documented, so the extension does not do it.

## Verification status

Deterministic tests verify request construction, endpoint paths, default models, missing-key behavior, and registration gating.

Live xAI media generation was not executed in this session because neither `XAI_API_KEY` nor `GROK_CODE_XAI_API_KEY` was present in the environment. A real generation smoke should be run before claiming media tools are fully production-proven on this machine.

Manual live smoke, intentionally opt-in because it can incur xAI API usage:

```bash
PI_GROK_BUILD_RUN_MEDIA_E2E=1 XAI_API_KEY=... npm run test:e2e:grok -- test/e2e/manual/xai-media.e2e.test.ts
```
