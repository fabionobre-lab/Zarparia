"""Phase 1: convert every \\uXXXX escape in index.html to a literal UTF-8 char.

Surrogate pairs (\\ud83d\\udcf7 etc.) are combined into single code points.
This also fixes the CSS placeholder bug: `content:'\\ud83d\\udcf7'` was JS
escape syntax inside CSS, rendering as literal text "ud83dudcf7" instead
of the camera emoji.

Safety preconditions (verified before this script was written, and asserted
below): the file contains no literal `\\\\` sequences and no `\\x` escapes,
so every `\\u` in the file is an unambiguous unicode escape. The only other
backslash escapes are `\\'` which are left untouched. Line endings and all
other bytes are preserved.

Usage: python tools/normalize_encoding.py [file]   (default: index.html)
"""
import re
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent.parent / "index.html")
text = path.read_bytes().decode("utf-8")  # strict: fails if not clean UTF-8

assert "\\\\" not in text, "literal backslash-backslash found; review before converting"
assert not re.search(r"\\x[0-9a-fA-F]{2}", text), "\\x escape found; script only handles \\u"

def decode_run(m: re.Match) -> str:
    units = "".join(chr(int(h, 16)) for h in re.findall(r"\\u([0-9a-fA-F]{4})", m.group(0)))
    # combine surrogate pairs into real code points
    return units.encode("utf-16", "surrogatepass").decode("utf-16")

converted, n = re.subn(r"(?:\\u[0-9a-fA-F]{4})+", decode_run, text)
assert not re.search(r"\\u[0-9a-fA-F]{4}", converted)

path.write_bytes(converted.encode("utf-8"))
print(f"{path.name}: {n} escape runs converted, {len(text) - len(converted)} chars smaller")
