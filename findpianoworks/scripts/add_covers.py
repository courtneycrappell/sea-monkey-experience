"""
Copy anthology cover images to public/images/ and update anthologies.json.
"""
import json, shutil
from pathlib import Path

IMG_SRC  = Path.home() / (
    "Library/CloudStorage/OneDrive-UniversityofMissouri/Crappell_Faculty"
    "/UH_Admin/OneDrive - University Of Houston/Work/Work_FPW"
    "/pablo/FindPianoWorksJSP/FindPianoWorks_JSP/WebContent/images"
)
# ColdFusion images folder — has additional covers not in the JSP folder
IMG_SRC_CF = Path.home() / (
    "Library/CloudStorage/OneDrive-UniversityofMissouri/Crappell_Faculty"
    "/UH_Admin/OneDrive - University Of Houston/Work/Work_FPW"
    "/pablo/FindPianoWorksCF/images"
)
OUT_DATA = Path(__file__).parent.parent / "src/data/anthologies.json"
OUT_IMG  = Path(__file__).parent.parent / "public/images"

# folder → exact book title (must match anthologies.json title field)
COVER_MAP = {
    "mc3":  "Masterwork Classics, Level 3",
    "mc4":  "Masterwork Classics, Level 4",
    "mc5":  "Masterwork Classics, Level 5",
    "mc6":  "Masterwork Classics, Level 6",
    "mc7":  "Masterwork Classics, Level 7",
    "mc8":  "Masterwork Classics, Level 8",
    "mc9":  "Masterwork Classics, Level 9",
    "mc10": "Masterwork Classics, Level 10",
    "mf1":  "Masterpieces with Flair, Book 1",
    "e1":   "Encore, Book 1",
    "e2":   "Encore, Book 2",
    "ca1":  "Classics Alive, Book 1",
    "ca2":  "Classics Alive, Book 2",
    "kbcp": "Kjos Piano Repertoire, Baroque & Classical, Prep Level",
    "kbc1": "Kjos Piano Repertoire, Baroque & Classical, Level 1",
    "kbc2": "Kjos Piano Repertoire, Baroque & Classical, Level 2",
    "kbc3": "Kjos Piano Repertoire, Baroque & Classical, Level 3",
    "kbc4": "Kjos Piano Repertoire, Baroque & Classical, Level 4",
    "kbc5": "Kjos Piano Repertoire, Baroque & Classical, Level 5",
    "kbc6": "Kjos Piano Repertoire, Baroque & Classical, Level 6",
    "kbc7": "Kjos Piano Repertoire, Baroque & Classical, Level 7",
    "kbc8": "Kjos Piano Repertoire, Baroque & Classical, Level 8",
    "kbc9": "Kjos Piano Repertoire, Baroque & Classical, Level 9",
    "kr2p": "Kjos Piano Repertoire, Romantic & 20th Century, Prep Level",
    "kr21": "Kjos Piano Repertoire, Romantic & 20th Century, Level 1",
    "kr22": "Kjos Piano Repertoire, Romantic & 20th Century, Level 2",
    "kr23": "Kjos Piano Repertoire, Romantic & 20th Century, Level 3",
    "kr24": "Kjos Piano Repertoire, Romantic & 20th Century, Level 4",
    "kr25": "Kjos Piano Repertoire, Romantic & 20th Century, Level 5",
    "kr26": "Kjos Piano Repertoire, Romantic & 20th Century, Level 6",
    "kr27": "Kjos Piano Repertoire, Romantic & 20th Century, Level 7",
    "kr28": "Kjos Piano Repertoire, Romantic & 20th Century, Level 8",
    "kr29": "Kjos Piano Repertoire, Romantic & 20th Century, Level 9",
    "ke1":  "Kjos Piano Repertoire, Etudes, Level 1",
}

# Entries sourced from the ColdFusion images folder instead:
# (folder_in_cf, dest_folder, cover_filename, book_title)
CF_COVER_MAP = [
    ("awayf1_2", "awayf1", "awayf1cover.jpg", "Around the World on 88 Keys, Book 1"),
    ("awayf1_2", "awayf2", "awayf2cover.jpg", "Around the World on 88 Keys, Book 2"),
    ("cspppr",   "cspppr", "csppprcover.jpg", "Celebration Series, Introductory Piano Repertoire"),
    ("csppr1",   "csppr1", "csppr1cover.jpg", "Celebration Series, Piano Repertoire, Book 1"),
]

anthologies = json.loads(OUT_DATA.read_text())
by_title    = {a["title"]: a for a in anthologies}

matched   = 0
unmatched = []

for folder, title in COVER_MAP.items():
    cover_src = IMG_SRC / folder / f"{folder}cover.jpg"
    if not cover_src.exists():
        unmatched.append(f"{folder}: source file not found")
        continue
    if title not in by_title:
        unmatched.append(f"{folder}: title '{title}' not in anthologies.json")
        continue

    # Copy image
    dest_dir = OUT_IMG / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cover_src, dest_dir / f"{folder}cover.jpg")

    # Update anthology record
    url = f"http://findpianoworks.com/images/{folder}/{folder}cover.jpg"
    by_title[title]["coverImage"] = url
    matched += 1
    print(f"  ✓ {folder}cover.jpg → {title}")

# Process CF-sourced covers
for src_folder, dest_folder, filename, title in CF_COVER_MAP:
    cover_src = IMG_SRC_CF / src_folder / filename
    if not cover_src.exists():
        unmatched.append(f"{src_folder}/{filename}: source file not found")
        continue
    if title not in by_title:
        unmatched.append(f"{filename}: title '{title}' not in anthologies.json")
        continue
    dest_dir = OUT_IMG / dest_folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cover_src, dest_dir / filename)
    url = f"http://findpianoworks.com/images/{dest_folder}/{filename}"
    by_title[title]["coverImage"] = url
    matched += 1
    print(f"  ✓ {filename} → {title}")

print(f"\nMatched: {matched}  |  Skipped: {len(unmatched)}")
for u in unmatched:
    print(f"  ✗ {u}")

OUT_DATA.write_text(json.dumps(anthologies, ensure_ascii=False, indent=2))
print(f"\nUpdated {OUT_DATA}")
