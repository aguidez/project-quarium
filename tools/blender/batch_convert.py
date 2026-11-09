# Headless batch of the Blender side of the bone pipeline: convert_fish.convert for each name, without a Blender
# window (the MCP isn't needed). Run through the runner:
#   npm run blender -- convert <Fish> [<Fish> ...]
# Each fish needs what convert_fish.py lists (design/meshes/<Fish>.obj, design/rigs/work/<Fish>_color.png and
# <Fish>.json); writes design/rigs/work/<Fish>.blend / .glb / _frames/. Prints one JSON summary line per fish, then
# exits 1 if any failed.
import json
import os
import sys
import traceback

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def main():
    names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not names:
        print("Usage: npm run blender -- convert <Fish> [<Fish> ...]")
        sys.exit(2)
    ns = {}
    path = os.path.join(REPO, "tools", "blender", "convert_fish.py")
    exec(compile(open(path).read(), path, "exec"), ns)
    failed = 0
    for name in names:
        try:
            summary = ns["convert"](REPO, name)
            ok = summary.get("unweighted", 1) == 0 and summary.get("max_influences", 5) <= 4
            print("RESULT " + json.dumps({"fish": name, "ok": ok, **summary}))
            failed += 0 if ok else 1
        except Exception:
            failed += 1
            print("RESULT " + json.dumps({"fish": name, "ok": False, "error": traceback.format_exc(limit=3)}))
    sys.exit(1 if failed else 0)


main()
