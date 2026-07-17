# Instance modes

A **workspace** is BragBit's tenant boundary — documents, brags, the timeline, and sharing all live
inside one. A freelancer is simply a personal workspace of one; an organization is a workspace with
many members. Everything beneath the workspace is identical regardless of who runs the instance.

`INSTANCE_MODE` (set once at deploy time) picks the deployment shape. The per-mode capability mapping
is centralized in [`src/lib/instance.ts`](../src/lib/instance.ts).

| Mode           | Who runs it               | Accounts come from         | Workspaces               | Ships |
| -------------- | ------------------------- | -------------------------- | ------------------------ | ----- |
| `private-org`  | a company self-hosting    | setup wizard + invitations | exactly one organization | v1    |
| `private-solo` | a freelancer self-hosting | setup wizard               | exactly one personal     | v1    |

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

> **Multi-tenant hosting is not part of main.** A shared instance (open sign-up, user-created
> organizations, an instance superadmin) is developed as **v1.1** on the `phase-10/hosted-multitenant`
> branch; `INSTANCE_MODE` here accepts only the two modes above.

## How branding reads

Branding is per-workspace, and an instance has exactly one workspace — so its name/accent/logo read
as instance-wide. Single-org white-labeling is just the one-workspace special case.

See [Configuration](configuration.md) for `INSTANCE_MODE` and related settings.
