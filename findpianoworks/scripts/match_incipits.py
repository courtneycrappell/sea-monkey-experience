"""
Match incipit image files from new folders to works in works.json.
Images exist on disk but the database still has blankincipit for those works.
Matching uses: anthology membership + composer initial + title token overlap.
"""
import json, re, os, shutil
from pathlib import Path

IMG_SRC = Path(
    os.path.expanduser("~"),
    "Library/CloudStorage/OneDrive-UniversityofMissouri/Crappell_Faculty"
    "/UH_Admin/OneDrive - University Of Houston/Work/Work_FPW"
    "/pablo/FindPianoWorksJSP/FindPianoWorks_JSP/WebContent/images"
)
OUT_DATA  = Path(__file__).parent.parent / "src/data/works.json"
OUT_IMG   = Path(__file__).parent.parent / "public/images"

# Folder → book title substring for lookup in anthologies.json
FOLDER_BOOK = {
    "mc10": "Masterwork Classics, Level 10",
    "kbc1": "Kjos Piano Repertoire, Baroque & Classical, Level 1",
    "kbc2": "Kjos Piano Repertoire, Baroque & Classical, Level 2",
    "kbc3": "Kjos Piano Repertoire, Baroque & Classical, Level 3",
    "kr21": "Kjos Piano Repertoire, Romantic & 20th Century, Level 1",
    "kr22": "Kjos Piano Repertoire, Romantic & 20th Century, Level 2",
    "kr23": "Kjos Piano Repertoire, Romantic & 20th Century, Level 3",
}

anthologies = json.loads((OUT_DATA.parent / "anthologies.json").read_text())
works       = json.loads(OUT_DATA.read_text())
work_by_id  = {w["id"]: w for w in works}

def norm(s):
    """Lowercase, strip accents crudely, keep only a-z0-9."""
    s = (s or "").lower()
    for a, b in [("ä","a"),("ö","o"),("ü","u"),("é","e"),("è","e"),("ê","e"),
                 ("à","a"),("â","a"),("ñ","n"),("ç","c"),("ô","o"),("î","i")]:
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]", "", s)

def tokens(s):
    """Split normalized string into overlapping substrings for fuzzy matching.
    Also split on digit boundaries so 'russianfolksong' matches 'Russian Folk Song'."""
    n = norm(s)
    # All letter runs (split on digit boundaries)
    letter_runs = re.findall(r"[a-z]+", n)
    result = set()
    for run in letter_runs:
        # Add the full run
        if len(run) >= 3:
            result.add(run)
        # Also add 4-char prefix substrings to bridge partial matches
        for length in range(4, len(run)):
            result.add(run[:length])
    return result

def score(filename_stem, work):
    """Score how well a filename matches a work title."""
    composer_initial = norm(work.get("composer","") or "")[:1]
    if not filename_stem.startswith(composer_initial):
        return 0
    fname_tokens = tokens(filename_stem[1:])   # drop the initial
    title_tokens = tokens(work.get("title","") or "")
    cat_tokens   = tokens(work.get("catalogNumber","") or "")
    all_tokens   = title_tokens | cat_tokens
    if not all_tokens:
        return 0
    overlap = fname_tokens & all_tokens
    return len(overlap) / max(len(fname_tokens), 1)

matched  = []
unmatched = []

for folder, book_title in FOLDER_BOOK.items():
    # Find the anthology
    anthology = next((a for a in anthologies if a["title"] == book_title), None)
    if not anthology:
        print(f"  WARNING: anthology not found for {folder}: {book_title}")
        continue
    book_works = {w["id"]: w for w in anthology.get("works", [])}

    # List image files in this folder (top level only, no nested)
    img_dir = IMG_SRC / folder
    images = [f for f in img_dir.iterdir()
              if f.suffix.lower() in (".jpg",".png")
              and "cover" not in f.name
              and f.parent == img_dir]   # top level only

    print(f"\n{folder} ({book_title}) — {len(images)} images, {len(book_works)} works in book")

    for img in sorted(images):
        stem = img.stem  # e.g. "bminuet"
        # Score all works in this anthology
        candidates = [(score(stem, w), w) for w in book_works.values()]
        candidates.sort(key=lambda x: -x[0])
        best_score, best_work = candidates[0] if candidates else (0, None)

        if best_score >= 0.25 and best_work:
            url = f"http://findpianoworks.com/images/{folder}/{img.name}"
            matched.append({
                "folder": folder,
                "file": img.name,
                "work_id": best_work["id"],
                "title": best_work["title"],
                "composer": best_work["composer"],
                "score": round(best_score, 2),
                "url": url,
            })
            print(f"  ✓ {stem:45s} → {best_work['title']} ({best_work['composer']}) [{best_score:.2f}]")
        else:
            unmatched.append({"folder": folder, "file": img.name})
            top3 = [(round(s,2), w["title"], w["composer"]) for s, w in candidates[:3]]
            print(f"  ✗ {stem:45s}  (best: {top3})")

print(f"\n{'='*60}")
print(f"Matched:   {len(matched)}")
print(f"Unmatched: {len(unmatched)}")

# Write the updated works.json
if matched:
    answer = input("\nApply matches to works.json and copy images? [y/N] ").strip().lower()
    if answer == "y":
        for m in matched:
            work_by_id[m["work_id"]]["incipit"] = m["url"]
        OUT_DATA.write_text(json.dumps(works, ensure_ascii=False, indent=2))
        print(f"Updated {OUT_DATA}")

        for folder in set(m["folder"] for m in matched):
            src = IMG_SRC / folder
            dst = OUT_IMG / folder
            dst.mkdir(parents=True, exist_ok=True)
            for img in src.iterdir():
                if img.suffix.lower() in (".jpg", ".png") and img.parent == src:
                    shutil.copy2(img, dst / img.name)
            print(f"Copied images → public/images/{folder}/")
