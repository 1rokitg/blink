import { Resend } from "resend";

import type { BlinkRole } from "./admin-roles.server";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Add it in Cloudflare Workers secrets.",
    );
  }
  return new Resend(apiKey);
}

function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Blink <onboarding@resend.dev>"
  );
}

function getInternalToolsUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://blinkperps.xyz";
  return `${base.replace(/\/$/, "")}/internal`;
}

function roleLabel(role: BlinkRole) {
  if (role === "superuser") return "Superuser";
  if (role === "admin") return "Admin";
  return "Read-only";
}

export async function sendInternalTeamInviteEmail(params: {
  toEmail: string;
  role: BlinkRole;
  note?: string | null;
}) {
  const to = params.toEmail.trim().toLowerCase();
  const internalUrl = getInternalToolsUrl();
  const access = roleLabel(params.role);

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#060510;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060510;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#0f131c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
          <tr>
            <td style="color:#8ef5dc;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;">
              Blink Internal
            </td>
          </tr>
          <tr>
            <td style="padding-top:16px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.03em;">
              You have internal tools access
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;color:rgba(255,255,255,0.62);font-size:15px;line-height:1.6;">
              Your Privy login email (<strong style="color:#fff;">${to}</strong>) was granted
              <strong style="color:#fff;"> ${access}</strong> access to the Blink internal dashboard.
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;">
              <a href="${internalUrl}" style="display:inline-block;background:linear-gradient(180deg,#3c76ff,#2457db);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;">
                Open internal dashboard
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;color:rgba(255,255,255,0.45);font-size:13px;line-height:1.55;">
              Sign in with the same email address above, connect any wallet, then open the link.
              ${params.role === "viewer" ? "This is read-only access — you can view metrics and feeds but cannot change settings." : ""}
            </td>
          </tr>
          ${
            params.note
              ? `<tr><td style="padding-top:16px;color:rgba(255,255,255,0.38);font-size:12px;">Note: ${params.note}</td></tr>`
              : ""
          }
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const { data, error } = await getResendClient().emails.send({
    from: getFromAddress(),
    to,
    subject: `Blink internal tools — ${access} access`,
    html,
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send invite email");
  }

  return { id: data?.id ?? null };
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
