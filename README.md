# pi-grok-build

Pi coding-agent extension providing Grok Build / Grok CLI integration.

## Install

```bash
npm install @ramarivera/pi-grok-build
```

Then add to your Pi agent settings:

```json
{
  "packages": ["@ramarivera/pi-grok-build"]
}
```

## Tests

CI runs only deterministic tests that do not require a locally installed or authenticated Grok CLI:

```bash
npm run test:ci
```

Run the real Grok CLI integration suite manually on a machine where `grok` is installed and authenticated:

```bash
npm run test:grok
```

Run everything locally with:

```bash
npm test
```
