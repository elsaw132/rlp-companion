# Chorus Life — Design Extract

A self-contained reference for rebuilding the exact Chorus Life look-and-feel in a standalone HTML file, without the repo. Every value below is copied literally from the current build (Tailwind v4 + Next.js 16, `next/font`). Source files: `app/tokens.css`, `app/globals.css`, `app/layout.tsx`, and the shared components under `app/components/`.

---

## 1. Fonts

Two families, loaded via `next/font/google` (self-hosted — the font files are served from our own domain and preloaded, no render-blocking request to Google). Each exposes a CSS variable that `tokens.css` feeds into `--font-sans` / `--font-serif`.

From `app/layout.tsx`:

```tsx
import { Inter, Source_Serif_4 } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});
// applied on <html>: className={`h-full ${inter.variable} ${sourceSerif.variable}`}
```

**Body / UI / controls → Inter (sans).**
**Headings / display / "feel" moments → Source Serif 4 (serif).**
Rule of thumb from the design system: *if the user is meant to feel it, it's serif; if it's a control, label, or status, it's sans.*

Fallback stacks (from `tokens.css`):

```css
--font-serif: var(--font-source-serif), "Source Serif 4", "Lora", Georgia, serif;
--font-sans:  var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

Weights actually used: **Inter** 400 (body), 500 (secondary/desc), 600 (buttons, labels, links), 700 (section heads, avatars, badges, eyebrows). **Source Serif 4** 600 (all display/heading uses). Only regular (non-italic) styles are used.

**To reproduce in standalone HTML without next/font**, load from Google Fonts CDN (this is how the pre-rebrand reference did it, same families):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
```
Then set `--font-sans` to `"Inter", -apple-system, …` and `--font-serif` to `"Source Serif 4", "Lora", Georgia, serif`.

---

## 2. Colour tokens

### 2a. Raw Chorus brand palette (the 8 exact hexes — never approximated)

| Token | Hex | Role |
|---|---|---|
| `--chorus-dark-green` | `#0A322D` | Structural brand colour: header band, primary text/ink, marks on pale stages |
| `--chorus-green` | `#00645F` | Interaction colour: buttons, links, selected controls, focus ring |
| `--chorus-purple` | `#322D69` | Vita's stable identity (coach mark/name), across all stages |
| `--chorus-orange` | `#DC6437` | Accent = the single current step / "do this next" cursor; Plan stage colour |
| `--chorus-blue` | `#C3F5FF` | Stage colour: Imagine |
| `--chorus-yellow` | `#FFEBC8` | Stage colour: Explore |
| `--chorus-pink` | `#FFEBFF` | Stage colour: Understand |
| `--chorus-lime` | `#D7FF73` | Small header accent (band divider), focus ring on dark band |

> Rule from the brand book: pair Dark Green (or Purple) with the light colours for contrast.

### 2b. Semantic brand tokens (reference these, not the raw palette)

```css
--color-brand-primary:      var(--chorus-dark-green);   /* structural */
--color-brand-accent:       var(--chorus-lime);         /* header accent */
--color-interactive-primary:var(--chorus-green);        /* interaction */
--color-interactive-hover:  color-mix(in srgb, var(--chorus-green) 85%, #000);
--color-vita:               var(--chorus-purple);       /* coach identity */
```

### 2c. Stage wayfinding colours + readable foregrounds

```css
--color-stage-imagine:   var(--chorus-blue);    /* #C3F5FF */
--color-stage-explore:   var(--chorus-yellow);  /* #FFEBC8 */
--color-stage-understand:var(--chorus-pink);    /* #FFEBFF */
--color-stage-plan:      var(--chorus-orange);  /* #DC6437 */
--color-stage-act:       var(--chorus-green);   /* #00645F */

/* Foreground for content sitting ON a stage-colour fill:
   dark green on the 3 pale stages, white on the 2 dark ones (Plan/Act). */
--color-on-stage-imagine:   var(--chorus-dark-green);
--color-on-stage-explore:   var(--chorus-dark-green);
--color-on-stage-understand:var(--chorus-dark-green);
--color-on-stage-plan:      #fff;
--color-on-stage-act:       #fff;
```

