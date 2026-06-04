"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";

import {
  getInternalTeamPanelState,
  grantInternalTeamMemberAction,
  resendInternalTeamInviteAction,
  revokeInternalTeamMemberAction,
  type InternalTeamPanelState,
} from "~/app/actions/manage-internal-team";
import {
  internalLabelClass,
  internalPanelClass,
} from "./internal-dashboard-primitives";

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleBadge(role: string) {
  if (role === "admin") {
    return (
      <Badge className="rounded-full border border-violet-400/35 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-300">
        Admin
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-300">
      Viewer
    </Badge>
  );
}

export function InternalTeamAccessPanel(props: {
  actingWalletAddress: string;
  emailAddresses?: string[];
}) {
  const [state, setState] = useState<InternalTeamPanelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "admin">("viewer");
  const [note, setNote] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getInternalTeamPanelState(
        props.actingWalletAddress,
        props.emailAddresses,
      );
      setState(next);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load team grants",
      );
    } finally {
      setLoading(false);
    }
  }, [props.actingWalletAddress, props.emailAddresses]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleGrant(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter an email address");
      return;
    }

    setSaving("grant");
    try {
      await grantInternalTeamMemberAction({
        actingWalletAddress: props.actingWalletAddress,
        emailAddresses: props.emailAddresses,
        email: trimmed,
        role,
        note: note.trim() || undefined,
        sendInvite,
      });
      toast.success(
        sendInvite
          ? `Invited ${trimmed} — check inbox`
          : `Granted ${trimmed} without sending email`,
      );
      setEmail("");
      setNote("");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to grant access",
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleResend(grantId: string) {
    setSaving(`resend:${grantId}`);
    try {
      await resendInternalTeamInviteAction({
        actingWalletAddress: props.actingWalletAddress,
        emailAddresses: props.emailAddresses,
        grantId,
      });
      toast.success("Invite email resent");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to resend invite",
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleRevoke(grantId: string, grantEmail: string) {
    if (
      !window.confirm(
        `Revoke internal access for ${grantEmail}? They will lose dashboard access on next sign-in.`,
      )
    ) {
      return;
    }

    setSaving(`revoke:${grantId}`);
    try {
      await revokeInternalTeamMemberAction({
        actingWalletAddress: props.actingWalletAddress,
        emailAddresses: props.emailAddresses,
        grantId,
      });
      toast.success(`Revoked ${grantEmail}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className={`${internalPanelClass} p-5`}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
            <Shield className="size-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Team email access
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Grant internal dashboard access by Privy login email. Invites are
              sent via Resend — recipients sign in with the same email, connect
              any wallet, then open{" "}
              <span className="text-white/70">/internal</span>.
            </p>
            {state && !state.resendConfigured ? (
              <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-xs text-amber-200">
                RESEND_API_KEY is not set — you can grant access without email,
                but invites will fail until configured in Cloudflare secrets.
              </p>
            ) : (
              <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                Invites send from{" "}
                <span className="text-white/65">no-reply@blinkperps.xyz</span>.
                Access is saved even if the invite email fails.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={`${internalPanelClass} p-5`}>
        <form onSubmit={handleGrant} className="space-y-4">
          <p className={internalLabelClass}>Add team member</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs text-white/45">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/20"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-white/45">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "viewer" | "admin")}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="admin">Admin (write)</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-white/45">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Finance review — Q2"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/55">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="size-4 rounded border-white/20 bg-white/5"
            />
            Send invite email via Resend
          </label>
          <button
            type="submit"
            disabled={saving === "grant"}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3b6ff5] px-4 text-sm font-medium text-white transition hover:bg-[#4a7aff] disabled:opacity-60"
          >
            {saving === "grant" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Grant access
          </button>
        </form>
      </section>

      <section className={`${internalPanelClass} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <p className={internalLabelClass}>Active email grants</p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:text-white/80"
            aria-label="Refresh grants"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !state ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-white/45">
            <Loader2 className="size-4 animate-spin" />
            Loading grants…
          </div>
        ) : state?.grants.length === 0 ? (
          <p className="px-5 py-10 text-sm text-white/45">
            No email grants yet. Bootstrap emails in code still work until
            migrated here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[11px] uppercase tracking-[0.12em] text-white/40">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Invite sent</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state?.grants.map((grant) => (
                  <tr
                    key={grant.id}
                    className="border-b border-white/6 last:border-0"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-white/85">
                      {grant.email}
                    </td>
                    <td className="px-5 py-3">{roleBadge(grant.role)}</td>
                    <td className="px-5 py-3 text-white/50">
                      {formatTimestamp(grant.inviteSentAt)}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-white/45">
                      {grant.note ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={
                            !state?.resendConfigured ||
                            saving === `resend:${grant.id}`
                          }
                          onClick={() => void handleResend(grant.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-white/60 transition hover:text-white disabled:opacity-40"
                          title="Resend invite email"
                        >
                          {saving === `resend:${grant.id}` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Mail className="size-3.5" />
                          )}
                          Resend
                        </button>
                        <button
                          type="button"
                          disabled={saving === `revoke:${grant.id}`}
                          onClick={() =>
                            void handleRevoke(grant.id, grant.email)
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-400/25 px-2.5 text-xs text-rose-300/90 transition hover:bg-rose-400/10 disabled:opacity-40"
                        >
                          {saving === `revoke:${grant.id}` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
