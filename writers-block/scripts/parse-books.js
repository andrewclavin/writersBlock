#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { allBookConfigs } = require("../src/config/bookConfigs");

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const appRoot = path.join(__dirname, "..");
  const parserPath = path.join(appRoot, "src", "parser", "parse.js");
  const booksSrcDir = path.join(appRoot, "books", "books-src");
  const booksOutDir = path.join(appRoot, "books");

  const publicDomainBooks = allBookConfigs.filter((c) => !c.local);
  if (!publicDomainBooks.length) {
    console.log("No non-local book configs found. Nothing to parse.");
    return;
  }

  const missing = [];
  for (const cfg of publicDomainBooks) {
    const inputPath = path.join(booksSrcDir, `${cfg.bookId}.txt`);
    const outputDir = path.join(booksOutDir, cfg.bookId);

    if (!fileExists(inputPath)) {
      missing.push(path.relative(appRoot, inputPath));
      continue;
    }

    execFileSync(process.execPath, [parserPath, "--bookId", cfg.bookId, inputPath, outputDir], {
      stdio: "inherit",
    });
  }

  if (missing.length) {
    console.log("");
    console.log("Skipped missing source files:");
    for (const p of missing) console.log(`- ${p}`);
  }
}

main();

