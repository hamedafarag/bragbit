# Instance modes

A **workspace** is BragBit's tenant boundary; a freelancer is just a personal workspace of
one. `INSTANCE_MODE` (set at deploy) picks the deployment shape.

> **Status:** stub — see [PLAN.md](../PLAN.md) §3 for the full tenancy model.

| Mode           | Who runs it               | Accounts come from              | Workspaces               |
| -------------- | ------------------------- | ------------------------------- | ------------------------ |
| `private-org`  | a company self-hosting    | setup wizard + invitations      | exactly one organization |
| `private-solo` | a freelancer self-hosting | setup wizard                    | exactly one personal     |
| `hosted`       | a shared instance         | open signup + user-created orgs | many                     |

Per-mode behavior is centralized in `src/lib/instance.ts`.