### 2d. Semantic neutrals

```css
--color-surface-page:   #fff;      /* page background surface */
--color-surface-card:   #fff;      /* card surface */
--color-surface-subtle: #FAFAF8;   /* subtle alt surface */
--color-border-default: #E9E9E4;   /* hairline borders */
--color-text-primary:   var(--chorus-dark-green);  /* primary ink */
--color-text-secondary: #7C7F86;   /* secondary text */
--color-text-on-dark:   #fff;      /* text on dark surfaces */
```

### 2e. Product brand layer (mapped onto Chorus semantics — what components actually consume)

```css
--brand-primary:      var(--color-interactive-primary);  /* = #00645F green: buttons, links, selected */
--brand-primary-hover:var(--color-interactive-hover);    /* green mixed 15% black */
--brand-primary-tint: color-mix(in srgb, var(--chorus-green) 12%, #fff);  /* pale green hover fill / menu hover */
--brand-on-primary:   #fff;
--brand-band:         var(--color-brand-primary);        /* = #0A322D dark green header band */
--brand-on-band:      var(--color-text-on-dark);         /* #fff on the band */
```

### 2f. Warm / coach surfaces (Vita presence)

```css
--warm-surface:  #FBF7EC;   /* cream — appears only where Vita/coach is present (hero, picture-card) */
--warm-surface-2:#FCF8EF;
--warm-line:     #EFE6D2;   /* border on warm surfaces */
--coach-pill:    #FFE36B;
--coach-pill-text:#5A4300;
--sun:           #FBD24E;   /* sun/illustration accent, picture-card icon */
```

### 2g. Orange accent (current-step cursor)

```css
--accent:        var(--chorus-orange);                             /* #DC6437 */
--accent-hover:  color-mix(in srgb, var(--chorus-orange) 88%, #000);
--accent-strong: color-mix(in srgb, var(--chorus-orange) 78%, #000);
--accent-surface:color-mix(in srgb, var(--chorus-orange) 8%, #fff); /* active card wash */
--accent-line:   color-mix(in srgb, var(--chorus-orange) 30%, #fff);/* active card border */
```

### 2h. Text / background / border neutrals

```css
--ink:         var(--color-text-primary);  /* dark green ink for headings */
--text:        #3A3D44;   /* body copy */
--text-muted:  #7C7F86;   /* muted/secondary */
--text-faint:  #A6A8AE;   /* faintest (reset link etc.) */
--bg:          #fff;
--bg-alt:      #FAFAF8;   /* body background */
--surface:     #fff;
--border:      #E9E9E4;
--border-strong:#DCDCD6;  /* ghost-button border, hover borders */
```

### 2i. Status / info / illustration

```css
--success:     #2F8B4E;  --success-text:#2C7A46;  --success-surface:#EAF5ED;  --success-line:#BFE0C4;
--muted-surface:#EFEEE9;  /* "not started" badge fill */
/* Info callout — retinted off the old Lionsgate blue onto the Chorus green family */
--info-surface:color-mix(in srgb, var(--chorus-green) 6%, #fff);
--info-line:   color-mix(in srgb, var(--chorus-green) 18%, #fff);
--info-text:   var(--color-text-primary);
/* Landscape illustration palette (hero scene gradient) */
--ill-sky:#A4CCE5; --ill-sky-pale:#C9E0EE; --ill-hill:#5B9F4A; --ill-hill-deep:#3F7F36;
--ill-path:#C7A53A; --ill-lavender:#D0CCEF;
```

### 2j. Stage 2 (Explore) area accents — base / selected / readable foreground (no orange)

```css
--area-active-base:#E7F2DA;    --area-active-sel:#BFDD97;    --area-active-fg:#2C5A1A;
--area-cognitive-base:#ECEAF8; --area-cognitive-sel:#CCC8F0; --area-cognitive-fg:#463C8C;
--area-social-base:#E4F0FA;    --area-social-sel:#B4D5F1;    --area-social-fg:#0C447C;
--area-purpose-base:#F4E9C8;   --area-purpose-sel:#E8D08A;   --area-purpose-fg:#6B5310;
--area-vitality-base:#DCF1E9;  --area-vitality-sel:#9FE1CB;  --area-vitality-fg:#0A5544;
--area-senses-base:#E6EDF2;    --area-senses-sel:#C2D2DE;    --area-senses-fg:#3A5566;
```

