import { compareSemverVersions, parseSemver } from "@t3tools/shared/semver";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

/**
 * The version this server advertises to clients in its environment descriptor.
 *
 * Clients show a "Server update available" banner whenever the advertised
 * version is behind the client's. This fork intentionally trails upstream's
 * numbering, so a static version would nag forever. The advertised version
 * therefore tracks the newest known `t3` release: the baked package version
 * is the floor, and the npm registry dist-tags are the signal. Only this
 * advertised field is dynamic — the CLI version, pinned runtime, and
 * self-update flows keep the real baked version.
 */

export const T3_REGISTRY_PACKUMENT_URL = "https://registry.npmjs.org/t3";

const ADVERTISED_VERSION_REFRESH_MS = 6 * 60 * 60 * 1_000;
const ADVERTISED_VERSION_FETCH_TIMEOUT_MS = 10_000;

/** Pulls every dist-tag value out of a registry packument payload. */
export function extractDistTagVersions(payload: unknown): Array<string> {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }
  const tags = (payload as { readonly "dist-tags"?: unknown })["dist-tags"];
  if (typeof tags !== "object" || tags === null) {
    return [];
  }
  return Object.values(tags).filter((value): value is string => typeof value === "string");
}

/**
 * Advertises the highest valid semver among the base and the candidates.
 * Garbage in either side falls back to the base, never throws.
 */
export function resolveAdvertisedServerVersion(
  baseVersion: string,
  latestVersions: ReadonlyArray<string>,
): string {
  const base = baseVersion.trim();
  if (parseSemver(base) === null) {
    return base;
  }
  let advertised = base;
  for (const candidate of latestVersions) {
    const trimmed = candidate.trim();
    if (parseSemver(trimmed) === null) {
      continue;
    }
    if (compareSemverVersions(trimmed, advertised) > 0) {
      advertised = trimmed;
    }
  }
  return advertised;
}

export const fetchRegistryT3Versions = Effect.fn("environment.server_advertised_version.fetch")(
  function* (fetchImpl: typeof fetch = fetch) {
    try {
      const response = yield* Effect.tryPromise(() =>
        fetchImpl(T3_REGISTRY_PACKUMENT_URL, {
          headers: { accept: "application/vnd.npm.install-v1+json" },
          signal: AbortSignal.timeout(ADVERTISED_VERSION_FETCH_TIMEOUT_MS),
        }),
      );
      if (!response.ok) {
        return [];
      }
      const payload: unknown = yield* Effect.tryPromise(() => response.json());
      return extractDistTagVersions(payload);
    } catch {
      return [];
    }
  },
);

export const makeAdvertisedServerVersionTracker = Effect.fn(
  "environment.server_advertised_version.make",
)(function* (input: {
  readonly bakedVersion: string;
  readonly fetchImpl?: typeof fetch;
  readonly refreshInterval?: Duration.Duration;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baked = input.bakedVersion.trim();
  const state = yield* Ref.make(baked);
  const refresh = Effect.gen(function* () {
    const latest = yield* fetchRegistryT3Versions(fetchImpl);
    yield* Ref.update(state, (current) => resolveAdvertisedServerVersion(current, latest));
  }).pipe(Effect.ignore);
  yield* refresh.pipe(
    Effect.andThen(
      Effect.sleep(input.refreshInterval ?? Duration.millis(ADVERTISED_VERSION_REFRESH_MS)),
    ),
    Effect.forever,
    Effect.forkScoped,
  );
  return {
    current: Ref.get(state),
    refresh,
  };
});
