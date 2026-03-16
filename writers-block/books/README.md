# Books directory

This directory holds both the raw Gutenberg source texts and any derived JSON data per book.

- `books-src/` – place the **plain text** Gutenberg downloads here.
  - Recommended filenames:
    - `great-gatsby.txt`
    - `age-of-innocence.txt`
    - `his-family.txt`
    - `old-man-and-the-sea.txt` (local-only, do not sync processed data off-device)
- `<book-id>/` – parser outputs and any per-book metadata.

Example parser usage (from the `writers-block` app directory):

```bash
node src/parser/parse.js books/books-src/great-gatsby.txt books/great-gatsby
```