### 2k. Stage 3 (Understand) reveal card washes

```css
--reveal-strengths-wash:#FAEEDA; --reveal-strengths-fg:#8A5A12;
--reveal-values-wash:#FBEAF0;    --reveal-values-fg:#8E3957;
--reveal-protect-wash:#EAF3DE;   --reveal-protect-fg:#3C6312;
--reveal-clear-wash:#E9EFF6;     --reveal-clear-fg:#2E517D;
--reveal-forward-wash:#E8EEF6;   --reveal-forward-fg:var(--chorus-dark-green);
```

---

## 3. Scales

### Type scale (literal, from `tokens.css`)

```css
--fs-display:34px;  --fs-h2:22px;  --fs-title:20px;  --fs-section:18px;
--fs-body:16px;     --fs-sm:14px;  --fs-label:12.5px; --fs-eyebrow:11.5px;
--lh-body:1.6;
```

| Role | Size | Weight | Line-height | Font |
|---|---|---|---|---|
| Greeting / display | 34px (`--fs-display`) | 600 | 1.15 | **serif** |
| Hero next-step title | 23px (in-component) | 600 | 1.2 | **serif** |
| Section / H2 | 22–24px (`--fs-h2`) | 600 | 1.2 | **serif** |
| Card / module title | 19–20px (`--fs-title`) | 600 | 1.2 | **serif** |
| Vita name | 20px | 600 | — | **serif** (colour `--color-vita`) |
| Section heading (list) | 18px (`--fs-section`) | 700 | — | **sans** |
| Body / reading | 16px (`--fs-body`) | 400 | 1.6 | sans |
| Secondary / description | 14px (`--fs-sm`) | 500 | ~1.5 | sans |
| Nav subtitle / label | 12.5px (`--fs-label`) | 500–600 | 1.35 | sans |
| Overline / eyebrow | 11.5px (`--fs-eyebrow`) | 600–700 | — | sans, UPPERCASE, `letter-spacing:.1em`, muted |

### Border-radius scale

```css
--r-xs:6px;  --r-sm:10px;  --r-md:14px;  --r-lg:18px;  --r-pill:999px;
```

### Shadows

```css
--shadow-sm:0 1px 2px rgba(16,32,46,.05), 0 1px 3px rgba(16,32,46,.04);
--shadow-md:0 2px 6px rgba(16,32,46,.05), 0 10px 28px rgba(16,32,46,.06);
```

### Layout metrics

```css
--header-h:68px;    --sidebar-w:280px;    --content-max:720px;
/* home shell max-width is 1180px (in-component) */
```

### Focus rings

```css
--focus-ring:       0 0 0 3px color-mix(in srgb, var(--chorus-green) 45%, transparent);   /* on light surfaces */
--focus-ring-accent:0 0 0 3px color-mix(in srgb, var(--chorus-lime) 75%, transparent);    /* on the dark-green band */
```

### Spacing
There is no numeric spacing token scale — spacing is applied ad hoc in px inside component CSS. Observed rhythm: cards padded `18px`; hero body `28px 28px 30px`; section gaps `12px` between cards, `28–34px` between blocks; touch minimum enforced at **44px** (`min-height:44px`) and buttons at **48px**.

### Base body (from `globals.css`)

```css
body{
  font-family: var(--font-sans);
  font-size: var(--fs-body);      /* 16px */
  line-height: var(--lh-body);    /* 1.6 */
  color: var(--text);             /* #3A3D44 */
  background: var(--bg-alt);      /* #FAFAF8 */
  -webkit-font-smoothing: antialiased;
}
```

---

## 4. Core components

There is **no shared `<Button>` React component** — button classes (`.btn`, `.btn-navy`, `.btn-ghost`) are redeclared inside each component's inline `<style>` block, all consuming the same tokens, so they render identically. Canonical class strings below.

