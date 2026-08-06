import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The marketing home (/), the Clerk auth routes, the privacy notice, and
// robots.txt are public; every other route requires auth. The privacy notice
// must be readable without signing in (it's linked from the onboarding consent
// step and referenced publicly). robots.txt must be reachable by crawlers
// un-gated — `.txt` isn't in the static-file exclusions of the matcher below, so
// it would otherwise hit auth.protect() and redirect to sign-in.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy",
  "/robots.txt",
  // The churned-participant exit survey and its API. Public because most of the
  // people it's sent to never made an account, so it must work with no sign-in.
  "/exit-survey(.*)",
  "/api/exit-survey",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
