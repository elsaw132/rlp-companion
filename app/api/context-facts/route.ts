import { auth } from "@clerk/nextjs/server";
import type { BuildResult } from "@/lib/modules";
import type { Dreams } from "@/lib/dreams";
import {
  factsFromBuild,
  factsFromDreams,
  normalizeDeltas,
} from "@/lib/contextFacts";
import {
  reconcileModuleFacts,
  applyConversationalDeltas,
} from "@/lib/contextCapture";

// Write path for the canonical context profile. The browser never sends a user
// id — it's derived from the Clerk session, so a request can only write its own
// facts. One POST endpoint with an `action` discriminator:
//
//  - reconcile        : make a module's widget_pick facts match its build
//                       (first capture AND re-edit diff — removed picks rejected)
//  - reconcileDreams  : make 1.money's facts match its dreams record (the
//                       achievable / pipe-dream split)
//  - conversational   : apply conversational deltas (additions + confirmed
//                       removals), returning any removals still awaiting
//                       confirmation
//
// Every branch self-guards: a malformed body returns 400 and never throws.

type Body =
  | { action: "reconcile"; moduleId?: string; build?: BuildResult }
  | { action: "reconcileDreams"; dreams?: Dreams }
  | {
      action: "conversational";
      moduleId?: string;
      deltas?: unknown;
      confirmedRemovalKeys?: string[];
    };

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    switch (body.action) {
      case "reconcile": {
        if (!body.moduleId || !body.build || typeof body.build !== "object") {
          return new Response("Missing moduleId or build", { status: 400 });
        }
        const desired = factsFromBuild(body.moduleId, body.build);
        const result = await reconcileModuleFacts(
          userId,
          body.moduleId,
          desired,
          "widget_pick"
        );
        return Response.json({ ok: true, ...result });
      }

      case "reconcileDreams": {
        if (!body.dreams || !Array.isArray(body.dreams.allDreams)) {
          return new Response("Missing dreams record", { status: 400 });
        }
        const desired = factsFromDreams(body.dreams);
        const result = await reconcileModuleFacts(
          userId,
          "1.money",
          desired,
          "confirmed_takeaway"
        );
        return Response.json({ ok: true, ...result });
      }

      case "conversational": {
        if (!body.moduleId) {
          return new Response("Missing moduleId", { status: 400 });
        }
        const deltas = normalizeDeltas(body.deltas);
        const result = await applyConversationalDeltas(
          userId,
          body.moduleId,
          deltas,
          Array.isArray(body.confirmedRemovalKeys) ? body.confirmedRemovalKeys : []
        );
        return Response.json({ ok: true, ...result });
      }

      default:
        return new Response("Unknown action", { status: 400 });
    }
  } catch {
    // Capture is best-effort — never surface a 500 that could block a module
    // close. The client treats a non-ok response as "facts not captured this
    // time" and carries on.
    return new Response("Capture failed", { status: 200 });
  }
}