### Buttons

**Primary (navy = Chorus green fill), from HomeDashboard / StageReveal:**
```css
.btn{font-family:var(--font-sans);font-size:15px;font-weight:600;border:none;border-radius:var(--r-sm);
     padding:13px 20px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1;min-height:48px}
.btn-navy{background:var(--brand-primary);color:#fff}         /* #00645F green, white text */
.btn-navy:hover{background:var(--brand-primary-hover)}        /* green mixed 15% black */
.btn:focus-visible{box-shadow:var(--focus-ring)}
```
(In `StageIntro` the primary is slightly larger: `font-size:15px; padding:14px 26px; border-radius:var(--r-sm); min-height:48px`.)

**Ghost (secondary), from StageReveal:**
```css
.btn-ghost{font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--brand-primary);
           background:transparent;border:1.5px solid var(--border-strong);border-radius:var(--r-sm);
           padding:13px 22px;min-height:48px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1}
.btn-ghost:hover{background:var(--brand-primary-tint)}         /* pale green wash */
```

Markup: `<a class="btn btn-navy">Continue with Vita →</a>` — the primary next-step CTA label is **"Continue with Vita"**.

### Links

Links inherit colour and drop underline by default; interactive text links use `--brand-primary` (green) weight 600, underline on hover:
```css
.rlp-home a{color:inherit;text-decoration:none}
.link-back{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;
           color:var(--brand-primary);padding:8px 0;min-height:44px}
.link-back:hover{text-decoration:underline}
```

### Card (the module "scard" — the canonical card)

```css
.scard{display:grid;grid-template-columns:88px minmax(0,1fr) auto auto;gap:18px;align-items:center;
       background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:18px;box-shadow:var(--shadow-sm)}
/* current-step (active) card: orange wash + orange hairline, lifted shadow */
.scard.is-active{background:var(--accent-surface);border-color:var(--accent-line);box-shadow:var(--shadow-md)}
/* completed card is clickable, hover lifts border+shadow */
.scard-done{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}
.scard-done:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.scard .title{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink);line-height:1.2}
.scard .desc{font-size:14px;color:var(--text-muted);margin-top:5px;max-width:34ch}
```
Status badges on cards:
```css
.badge{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;border-radius:var(--r-pill);padding:7px 14px;white-space:nowrap}
.badge-complete{color:var(--success-text);background:#fff;border:1.5px solid var(--success-line)}
.badge-notstarted{color:var(--text-muted);background:var(--muted-surface)}
.chip-time{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--text-muted);
           background:#fff;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 12px;font-weight:500}
```

### Header / nav — the "ProviderBand" (dark-green band, desktop; hidden ≤880px)

Structure (JSX, from `ProviderBand.tsx`):
```html
<header class="rlp-band">
  <a class="brand" href="/home">
    <img class="logo" src="/chorus-life-logo-white.svg" alt="Chorus Life" width="76" height="24">
    <span class="brand-divider"></span>
    <span class="descriptor">Your retirement coach</span>
  </a>
  <div class="right">
    <button class="support">◎ Support</button>
    <div class="account">
      <button class="user"><span>Name</span><span class="avatar">EW</span></button>
      <!-- dropdown .menu with .menu-identity + .menu-item -->
    </div>
  </div>
</header>
```
CSS (literal):
```css
.rlp-band{height:var(--header-h);background:var(--brand-band);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:10}
@media (max-width:880px){.rlp-band{display:none}}   /* mobile uses MobileAppBar instead */
.rlp-band .brand{display:flex;align-items:center;gap:14px;text-decoration:none;border-radius:var(--r-sm)}
.rlp-band .brand:focus-visible{outline:none;box-shadow:var(--focus-ring-accent)}
.rlp-band .logo{height:24px;width:auto;display:block}
.rlp-band .brand-divider{width:1px;height:26px;background:var(--color-brand-accent);flex:none}  /* lime divider */
.rlp-band .descriptor{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-on-band);letter-spacing:.01em;line-height:1.2}
.rlp-band .right{display:flex;align-items:center;gap:20px}
.rlp-band .support{font-family:inherit;font-size:14px;font-weight:600;color:var(--brand-on-band);display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;min-height:44px}
.rlp-band .support:hover{text-decoration:underline;text-underline-offset:3px}
.rlp-band .user{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600;color:var(--brand-on-band);background:none;border:none;cursor:pointer;font-family:inherit;min-height:44px}
.rlp-band .avatar{width:34px;height:34px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
/* account dropdown */
.rlp-band .menu{position:absolute;top:calc(100% + 10px);right:0;z-index:50;min-width:220px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);padding:8px;display:flex;flex-direction:column;gap:4px}
.rlp-band .menu-item{text-align:left;background:none;border:none;border-radius:var(--r-sm);padding:10px;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);cursor:pointer;min-height:44px}
.rlp-band .menu-item:hover{background:var(--brand-primary-tint)}
```
Focus states on the band use `--focus-ring-accent` (lime) because green wouldn't show against dark green.

