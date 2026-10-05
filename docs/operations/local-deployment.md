# Local deployment on the AskPlays Linux server

The source checkout is `/root/dev/t3code`, on `feat/ov2-fork`. The live service
runs a deployed copy of its build. An agent running through that service will
disconnect when it restarts; use the delayed systemd job below for an authorized
deployment from an active agent turn.

## Current service

`t3.service` runs Node directly, without the old CLI supervisor:

```text
/opt/t3-node/bin/node /root/dev/t3code-ov2-5034530964/apps/server/dist/bin.mjs serve --base-dir /root/.t3 --host 127.0.0.1 --port 3773
```

The override is `/etc/systemd/system/t3.service.d/ov2.conf`. Its working directory
is `/root/dev/t3code`. Confirm the installed configuration before deploying:

```bash
systemctl show t3.service -p ExecStart -p WorkingDirectory -p MainPID
systemctl cat t3.service
```

- V2 is already deployed and uses `~/.t3/userdata/statev2.sqlite`. Routine
  updates do not need a V1 migration, a new runtime version directory, or changes
  to `service-state.json`.
- T3 Connect configuration is loaded from `/root/.t3/t3-connect.env` through the
  unit's `EnvironmentFile`. Load that file for builds too, so the matching web
  client includes the public Connect configuration. Do not print its contents.
- The server advertises a dynamic version through `ServerAdvertisedVersion`.
  The advertised version alone does not identify the deployed commit; use the
  build marker and web-bundle verification below.
- `/usr/bin/t3` currently points to `/root/.t3/runtime/versions/0.0.46/t3`, which
  is separate from the service's entry point. Do not use `t3 update`, install
  an official npm release, or change this symlink to deploy the fork.

## Build and push

Check that the branch is `feat/ov2-fork` and review any local changes first.
Use Node 24.13.1 or newer in the supported Node 24 range. Build sequentially on
this machine: it has 3.7 GB RAM and 4 GB swap. Check disk space before installing
or building; use another build host if there is insufficient space.

```bash
cd /root/dev/t3code
export PATH="/opt/t3-node/bin:$PWD/node_modules/.bin:$PATH"
git status --short --branch
df -h .
vp install --frozen-lockfile
vp test run apps/server/src/environment/ServerAdvertisedVersion.test.ts apps/server/src/environment/ServerEnvironment.test.ts apps/desktop/src/app/DesktopClerk.test.ts --maxWorkers=1
git push origin feat/ov2-fork

mkdir -p /root/t3-deployments
deploy_commit=$(git rev-parse --short=10 HEAD)
NODE_OPTIONS=--max-old-space-size=1536 RAYON_NUM_THREADS=2 T3CODE_WEB_SOURCEMAP=0 \
  node --env-file=/root/.t3/t3-connect.env node_modules/vite-plus/bin/vp run --filter @t3tools/web build \
  > "/root/t3-deployments/web-$deploy_commit.log" 2>&1
NODE_OPTIONS=--max-old-space-size=1536 RAYON_NUM_THREADS=2 \
  node --env-file=/root/.t3/t3-connect.env apps/server/scripts/cli.ts build --verbose \
  > "/root/t3-deployments/server-$deploy_commit.log" 2>&1
node apps/server/dist/bin.mjs --version
node --check apps/server/dist/bin.mjs
test -f apps/server/dist/client/index.html
```

Stop on any failed command. If `vp` is missing before installation, the existing
`/root/dev/t3code-ov2/node_modules/.bin/vp` can bootstrap the frozen install.
The server build copies the web output into `dist/client`; `build:bundle` alone
would omit the updated client. Do not set `VITE_HTTP_URL` or `VITE_WS_URL`.

The build limits above passed on this server. Do not run repo-wide checks or a
full typecheck here; memory pressure can take down the live service. For local
UI testing, use isolated state seeded with `vp run migrate-dev-db`, never the
live userdata directory. Provider upgrades, including OpenCode database
conversions, are separate from deploying the T3 build.

## Update in place and restart

