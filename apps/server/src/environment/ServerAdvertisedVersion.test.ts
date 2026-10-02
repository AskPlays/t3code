import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import {
  extractDistTagVersions,
  makeAdvertisedServerVersionTracker,
  resolveAdvertisedServerVersion,
} from "./ServerAdvertisedVersion.ts";

const stubFetch = (payload: unknown, ok = true) =>
  (async () =>
    ({ ok, json: async () => payload }) as unknown as Response) as unknown as typeof fetch;

const failingFetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;

it.effect("adopts the newest registry version over the baked one", () =>
  Effect.gen(function* () {
    const tracker = yield* makeAdvertisedServerVersionTracker({
      bakedVersion: "0.0.40",
      fetchImpl: stubFetch({ "dist-tags": { latest: "0.0.41", nightly: "0.0.42-nightly.1.2" } }),
    });
    yield* tracker.refresh;
    expect(yield* tracker.current).toBe("0.0.42-nightly.1.2");
  }),
);

it.effect("keeps the baked version when the registry is older or unreachable", () =>
  Effect.gen(function* () {
    const older = yield* makeAdvertisedServerVersionTracker({
      bakedVersion: "0.0.40",
      fetchImpl: stubFetch({ "dist-tags": { latest: "0.0.39" } }),
    });
    yield* older.refresh;
    expect(yield* older.current).toBe("0.0.40");

    const offline = yield* makeAdvertisedServerVersionTracker({
      bakedVersion: "0.0.40",
      fetchImpl: failingFetch,
    });
    yield* offline.refresh;
    expect(yield* offline.current).toBe("0.0.40");
  }),
);

it("picks the highest valid semver and ignores garbage", () => {
  expect(resolveAdvertisedServerVersion("0.0.40", ["0.0.41", "0.0.39"])).toBe("0.0.41");
  expect(resolveAdvertisedServerVersion("0.0.40", ["0.0.41-nightly.1.2"])).toBe(
    "0.0.41-nightly.1.2",
  );
  expect(resolveAdvertisedServerVersion("0.0.40", [])).toBe("0.0.40");
  expect(resolveAdvertisedServerVersion("0.0.40", ["not-a-version", ""])).toBe("0.0.40");
  expect(resolveAdvertisedServerVersion("0.0.40", ["  0.0.41  "])).toBe("0.0.41");
});

it("extracts dist-tag values only from well-formed packuments", () => {
  expect(extractDistTagVersions({ "dist-tags": { latest: "0.0.40" } })).toEqual(["0.0.40"]);
  expect(extractDistTagVersions({})).toEqual([]);
  expect(extractDistTagVersions(null)).toEqual([]);
  expect(extractDistTagVersions({ "dist-tags": null })).toEqual([]);
});