**Mobile app bar** (`≤880px`, replaces the band): `background:var(--brand-band)`, sticky, `min-height:calc(54px + env(safe-area-inset-top))`, all text/icons white, focus ring lime.

---

## 5. Landing / marketing / public page

**There is no logged-out marketing/landing page in this app.** The public routes are auth only:

- `app/page.tsx` — redirects: `redirect(userId ? "/home" : "/sign-in")`.
- `app/sign-in/[[...sign-in]]/page.tsx` — renders Clerk's `<SignIn />` centred, no custom chrome:
  ```tsx
  <div className="flex min-h-screen items-center justify-center"><SignIn /></div>
  ```
- `app/sign-up/[[...sign-up]]/page.tsx` — same pattern with `<SignUp />`.

The closest thing to a "home / hero" is the **authenticated `/home` dashboard** (`HomeDashboard.tsx`), whose hero section is the primary composed layout. Its JSX and CSS:

**Hero JSX:**
```html
<section class="hero">
  <div class="body">
    <div class="vita"><VitaMark size=36 /><span class="name">Vita</span></div>
    <span class="coachpill">Your retirement coach</span>
    <p class="intro">{heroIntro}</p>
    <div class="ns-eyebrow">Your next step</div>
    <div class="ns-title">{nextModule.title}</div>
    <div class="ctarow">
      <a class="btn btn-navy" href="/session/{id}">Continue with Vita</a>
      <span class="chip-time">🕐 {min} min</span>
    </div>
  </div>
  <div class="scene"><!-- hero photo OR gradient sky+sun+clouds --></div>
</section>
```

**Hero CSS (literal):**
```css
.hero{display:grid;grid-template-columns:1.05fr .95fr;background:var(--warm-surface);border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--warm-line);box-shadow:var(--shadow-md);margin-bottom:34px}
.hero .body{padding:28px 28px 30px}
.hero .vita{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.hero .vita .name{font-family:var(--font-serif);font-size:20px;font-weight:600;color:var(--color-vita)}
.coachpill{display:inline-block;background:var(--color-vita);color:#fff;font-size:12px;font-weight:700;padding:5px 11px;border-radius:var(--r-sm);margin-bottom:16px}
.hero p.intro{font-size:15px;color:var(--text);line-height:1.6;margin-bottom:22px}
.hero .ns-eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:3px}
.hero .ns-title{font-family:var(--font-serif);font-size:23px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:18px}
.hero .ctarow{display:flex;align-items:center;gap:14px}
/* Gradient "sky" scene fallback when there's no stage photo */
.hero .scene{background:linear-gradient(var(--ill-sky-pale),var(--ill-sky) 42%,var(--ill-hill) 60%,var(--ill-hill-deep));position:relative}
.hero .scene .sun-ill{position:absolute;right:30px;top:34px;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle,#FFF3CF,var(--sun));box-shadow:0 0 30px rgba(251,210,78,.6)}
.hero .scene .cloud{position:absolute;width:64px;height:18px;background:rgba(255,255,255,.7);border-radius:20px;top:74px;right:54px}
.hero .scene .cloud.two{width:44px;top:104px;right:120px;opacity:.6}
.scene-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
```

