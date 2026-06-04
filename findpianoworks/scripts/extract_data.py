"""
Extract data from FindPianoWorks MySQL dump and write JSON files for the static site.
Usage: python scripts/extract_data.py
"""
import re
import json
import os

SQL_FILE = os.path.join(
    os.path.dirname(__file__), "..",
    "../Library/CloudStorage/OneDrive-UniversityofMissouri/Crappell_Faculty"
    "/UH_Admin/OneDrive - University Of Houston/Work/Work_FPW"
    "/kcstorage old/CMD/21mysql.sql"
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")


# ---------------------------------------------------------------------------
# SQL parsing helpers
# ---------------------------------------------------------------------------

def parse_values(values_str):
    """Parse a VALUES (...),(...)  string into a list of tuples."""
    rows = []
    # Each row is a parenthesised group
    for m in re.finditer(r'\(([^()]*(?:\([^()]*\)[^()]*)*)\)', values_str):
        raw = m.group(1)
        fields = split_sql_row(raw)
        rows.append(fields)
    return rows


def split_sql_row(row_str):
    """Split a comma-separated SQL row respecting quoted strings."""
    fields = []
    current = []
    in_quote = False
    escape_next = False
    for ch in row_str:
        if escape_next:
            current.append(ch)
            escape_next = False
        elif ch == '\\':
            escape_next = True
            current.append(ch)
        elif ch == "'" and not in_quote:
            in_quote = True
            current.append(ch)
        elif ch == "'" and in_quote:
            in_quote = False
            current.append(ch)
        elif ch == ',' and not in_quote:
            fields.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)
    fields.append(''.join(current).strip())
    return [clean_field(f) for f in fields]


def clean_field(f):
    f = f.strip()
    if f.upper() == 'NULL':
        return None
    if f.startswith("'") and f.endswith("'"):
        inner = f[1:-1]
        inner = inner.replace("\\'", "'").replace('\\\\', '\\')
        return inner.strip()
    try:
        return int(f)
    except ValueError:
        pass
    try:
        return float(f)
    except ValueError:
        pass
    return f


def load_table(sql_text, table_name):
    """Return list of dicts for all INSERT rows for a given table."""
    # Find CREATE TABLE to get column names
    col_pat = re.compile(
        r'CREATE TABLE `' + re.escape(table_name) + r'`\s*\((.*?)\)\s*ENGINE',
        re.DOTALL | re.IGNORECASE
    )
    m = col_pat.search(sql_text)
    if not m:
        return []
    col_block = m.group(1)
    col_names = []
    for line in col_block.split('\n'):
        line = line.strip()
        cm = re.match(r'`([^`]+)`\s+', line)
        if cm and not line.upper().startswith(('PRIMARY', 'KEY', 'UNIQUE', 'CONSTRAINT', 'INDEX')):
            col_names.append(cm.group(1))

    # Collect all INSERT rows
    rows = []
    insert_pat = re.compile(
        r'insert\s+into\s+`' + re.escape(table_name) + r'`\s+values\s*(.*?);',
        re.IGNORECASE | re.DOTALL
    )
    for im in insert_pat.finditer(sql_text):
        for row_vals in parse_values(im.group(1)):
            if len(row_vals) == len(col_names):
                rows.append(dict(zip(col_names, row_vals)))
            elif row_vals:
                # Best-effort: zip what we have
                rows.append(dict(zip(col_names[:len(row_vals)], row_vals)))
    return rows


def rows_to_dict(rows, key_col, val_col):
    """Build id→value lookup dict."""
    return {r[key_col]: r[val_col] for r in rows if r.get(key_col) is not None}


def rows_to_multi(rows, key_col, val_col):
    """Build id→[values] lookup dict."""
    result = {}
    for r in rows:
        k = r.get(key_col)
        v = r.get(val_col)
        if k is not None:
            result.setdefault(k, []).append(v)
    return result


# ---------------------------------------------------------------------------
# Main extraction
# ---------------------------------------------------------------------------

