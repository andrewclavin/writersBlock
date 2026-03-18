#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Very small glob-to-regex:
 * - `*` matches any chars except path separator
 * - `**` matches any chars including path separator
 */
function globToRegex(glob) {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      const next = glob[i + 1];
      if (next === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
      continue;
    }
    out += escapeRegex(ch);
  }
  out += "$";
  return new RegExp(out);
}

function getRepoRoot() {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
}

function getStagedFiles() {
  const out = execSync("git diff --cached --name-only -z", { encoding: "buffer" });
  const text = out.toString("utf8");
  return text.split("\0").filter(Boolean);
}

function main() {
  const repoRoot = getRepoRoot();
  const configPath = path.join(repoRoot, "local-only.json");

  if (!fs.existsSync(configPath)) {
    // No config, nothing to enforce.
    process.exit(0);
  }

  const config = readJson(configPath);
  const deny = Array.isArray(config.deny) ? config.deny : [];
  const denyRegexes = deny.map(globToRegex);

  const staged = getStagedFiles();
  const violations = [];

  for (const f of staged) {
    // Normalize to forward slashes (git always uses /, but keep it explicit).
    const file = f.replace(/\\/g, "/");
    if (denyRegexes.some((re) => re.test(file))) {
      violations.push(file);
    }
  }

  if (violations.length) {
    console.error("");
    console.error("Blocked commit: local-only/copyrighted content detected in staged files.");
    console.error("");
    console.error(`Update allow/deny rules in: ${path.relative(process.cwd(), configPath)}`);
    console.error("");
    console.error("Files:");
    for (const v of violations) console.error(`- ${v}`);
    console.error("");
    console.error("If this is intentional, remove the file(s) from staging or update `local-only.json`.");
    process.exit(1);
  }
}

main();