**Page shell + greeting:**
```css
.rlp-home .shell{display:flex;align-items:flex-start;max-width:1180px;margin:0 auto}
.rlp-home .sidebar{width:var(--sidebar-w);flex-shrink:0;padding:28px 20px 40px;border-right:1px solid var(--border);min-height:calc(100vh - var(--header-h));position:sticky;top:var(--header-h);display:flex;flex-direction:column}
.rlp-home .main{flex:1;min-width:0;padding:34px 40px 80px;display:flex;justify-content:center}
.rlp-home .col{width:100%;max-width:var(--content-max)}
.greeting{font-family:var(--font-serif);font-size:34px;font-weight:600;color:var(--ink);line-height:1.15;margin-bottom:6px}
.greet-sub{font-size:14px;color:var(--text-muted);margin-bottom:28px}
```
(Greeting text is time-based: "Good morning / afternoon / evening" + name.)

Below the shell (≤880px) the sidebar is hidden and hero collapses to one column with a 170px photo band.

---

## 6. Graphics & imagery

### The Chorus bloom "C" mark
The brand is the **Chorus Life bloom** — five hand-like curved petals forming a loose "C", not a literal letter C. Two forms:

1. **Full wordmark (supplied art, never redrawn):** `/public/chorus-life-logo.svg` (black on transparent, viewBox `0 0 1000 316.91`) and `/public/chorus-life-logo-white.svg` (white, `fill:#fff`). Used white on the dark-green band at `height:24px`. There's also `/public/chorus-life-icon-white.svg` (icon only).

2. **Vita mark — the ONE shared coach icon** (`VitaMark.tsx`): a flat `--color-vita` (Chorus purple `#322D69`) disc holding the bloom icon in white. The bloom is the supplied `ChorusLife_SocialIcon` paths, viewBox `0 0 524.72535 500`, recoloured white. **Never redraw or approximate the mark.** Reproduce it as:
```html
<span style="width:34px;height:34px;border-radius:50%;background:var(--color-vita);display:grid;place-items:center;flex-shrink:0" aria-hidden="true">
  <svg width="18.36" height="17.5" viewBox="0 0 524.72535 500" fill="#fff">
    <path d="M348.51114,88.2401C348.51114,48.44079,327.8228,15.4933,298.05583,0l-14.18089,24.57136c22.13285,9.90043,37.82488,34.68406,37.82488,63.66874,0,37.71874-26.55972,68.90368-59.33484,68.90368s-59.33465-31.18494-59.33465-68.90368c0-28.98468,15.69183-53.76831,37.82469-63.66874L226.67412,0c-29.76678,15.4933-50.45512,48.44079-50.45512,88.2401,0,54.32534,38.56708,95.71482,86.14598,95.71482s86.14616-41.38948,86.14616-95.71482Z"/>
    <path d="M185.98018,239.45379c14.7033-45.25067-12.74278-94.7197-64.40925-111.50734-37.85141-12.29904-75.57805-2.80434-99.51203,20.71732l18.98658,21.08052c16.25507-17.98976,44.67407-25.25522,72.24077-16.29873,35.87245,11.6562,57.32295,46.55216,47.19481,77.72355-10.12813,31.17177-47.99403,46.79454-83.86667,35.13721-27.56652-8.95536-46.28813-31.5376-48.86307-55.6464L0,216.55352c5.53604,33.09728,30.47868,62.95289,68.32972,75.25193,51.66666,16.78952,102.94735-7.10099,117.65046-52.35165Z"/>
    <path d="M215.15794,329.24605c-38.49124-27.96434-94.02247-17.14971-125.95338,26.80098-23.39351,32.19738-26.02283,71.01362-11.04798,101.04273l25.91557-11.54329c-12.08714-21.01993-10.21432-50.29366,6.82247-73.74381,22.17011-30.51463,61.98825-40.13127,88.50394-20.86637,26.51569,19.26529,29.67269,60.10376,7.50257,90.62065-17.03679,23.44789-44.29883,34.2757-68.02486,29.27674l-2.96994,28.2135c33.18874,4.96207,69.29172-9.53159,92.68504-41.72934,31.93129-43.95068,25.05801-100.10481-13.43342-128.07179Z"/>
    <path d="M309.57033,329.24341c-38.49275,27.96697-45.36716,84.1211-13.43361,128.07179,23.39219,32.19738,59.49667,46.69405,92.68542,41.72934l-2.97107-28.2135c-23.7234,5.00159-50.98806-5.82622-68.02392-29.27674-22.17011-30.51425-19.0133-71.35574,7.50126-90.62065,26.5172-19.26491,66.33269-9.64563,88.50281,20.869,17.03849,23.44752,18.90999,52.72125,6.82285,73.7408l25.91538,11.54404c14.97635-30.02949,12.34684-68.84572-11.0478-101.04348-31.92997-43.95031-87.45857-54.76494-125.95131-26.8006Z"/>
    <path d="M448.11331,266.30746c-35.87396,11.65244-73.73854-3.96808-83.86667-35.13947-10.12813-31.17177,11.32085-66.06773,47.195-77.72543,27.56689-8.95649,55.98438-1.69103,72.24096,16.29873l18.98658-21.08052c-23.93285-23.52204-61.66212-33.01674-99.51353-20.7177-51.66666,16.78952-79.11424,66.25855-64.41095,111.50809,14.70311,45.24954,65.98549,69.13703,117.65196,52.35052,37.85141-12.29641,62.79406-42.15351,68.32868-75.24967l-27.74971-5.89509c-2.57645,24.1103-21.29806,46.69142-48.86232,55.65054Z"/>
  </svg>
</span>
```
(The disc holds the bloom in a box ~54% of the disc diameter, preserving native aspect `500/524.72535`.)