def main():
    with open(SQL_FILE, 'r', encoding='latin-1') as f:
        sql = f.read()

    print("Loaded SQL file.")

    # --- Load all tables ---
    works_rows       = load_table(sql, 'tblworks')
    originator_rows  = load_table(sql, 'tbloriginator')
    books_rows       = load_table(sql, 'tblbooks')
    booksdetails     = load_table(sql, 'tblbooksdetails')
    bookoriginator   = load_table(sql, 'tblbookoriginator')
    wk_techniques    = load_table(sql, 'tblworkstechniques')
    wk_rhythms       = load_table(sql, 'tblworksrhythms')
    publishers_rows  = load_table(sql, 'tblpublishers')
    collection_rows  = load_table(sql, 'tblcollectionlist')
    techniques_rows  = load_table(sql, 'tbltechniques')
    rhythm_rows      = load_table(sql, 'tblrhythm')
    genre_rows       = load_table(sql, 'tblgenrelist')
    period_rows      = load_table(sql, 'tblperiodlist')
    level_rows       = load_table(sql, 'tbllevellist')
    mood_rows        = load_table(sql, 'tblmoodlist')
    occasion_rows    = load_table(sql, 'tbloccasionlist')
    keysig_rows      = load_table(sql, 'tblkeysiglist')
    meter_rows       = load_table(sql, 'tblmeterlist')
    tempo_rows       = load_table(sql, 'tbltempolist')
    movement_rows    = load_table(sql, 'tblmovementlist')
    country_rows     = load_table(sql, 'tblcountrylist')
    instrumentation_rows = load_table(sql, 'tblinstrumentationlist')
    booktype_rows    = load_table(sql, 'tblbooktypelist')
    role_rows        = load_table(sql, 'tblrolelist')

    print(f"  works: {len(works_rows)}, originators: {len(originator_rows)}, books: {len(books_rows)}")

    # --- Build lookup dicts ---
    def first_val(rows, id_col):
        # Returns {id: first non-id column value}
        result = {}
        for r in rows:
            keys = list(r.keys())
            val_keys = [k for k in keys if k != id_col]
            if val_keys:
                result[r[id_col]] = r[val_keys[0]]
        return result

    period_map      = rows_to_dict(period_rows,      'PeriodID',          'Period')
    level_map       = rows_to_dict(level_rows,        'LevelID',           'MagrathLevel')
    mood_map        = rows_to_dict(mood_rows,         'MoodID',            'Mood')
    occasion_map    = rows_to_dict(occasion_rows,     'OccasionID',        'Occasion')
    keysig_map      = rows_to_dict(keysig_rows,       'KeyID',             'KeySig')
    meter_map       = rows_to_dict(meter_rows,        'MeterID',           'Meter')
    tempo_map       = rows_to_dict(tempo_rows,        'TempoID',           'Tempo')
    movement_map    = rows_to_dict(movement_rows,     'MovementID',        'Movement')
    genre_map       = rows_to_dict(genre_rows,        'GenreID',           'Genre')
    country_map     = rows_to_dict(country_rows,      'CountryID',         'Country')
    collection_map  = rows_to_dict(collection_rows,   'CollectionID',      'CollectionTitle')
    publisher_map   = rows_to_dict(publishers_rows,   'PublisherID',       'PublisherName')
    technique_map   = {r['TechniqueID']: r['Technique'] for r in techniques_rows if 'TechniqueID' in r}
    rhythm_map      = {r['RhythmID']: r['Rhythm'] for r in rhythm_rows if 'RhythmID' in r}
    book_map        = {r['BooksID']: r for r in books_rows}
    instrumentation_map = rows_to_dict(instrumentation_rows, 'InstrumentationID', 'Instrumentation')
    booktype_map    = rows_to_dict(booktype_rows,     'BookTypeID',        'BookType')

    # work → techniques (many-to-many)
    work_techniques = rows_to_multi(wk_techniques, 'WorksID', 'TechniqueID')
    # work → rhythms
    work_rhythms    = rows_to_multi(wk_rhythms,    'WorksID', 'RhythmID')
    # work → books (sources)
    work_books      = rows_to_multi(booksdetails,  'WorkID',  'BookID')
    # book → originators
    book_orig       = {}
    role_map        = rows_to_dict(role_rows, 'RoleID', 'Role')
    # note: tblrolelist columns are RoleID, Role
    for r in bookoriginator:
        bid = r.get('BooksID')
        oid = r.get('OriginatorID')
        rid = r.get('Role')
        if bid is not None:
            book_orig.setdefault(bid, []).append({'originatorID': oid, 'role': role_map.get(rid, '')})

    # originator lookup
    orig_map = {r['OriginatorID']: r for r in originator_rows}

    def orig_name(oid):
        o = orig_map.get(oid)
        if not o:
            return ''
        parts = [o.get('LastName', ''), o.get('FirstName', '')]
        mid = o.get('MiddleName', '')
        if mid and mid.strip():
            parts.append(mid)
        return ', '.join(p for p in parts if p and p.strip())

    def clean(v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s and s != ' ' else None

    # --- Build works.json ---
    works_out = []
    for w in works_rows:
        wid     = w.get('WorksID')
        oid     = w.get('OriginatorID')
        orig    = orig_map.get(oid, {})

        tech_ids   = work_techniques.get(wid, [])
        rhythm_ids = work_rhythms.get(wid, [])
        book_ids   = work_books.get(wid, [])

        techniques_list = [technique_map[t] for t in tech_ids if t in technique_map]
        rhythms_list    = [rhythm_map[r] for r in rhythm_ids if r in rhythm_map]
        sources_list    = [book_map[b]['BookTitle'] for b in book_ids if b in book_map]

        level_id = w.get('Level')
        works_out.append({
            'id':              wid,
            'title':           clean(w.get('WorkTitle')),
            'composerId':      oid,
            'composer':        orig_name(oid),
            'birthDate':       clean(orig.get('BirthDate')),
            'deathDate':       clean(orig.get('DeathDate')),
            'period':          clean(period_map.get(orig.get('Period'))),
            'country':         clean(country_map.get(orig.get('Countries'))),
            'levelId':         level_id,
            'level':           clean(level_map.get(level_id)),
            'catalogNumber':   clean(w.get('CatalogNumber')),
            'collection':      clean(collection_map.get(w.get('FromCollection'))),
            'movement':        clean(movement_map.get(w.get('Movement'))),
            'keySig':          clean(keysig_map.get(w.get('KeySig'))),
            'meter':           clean(meter_map.get(w.get('Meter'))),
            'genre':           clean(genre_map.get(w.get('Genre'))),
            'instrumentation': clean(instrumentation_map.get(w.get('Instrumentation'))),
            'tempo':           clean(tempo_map.get(w.get('Tempo'))),
            'markedTempo':     clean(w.get('MarkedTempo/Mood')),
            'mood':            clean(mood_map.get(w.get('Mood'))),
            'occasion':        clean(occasion_map.get(w.get('Occasion'))),
            'length':          clean(w.get('Length')),
            'incipit':         clean(w.get('Incipit')),
            'comments':        clean(w.get('Comments')),
            'techniques':      techniques_list,
            'rhythms':         rhythms_list,
            'sources':         sources_list,
        })

    # --- Build composers.json ---
    composers_out = []
    for o in originator_rows:
        oid = o.get('OriginatorID')
        composers_out.append({
            'id':         oid,
            'name':       orig_name(oid),
            'lastName':   clean(o.get('LastName')),
            'firstName':  clean(o.get('FirstName')),
            'middleName': clean(o.get('MiddleName')),
            'birthDate':  clean(o.get('BirthDate')),
            'deathDate':  clean(o.get('DeathDate')),
            'period':     clean(period_map.get(o.get('Period'))),
            'country':    clean(country_map.get(o.get('Countries'))),
            'comments':   clean(o.get('Comments')),
        })
    composers_out.sort(key=lambda c: (c.get('lastName') or '', c.get('firstName') or ''))

    # --- Build anthologies.json ---
    # book → works (reverse of work_books)
    book_works = {}
    for r in booksdetails:
        bid = r.get('BookID')
        wid = r.get('WorkID')
        if bid is not None:
            book_works.setdefault(bid, []).append(wid)

    work_by_id = {w['id']: w for w in works_out}
    anthologies_out = []
    for b in books_rows:
        bid = b.get('BooksID')
        orig_list = book_orig.get(bid, [])
        editors = [
            {'name': orig_name(e['originatorID']), 'role': e['role']}
            for e in orig_list
        ]
        wids = book_works.get(bid, [])
        contained = [work_by_id[w] for w in wids if w in work_by_id]
        contained.sort(key=lambda x: (x.get('composer') or '', x.get('title') or ''))
        anthologies_out.append({
            'id':          bid,
            'title':       clean(b.get('BookTitle')),
            'bookType':    clean(booktype_map.get(b.get('BookType'))),
            'publisher':   clean(publisher_map.get(b.get('Publisher'))),
            'pubDateOrig': clean(b.get('OriginalPublicationDate')),
            'pubDateLast': clean(b.get('LastPublicationDate')),
            'coverImage':  clean(b.get('CoverscanFilename')),
            'companionCD': b.get('CompanionCD') == 2,
            'comments':    clean(b.get('Comments')),
            'editors':     editors,
            'works':       contained,
        })
    anthologies_out.sort(key=lambda a: a.get('title') or '')

    # --- Build lookup files ---
    def lookup_list(rows, id_col, val_col):
        return sorted(
            [{'id': r[id_col], 'label': r[val_col]} for r in rows
             if r.get(id_col) and r.get(val_col) and str(r[val_col]).strip() and str(r[val_col]).strip() != ' '],
            key=lambda x: x.get('label', '')
        )

    lookups = {
        'techniques': lookup_list(techniques_rows,       'TechniqueID',       'Technique'),
        'genres':     lookup_list(genre_rows,             'GenreID',           'Genre'),
        'levels':     sorted([{'id': r['LevelID'], 'label': r['MagrathLevel']} for r in level_rows
                               if r.get('LevelID') and r.get('MagrathLevel')],
                             key=lambda x: x['id']),
        'periods':    lookup_list(period_rows,            'PeriodID',          'Period'),
        'moods':      lookup_list(mood_rows,              'MoodID',            'Mood'),
        'occasions':  lookup_list(occasion_rows,          'OccasionID',        'Occasion'),
        'rhythms':    lookup_list(rhythm_rows,            'RhythmID',          'Rhythm'),
        'keysigs':    lookup_list(keysig_rows,            'KeyID',             'KeySig'),
        'meters':     lookup_list(meter_rows,             'MeterID',           'Meter'),
        'tempos':     lookup_list(tempo_rows,             'TempoID',           'Tempo'),
        'countries':  lookup_list(country_rows,           'CountryID',         'Country'),
        'instrumentation': lookup_list(instrumentation_rows, 'InstrumentationID', 'Instrumentation'),
    }

    # --- Write output ---
    os.makedirs(OUT_DIR, exist_ok=True)
    lookup_dir = os.path.join(OUT_DIR, 'lookup')
    os.makedirs(lookup_dir, exist_ok=True)

    def write_json(path, data):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Wrote {path} ({len(data)} items)")

    write_json(os.path.join(OUT_DIR, 'works.json'),       works_out)
    write_json(os.path.join(OUT_DIR, 'composers.json'),   composers_out)
    write_json(os.path.join(OUT_DIR, 'anthologies.json'), anthologies_out)

    for name, data in lookups.items():
        write_json(os.path.join(lookup_dir, f'{name}.json'), data)

    print(f"\nDone. {len(works_out)} works, {len(composers_out)} composers, {len(anthologies_out)} anthologies.")


if __name__ == '__main__':
    main()
