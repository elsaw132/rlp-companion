import { renderToBuffer } from "@react-pdf/renderer";
import { createPlanPdfDocument } from "@/lib/rlpPlanPdf";
import type { RlpPlan } from "@/lib/rlpPlan";

// Renders the assembled plan to the downloadable keepsake PDF. The client POSTs
// the already-assembled RlpPlan (plus any generated scene images), so the still
// keepsake is built from exactly what's on screen. Node runtime: @react-pdf needs
// Node APIs, not the edge.

export const runtime = "nodejs";
export const maxDuration = 30;

type PdfRequest = { plan?: RlpPlan; images?: Record<string, string> };

export async function POST(request: Request): Promise<Response> {
  let body: PdfRequest;
  try {
    body = (await request.json()) as PdfRequest;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body.plan) return new Response("Missing plan", { status: 400 });

  try {
    const doc = createPlanPdfDocument(body.plan, body.images ?? {});
    const buffer = await renderToBuffer(doc);
    const name = body.plan.meta.name
      ? `Retirement-Life-Plan-${body.plan.meta.name.replace(/\s+/g, "-")}.pdf`
      : "Retirement-Life-Plan.pdf";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    console.error("[plan-pdf] render error:", error);
    return new Response("Could not generate PDF", { status: 500 });
  }
}
