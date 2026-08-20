"use client";

import { useMemo, useState, useTransition } from "react";

import {
  EMAIL_SENDERS,
  type EmailCampaignId,
  type EmailSenderId,
} from "@/lib/email-campaigns";
import type {
  EmailAudienceBoardRow,
  EmailBoard,
  EmailBoardTab,
  EmailCampaignBoardRow,
} from "@/lib/email-board-types";

const TABS: { id: EmailBoardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "audiences", label: "Audiences" },
  { id: "campaigns", label: "Campaigns" },
  { id: "sends", label: "Sends" },
  { id: "automation", label: "Automation" },
];

function readinessTone(value: EmailCampaignBoardRow["readiness"]) {
  if (value === "ready") return "bg-emerald-500/15 text-emerald-300";
  if (value === "needs_review") return "bg-amber-500/15 text-amber-200";
  return "bg-rose-500/15 text-rose-300";
}

function scoreTone(score: number) {
  if (score >= 70) return "text-emerald-300";
  if (score >= 45) return "text-amber-200";
  return "text-[#a1a1aa]";
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[#141414] p-4 ${
        accent ? "border-[#ff6a00]/35 shadow-[0_0_24px_rgba(255,106,0,0.08)]" : "border-[#262626]"
      }`}
    >
      <p className="text-[11px] font-bold tracking-[0.14em] text-[#71717a] uppercase">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-[#71717a]">{hint}</p> : null}
    </div>
  );
}

export function EmailsView({ initialBoard }: { initialBoard: EmailBoard }) {
  const [board, setBoard] = useState(initialBoard);
  const [tab, setTab] = useState<EmailBoardTab>("overview");
  const [audienceId, setAudienceId] = useState(
    initialBoard.audiences[0]?.id ?? "all_emailable",
  );
  const [campaignId, setCampaignId] = useState<EmailCampaignId>(
    initialBoard.campaigns[0]?.id ?? "whop_migration",
  );
  const [senderId, setSenderId] = useState<EmailSenderId>("members");
  const [testTo, setTestTo] = useState("1rokitg@gmail.com");
  const [audienceQuery, setAudienceQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const audience = useMemo(
    () =>
      board.audiences.find((row) => row.id === audienceId) ??
      board.audiences[0]!,
    [board.audiences, audienceId],
  );

  const campaign = useMemo(
    () =>
      board.campaigns.find((row) => row.id === campaignId) ??
      board.campaigns[0]!,
    [board.campaigns, campaignId],
  );

  const filteredSample = useMemo(() => {
    const q = audienceQuery.trim().toLowerCase();
    if (!q) return audience.sample;
    return audience.sample.filter((row) =>
      [row.email, row.name, row.telegramUsername, row.source, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [audience.sample, audienceQuery]);

  function refreshBoard() {
    startTransition(async () => {
      const res = await fetch("/api/internal/emails?board=1", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { board?: EmailBoard };
      if (data.board) setBoard(data.board);
    });
  }

  function sendTest() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/internal/emails", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_send",
          campaignId,
          senderId,
          to: testTo.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Test send failed.");
        return;
      }
      setMessage(`Test sent · Resend id ${data.id}`);
    });
  }

  function runImport(action: "import_propr" | "import_substack") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/internal/emails", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        imported?: number;
        emailable?: number;
        paid?: number;
        free?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      if (action === "import_propr") {
        setMessage(
          `Imported ${data.imported} Propr leads (emailable ${data.emailable}).`,
        );
      } else {
        setMessage(
          `Imported ${data.imported} Substack leads (${data.free} free · ${data.paid} paid).`,
        );
      }
      refreshBoard();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-[#ff6a00] uppercase">
            Marketing
          </p>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Emails
          </h1>
          <p className="max-w-3xl text-[14px] text-[#a1a1aa]">
            Audience intelligence, campaign readiness, and send ops for Circle.
            Scored segments from CRM + Whop + Substack engagement — blast +
            Resend webhooks plug into Sends next.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshBoard}
          disabled={pending}
          className="rounded-full border border-[#262626] bg-[#141414] px-4 py-2 text-[13px] font-medium text-[#d4d4d8] hover:border-[#52525b] disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh data"}
        </button>
      </header>

      {!board.deliverability.resendConfigured ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-[13px] text-amber-100/90">
          <p className="font-semibold text-amber-200">Connect Resend</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-100/75">
            <li>
              Verify domain{" "}
              <code className="text-amber-50">
                {board.deliverability.domain}
              </code>{" "}
              (SPF / DKIM)
            </li>
            <li>
              Set Worker secret{" "}
              <code className="text-amber-50">RESEND_API_KEY</code>
            </li>
            <li>Redeploy — Overview deliverability turns green</li>
          </ol>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          Resend connected · @{board.deliverability.domain} · webhooks{" "}
          {board.deliverability.webhookConfigured ? "live" : "pending"}
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#262626] bg-[#0f0f0f] p-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
              tab === item.id
                ? "bg-white text-black"
                : "text-[#a1a1aa] hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewTab
          board={board}
          onOpenAudience={(id) => {
            setAudienceId(id);
            setTab("audiences");
          }}
          onOpenCampaign={(id) => {
            setCampaignId(id);
            setTab("campaigns");
          }}
        />
      ) : null}

      {tab === "audiences" ? (
        <AudiencesTab
          board={board}
          audience={audience}
          audienceId={audienceId}
          setAudienceId={setAudienceId}
          query={audienceQuery}
          setQuery={setAudienceQuery}
          filteredSample={filteredSample}
          onImportPropr={() => runImport("import_propr")}
          onImportSubstack={() => runImport("import_substack")}
          pending={pending}
        />
      ) : null}

      {tab === "campaigns" ? (
        <CampaignsTab
          board={board}
          campaign={campaign}
          campaignId={campaignId}
          setCampaignId={setCampaignId}
          senderId={senderId}
          setSenderId={setSenderId}
          testTo={testTo}
          setTestTo={setTestTo}
          onSendTest={sendTest}
          pending={pending}
        />
      ) : null}

      {tab === "sends" ? <SendsTab board={board} /> : null}
      {tab === "automation" ? <AutomationTab board={board} /> : null}

      <p className="text-[11px] text-[#52525b]">
        Board generated {new Date(board.generatedAt).toLocaleString()} · Propr
        seed {board.proprImported} · missing email {board.missingEmailPropr}
      </p>
    </div>
  );
}

function OverviewTab({
  board,
  onOpenAudience,
  onOpenCampaign,
}: {
  board: EmailBoard;
  onOpenAudience: (id: EmailAudienceBoardRow["id"]) => void;
  onOpenCampaign: (id: EmailCampaignId) => void;
}) {
  const { kpis } = board;
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Emailable"
          value={kpis.emailableTotal.toLocaleString()}
          hint="Deduped CRM + Whop"
          accent
        />
        <Kpi
          label="High intent"
          value={kpis.highIntent.toLocaleString()}
          hint="Score ≥ 60"
        />
        <Kpi
          label="Substack engaged"
          value={kpis.substackEngaged.toLocaleString()}
          hint="Opens / activity signal"
        />
        <Kpi
          label="Whop migrate"
          value={kpis.whopMigrationPool.toLocaleString()}
          hint="Paid + emailable"
        />
        <Kpi
          label="Waitlist ≤7d"
          value={kpis.waitlistFresh7d.toLocaleString()}
          hint="Fresh captures"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                Audience heat
              </h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Size · emailable · avg intent score
              </p>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Circle members w/ email · {kpis.circleMembersEmailable}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="text-[11px] tracking-wide text-[#71717a] uppercase">
                <tr>
                  <th className="pb-2 font-semibold">Segment</th>
                  <th className="pb-2 font-semibold">Count</th>
                  <th className="pb-2 font-semibold">Emailable</th>
                  <th className="pb-2 font-semibold">Members</th>
                  <th className="pb-2 font-semibold">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {board.audiences.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-[#1f1f1f] hover:bg-white/[0.03]"
                    onClick={() => onOpenAudience(row.id)}
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium text-[#fafafa]">{row.label}</p>
                      <p className="text-[11px] text-[#71717a]">
                        {row.topReasons.slice(0, 2).join(" · ") || row.description}
                      </p>
                    </td>
                    <td className="py-3 tabular-nums">{row.count}</td>
                    <td className="py-3 tabular-nums">{row.emailableCount}</td>
                    <td className="py-3 tabular-nums">{row.memberPct}%</td>
                    <td className={`py-3 font-semibold tabular-nums ${scoreTone(row.avgScore)}`}>
                      {row.avgScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <h2 className="text-[15px] font-semibold text-[#fafafa]">
              Campaign desk
            </h2>
            <p className="mt-1 text-[12px] text-[#71717a]">
              {kpis.campaignsReady} ready · {kpis.campaignsDraft} draft
            </p>
            <ul className="mt-4 space-y-3">
              {board.campaigns.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCampaign(row.id)}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-3 text-left hover:border-[#52525b]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#fafafa]">
                        {row.title}
                      </p>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${readinessTone(row.readiness)}`}
                      >
                        {row.readiness.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71717a]">
                      {row.audienceEmailable.toLocaleString()} emailable ·{" "}
                      {row.subject}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <h2 className="text-[15px] font-semibold text-[#fafafa]">
              Deliverability
            </h2>
            <ul className="mt-3 space-y-2 text-[12px] text-[#a1a1aa]">
              {board.deliverability.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-[#ff6a00]">▸</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2">
              {board.deliverability.senders.map((sender) => (
                <div
                  key={sender.id}
                  className="rounded-lg border border-[#1f1f1f] px-3 py-2"
                >
                  <p className="text-[12px] font-medium text-[#fafafa]">
                    {sender.label}
                  </p>
                  <p className="text-[11px] text-[#71717a]">{sender.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AudiencesTab({
  board,
  audience,
  audienceId,
  setAudienceId,
  query,
  setQuery,
  filteredSample,
  onImportPropr,
  onImportSubstack,
  pending,
}: {
  board: EmailBoard;
  audience: EmailAudienceBoardRow;
  audienceId: string;
  setAudienceId: (id: EmailAudienceBoardRow["id"]) => void;
  query: string;
  setQuery: (value: string) => void;
  filteredSample: EmailAudienceBoardRow["sample"];
  onImportPropr: () => void;
  onImportSubstack: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {board.audiences.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setAudienceId(row.id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left ${
              audienceId === row.id
                ? "border-[#ff6a00]/50 bg-[#ff6a00]/10"
                : "border-[#262626] bg-[#141414] hover:border-[#52525b]"
            }`}
          >
            <p className="text-[13px] font-semibold text-[#fafafa]">
              {row.label}
            </p>
            <p className="mt-1 text-[11px] text-[#71717a]">
              {row.emailableCount}/{row.count} emailable · score {row.avgScore}
            </p>
          </button>
        ))}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={onImportSubstack}
            className="rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-[12px] font-medium text-[#d4d4d8] disabled:opacity-50"
          >
            Re-import Substack CSV
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onImportPropr}
            className="rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-[12px] font-medium text-[#d4d4d8] disabled:opacity-50"
          >
            Re-import Propr CSV
          </button>
        </div>
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#fafafa]">
                {audience.label}
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] text-[#a1a1aa]">
                {audience.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#262626] px-3 py-1 text-[12px] text-[#d4d4d8]">
                {audience.count} people
              </span>
              <span className="rounded-full border border-[#262626] px-3 py-1 text-[12px] text-[#d4d4d8]">
                {audience.emailableCount} emailable
              </span>
              <span
                className={`rounded-full border border-[#262626] px-3 py-1 text-[12px] font-semibold ${scoreTone(audience.avgScore)}`}
              >
                avg {audience.avgScore}
              </span>
            </div>
          </div>
          {audience.topReasons.length ? (
            <p className="mt-3 text-[12px] text-[#71717a]">
              Top signals · {audience.topReasons.join(" · ")}
            </p>
          ) : null}
          {!audience.emailable ? (
            <p className="mt-3 text-[12px] text-amber-200/90">
              Needs email enrichment before blast ({board.missingEmailPropr}{" "}
              Propr missing email).
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter sample by email, telegram, source…"
            className="min-w-[240px] flex-1 rounded-xl border border-[#262626] bg-[#141414] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
          />
          <p className="text-[12px] text-[#71717a]">
            Showing top {filteredSample.length} of scored sample (cap{" "}
            {audience.sample.length})
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Signals</th>
                </tr>
              </thead>
              <tbody>
                {filteredSample.map((row) => (
                  <tr key={row.id} className="border-t border-[#1f1f1f] align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#fafafa]">
                        {row.email ||
                          (row.telegramUsername
                            ? `@${row.telegramUsername}`
                            : row.name) ||
                          row.id}
                      </p>
                      <p className="text-[11px] text-[#71717a]">
                        {[row.name, row.telegramUsername ? `@${row.telegramUsername}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{row.source}</td>
                    <td className="px-4 py-3 capitalize text-[#a1a1aa]">
                      {row.status}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold tabular-nums ${scoreTone(row.score)}`}
                    >
                      {row.score}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#71717a]">
                      {row.metaSummary ? (
                        <p className="text-[#a1a1aa]">{row.metaSummary}</p>
                      ) : null}
                      <p>{row.scoreReasons.join(" · ") || "—"}</p>
                      {row.lifetimeUsd != null && row.lifetimeUsd > 0 ? (
                        <p className="mt-1 text-emerald-300/90">
                          Stripe ${row.lifetimeUsd.toFixed(2)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filteredSample.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-[#71717a]"
                    >
                      No contacts in this sample.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function CampaignsTab({
  board,
  campaign,
  campaignId,
  setCampaignId,
  senderId,
  setSenderId,
  testTo,
  setTestTo,
  onSendTest,
  pending,
}: {
  board: EmailBoard;
  campaign: EmailCampaignBoardRow;
  campaignId: EmailCampaignId;
  setCampaignId: (id: EmailCampaignId) => void;
  senderId: EmailSenderId;
  setSenderId: (id: EmailSenderId) => void;
  testTo: string;
  setTestTo: (value: string) => void;
  onSendTest: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {board.campaigns.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setCampaignId(row.id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left ${
              campaignId === row.id
                ? "border-white bg-white text-black"
                : "border-[#262626] bg-[#141414] text-[#d4d4d8] hover:border-[#52525b]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold">{row.title}</p>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                  campaignId === row.id
                    ? "bg-black/10 text-black"
                    : readinessTone(row.readiness)
                }`}
              >
                {row.readiness.replace("_", " ")}
              </span>
            </div>
            <p
              className={`mt-1 text-[11px] ${
                campaignId === row.id ? "text-black/60" : "text-[#71717a]"
              }`}
            >
              {row.audienceEmailable} emailable · {row.status}
            </p>
          </button>
        ))}
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#fafafa]">
                {campaign.title}
              </h2>
              <p className="mt-1 text-[13px] text-[#a1a1aa]">
                {campaign.preview}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${readinessTone(campaign.readiness)}`}
            >
              {campaign.readiness.replace("_", " ")}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#71717a]">
                Subject
              </dt>
              <dd className="mt-1 text-[13px] text-[#fafafa]">
                {campaign.subject}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#71717a]">
                Audience
              </dt>
              <dd className="mt-1 text-[13px] text-[#fafafa]">
                {campaign.audienceId} · {campaign.audienceEmailable} emailable
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#71717a]">
                CTA
              </dt>
              <dd className="mt-1 text-[13px] text-[#70a7ff]">
                <a href={campaign.ctaHref} target="_blank" rel="noreferrer">
                  {campaign.ctaLabel}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#71717a]">
                Default sender
              </dt>
              <dd className="mt-1 text-[13px] text-[#fafafa]">
                {campaign.senderId}
              </dd>
            </div>
          </dl>
          {campaign.blockers.length ? (
            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-[12px] text-rose-100">
              <p className="font-semibold">Blockers</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {campaign.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-emerald-300/90">
              Ready for controlled blast once Sends ships rate limits + ledger.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <h3 className="text-[14px] font-semibold text-[#fafafa]">
              Test send
            </h3>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[12px] text-[#a1a1aa]">From</span>
                <select
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value as EmailSenderId)}
                  className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[13px] outline-none"
                >
                  {EMAIL_SENDERS.map((sender) => (
                    <option key={sender.id} value={sender.id}>
                      {sender.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] text-[#a1a1aa]">Send test to</span>
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[13px] outline-none focus:border-[#52525b]"
                />
              </label>
              <button
                type="button"
                disabled={pending || !board.deliverability.resendConfigured}
                onClick={onSendTest}
                className="rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send test email"}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <h3 className="text-[14px] font-semibold text-[#fafafa]">
              Body preview
            </h3>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-3 text-[11px] leading-relaxed text-[#a1a1aa]">
              {campaign.bodyText.slice(0, 1200)}
              {campaign.bodyText.length > 1200 ? "…" : ""}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function SendsTab({ board }: { board: EmailBoard }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-[#262626] bg-[#141414] p-6">
        <h2 className="text-[16px] font-semibold text-[#fafafa]">
          Send ledger
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] text-[#a1a1aa]">
          Blast runs, Resend delivery/open/click events, and suppression will
          land here. Test sends already tag{" "}
          <code className="text-[#d4d4d8]">campaign</code> +{" "}
          <code className="text-[#d4d4d8]">kind=test</code> in Resend.
        </p>
        <ul className="mt-4 grid gap-2 text-[12px] text-[#71717a] sm:grid-cols-3">
          <li className="rounded-xl border border-[#1f1f1f] px-3 py-3">
            Webhook intake · delivered / opened / clicked / bounced
          </li>
          <li className="rounded-xl border border-[#1f1f1f] px-3 py-3">
            Blast dry-run + rate limits + idempotent ledger
          </li>
          <li className="rounded-xl border border-[#1f1f1f] px-3 py-3">
            Attribution join → Funnel paid / Circle Stripe
          </li>
        </ul>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Kind</th>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">To</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {board.recentSends.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[#71717a]"
                >
                  No sends logged yet — run a test from Campaigns to start the
                  trail once the ledger is wired.
                </td>
              </tr>
            ) : (
              board.recentSends.map((row) => (
                <tr key={row.id} className="border-t border-[#1f1f1f]">
                  <td className="px-4 py-3 text-[#a1a1aa]">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{row.kind}</td>
                  <td className="px-4 py-3">{row.campaignId ?? "—"}</td>
                  <td className="px-4 py-3">{row.to}</td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AutomationTab({ board }: { board: EmailBoard }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {board.automations.map((row) => (
        <article
          key={row.id}
          className="rounded-2xl border border-[#262626] bg-[#141414] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                {row.title}
              </h2>
              <p className="mt-1 text-[12px] text-[#71717a]">{row.trigger}</p>
            </div>
            <span className="rounded-md bg-[#262626] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#a1a1aa] uppercase">
              {row.status}
            </span>
          </div>
          <p className="mt-3 text-[12px] text-[#a1a1aa]">
            Audience · {row.audienceHint}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] text-[#d4d4d8]">
            {row.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
