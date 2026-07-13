import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import MarketingHome from "./components/MarketingHome";

// The public route. Signed-in visitors go straight to their dashboard; signed-out
// visitors get the marketing home (this replaces the old redirect to /sign-in).
export const metadata: Metadata = {
  title: "Chorus Life — Design a life after work you'll love",
  description:
    "Picture, shape and plan the years ahead with Chorus Life — build your own Retirement Life Plan, one bite-sized session at a time.",
};

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/home");
  return <MarketingHome />;
}
