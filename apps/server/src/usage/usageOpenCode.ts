// @effect-diagnostics nodeBuiltinImport:off
/**
 * Read-only OpenCode usage database access.
 *
 * OpenCode stores one usage-bearing JSON object per assistant message in its
 * global SQLite database. Only the scalar fields needed for usage reporting are
 * selected; prompts, responses, and tool output never leave the database.
 *
 * @module usageOpenCode
 */
import * as NodePath from "node:path";

import type { UsageRecord } from "./usageTranscripts.ts";

// Kept non-literal so the Node-targeted bundle leaves Bun's runtime module
// external without asking its resolver to load a module Node cannot provide.
const BUN_SQLITE_MODULE_ID: string = "bun:sqlite";

const OPEN_CODE_USAGE_QUERY = `
  SELECT
    id AS messageId,
    session_id AS sessionId,
    time_created AS timestampMs,
    json_extract(data, '$.providerID') AS providerId,
    json_extract(data, '$.modelID') AS modelId,
    json_extract(data, '$.tokens.input') AS inputTokens,
    json_extract(data, '$.tokens.output') AS outputTokens,
    json_extract(data, '$.tokens.reasoning') AS reasoningTokens,
    json_extract(data, '$.tokens.cache.read') AS cacheReadTokens,
    json_extract(data, '$.tokens.cache.write') AS cacheWriteTokens,
    json_extract(data, '$.cost') AS costUsd
  FROM message
  WHERE time_created >= ?
    AND json_valid(data)
    AND json_extract(data, '$.role') = 'assistant'
`;

const OPEN_CODE_MALFORMED_QUERY = `
  SELECT COUNT(*) AS records
  FROM message
  WHERE time_created >= ? AND NOT json_valid(data)
`;

interface OpenCodeUsageRow {
  readonly messageId?: unknown;
  readonly sessionId?: unknown;
  readonly timestampMs?: unknown;
  readonly providerId?: unknown;
  readonly modelId?: unknown;
  readonly inputTokens?: unknown;
  readonly outputTokens?: unknown;
  readonly reasoningTokens?: unknown;
  readonly cacheReadTokens?: unknown;
  readonly cacheWriteTokens?: unknown;
  readonly costUsd?: unknown;
}

interface CountRow {
  readonly records?: unknown;
}

interface SqliteStatement {
  readonly all: (sinceMs: number) => readonly unknown[];
}

interface SqliteDatabase {
  readonly statement: (sql: string) => SqliteStatement;
  readonly close: () => void;
}

