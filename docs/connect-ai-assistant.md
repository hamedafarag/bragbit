# Connect your AI assistant (MCP connector)

Log a win the moment it happens — right from Claude (or any [MCP](https://modelcontextprotocol.io)
client) — without switching to BragBit. You say _"log this as a brag,"_ your assistant writes it up
with the BragBit formula (_what you did + why it mattered + the measurable result_) and saves it to
your timeline.

BragBit itself ships **no AI** and needs no AI keys — the intelligence is your own assistant's. The
connector just gives it a secure, scoped door into your account.

## Connect (claude.ai or Claude Desktop)

1. In Claude, add a **custom connector** and paste your BragBit **MCP server URL** — your instance
   origin plus `/api/mcp` (e.g. `https://bragbit.example.com/api/mcp`). The bare origin won't work —
   it serves the app, not the connector.
2. Claude connects and opens BragBit's **Authorize** screen. Sign in if you aren't already, review
   what it's asking for, and click **Authorize**.
3. That's it — no token to copy. Try: _"Brag: shipped the realtime crew heatmap, cut crew-location
   time 22 → 5 min."_

Other MCP clients (Cursor, VS Code, the MCP Inspector, …) connect the same way: point them at the
`/api/mcp` URL and they run the OAuth flow.

## What your assistant can do

| Tool                     | What it does                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bragbit_add_brag`       | Record a win — `title` (required), plus optional `impact`, `description`, `category`, `date`, `links`, and a target `documentId`. Without a document it lands in your most recent one. |
| `bragbit_list_documents` | List your documents (review periods) so the assistant can pick where a brag belongs.                                                                                                   |

Capture-first by design: the connector can **add** wins and **list** your documents. It can't read
your existing brags, edit, or delete — do that in the app.

## Privacy & control

- **You approve access.** The Authorize screen shows exactly what the app is asking for before you
  grant it.
- **Scoped to you.** Every action runs as you, through the same access checks as the web app — an
  assistant can only ever touch your own wins, never anyone else's or another workspace's.
- **Revoke anytime.** Settings → **Connected apps** lists every assistant you've authorized. Revoke
  one and its access stops working immediately.

## For self-hosters

The connector ships **with** BragBit — no extra service, still one `docker compose up`. Enabling it
requires nothing beyond a reachable public URL: BragBit acts as its own OAuth 2.1 provider, serving
discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`
and the MCP endpoint at `/api/mcp`. Make sure `APP_URL` (or `BETTER_AUTH_URL`) is your real external
origin so those URLs resolve for clients. See
[docs/specs/mcp-connector.md](specs/mcp-connector.md) for the architecture.
