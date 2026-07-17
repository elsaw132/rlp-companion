"use client";

import { useEffect, useRef } from "react";

// Measures how long a session actually took, and reports when it was finished.
//
// "Time spent" here means time the session was ON SCREEN — not wall-clock from
// opening to finishing. The programme suggests one session a day, so people open
// one, wander off, and come back tomorrow; elapsed time would record that as
// 1,400 minutes and quietly destroy the one number this exists to answer ("are
// these really 10–20 minutes?"). So the clock runs only while the tab is
// visible and this screen is mounted, and stops the moment the session is done.
//
// Each flush sends the time since the LAST flush and the server adds it on.
// Nothing sends a running total: a total from a stale tab could overwrite a good
// record with an old number, and one dropped request would cost the whole
// session rather than one slice.

const FLUSH_EVERY_MS = 30_000;

// Below this, a flush is noise — someone passing through, or a re-render. Not
// worth a request.
const MIN_FLUSH_MS = 1_000;

export function useModuleTimer(moduleId: string, completed: boolean) {
  // When the clock started running, or null while it's stopped (tab hidden,
  // or the session is finished).
  const runningSince = useRef<number | null>(null);
  // Time accumulated but not yet sent.
  const pendingMs = useRef(0);
  // Whether this mount has been counted as a visit yet.
  const countedVisit = useRef(false);
  // Completion is reported once, and stops the clock for good.
  const reportedComplete = useRef(false);
  const stopped = useRef(false);

  // Refs, not state: the listeners below are registered once and must not go
  // stale, and none of this should ever cause a re-render.
  const moduleIdRef = useRef(moduleId);
  // Kept current in an effect rather than assigned during render — a ref written
  // while rendering is a React rule violation, and it would be wrong under a
  // re-render that never commits.
  useEffect(() => {
    moduleIdRef.current = moduleId;
  }, [moduleId]);

  // Lets the completion effect send a flush without re-registering the
  // listeners. Declared here, with the other refs, so it exists before the
  // effect that fills it in.
  const senderRef = useRef<
    ((opts: { completed?: boolean; useBeacon?: boolean }) => void) | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const takeTime = () => {
      if (runningSince.current === null) return;
      const now = Date.now();
      pendingMs.current += now - runningSince.current;
      runningSince.current = now;
    };

    const send = (opts: { completed?: boolean; useBeacon?: boolean }) => {
      takeTime();
      const addMs = Math.round(pendingMs.current);
      const newVisit = !countedVisit.current;
      const isComplete = opts.completed === true;

      // Nothing worth saying.
      if (addMs < MIN_FLUSH_MS && !newVisit && !isComplete) return;

      pendingMs.current = 0;
      countedVisit.current = true;

      const body = JSON.stringify({
        moduleId: moduleIdRef.current,
        addMs,
        newVisit,
        completed: isComplete,
      });

      // On the way out, a normal fetch is cancelled with the page. sendBeacon
      // hands the request to the browser to deliver after we're gone; it carries
      // the session cookie, so it authenticates like any other request.
      if (opts.useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/module-progress",
          new Blob([body], { type: "application/json" })
        );
        return;
      }
      void fetch("/api/module-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Best-effort. A lost slice is a rounding error; it must never surface
        // to someone in the middle of a session.
      });
    };

    // Start the clock if we're actually being looked at.
    if (document.visibilityState === "visible") {
      runningSince.current = Date.now();
    }

    const onVisibility = () => {
      if (stopped.current) return;
      if (document.visibilityState === "visible") {
        runningSince.current = Date.now();
      } else {
        // Backgrounded: bank the time and stop the clock. A tab left open
        // overnight must not read as an eight-hour session.
        takeTime();
        runningSince.current = null;
        send({ useBeacon: true });
      }
    };

    const onPageHide = () => {
      if (stopped.current) return;
      takeTime();
      runningSince.current = null;
      send({ useBeacon: true });
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const interval = window.setInterval(() => {
      if (!stopped.current) send({});
    }, FLUSH_EVERY_MS);

    // Expose the sender so the completion effect below can reach it without
    // re-registering any of the above.
    senderRef.current = send;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(interval);
      // Leaving the screen (navigating on) — bank whatever is left.
      if (!stopped.current) {
        takeTime();
        runningSince.current = null;
        send({ useBeacon: true });
      }
      senderRef.current = null;
    };
    // Registered once per session screen. moduleId is read through a ref, so a
    // change of session doesn't tear down and lose the pending slice.
  }, []);

  // Finished: report it once, then stop the clock. Time spent afterwards — on
  // the feedback card, or re-reading — is not time spent doing the session, and
  // counting it would inflate the very number this measures.
  useEffect(() => {
    if (!completed || reportedComplete.current) return;
    reportedComplete.current = true;
    senderRef.current?.({ completed: true });
    stopped.current = true;
    runningSince.current = null;
  }, [completed]);
}
