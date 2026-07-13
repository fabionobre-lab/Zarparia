# geornada MCP connector

geornada exposes a remote [Model Context Protocol](https://modelcontextprotocol.io)
server so you can create, read, and update your trips from Claude (claude.ai and
the Claude desktop/mobile apps). You sign in with the same Google account you use
on the web app; Claude only ever acts as you, on your own trips.

## Connect it in Claude

1. In Claude, open **Settings → Connectors → Add custom connector**.
2. Set the URL to:

   ```
   https://trips.fabionobre-ai.workers.dev/mcp
   ```

3. Claude discovers the authorization server, registers itself automatically
   (no client secret — it is a public OAuth client), and opens a geornada
   sign-in page.
4. Sign in with Google if you aren't already, then **Approve** on the consent
   screen ("… wants access to your geornada trips").
5. The connector is now live. Ask Claude things like *"list my geornada trips"*
   or *"add a museum stop to day 2 of my Rome trip"*.

## Tools

| Tool | What it does |
| --- | --- |
| `list_trips` | Lists trips you can access (owned + shared) with id, title, status, dates, and your role. |
| `get_trip` | Returns one trip's full document, your role, and its `updatedAt`. |
| `get_trip_schema` | Returns the trip JSON Schema plus a minimal working example. |
| `create_trip` | Creates a trip from a document. Returns validation errors if the doc is invalid. |
| `update_trip` | Replaces a trip document. Pass `base_updated_at` (from `get_trip`) for conflict detection. |
| `delete_trip` | Permanently deletes a trip. Owner-only; requires `confirm: true`. |

A trip is a single JSON document validated against `src/lib/trip.schema.json`.
The recommended editing loop is: `get_trip_schema` → `get_trip` →
edit the returned doc → `update_trip` with `base_updated_at` set to the
`updatedAt` you got back (so simultaneous edits are detected and surfaced as a
conflict rather than silently overwriting).

Permissions mirror the web app: owners and editors can write, viewers are
read-only, and only an owner can delete.

## Token lifetimes

- **Access token** (`gna_…`): 1 hour. Sent as `Authorization: Bearer …` on every
  MCP call.
- **Refresh token** (`gnr_…`): 60 days. Rotated on every use — each refresh
  returns a brand-new refresh token and invalidates the previous one. If an old
  (already-rotated) refresh token is ever presented again, the whole token
  family is revoked as a safety measure and you'll need to reconnect.
- **Authorization code**: 10 minutes, single-use.

## Revoking access

There is no self-service revoke UI yet. To cut a connector off, delete its token
rows from the database (this invalidates all of that client's access and refresh
tokens immediately):

```sh
# by user (revoke every MCP token you hold):
wrangler d1 execute trips --remote \
  --command "UPDATE oauth_tokens SET revoked = 1 WHERE user_id = '<your-user-id>'"
```

Deleting the `oauth_clients` row (with its cascading token rows) removes a client
entirely. Expired tokens stop working on their own.

## Architecture (for maintainers)

The MCP server is a same-origin OAuth 2.1 authorization server plus a single
JSON-RPC endpoint, all inside the SvelteKit app:

- **Discovery**: `/.well-known/oauth-authorization-server` and
  `/.well-known/oauth-protected-resource` (each also served with the `/mcp`
  resource path appended, because some clients request it that way).
- **Registration**: `POST /oauth/register` — RFC 7591 open dynamic client
  registration. Public clients only (`token_endpoint_auth_method: none`).
- **Authorization**: `GET /oauth/authorize` — a SvelteKit page that validates the
  request (exact `redirect_uri` match, mandatory PKCE `S256`), requires a signed-in
  geornada session (reusing the existing Google login + `returnTo` flow), and
  renders the consent screen. Approve is a form action that mints a single-use
  code.
- **Token**: `POST /oauth/token` — `authorization_code` (PKCE-verified) and
  rotating `refresh_token` grants.
- **MCP**: `POST /mcp` — stateless Streamable HTTP, hand-rolled JSON-RPC 2.0,
  Bearer-authenticated. All tools resolve the token to a user and call the
  existing `src/lib/server/trips.ts` data layer (no new trip SQL).

Security notes:

- Authorization codes and access/refresh tokens are stored only as SHA-256
  hashes (same discipline as session tokens) — a DB leak cannot be replayed.
- PKCE `S256` is mandatory; the token endpoint enforces it and single-use codes.
- `redirect_uri` is matched exactly against the client's registered set.
- SvelteKit's built-in cross-origin form-POST CSRF check is disabled globally
  (`csrf.checkOrigin: false` in `vite.config.ts`) because MCP clients call the
  token/register endpoints cross-origin with no `Origin` header; an equivalent
  origin guard is re-implemented in `src/hooks.server.ts` that exempts only
  `/oauth/token`, `/oauth/register`, and `/mcp`. Every same-origin form (the
  consent action included) keeps full protection, and session cookies remain
  `SameSite=Lax`.
- The consent page sets `X-Frame-Options: DENY` / `frame-ancestors 'none'`.

Schema lives in migration `migrations/0006_mcp_oauth.sql`
(`oauth_clients`, `oauth_codes`, `oauth_tokens`). Server code is under
`src/lib/server/mcp/` (`oauth.ts`, `tokens.ts`).
