# Local deployment on the AskPlays server

Read before changing the Linux installation. The live OV2 build is in
`/root/dev/t3code-ov2`; `/root/dev/t3code` retains the V1 fork for rollback.

An agent hosted by the Linux server runs inside its process tree. Restarting
that service strands the agent; perform the cutover from a separate host/session.

### Architecture

- `t3.service` is a system-level unit. Its `t3.service.d/ov2.conf` override runs
  `/opt/t3-node/bin/node /root/dev/t3code-ov2/apps/server/dist/bin.mjs serve`
  against `/root/.t3` on `127.0.0.1:3773`, with a managed cloudflared tunnel child.
  systemd restarts the service on failure.
- This is a manually deployed fork build. Do not run self-update, `t3 update`,
  or service install/update commands: they can replace it with upstream artifacts.
  The preserved V1 runtime is `versions/0.0.43`; OV2's `versions/0.0.46/t3`
  is a wrapper around Node 24 and the OV2 checkout's bundle.
- The server advertises a dynamic version to clients (baked version as the
  floor, npm registry dist-tags as the signal; see `ServerAdvertisedVersion`)
  so release clients do not nag about updates. The CLI version, pinned
  runtime, and self-update flows keep the real baked version.
- `/usr/bin/t3` is a symlink to the OV2 runtime wrapper. There is no
  global npm `t3` install and no `/root/t3-headless` checkout — both were removed to avoid
  accidentally running mainline. Do not `npm i -g t3` on this machine.
- T3 Connect/auth env lives in `/root/.t3/t3-connect.env` (Clerk publishable key, JWT template,
  OAuth client id, relay URL), loaded via the unit's `EnvironmentFile`. Without it the server
  boots but T3 Connect stays disabled.
- `/root/t3-headless` (the retired standard nightly install) was removed. If setup notes
  elsewhere still reference it, ignore them — nothing should point at it.
- The service's PATH selects OpenCode 2.0.22 from `/opt/t3-opencode/node_modules/.bin`.
  T3 uses root's global OpenCode data. Ask-bot's OpenCode 2 adapter uses
  `/home/askbot/.local/share-v2-askbot`; keep those session databases separate.
  OpenCode 2 converts provider state in place. Preserve it before upgrading;
  reverting only the T3 runtime does not roll back OpenCode.
- OV2 initializes `userdata/statev2.sqlite` from V1 once. New OV2 work does not
  synchronize back into `state.sqlite`. All connecting clients must support OV2.

### Update cycle (after changing server code)

```bash
cd /root/dev/t3code-ov2
export PATH=/opt/t3-node/bin:$PWD/node_modules/.bin:$PATH
vp i --frozen-lockfile
vp run --filter t3 build
# This builds both the server and its bundled web client. Do not build over a
# running bundle: prepare a separate checkout or stop the service first.
# Verify against copied state, take a consistent backup, then update the unit
# to the prepared checkout and restart from a separate operator session.
```

### Gotchas

- Restarting the Linux service kills agent sessions hosted there. Prepare the
  build first and restart from a separate operator session.
- Only ONE server may run (shared sqlite state in `~/.t3`). Check for stray
  `bin.mjs start` / `serve` processes and extra `cloudflared tunnel run` children.
- Never kill by name/path matching. Stop only a PID captured at spawn, or a
  port owner after confirming its `/proc/<pid>/cwd`.
- Machine has 3.7G RAM + 4G swap. Heavy installs/builds can OOM the server; prefer detached
  background jobs and poll logs instead of long foreground commands. Never run a full
  `tsgo --noEmit` here: it wants ~3GB and the OOM-killer takes it (and the memory
  pressure restarts this very service). Use focused `vp test run <files>` instead.
- State backups: `/root/t3-state-backups/`. gh CLI is authed as AskPlays (repo scope).
- The October 3 OV2 cutover backup is on Windows at
  `D:\Users\Adrian\Documents\t3code-ov2-tools\linux-before-ov2-20261003.tar.gz`.
  It contains stopped T3/OpenCode state, service configuration, and the old CLI link.

### Related repos

- Production ask-bot: `/home/askbot/ask-bot` (askbot user, read-only deploy key, auto-pull
  deploy timer — do not develop there). Dev clone: `/root/dev/ask-bot`.
