#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CERTIFICATE_FILENAME = "G-CODEX_ROOT_CERTIFICATE.md";

function usage() {
  return [
    "Usage: organ-registry.js [--root <dir>]... [--roots <dir1:dir2>] [--roots-file <json>] [--max-depth <n>]",
    "",
    "Read-only local organ registry generator.",
    "Searches only the explicitly declared parent roots and writes JSON to stdout.",
  ].join("\n");
}

function parseArgs(argv, env = process.env) {
  const roots = [];
  let maxDepth = 4;
  let rootsFile = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(usage());
      }
      roots.push(value);
      index += 1;
      continue;
    }
    if (arg === "--roots") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(usage());
      }
      roots.push(...value.split(path.delimiter).filter(Boolean));
      index += 1;
      continue;
    }
    if (arg === "--roots-file") {
      rootsFile = argv[index + 1];
      if (!rootsFile) {
        throw new Error(usage());
      }
      index += 1;
      continue;
    }
    if (arg === "--max-depth") {
      const raw = argv[index + 1];
      const value = Number(raw);
      if (!raw || !Number.isInteger(value) || value < 0) {
        throw new Error(usage());
      }
      maxDepth = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    throw new Error(usage());
  }

  if (rootsFile != null) {
    roots.push(...readRootsFile(rootsFile));
  }
  if (roots.length === 0 && env.CODEX_ORGAN_REGISTRY_ROOTS) {
    roots.push(...String(env.CODEX_ORGAN_REGISTRY_ROOTS).split(path.delimiter).filter(Boolean));
  }
  if (roots.length === 0) {
    roots.push(process.cwd());
  }

  const dedupedRoots = [...new Set(roots.map((root) => path.resolve(root)))];
  return { roots: dedupedRoots, maxDepth };
}

function readRootsFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid roots file: ${filePath}`);
  }
  return parsed.map((value) => String(value));
}

function parseCertificate(content) {
  const fields = Object.create(null);
  const requiredPreWorkChecks = [];
  let collectingChecks = false;

  for (const line of String(content).split(/\r?\n/u)) {
    const inlineBoldMatch = line.match(/^\*\*([^:*]+):\s*(.+?)\*\*\s*$/u);
    if (inlineBoldMatch) {
      fields[normalizeFieldKey(inlineBoldMatch[1])] = inlineBoldMatch[2].trim();
      collectingChecks = false;
      continue;
    }
    const keyMatch = line.match(/^\*\*([^*]+):\*\*\s*(.+?)\s*$/u);
    if (keyMatch) {
      fields[normalizeFieldKey(keyMatch[1])] = keyMatch[2].trim();
      collectingChecks = false;
      continue;
    }
    if (line.trim() === "**Required pre-work checks:**") {
      collectingChecks = true;
      continue;
    }
    if (collectingChecks) {
      const checkMatch = line.match(/^- (.+)$/u);
      if (checkMatch) {
        requiredPreWorkChecks.push(checkMatch[1].trim());
        continue;
      }
      if (line.trim().length > 0) {
        collectingChecks = false;
      }
    }
  }

  return {
    status: fields.status ?? null,
    organ: fields.organ ?? null,
    localRole: fields.local_role ?? null,
    absolutePath: fields.absolute_path ?? null,
    githubRemoteAndDefaultBranch: fields.github_remote_default_branch ?? null,
    safeTerminalLaunchCommand: fields.safe_terminal_launch_command ?? null,
    lastMdCheckTimestamp: fields.last_md_check_timestamp ?? null,
    useThisFolderFor: fields.use_this_folder_for ?? null,
    doNotUseThisFolderFor: fields.do_not_use_this_folder_for ?? null,
    requiredPreWorkChecks,
  };
}

function normalizeFieldKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function walkForCertificates(rootDir, maxDepth) {
  const results = [];
  const pending = [{ dir: rootDir, depth: 0 }];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current.dir, entry.name);
      if (entry.isFile() && entry.name === CERTIFICATE_FILENAME) {
        results.push(entryPath);
        continue;
      }
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "target") {
        continue;
      }
      if (current.depth >= maxDepth) {
        continue;
      }
      pending.push({ dir: entryPath, depth: current.depth + 1 });
    }
  }

  results.sort();
  return results;
}

function runGit(repoDir, args) {
  const result = childProcess.spawnSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  const output = result.stdout.trim();
  return output.length > 0 ? output : null;
}

function parseGitRemotes(raw) {
  const remotes = Object.create(null);
  for (const line of String(raw ?? "").split(/\r?\n/u)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/u);
    if (match == null) {
      continue;
    }
    const [, name, url, kind] = match;
    remotes[name] ??= {};
    remotes[name][kind] = sanitizeRemoteUrl(url);
  }
  return remotes;
}

function sanitizeRemoteUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "";
      url.password = "";
      return url.toString();
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function observeGitState(repoDir) {
  if (runGit(repoDir, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    return null;
  }
  const statusShortBranch = runGit(repoDir, ["status", "--short", "--branch"]) ?? "";
  const remoteOutput = runGit(repoDir, ["remote", "-v"]) ?? "";
  const head = runGit(repoDir, ["rev-parse", "HEAD"]);
  const branch = runGit(repoDir, ["branch", "--show-current"]);
  return {
    branch: branch ?? null,
    head: head ?? null,
    shortHead: head == null ? null : head.slice(0, 12),
    dirty: statusShortBranch.split(/\r?\n/u).some((line) => !line.startsWith("##") && line.trim().length > 0),
    statusShortBranch: statusShortBranch.length > 0 ? statusShortBranch : null,
    remotes: parseGitRemotes(remoteOutput),
  };
}

function buildRegistryEntry(certificatePath) {
  const rootDir = path.dirname(certificatePath);
  const certificate = parseCertificate(fs.readFileSync(certificatePath, "utf8"));
  const git = observeGitState(rootDir);
  const warnings = [];

  if (certificate.absolutePath != null && path.resolve(certificate.absolutePath) !== rootDir) {
    warnings.push(
      `certificate-absolute-path-mismatch: declared ${certificate.absolutePath} but found ${rootDir}`,
    );
  }

  return {
    organ: certificate.organ,
    status: certificate.status,
    localRole: certificate.localRole,
    rootPath: rootDir,
    certificatePath,
    certificate,
    git,
    warnings,
  };
}

function detectRegistryWarnings(entries) {
  const warnings = [];
  const byOrgan = new Map();
  const byRemote = new Map();

  for (const entry of entries) {
    if (entry.organ) {
      const matches = byOrgan.get(entry.organ) ?? [];
      matches.push(entry.rootPath);
      byOrgan.set(entry.organ, matches);
    }
    const originFetch = entry.git?.remotes?.origin?.fetch;
    if (originFetch) {
      const matches = byRemote.get(originFetch) ?? [];
      matches.push(entry.rootPath);
      byRemote.set(originFetch, matches);
    }
  }

  for (const [organ, paths] of byOrgan.entries()) {
    if (paths.length > 1) {
      warnings.push({
        code: "duplicate-organ",
        organ,
        paths,
      });
    }
  }
  for (const [remote, paths] of byRemote.entries()) {
    if (paths.length > 1) {
      warnings.push({
        code: "duplicate-origin-remote",
        remote,
        paths,
      });
    }
  }
  return warnings;
}

function generateOrganRegistry(options) {
  const roots = options.roots.map((root) => path.resolve(root));
  const entries = [];
  const rootScan = [];

  for (const root of roots) {
    const certificates = walkForCertificates(root, options.maxDepth);
    rootScan.push({ root, certificateCount: certificates.length });
    for (const certificatePath of certificates) {
      entries.push(buildRegistryEntry(certificatePath));
    }
  }

  entries.sort((left, right) => left.rootPath.localeCompare(right.rootPath));
  return {
    generatedAt: new Date().toISOString(),
    boundedDiscovery: {
      roots,
      maxDepth: options.maxDepth,
      rootScan,
    },
    entries,
    warnings: detectRegistryWarnings(entries),
  };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const registry = generateOrganRegistry(options);
    process.stdout.write(`${JSON.stringify(registry, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  CERTIFICATE_FILENAME,
  buildRegistryEntry,
  detectRegistryWarnings,
  generateOrganRegistry,
  observeGitState,
  parseArgs,
  parseCertificate,
  sanitizeRemoteUrl,
  walkForCertificates,
};