The favicon `app/icon.svg` is the same bloom in black on a white rounded canvas.

### Illustrated module thumbnails (pure CSS, no images)
Each stage's 88×72 thumbnails share one light wash of the stage colour (`background:var(--stage-wash)`), with line-work drawn in Chorus dark green via `::after` shapes. Examples:
```css
.thumb{width:88px;height:72px;border-radius:var(--r-md);overflow:hidden;position:relative;flex-shrink:0;background:var(--stage-wash)}
.thumb.mtn::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:34px solid var(--color-brand-primary)}      /* mountain */
.thumb.sunrise::after{content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:var(--color-brand-primary)}                                        /* rising sun */
.thumb.cal::after{content:"";width:46px;height:34px;border-radius:6px;background:var(--color-brand-primary);box-shadow:inset 0 8px 0 color-mix(in srgb,var(--color-brand-primary) 55%,#fff)}                        /* calendar */
```
Thumb keys used per stage in order: `sunrise, roles, cal, keep, mtn, future`.

### Hero photography
Stage hero photos live in `/public/hero/`: `imagine.jpg`, `explore.jpg`, `understand.jpg`, `plan.jpg`, `act.jpg` (~1000×1000 square, cropped to the slot with `object-fit:cover`). Shown in the hero scene slot and the completion panel.

### Radial progress ring (sidebar "clarity")
```css
.radial{--p:0;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--stage-color,var(--brand-primary)) calc(var(--p)*1%),var(--border) 0)}
.radial::before{content:"";position:absolute;width:58px;height:58px;border-radius:50%;background:#fff}
```

---

## 7. Anything distinctive

- **Vita, the coach, has a fixed identity.** Always Chorus **purple** (`--color-vita` `#322D69`), the same across all five stages, presented as the round bloom disc (VitaMark) + a serif "Vita" name label + a purple `.coachpill` reading "Your retirement coach". Cream/warm surfaces (`--warm-surface #FBF7EC`) appear **only where Vita is present** (the hero, the picture-card). The primary CTA everywhere is **"Continue with Vita →"** in green.

- **Orange is a cursor, not decoration.** `--accent` (`#DC6437`) marks the *single* current step and nothing else — the active module card gets the orange wash/border (`--accent-surface`/`--accent-line`); the step-dots use orange only for the active dot. Green = interactive/complete; grey = not-yet-available; pale-green info panel = gentle orientation.

