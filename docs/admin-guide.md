# Admin guide

For workspace **owners** and **admins** (organizations), plus the hosted
**instance superadmin**. Workspace administration — branding, members,
invitations, roles, removal, and ownership transfer — is complete for the
self-hosted modes; the hosted superadmin console ships in v1.1.

## Workspace branding

At **`/admin`** (owner/admin only) you can set the workspace's:

- **Name** — shown in the app header, on the sign-in page, and on shared documents.
- **Accent color** — a validated hex with a live preview; it tints buttons,
  highlights, and links throughout BragBit, applied through a `--primary` CSS
  variable so the whole app re-themes at once.
- **Logo** — replaces the wordmark in the header and on the sign-in page (and,
  later, share pages). Logos are public assets; other uploads are not.

A **personal** workspace has the same branding controls (useful for a
freelancer's client-facing share pages) but no member/invite surface.

## Roles & permissions

Every workspace has three roles:

- **Owner** — the workspace creator (the setup user, or the org creator on a
  hosted instance). Exactly one per workspace; transferable, but never demotable
  or removable by an admin.
- **Admin** — manages the workspace: branding, members, and invitations.
- **Member** — uses the product.

**Admins manage the workspace, never members' brag content.** Brags are private
to each member regardless of role — an admin, and the hosted superadmin, can
never read another person's entries. A personal (`private-solo`) workspace has a
single owner and no member/invite surface at all.

## Invitations (organizations)

Organizations are **invitation-only**: there is no open sign-up on a `private-org`
instance, so a new account can be created only by accepting an invitation. An
invitation is:

- created for a specific **email + role** (admin or member);
- delivered as a branded email with a tokenized link;
- **single-use** and **expires after 7 days** (re-inviting an address revokes the
  prior token);
- **bound to the invited address** — the invitee can register only as that email,
  and verification is satisfied by construction (the link was sent to that inbox).

Opening the link lands the invitee on an accept page where they set a name and
password; accepting creates their membership and signs them in.

## Managing members

From **`/admin/members`** (organizations only — personal workspaces have no
member surface) an owner/admin can:

- **See the team** — each member's role, when they joined, and when they were
  last active.
- **Invite** one or more people at once (paste several addresses) with a role of
  Member or Admin.
- **Resend or revoke** a pending invitation.
- **Change a member's role** between Member and Admin.
- **Remove a member** — they lose workspace access immediately.
- **Transfer ownership** (owner only) — hand ownership to another member; you
  atomically step down to admin, so the workspace always has exactly one owner.

Owner protection is enforced everywhere: admins can never demote, remove, or be
handed past the owner; only the owner can change the owner's role or transfer
ownership. You can't remove yourself through these controls.

> **Removal purges the member's access and data from the workspace.** The
> _export-then-delete_ handoff — automatically handing the member a portable
> Markdown + JSON + attachments bundle before their data is purged — builds on the
> now-shipped [export](user-guide.md#export) feature and is a tracked follow-up.
> Until it lands, ask the member to export their own data first (Settings →
> Download JSON, plus per-document Markdown), since admins can't read member
> content on their behalf.

## Hosted: instance superadmin

On a `hosted` instance a seeded **superadmin** manages workspaces, users, and
storage quotas for abuse control — and, like workspace admins, never reads brag
content. Ships in v1.1.
