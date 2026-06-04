# Internal tools RBAC

Roles (Neon `internal_role` + code bootstrap):

| Role | Internal access | Writes |
|------|-----------------|--------|
| `viewer` | Read-only dashboards | No |
| `admin` | Full internal (wallet grant) | Yes |
| `superuser` | Full + user overrides | Yes |

## Email access

Resolved from **Privy login email** (`user.email` or Google email). User must still **connect a wallet** for server actions that require `actingWalletAddress`.

1. **Code bootstrap** — `INTERNAL_EMAIL_BOOTSTRAP` in `admin-roles.server.ts` (legacy).
2. **Database grants** — `internal_email_grant` table, managed at **Internal → Team access** (`/internal/team`, superuser only). Invites sent via [Resend](https://resend.com).

| Env | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Send invite emails |
| `RESEND_FROM_EMAIL` | Verified sender (e.g. `Blink <notifications@blinkperps.xyz>`) |

## Wallet bootstrap

| Wallet | Role |
|--------|------|
| `0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6` (rokitg.eth) | `superuser` |

## Grant more users

- **Wallet roles:** Internal → Users (superuser panel).
- **Email roles:** Internal → Team access — grant `viewer` or `admin`, optional Resend invite.
