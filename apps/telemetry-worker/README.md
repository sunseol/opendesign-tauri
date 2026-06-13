# Open Design Telemetry Relay

Cloudflare Worker relay for opt-in Open Design telemetry. The shipped desktop
client sends redacted Langfuse ingestion batches here after the user enables
metrics. This Worker holds the Langfuse write credentials and forwards valid
batches to Langfuse.

The relay keeps Langfuse secret keys out of packaged clients. Release builds
only include the public relay URL; the Worker adds Langfuse authentication
server-side after validating the request. If the relay is unavailable, the
daemon retries, logs the failure, and continues the user flow without blocking
the CLI or desktop app.

The same Worker also exposes write-only trace object ingest endpoints. Normal
telemetry batches register trace-safe object scopes in `TRACE_OBJECT_SCOPE_KV`;
`POST /api/objects/authorize` checks those scopes and returns a short-lived
upload token; `POST /api/objects/batch` accepts only token-authorized objects
and writes them through the `TRACE_OBJECT_BUCKET` R2 binding. The long-lived
signing secret stays in the Worker and is never packaged into the daemon or
client.

Local development can bypass the relay by setting direct `LANGFUSE_PUBLIC_KEY`
and `LANGFUSE_SECRET_KEY` environment variables for the daemon. Packaged
release config should use only `OPEN_DESIGN_TELEMETRY_RELAY_URL`.

## Abuse controls

The Worker requires the Open Design telemetry marker header, validates the
Langfuse ingestion batch shape and size before forwarding, and uses Cloudflare
Rate Limiting bindings for two independent keys:

- `TELEMETRY_CLIENT_RATE_LIMITER`: anonymous installation/user id, 120 requests
  per minute.
- `TELEMETRY_IP_RATE_LIMITER`: Cloudflare `CF-Connecting-IP`, 600 requests per
  minute.

Object ingest uses the separate marker
`X-Open-Design-Telemetry: object-ingestion-v1`. The authorize endpoint reads
only bounded JSON metadata, and the batch endpoint applies IP rate limiting
before reading object bodies. By default the Worker enforces a 10 MiB
single-object limit and a 20 MiB request-body limit; oversized or unauthorized
objects are reported as unavailable instead of being written.

## Secrets

```bash
pnpm --dir apps/telemetry-worker dlx wrangler secret put LANGFUSE_PUBLIC_KEY
pnpm --dir apps/telemetry-worker dlx wrangler secret put LANGFUSE_SECRET_KEY
pnpm --dir apps/telemetry-worker dlx wrangler secret put TRACE_OBJECT_UPLOAD_SECRET
```

`LANGFUSE_BASE_URL` defaults to `https://us.cloud.langfuse.com` in
`wrangler.toml`.

Object ingest should use Cloudflare bindings, not R2 access keys in the
packaged client or daemon. `wrangler.toml` defines the public object limits and
`TRACE_OBJECT_BUCKET` binding. Deployed environments must also provide a KV
namespace binding for trace scope registration:

```toml
[[kv_namespaces]]
binding = "TRACE_OBJECT_SCOPE_KV"
id = "<cloudflare-kv-namespace-id>"
```

## Deploy

```bash
pnpm --filter @open-design/telemetry-worker deploy
```

After deploy, set the repository variable `OPEN_DESIGN_TELEMETRY_RELAY_URL` to
the Worker route, for example:

```text
https://telemetry.open-design.ai/api/langfuse
```

Opening `/api/langfuse` or `/health` in a browser returns relay health JSON.
Telemetry ingestion still uses POST to `/api/langfuse`.
Object authorization uses POST to `/api/objects/authorize`; object ingestion
uses POST to `/api/objects/batch`.

Release workflows bake only this public relay URL into packaged config. The
Langfuse secret key stays in Cloudflare Worker secrets.