- **Stage colour system.** Five wayfinding colours (Imagine blue / Explore yellow / Understand pink / Plan orange / Act green). All stage surfaces use the same treatment: a **light tint wash** of the stage colour as fill + a **crisp solid mark** on top (never a heavy solid block). The three pale stages (blue/yellow/pink) render their marks in **dark green** (too pale otherwise); Plan/Act render marks in their own saturated colour. Centralised in `lib/stageColors.ts` — `stageWashFor()` mixes pale stages at 42–55% and Plan/Act at 11%.

- **Two focus rings by surface.** Green ring (`--focus-ring`) on light surfaces; lime ring (`--focus-ring-accent`) on the dark-green band/app bar.

- **Motion.** Dashboard content rises in on load — `@keyframes rlp-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}` with staggered `nth-child` delays (.02s→.27s), all wrapped in `@media (prefers-reduced-motion:no-preference)`. Card/panel hovers transition `border-color`/`box-shadow` over `.15s ease`.

- **Section background rhythm.** Body is off-white `#FAFAF8`; cards/panels are pure white `#fff` with `#E9E9E4` hairlines; Vita/coach moments switch to cream. The dark-green band is the only dark surface in the standard chrome.

- **Touch sizing.** Buttons `min-height:48px`; all other interactive controls `min-height:44px`. Below `880px` (or any `pointer:coarse` device) a set of `.rlp-chip` / `.rlp-tap` / `.rlp-slider` helpers enforce 44px targets.

- **CSS delivery quirk.** Component styles are injected as inline `<style>` blocks scoped under a root class (`.rlp-home`, `.rlp-band`, `.rlp-reveal`, `.rlp-stage-intro`) rather than in a shared stylesheet — so class names like `.btn-navy` are redeclared per component. For a standalone rebuild, hoist them once. Only global CSS is `tokens.css` + a small `globals.css` (body + the touch helpers).

- **Terminology.** A unit of the programme is a **module** (e.g. 1.1); a **stage** groups modules (Imagine, Explore, Understand, Plan, Act); the coach exchange inside a module is a **conversation**. Avoid "session"/"step" in user-facing copy.

---

## Differences from the old Aviva/Lionsgate design system

The pre-rebrand reference (`design-reference/DESIGN_SYSTEM.md`, "Aviva-derived palette … provider name Lionsgate Pensions") differs as follows:

- **Palette fully replaced.** Old: Aviva **navy** primary + a **yellow provider band** (a swappable per-provider brand layer). New: the interaction colour is **Chorus green `#00645F`**, the header band is **Chorus dark green `#0A322D`**, with a **lime `#D7FF73`** accent divider. `--brand-primary` now resolves to green (not navy) and `--brand-band` to dark green (not yellow). The whole "swappable pension-provider brand layer" idea is gone — this is a **direct-to-consumer pilot** with no provider name; the brand *is* Chorus Life.

- **Vita recoloured & formalised.** The coach now has a single stable **purple `#322D69`** identity and one canonical `VitaMark` bloom asset used everywhere. In the old system the coach avatar was tied to the brand-primary (navy).

- **Stage colours are new.** The five-colour stage wayfinding system (blue/yellow/pink/orange/green washes + dark-green marks) is a Chorus-era addition centralised in `lib/stageColors.ts`.

- **Info callout retinted.** The old Lionsgate **blue** info panel was re-mixed onto the **Chorus green** family (`--info-surface`/`--info-line` now derive from `--chorus-green`).

- **Orange accent = exact Chorus orange.** `--accent` is now literally `#DC6437` (the brand orange), with hover/strong/surface derived by `color-mix` — where the old product-layer orange was a fixed independent hex.

- **Fonts unchanged.** Still **Source Serif 4** (display/headings) + **Inter** (body/UI) — but now self-hosted via `next/font` rather than loaded from the Google Fonts CDN link.

- **Terminology unchanged.** "module / stage / conversation" carries over from the old system.
