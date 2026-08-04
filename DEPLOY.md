# Deploying rlp-companion

**Production is `main`, and `main` only.**

A Vercel deploy ships the *entire working tree of whatever branch is checked
out*. So deploying from a feature branch (or the shared checkout) silently
reverts anything on `main` that the branch doesn't have. This is the recurring
"deploy clobber" — it has, more than once, taken live features back off the site
because a later deploy went out from an older branch.

There is one rule that prevents it.

## The one rule

**Never `vercel --prod` from a feature branch or the shared checkout. Merge to
`main` first, then deploy from the dedicated deploy worktree.**

## To ship a change

1. Merge your branch into `main` (PR or fast-forward) and push it:
   ```
   git push origin main
   ```
2. Deploy from the deploy worktree, which only ever holds `main`:
   ```
   cd /Users/elsawakeman/Projects/rlp-companion-deploy
   git fetch origin main && git reset --hard origin/main
   npx vercel --prod --yes
   ```
3. Confirm it landed on the right project and domain:
   ```
   npx vercel inspect <deploy-url>
   ```
   Expect `target production` and the `app.chorus-life.com` alias. If the URL is
   `rlp-companion-integrate-*` or any project other than `rlp-companion`, STOP —
   the `.vercel` link is wrong (see below).

## Why a dedicated deploy worktree

- **It only ever holds `main`.** A deploy can never accidentally ship a feature
  branch, half-finished work, or another session's changes.
- **It carries the correct `.vercel/project.json`** (project `rlp-companion`,
  `prj_Nr1jNfGZ…`). A fresh `git worktree` does **not** copy `.vercel` — and
  without it, `vercel --prod` invents a brand-new throwaway project named after
  the folder instead of deploying to production. If `.vercel` ever goes missing
  here, restore it with:
  ```
  cp /Users/elsawakeman/Projects/rlp-companion/.vercel/project.json \
     /Users/elsawakeman/Projects/rlp-companion-deploy/.vercel/project.json
  ```

## The stronger fix (optional): let Vercel auto-deploy `main`

Connecting the GitHub repo (`github.com/elsaw132/rlp-companion`) to the Vercel
project and setting the production branch to `main` makes `git push origin main`
deploy on its own. Then nobody runs `vercel --prod` by hand, and the clobber
becomes structurally impossible rather than a rule people have to remember. This
needs a one-time setup in the Vercel dashboard (Git → Connect) or
`vercel git connect`; ask before enabling it, since it changes *when* things go
live (every push to `main` ships).
