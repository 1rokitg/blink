"use client";

import { useState } from "react";

import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { reportIssueEvent } from "~/lib/blink/issue-reporting";

type IssueReportButtonProps = {
  category: string;
  source: string;
  triggerLabel?: string;
  walletAddress?: string | null;
  defaultSummary?: string;
  defaultDescription?: string;
  metadata?: Record<string, unknown>;
};

export function IssueReportButton(props: IssueReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(
    props.defaultSummary ?? "Wallet / verification issue",
  );
  const [description, setDescription] = useState(
    props.defaultDescription ?? "",
  );

  function openReportDialog() {
    setSummary(props.defaultSummary ?? "Wallet / verification issue");
    setDescription(props.defaultDescription ?? "");
    setOpen(true);
  }

  async function handleSubmit() {
    const trimmedSummary = summary.trim();
    const trimmedDescription = description.trim();

    if (!trimmedSummary) {
      toast.error("Add a short summary first.");
      return;
    }

    setSubmitting(true);
    try {
      await reportIssueEvent({
        eventType: "issue_feedback",
        category: props.category,
        source: props.source,
        summary: trimmedSummary,
        description: trimmedDescription || null,
        walletAddress: props.walletAddress,
        metadata: props.metadata,
      });
      toast.success("Issue report sent to Blink internal tools.");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReportDialog}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200/90 transition hover:text-white"
      >
        <AlertTriangle className="size-3.5" />
        {props.triggerLabel ?? "Report issue"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0c1119] p-0 sm:max-w-[560px]">
          <div className="border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-white">
              Report an issue
            </DialogTitle>
            <p className="mt-2 text-sm text-white/55">
              This sends the problem straight into Blink internal tools together
              with page context so the team can inspect it faster.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/42">
                Summary
              </p>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="h-11 border-white/10 bg-white/[0.04] text-white"
              />
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/42">
                Details
              </p>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="What happened? Which wallet or step failed? Paste any message you saw."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>

            <div className="rounded-2xl border border-[#8fbaff20] bg-[#8fbaff0a] px-4 py-3 text-xs text-white/48">
              Wallet, page path, browser request metadata, and any provided
              context will be attached automatically.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-xl border border-white/10 px-4 text-sm text-white/65 transition hover:bg-white/[0.05] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#8fbaff55] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-4 text-sm font-medium text-white shadow-[0_16px_40px_rgba(37,90,224,0.22)] transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Send report
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
