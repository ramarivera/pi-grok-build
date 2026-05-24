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

The extension registers these tools when xAI API auth is available from either explicit environment keys or the local Grok CLI auth cache:

- `grok_imagine_image`
- `grok_imagine_video`
- `grok_imagine_video_status`

Accepted explicit env vars:

```bash
XAI_API_KEY=...
GROK_CODE_XAI_API_KEY=...
```

`XAI_API_KEY` wins when both are set.

Fallback auth source:

- `~/.grok/auth.json`
- first non-expired `https://auth.x.ai` entry
- `key` field only
- disabled when `PI_GROK_BUILD_DISABLE_GROK_AUTH_CACHE=1`

The cached `refresh_token` is intentionally not used. It failed direct xAI API authentication in local probing, while the cached `key` access token successfully authenticated `GET https://api.x.ai/v1/models`. Token values must never be logged or surfaced.

When no explicit key or valid cached Grok token is configured, the tools are not registered. This avoids advertising a fake media surface in normal Pi installations.

## Not shipped

The extension intentionally does **not** register voice/TTS/STT tools. The previous `grok_tts` and `grok_stt` tools were removed because the active goal asked for image/video and the old endpoints were not grounded in current evidence.

The extension reads only the Grok CLI cached access token needed for xAI REST auth fallback. It does **not** use the refresh token, mutate Grok auth files, or attempt undocumented refresh flows.

## Verification status

Deterministic tests verify request construction, endpoint paths, default models, missing-key behavior, and registration gating.

Live xAI media generation was not executed in this session. Explicit API keys were absent, but local probing confirmed `~/.grok/auth.json` contains an auth.x.ai cached `key` access token that successfully authenticates `GET https://api.x.ai/v1/models`. A real generation smoke should still be run before claiming media tools are fully production-proven on this machine because image/video endpoints can incur usage.

Manual live smoke, intentionally opt-in because it can incur xAI API usage:

```bash
PI_GROK_BUILD_RUN_MEDIA_E2E=1 XAI_API_KEY=... npm run test:e2e:grok -- test/e2e/manual/xai-media.e2e.test.ts
```
