"""Sanity-check the Lucy's Lab question bank.

Usage:  python3 tools/check_bank.py            (run from the project root)

Prints per-module stats and any structural problems:
  - unique ids, matching module, question + explanation present
  - mcq: 4 options (study-card questions may differ), answer letter valid,
    extraWrong is a list of new strings that don't repeat an existing option
  - tf: boolean answer
  - explanations shouldn't mention option letters (options are shuffled when shown)
"""
import collections, json, pathlib, re, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
mods = json.loads((root / "data/modules.json").read_text())["modules"]
problems, ids, texts = [], set(), {}
tot = collections.Counter()
LETTER_REF = re.compile(r"\b(option|answer|choice)s? [A-F]\b|\([A-F]\)")

print(f"{'mod':5}{'n':>4}{'mcq':>5}{'tf':>4}{'card':>5}  wrong-pool  no-extraWrong")
for m in mods:
    p = root / f"data/questions/{m['id']}.json"
    if not p.exists():
        print(f"{m['id']:5}  MISSING"); continue
    qs = json.loads(p.read_text())
    mcq = tf = cards = missing_ew = 0
    pools = []
    for q in qs:
        qid = q.get("id")
        is_card = "card" in str(q.get("source", "")).lower()
        cards += is_card
        if qid in ids: problems.append(f"duplicate id {qid}")
        ids.add(qid)
        if q.get("module") != m["id"]: problems.append(f"{qid}: module {q.get('module')} != {m['id']}")
        if not q.get("question") or not q.get("explanation"): problems.append(f"{qid}: missing question/explanation")
        key = q.get("question", "").strip().lower()
        if key in texts and not is_card: problems.append(f"{qid}: same text as {texts[key]}")
        texts.setdefault(key, qid)
        if LETTER_REF.search(q.get("explanation", "")): problems.append(f"{qid}: explanation refers to an option letter")
        if q.get("type") == "mcq":
            mcq += 1
            opts = q.get("options", [])
            if len(opts) != 4 and not is_card: problems.append(f"{qid}: {len(opts)} options")
            a = q.get("answer")
            if not isinstance(a, str) or a not in "ABCDEF"[:len(opts)] or not a:
                problems.append(f"{qid}: bad answer {a!r}"); continue
            ew = q.get("extraWrong")
            if ew is None:
                if not is_card: missing_ew += 1
                ew = []
            elif not isinstance(ew, list) or not all(isinstance(x, str) and x.strip() for x in ew):
                problems.append(f"{qid}: extraWrong malformed"); ew = []
            pool = [o.strip().lower() for o in opts] + [x.strip().lower() for x in ew]
            if len(set(pool)) != len(pool): problems.append(f"{qid}: duplicate text among options/extraWrong")
            pools.append(len(opts) - 1 + len(ew))
            for o in opts + ew:
                # Allowed on Lucy's own study cards (the app keeps those in their written order).
                if not is_card and any(w in o.lower() for w in ("all of the above", "none of the above", "both a and b")):
                    problems.append(f"{qid}: uses '{o}'")
        elif q.get("type") == "tf":
            tf += 1
            if not isinstance(q.get("answer"), bool): problems.append(f"{qid}: tf answer not bool")
        else:
            problems.append(f"{qid}: bad type {q.get('type')}")
    tot["n"] += len(qs); tot["mcq"] += mcq; tot["tf"] += tf; tot["card"] += cards; tot["missing"] += missing_ew
    pool_txt = f"{min(pools)}-{max(pools)}" if pools else "-"
    print(f"{m['id']:5}{len(qs):>4}{mcq:>5}{tf:>4}{cards:>5}  {pool_txt:>10}  {missing_ew:>8}")
print(f"TOTAL {tot['n']} questions: {tot['mcq']} mcq, {tot['tf']} tf, {tot['card']} from study cards, {tot['missing']} mcq without extraWrong")
print("\n".join(problems) if problems else "No problems found.")
