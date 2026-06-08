"use client";

// TEMPORARY PREVIEW PAGE — for looking at the Stage 1 opening capture screen
// without going through the real flow or touching any saved data. Nothing here
// is persisted: onComplete just reports what happened and re-mounts the screen
// so both paths (save / skip) can be replayed. Safe to delete once reviewed.

import { useState } from "react";
import ProviderBand from "../../components/ProviderBand";
import OpeningCapture from "../../components/OpeningCapture";

export default function OpeningCapturePreviewPage() {
  // Bumping the key re-mounts OpeningCapture for a fresh run.
  const [run, setRun] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <>
      <ProviderBand />
      <div
        style={{
          background: "var(--info-surface)",
          borderBottom: "1px solid var(--info-line)",
          padding: "10px 18px",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--info-text)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>Preview mode</strong>
        <span>Nothing here is saved. Your real data is untouched.</span>
        {lastAction && <span>· Last run: {lastAction}</span>}
        <button
          type="button"
          onClick={() => {
            setLastAction(null);
            setRun((n) => n + 1);
          }}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid var(--info-line)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--info-text)",
          }}
        >
          Replay
        </button>
      </div>

      <OpeningCapture
        key={run}
        onComplete={(text) => {
          setLastAction(
            text ? `saved — "${text}"` : "skipped (nothing saved)"
          );
          setRun((n) => n + 1);
        }}
      />
    </>
  );
}
