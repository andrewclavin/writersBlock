#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { allBookConfigs } = require('../src/config/bookConfigs');

function parseBookIdsFromArgs(argv) {
  const ids = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--bookId' && argv[i + 1]) {
      ids.push(argv[i + 1]);
      i += 1;
    }
    if (a.startsWith('--bookId=')) {
      ids.push(a.split('=')[1]);
    }
  }
  return ids;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyIfExists({ src, dest }) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${src}`);
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function main() {
  const appRoot = path.join(__dirname, '..');
  const booksSrcRoot = path.join(appRoot, 'books');
  const publicBooksRoot = path.join(appRoot, 'public', 'books');

  const requestedBookIds = parseBookIdsFromArgs(process.argv.slice(2));
  const candidateBooks = allBookConfigs.filter((c) => !c.local);

  const targetBooks = requestedBookIds.length
    ? candidateBooks.filter((c) => requestedBookIds.includes(c.bookId))
    : candidateBooks;

  if (!targetBooks.length) {
    console.log('No matching non-local books to copy.');
    return;
  }

  for (const cfg of targetBooks) {
    const bookId = cfg.bookId;
    const srcBookDir = path.join(booksSrcRoot, bookId);
    const destBookDir = path.join(publicBooksRoot, bookId);

    copyIfExists({
      src: path.join(srcBookDir, `${bookId}.words.json`),
      dest: path.join(destBookDir, `${bookId}.words.json`),
    });
    copyIfExists({
      src: path.join(srcBookDir, `${bookId}.lexicon.json`),
      dest: path.join(destBookDir, `${bookId}.lexicon.json`),
    });

    console.log(`Copied web assets for ${bookId}`);
  }
}

main();

