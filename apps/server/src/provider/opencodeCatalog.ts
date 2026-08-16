/**
 * opencodeCatalog — normalize OpenCode command/skill inventories into the
 * shared provider catalog shapes (`ServerProviderSlashCommand` /
 * `ServerProviderSkill`) that the composer `/` and `$` menus render.
 *
 * Shared by the provider status check (environment-scoped snapshot) and the
 * per-thread catalog RPC, so both surfaces resolve names, hints, and scopes
 * identically.
 *
 * @module provider/opencodeCatalog
 */
import type { ServerProviderSlashCommand, ServerProviderSkill } from "@t3tools/contracts";

import type { OpenCodeInventory } from "./opencodeRuntime.ts";
import { nonEmptyTrimmed } from "./providerSnapshot.ts";

export interface OpenCodeProviderCatalog {
  readonly slashCommands: ReadonlyArray<ServerProviderSlashCommand>;
  readonly skills: ReadonlyArray<ServerProviderSkill>;
}

export function openCodeSlashCommands(
  inventory: Pick<OpenCodeInventory, "commands">,
): ReadonlyArray<ServerProviderSlashCommand> {
  const commandsByName = new Map<string, ServerProviderSlashCommand>();

  for (const command of inventory.commands) {
    const name = nonEmptyTrimmed(command.name);
    if (!name) {
      continue;
    }
    const description = nonEmptyTrimmed(command.description);
    const hint = command.hints
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(" ");
    const key = name.toLowerCase();
    const existing = commandsByName.get(key);
    commandsByName.set(key, {
      name: existing?.name ?? name,
      ...(existing?.description
        ? { description: existing.description }
        : description
          ? { description }
          : {}),
      ...(existing?.input ? { input: existing.input } : hint ? { input: { hint } } : {}),
    });
  }

  return [...commandsByName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function openCodeSkills(
  inventory: Pick<OpenCodeInventory, "skills">,
  cwd: string,
): ReadonlyArray<ServerProviderSkill> {
  const normalizedCwd = cwd.replaceAll("\\", "/").replace(/\/+$/, "");
  const skillsByName = new Map<string, ServerProviderSkill>();

  for (const skill of inventory.skills) {
    const name = nonEmptyTrimmed(skill.name);
    const location = nonEmptyTrimmed(skill.location);
    if (!name || !location) {
      continue;
    }
    const normalizedLocation = location.replaceAll("\\", "/");
    const scope =
      location === "<built-in>"
        ? "system"
        : normalizedCwd &&
            (normalizedLocation === normalizedCwd ||
              normalizedLocation.startsWith(`${normalizedCwd}/`))
          ? "project"
          : "user";
    const description = nonEmptyTrimmed(skill.description);
    skillsByName.set(name, {
      name,
      path: location,
      scope,
      enabled: true,
      ...(description ? { description } : {}),
    });
  }

  return [...skillsByName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function mapOpenCodeInventoryToProviderCatalog(
  inventory: Pick<OpenCodeInventory, "commands" | "skills">,
  cwd: string,
): OpenCodeProviderCatalog {
  return {
    slashCommands: openCodeSlashCommands(inventory),
    skills: openCodeSkills(inventory, cwd),
  };
}