Replace the existing service build without retaining an old build. The job
stops the service before replacing files, updates its dependency symlink, and
starts the same unit. It does not change the service configuration or user data.
Keep the source build and its `node_modules` intact while the job runs; the live
service uses that dependency directory afterward.

Create the deployment script outside the checkout:

```bash
cat > "/root/t3-deployments/update-$deploy_commit.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail
commit=$1
exec > "/root/t3-deployments/update-$commit.log" 2>&1
source_dir=/root/dev/t3code/apps/server
live_dir=/root/dev/t3code-ov2-5034530964/apps/server
stopped=0
trap 'rc=$?; if (( stopped )); then systemctl start t3.service || true; fi; printf "Deployment failed with exit %s\n" "$rc"; exit "$rc"' ERR
[[ $(git -C /root/dev/t3code rev-parse --short=10 HEAD) == "$commit" ]]
[[ $(systemctl show t3.service -p ExecStart --value) == *"$live_dir/dist/bin.mjs serve"* ]]
test -L "$live_dir/node_modules"
test -f "$source_dir/dist/client/index.html"
/opt/t3-node/bin/node "$source_dir/dist/bin.mjs" --version
expected_index=$(sha256sum "$source_dir/dist/client/index.html" | cut -d ' ' -f1)
systemctl stop t3.service
stopped=1
rsync -a --delete "$source_dir/dist/" "$live_dir/dist/"
ln -sfn "$source_dir/node_modules" "$live_dir/node_modules"
printf '%s\n' "$commit" > "$live_dir/dist/.t3-build-commit"
systemctl start t3.service
stopped=0
for attempt in {1..30}; do
  if systemctl is-active --quiet t3.service && curl -fsS --max-time 3 http://127.0.0.1:3773/.well-known/t3/environment > "/root/t3-deployments/descriptor-$commit.json"; then
    served_index=$(curl -fsS --max-time 3 http://127.0.0.1:3773/ | sha256sum | cut -d ' ' -f1)
    if [[ "$served_index" == "$expected_index" ]]; then
      printf 'DEPLOYED %s at %s; ' "$commit" "$(date -Is)"
      systemctl show t3.service -p MainPID
      exit 0
    fi
  fi
  sleep 2
done
printf 'Service did not pass readiness verification\n'
exit 1
SCRIPT
chmod 700 "/root/t3-deployments/update-$deploy_commit.sh"
bash -n "/root/t3-deployments/update-$deploy_commit.sh"
systemd-run --unit="t3-update-$deploy_commit" --on-active=15s --timer-property=AccuracySec=1s \
  /bin/bash "/root/t3-deployments/update-$deploy_commit.sh" "$deploy_commit"
```

The delayed job belongs to systemd and survives the agent session disconnect.
After scheduling it, report that the update is queued and end the turn before
it stops the service. Do not issue a foreground restart from the agent session.
A separate operator shell can run the same script directly instead of queuing
it. If repeating a deployment of the same commit, use a fresh unit name.

After reconnecting, confirm completion rather than treating a queued job as a
successful deployment. In a new shell, set `deploy_commit` to the commit you
queued:

```bash
cat "/root/t3-deployments/update-$deploy_commit.log"
systemctl show t3.service -p ActiveState -p SubState -p MainPID
cat /root/dev/t3code-ov2-5034530964/apps/server/dist/.t3-build-commit
curl -fsS --max-time 5 http://127.0.0.1:3773/.well-known/t3/environment
```

A `DEPLOYED` line means the unit is active, its descriptor responds, and the
served HTML matches the new web bundle. If it fails, inspect the job with
`journalctl -u "t3-update-$deploy_commit.service"` and the service logs in
`/root/.t3/logs/t3-service.log` and `t3-service.err.log`.

Never kill processes by name or path matching. Stop the managed server through
`systemctl`; stop development processes only by a PID captured at spawn, or a
port owner whose `/proc/<pid>/cwd` was confirmed. Never launch a second server
against the live T3 home. Existing state backups are in `/root/t3-state-backups/`.

## Related repos

- Production ask-bot: `/home/askbot/ask-bot` (askbot user, read-only deploy key,
  auto-pull deploy timer). Develop in `/root/dev/ask-bot`, not the production clone.
