"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { absoluteUrl } from "@/lib/site";
import { setShareEnabled, type ShareResult } from "./actions";

/**
 * Owner-side opt-in share control (UI-STYLE-GUIDE: "Dialog for share confirm").
 * Private by default — enabling generates a public `/r/[token]` link the owner
 * can copy; disabling revokes it. The public route never includes the plan.
 */
export function ShareControls({
  analysisId,
  shareEnabled: initialEnabled,
  shareToken: initialToken,
}: {
  analysisId: string;
  shareEnabled: boolean;
  shareToken: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl = token ? absoluteUrl(`/r/${token}`) : null;

  function apply(next: boolean) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result: ShareResult = await setShareEnabled(analysisId, next);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEnabled(result.shareEnabled);
      setToken(result.shareToken);
    });
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the URL is visible for manual copy anyway.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-foreground">
            Share this report
          </span>
          <span className="text-[13px] text-muted-foreground">
            {enabled
              ? "Anyone with the link can view this report (without your realization plan)."
              : "Private by default. Create a public link to share it."}
          </span>
        </div>

        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Share2 className="size-3.5" aria-hidden />
                {enabled ? "Manage link" : "Share"}
              </Button>
            }
          />
          <DialogContent>
            <DialogTitle>Share this report</DialogTitle>
            <DialogDescription>
              A public link lets anyone view this report — the score, criteria, and
              evidence. Your paid realization plan is never included. You can turn
              the link off at any time.
            </DialogDescription>

            {enabled && shareUrl && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  {shareUrl}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={copy}
                  aria-label="Copy link"
                >
                  {copied ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                </Button>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              {enabled ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => apply(false)}
                  disabled={isPending}
                >
                  {isPending ? "Working…" : "Stop sharing"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => apply(true)}
                  disabled={isPending}
                >
                  {isPending ? "Creating…" : "Create public link"}
                </Button>
              )}
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Done
                  </Button>
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
