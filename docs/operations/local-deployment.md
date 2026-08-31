# Local deployment on the AskPlays server

Read when working on this repo from the server checkout (`/root/dev/t3code`): the live t3 server runs from this build.

This checkout is not just for development: **the live t3 server runs from this repo's build.**
The agent session itself runs inside that server's process tree — killing it strands you.

### Architecture

- `t3.service` (system-level systemd unit, `/etc/systemd/system/t3.service`, enabled) →
  `apps/server/dist/bin.mjs start` (supervisor, self-heals: it re-spawns and re-enables its unit
  if killed — that is by design, not a bug) →
  `~/.t3/runtime/versions/<version>/node_modules/t3/dist/bin.mjs serve` on `127.0.0.1:3773` →
  cloudflared tunnel child.
- The served runtime version dir is **planted by hand** (it is NOT npm-installed): fork `dist/`
  plus sibling deps borrowed from `versions/0.0.37`. Running any self-update / `t3 update` flow
  will `npm install` the official release over the fork code — **never do that.**
- T3 Connect/auth env lives in `/root/.t3/t3-connect.env` (Clerk publishable key, JWT template,
  OAuth client id, relay URL), loaded via the unit's `EnvironmentFile`. Without it the server
  boots but T3 Connect stays disabled.
- `/root/t3-headless` is the retired standard nightly install. Nothing points at it; do not
  "fix" the service back to it.

### Update cycle (after changing server code)

```bash
cd /root/dev/t3code
pnpm install
pnpm --filter t3 build:bundle
V=$(node -p "require('./apps/server/package.json').version")
VD=/root/.t3/runtime/versions/$V/node_modules/t3
rsync -a --delete apps/server/dist/ $VD/dist/
cp apps/server/package.json $VD/package.json
# if V is a NEW version dir: create it first (mkdir -p, write .install-complete containing $V,
# copy sibling node_modules from versions/0.0.37), then set activeVersion in
# ~/.t3/runtime/service-state.json to $V
systemctl restart t3.service
```

### Gotchas

- Restarting the service kills your own session host. Do it from a detached script:
  `setsid nohup sh -c 'sleep 1; systemctl restart t3.service' >/dev/null 2>&1 &`
- Only ONE server may run (shared sqlite state in `~/.t3`). Check for stray
  `bin.mjs start` / `serve` processes and extra `cloudflared tunnel run` children.
- `pkill -f "<pattern>"` self-matches your own shell's command line — use a bracket trick
  (`pkill -f "[b]in.mjs serve"`) or kill by PID.
- Machine has 3.7G RAM + 4G swap. Heavy installs/builds can OOM the server; prefer detached
  background jobs and poll logs instead of long foreground commands.
- State backups: `/root/t3-state-backups/`. gh CLI is authed as AskPlays (repo scope).

### Related repos

- Production ask-bot: `/home/askbot/ask-bot` (askbot user, read-only deploy key, auto-pull
  deploy timer — do not develop there). Dev clone: `/root/dev/ask-bot`.
