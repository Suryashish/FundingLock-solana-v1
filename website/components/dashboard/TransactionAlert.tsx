"use client";

import React from "react";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface Props {
  successMessage: string | null;
  errorMessage: string | null;
  txSignature: string | null;
}

export const TransactionAlert: React.FC<Props> = ({
  successMessage,
  errorMessage,
  txSignature,
}) => {
  if (!successMessage && !errorMessage) return null;

  return (
    <div className="space-y-3">
      {successMessage && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-emerald-300">{successMessage}</p>
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-mono"
              >
                <span>View Transaction: {txSignature.slice(0, 16)}...</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-rose-300">Transaction Failed</p>
            <p className="text-xs text-rose-300/80 break-all">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