export interface OpenCodeUsageRead {
  readonly records: readonly UsageRecord[];
  readonly malformedRecords: number;
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/**
 * Resolves the OpenCode usage database path, mirroring opencode's own
 * resolution (`packages/core/src/database/database.ts`): an `OPENCODE_DB`
 * override wins (absolute paths are used verbatim, relative ones resolve
 * against the data dir), otherwise the stable-channel `opencode.db` is used.
 * Channel-specific names (`opencode-<channel>.db`) are not handled here; the
 * installs this server targets use stable channels.
 */
export function resolveOpenCodeDatabasePath(dataDir: string): string {
  const override = process.env.OPENCODE_DB?.trim();
  if (override !== undefined && override.length > 0 && override !== ":memory:") {
    return NodePath.isAbsolute(override) ? override : NodePath.join(dataDir, override);
  }
  return NodePath.join(dataDir, "opencode.db");
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Converts one assistant-message projection into the shared usage shape. */
export function parseOpenCodeUsageRow(value: unknown): UsageRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as OpenCodeUsageRow;
  if (
    typeof row.messageId !== "string" ||
    row.messageId.length === 0 ||
    typeof row.sessionId !== "string" ||
    typeof row.timestampMs !== "number" ||
    !Number.isFinite(row.timestampMs) ||
    typeof row.providerId !== "string" ||
    row.providerId.length === 0 ||
    typeof row.modelId !== "string" ||
    row.modelId.length === 0
  ) {
    return null;
  }

  const uncachedInputTokens = nonNegativeInt(row.inputTokens);
  const cachedInputTokens = nonNegativeInt(row.cacheReadTokens);
  const cacheCreationTokens = nonNegativeInt(row.cacheWriteTokens);
  const generatedOutputTokens = nonNegativeInt(row.outputTokens);
  const reasoningTokens = nonNegativeInt(row.reasoningTokens);

  // OpenCode reports generated text and reasoning as disjoint counts. The
  // shared contract treats reasoning as a subset of output, so combine them in
  // outputTokens while retaining the reasoning slice for the token-mix UI.
  const outputTokens = generatedOutputTokens + reasoningTokens;
  // Zero-token rows are rejected regardless of reported cost: OpenCode writes
  // placeholder assistant rows (zero tokens, cost 0) that must not inflate
  // record or session counts. Zero-cost rows with real token usage still pass.
  if (uncachedInputTokens + cachedInputTokens + cacheCreationTokens + outputTokens === 0) {
    return null;
  }

  return {
    provider: "opencode",
    timestampMs: row.timestampMs,
    model: `${row.providerId}/${row.modelId}`,
    sessionId: row.sessionId,
    totals: {
      uncachedInputTokens,
      cachedInputTokens,
      cacheCreationTokens,
      outputTokens,
      reasoningTokens,
    },
    reportedCostUsd: finiteNonNegative(row.costUsd),
    dedupeKey: `opencode:${row.messageId}`,
  };
}

/**
 * Whether a row is a legitimate zero-token placeholder rather than a malformed
 * one. OpenCode writes placeholder assistant rows (valid identity and model,
 * zero tokens, cost 0) for aborted or empty attempts; these are intentionally
 * ignored and must not mark the source `partial`.
 */
export function isOpenCodePlaceholderRow(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const row = value as OpenCodeUsageRow;
  if (typeof row.providerId !== "string" || row.providerId.length === 0) return false;
  if (typeof row.modelId !== "string" || row.modelId.length === 0) return false;
  return (
    nonNegativeInt(row.inputTokens) +
      nonNegativeInt(row.outputTokens) +
      nonNegativeInt(row.reasoningTokens) +
      nonNegativeInt(row.cacheReadTokens) +
      nonNegativeInt(row.cacheWriteTokens) ===
    0
  );
}

async function openDatabase(databasePath: string): Promise<SqliteDatabase> {
  if (process.versions.bun !== undefined) {
    const { Database } = (await import(BUN_SQLITE_MODULE_ID)) as typeof import("bun:sqlite");
    const database = new Database(databasePath, { readonly: true, create: false });
    return {
      statement: (sql) => {
        const statement = database.query(sql);
        return { all: (sinceMs) => statement.all(sinceMs) };
      },
      close: () => database.close(),
    };
  }

  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(databasePath, { readOnly: true });
  return {
    statement: (sql) => {
      const statement = database.prepare(sql);
      return { all: (sinceMs) => statement.all(sinceMs) };
    },
    close: () => database.close(),
  };
}

/**
 * Reads assistant usage at or after `sinceMs`, returning `null` when the
 * database is unavailable or has an unsupported schema.
 */
export async function readOpenCodeUsage(
  databasePath: string,
  sinceMs: number,
): Promise<OpenCodeUsageRead | null> {
  let database: SqliteDatabase | undefined;
  try {
    database = await openDatabase(databasePath);
    const rows = database.statement(OPEN_CODE_USAGE_QUERY).all(sinceMs);
    const records: UsageRecord[] = [];
    let malformedRecords = 0;
    for (const row of rows) {
      const record = parseOpenCodeUsageRow(row);
      if (record === null) {
        // Placeholders are expected on every install; only rows that are not
        // even valid placeholders count as malformed.
        if (!isOpenCodePlaceholderRow(row)) malformedRecords += 1;
      } else {
        records.push(record);
      }
    }

    const [malformed] = database.statement(OPEN_CODE_MALFORMED_QUERY).all(sinceMs);
    const invalidJsonRecords = nonNegativeInt((malformed as CountRow | undefined)?.records);
    return { records, malformedRecords: malformedRecords + invalidJsonRecords };
  } catch {
    return null;
  } finally {
    try {
      database?.close();
    } catch {
      // A failed close must not turn a successful read into a failed RPC.
    }
  }
}
