# Instance modes

A **workspace** is BragBit's tenant boundary — documents, brags, the timeline, and sharing all live
inside one. A freelancer is simply a personal workspace of one; an organization is a workspace with
many members. Everything beneath the workspace is identical regardless of who runs the instance.

`INSTANCE_MODE` (set once at deploy time) picks the deployment shape. The per-mode capability mapping
is centralized in [`src/lib/instance.ts`](../src/lib/instance.ts).

| Mode           | Who runs it                    | Accounts come from              | Workspaces               | Ships |
| -------------- | ------------------------------ | ------------------------------- | ------------------------ | ----- |
| `private-org`  | a company self-hosting         | setup wizard + invitations      | exactly one organization | v1    |
| `private-solo` | a freelancer self-hosting      | setup wizard                    | exactly one personal     | v1    |
| `hosted`       | a shared multi-tenant instance | open signup + user-created orgs | many                     | v1.1  |

## `private-solo` — a personal instance

The simplest mode, and the default. The first visit opens a one-time `/setup` wizard that creates
the owner account and a single **personal** workspace, signs you in, and then closes for good. There
is no member, invitation, or role chrome anywhere — it's a workspace of one. Branding (name, accent,
logo) still applies, which is handy for a freelancer's client-facing share pages.

## `private-org` — a single-organization instance

The setup wizard creates the owner account and one **organization** workspace. Growth is
**invitation-only**: there is no open sign-up, so an account is created only by accepting a tokenized
invite (see the [Admin guide](admin-guide.md)). Owners and admins manage branding, members, and
invitations — but never read members' brag content.

## `hosted` — a shared multi-tenant instance (v1.1)

The mode for a public instance: open sign-up with required email verification, each signup landing
in a personal workspace, and any user able to create organizations and invite a team. It adds an
instance superadmin and abuse controls (disposable-email blocking, per-workspace storage quotas).
Hosted shipped in **v1.1**; because the schema is workspace-scoped from day one, it's
purely additive — not a rewrite.

## How branding reads per mode

Branding is per-workspace. In the two private modes there's exactly one workspace, so its
name/accent/logo read as instance-wide — single-org white-labeling is just the one-workspace special
case. On a hosted instance each workspace self-brands, and the pre-sign-in pages use the BragBit
default.

See [Configuration](configuration.md) for `INSTANCE_MODE` and related settings.
