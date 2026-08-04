# Deploying rlp-companion

**Production is the `main` branch, and Vercel deploys it automatically.**

The Vercel project is connected to `github.com/elsaw132/rlp-companion` with
`main` as the production branch. **Pushing to `main` triggers a production
deploy on its own** — you do not run any deploy command by hand.

## To ship a change

1. Merge your branch into `main` (PR or fast-forward).
2. Push it:
   ```
   git push origin main
   ```
3. That's it. Vercel builds `main` and promotes it to `app.chorus-life.com`
   automatically. Watch it in the Vercel dashboard, or confirm from the CLI:
   ```
   npx vercel inspect app.chorus-life.com
   ```
   Expect `target production` and a `rlp-companion-git-main-*` alias (the tell
   that it was the git deploy of `main`).

## Do NOT run `vercel --prod` by hand

This is what caused the repeated "deploy clobbers." A manual `vercel --prod`:
- ships the **whole local working tree** of whatever branch is checked out, so
  deploying a feature branch silently reverts whatever `main` has that the
  branch lacks; and
- **overrides** the automatic git deploy, so the two fight over the production
  alias.

The automatic git deploy avoids both: it only ever builds committed `main`.
Feature-branch pushes get their own **preview** deploys (not production), which
is exactly what you want.

If you ever genuinely must deploy by hand (git integration down, etc.), do it
ONLY from this deploy worktree, which holds `main` and the correct `.vercel`
project link:
```
cd /Users/elsawakeman/Projects/rlp-companion-deploy
git fetch origin main && git reset --hard origin/main
npx vercel --prod --yes
```
Never from a feature branch or the shared checkout.

## Notes

- `main` was made current on 2026-08-04 (it had been ~25 commits behind the live
  code); it now reflects production.
- A fresh `git worktree` does not copy `.vercel/`. If this worktree ever loses
  it, restore with:
  ```
  cp /Users/elsawakeman/Projects/rlp-companion/.vercel/project.json \
     /Users/elsawakeman/Projects/rlp-companion-deploy/.vercel/project.json
  ```
