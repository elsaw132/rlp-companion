import type { MetadataRoute } from "next";

// This is the app domain (app.chorus-life.com), which stays out of search during
// the pilot — the public front door and discovery live on chorus-life.com. Every
// crawler is disallowed from the whole app; paired with the site-wide
// `robots: { index: false, follow: false }` metadata in app/layout.tsx.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
