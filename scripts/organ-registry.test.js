const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CERTIFICATE_FILENAME,
  detectRegistryWarnings,
  generateOrganRegistry,
  observeGitState,
  parseCertificate,
  walkForCertificates,
} = require("./organ-registry.js");

function makeCertificate({
  status = "ACTIVE DEVELOPMENT ROOT",
  organ = "sample-organ",
  localRole = "Active dev root",
  absolutePath,
  remote = "https://github.com/example/sample-organ.git (main)",
} = {}) {
  return [
    "# G-CODEX_ROOT_CERTIFICATE.md",
    "",
    `**Status: ${status}**`,
    "",
    `**Organ:** ${organ}`,
    `**Local role:** ${localRole}`,
    `**Absolute path:** ${absolutePath}`,
    `**GitHub remote + default branch:** ${remote}`,
    `**Safe terminal launch command:** cd ${absolutePath}`,
    "**Last MD check timestamp:** 2026-06-14",
    "**Use this folder for:** Sample work.",
    "**Do not use this folder for:** Other work.",
    "**Required pre-work checks:**",
    "- pwd",
    "- git remote -v",
    "- git status --short --branch",
    "- check this certificate before work",
    "",
  ].join("\n");
}

function runGit(repoDir, args) {
  childProcess.spawnSync("git", ["-C", repoDir, ...args], {
    stdio: "ignore",
  });
}

test("parseCertificate reads certificate fields and pre-work checks", () => {
  const certificate = parseCertificate(
    makeCertificate({ absolutePath: "/tmp/example-root", organ: "codex-desktop-linux" }),
  );
  assert.equal(certificate.status, "ACTIVE DEVELOPMENT ROOT");
  assert.equal(certificate.organ, "codex-desktop-linux");
  assert.equal(certificate.absolutePath, "/tmp/example-root");
  assert.equal(certificate.safeTerminalLaunchCommand, "cd /tmp/example-root");
  assert.deepEqual(certificate.requiredPreWorkChecks, [
    "pwd",
    "git remote -v",
    "git status --short --branch",
    "check this certificate before work",
  ]);
});

test("walkForCertificates stays within the configured max depth", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-organ-walk-"));
  try {
    const shallowDir = path.join(tempRoot, "active", "repo");
    const deepDir = path.join(tempRoot, "a", "b", "c", "d", "e");
    fs.mkdirSync(shallowDir, { recursive: true });
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(
      path.join(shallowDir, CERTIFICATE_FILENAME),
      makeCertificate({ absolutePath: shallowDir, organ: "shallow" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(deepDir, CERTIFICATE_FILENAME),
      makeCertificate({ absolutePath: deepDir, organ: "deep" }),
      "utf8",
    );

    assert.deepEqual(walkForCertificates(tempRoot, 2), [path.join(shallowDir, CERTIFICATE_FILENAME)]);
    assert.deepEqual(walkForCertificates(tempRoot, 5), [
      path.join(deepDir, CERTIFICATE_FILENAME),
      path.join(shallowDir, CERTIFICATE_FILENAME),
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("observeGitState captures branch, remotes, and dirty state", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-organ-git-"));
  try {
    runGit(tempRoot, ["init", "-b", "main"]);
    runGit(tempRoot, ["config", "user.name", "Codex Test"]);
    runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
    fs.writeFileSync(path.join(tempRoot, "README.md"), "hello\n", "utf8");
    runGit(tempRoot, ["add", "README.md"]);
    runGit(tempRoot, ["commit", "-m", "init"]);
    runGit(tempRoot, ["remote", "add", "origin", "https://token@example.com/org/repo.git"]);
    fs.writeFileSync(path.join(tempRoot, "dirty.txt"), "changed\n", "utf8");

    const observed = observeGitState(tempRoot);
    assert.equal(observed.branch, "main");
    assert.equal(observed.dirty, true);
    assert.equal(observed.remotes.origin.fetch, "https://example.com/org/repo.git");
    assert.match(observed.statusShortBranch, /^## main/m);
    assert.match(observed.head, /^[0-9a-f]{40}$/u);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("generateOrganRegistry reports path mismatches and duplicate remotes", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-organ-registry-"));
  try {
    const repoOne = path.join(tempRoot, "organs", "one");
    const repoTwo = path.join(tempRoot, "organs", "two");
    fs.mkdirSync(repoOne, { recursive: true });
    fs.mkdirSync(repoTwo, { recursive: true });

    fs.writeFileSync(
      path.join(repoOne, CERTIFICATE_FILENAME),
      makeCertificate({
        absolutePath: "/wrong/path",
        organ: "shared-organ",
        remote: "https://github.com/example/shared.git (main)",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(repoTwo, CERTIFICATE_FILENAME),
      makeCertificate({
        absolutePath: repoTwo,
        organ: "shared-organ",
        remote: "https://github.com/example/shared.git (main)",
      }),
      "utf8",
    );

    runGit(repoOne, ["init", "-b", "main"]);
    runGit(repoOne, ["config", "user.name", "Codex Test"]);
    runGit(repoOne, ["config", "user.email", "codex@example.com"]);
    fs.writeFileSync(path.join(repoOne, "a.txt"), "a\n", "utf8");
    runGit(repoOne, ["add", "a.txt"]);
    runGit(repoOne, ["commit", "-m", "a"]);
    runGit(repoOne, ["remote", "add", "origin", "https://github.com/example/shared.git"]);

    runGit(repoTwo, ["init", "-b", "main"]);
    runGit(repoTwo, ["config", "user.name", "Codex Test"]);
    runGit(repoTwo, ["config", "user.email", "codex@example.com"]);
    fs.writeFileSync(path.join(repoTwo, "b.txt"), "b\n", "utf8");
    runGit(repoTwo, ["add", "b.txt"]);
    runGit(repoTwo, ["commit", "-m", "b"]);
    runGit(repoTwo, ["remote", "add", "origin", "https://github.com/example/shared.git"]);

    const registry = generateOrganRegistry({ roots: [tempRoot], maxDepth: 3 });
    assert.equal(registry.entries.length, 2);
    assert.equal(registry.boundedDiscovery.rootScan[0].certificateCount, 2);
    assert.match(registry.entries[0].warnings.join("\n"), /certificate-absolute-path-mismatch/);
    assert.deepEqual(
      registry.warnings.map((warning) => warning.code).sort(),
      ["duplicate-organ", "duplicate-origin-remote"],
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("detectRegistryWarnings ignores unique organ names and remotes", () => {
  const warnings = detectRegistryWarnings([
    {
      organ: "one",
      rootPath: "/tmp/one",
      git: { remotes: { origin: { fetch: "https://github.com/example/one.git" } } },
    },
    {
      organ: "two",
      rootPath: "/tmp/two",
      git: { remotes: { origin: { fetch: "https://github.com/example/two.git" } } },
    },
  ]);
  assert.deepEqual(warnings, []);
});
