# Lucy's Lab

A static revision site for radiography exams. It uses plain HTML, CSS and JS, with no build step, so it can be hosted on GitHub Pages as is.

## Running locally

Browsers won't load the JSON files from a page opened straight from disk, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Pages

| Page | File | What it does |
|---|---|---|
| Home | `index.html` | Links to the three sections |
| Study Cards | `study.html` | Endless random questions. 10 pts × multiplier, and the multiplier grows +0.5 for each correct answer in a row. A module filter resets the score. Supports deep links: `study.html?modules=m11` |
| The Million Climb | `climb.html` | 15 multiple-choice questions up a £100 to £1,000,000 prize ladder, with safe points at £2,500 and £50,000. Lifelines: Halve it (removes two wrong answers), Poll the class (bar chart, correct answer always highest) and Ask Chris (the mascot says the right answer). Full-screen celebration for the million. Ladder and safe points are set at the top of `assets/js/climb.js` |
| Mock Test | `mock.html` | 100 questions spread across all modules in proportion to their size, with a 60-minute timer. Progress is saved if the page is reloaded. Graded A–F with a module breakdown and question-by-question review |
| Module Notes | `notes.html` | Renders `data/notes/<module>.md` (Markdown) |

## Data

```
data/
  modules.json         groups (name + colour) and modules (id, number, group, short name, full title)
  questions/mNN.json   array of questions for module NN (e.g. m11.json)
  notes/mNN.md         long-form notes for module NN in Markdown
```

The notes and questions were built from photos of Lucy's printed revision handout (Modules 2–25; Module 1 is an intro and isn't included). In the notes Markdown:

- `<mark>…</mark>` is a point Lucy highlighted. It shows as a yellow highlight.
- A blockquote starting `**Correction:**` is a place where the printed handout was wrong and has been corrected. It shows as an amber callout. No questions test these points.
- A blockquote starting `**Lucy's note:**` is one of her handwritten margin notes.

### Question format

```json
{
  "id": "m03-001",
  "module": "m03",
  "type": "mcq",
  "question": "What is the SI unit of absorbed dose?",
  "options": ["Sievert (Sv)", "Gray (Gy)", "Becquerel (Bq)", "Coulomb per kilogram (C/kg)"],
  "answer": "B",
  "explanation": "Optional. Shown after answering and in the mock test review.",
  "extraWrong": ["Rad", "Roentgen (R)", "Curie (Ci)"]
}
```

**How options are shown:** the correct answer is pooled with every other wrong answer (the other `options` plus any `extraWrong`). Each time a question appears, the app shows the correct answer plus **3 wrong answers picked at random from that pool**, in a random order. So a question with 6 wrong answers looks different most times it comes up, and the correct letter moves around.

This means:
- every wrong answer must be clearly wrong on its own;
- avoid "all/none of the above", or options that only make sense next to another option;
- explanations shouldn't mention option letters.

The mock test saves the options it dealt, so resuming a test shows the same ones. Questions transcribed from Lucy's study cards keep exactly the options on the card, so they're shuffled but have no `extraWrong`. They have a `"source": "Study card scN rXcY"` field. Generated questions have `"source": "generated"`.

True/false questions leave out `options` and use a boolean answer:

```json
{ "id": "m03-002", "module": "m03", "type": "tf",
  "question": "…", "answer": true, "explanation": "…" }
```

- `id` must be unique. The mock test uses it to restore progress.
- `answer` for `mcq` is a letter (`"A"`–`"D"`). For `tf` it is `true` or `false`.
- Malformed questions are skipped, with a warning in the browser console.
- Run `python3 tools/check_bank.py` from the project root after editing questions. It checks IDs, answers, `extraWrong` and so on, and prints per-module counts.

### Adding a module

Add an entry to `data/modules.json` (e.g. `{ "id": "m01", "number": 1, "group": "science", "name": "…", "title": "…" }`), then create `data/questions/m01.json` and `data/notes/m01.md`. File paths follow from the `id`, and the colour comes from the group.

## Tweakables

- Scoring: `BASE_POINTS`, `MULT_STEP`, `MILESTONE_EVERY` at the top of `assets/js/study.js`
- Mock test: `TEST_SIZE`, `DURATION_MS`, `GRADES` at the top of `assets/js/mock.js`
