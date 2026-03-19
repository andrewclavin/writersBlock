# Books directory

This directory holds both the raw Gutenberg source texts and any derived JSON data per book.

- `books-src/` – place the **plain text** Gutenberg downloads here.
  - Recommended filenames:
    - `great-gatsby.txt`
    - `age-of-innocence.txt`
    - `his-family.txt`
    - `old-man-and-the-sea.txt` (**local-only**, do not commit; keep all derived data local too)
- `<book-id>/` – parser outputs and any per-book metadata.

## Copyright / local-only handling

- **Public domain**: we commit raw `.txt` files in `books-src/` and parser outputs under `books/<book-id>/`.
- **Copyrighted / local-only** (example: *The Old Man and the Sea*):
  - Put the raw text at `books/books-src/old-man-and-the-sea.txt` locally.
  - Any generated output should go under `books/old-man-and-the-sea/`.
  - Both the raw text and the output folder are ignored by git via `writers-block/.gitignore`.

Example parser usage (from the `writers-block` app directory):

```bash
node src/parser/parse.js books/books-src/great-gatsby.txt books/great-gatsby
```

You can also pass the book id explicitly:

```bash
node src/parser/parse.js --bookId age-of-innocence books/books-src/age-of-innocence.txt books/age-of-innocence
```

## Safety check (pre-commit)

This repo installs a pre-commit hook on `npm install` that blocks committing any paths matching `local-only.json`.

- Edit `local-only.json` to add more local-only/copyrighted books over time.
- Manually run: `npm run check:local-only`

