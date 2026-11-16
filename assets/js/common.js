/* Lucy's Lab — shared helpers: data loading, storage, small DOM utilities. */

const Lab = (() => {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status})`);
    return res.json();
  }

  async function getText(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status})`);
    return res.text();
  }

  /**
   * Loads data/modules.json. Each module gets its colour from its group, and
   * file paths default to data/questions/<id>.json and data/notes/<id>.md.
   */
  async function loadModules() {
    const data = await getJSON('data/modules.json');
    const groups = data.groups || [];
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
    const modules = data.modules
      .map((m) => ({
        ...m,
        colour: m.colour || groupById[m.group]?.colour || '#6b4ef0',
        groupName: groupById[m.group]?.name || '',
        questions: m.questions || `data/questions/${m.id}.json`,
        notes: m.notes || `data/notes/${m.id}.md`,
      }))
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return { modules, groups };
  }

  /**
   * Turns a raw question from JSON into the shape the app uses:
   *   - True/False questions get options ["True", "False"]
   *   - answerIndex is always a 0-based index into options
   */
  function normalise(raw, mod, i) {
    const q = { ...raw };
    q.module = q.module || mod.id;
    q.id = q.id || `${q.module}-${i + 1}`;

    if (q.type === 'tf' || q.type === 'truefalse') {
      q.type = 'tf';
      q.options = ['True', 'False'];
      q.answerIndex = q.answer === true || String(q.answer).toLowerCase() === 'true' ? 0 : 1;
    } else {
      q.type = 'mcq';
      q.answerIndex = typeof q.answer === 'number'
        ? q.answer
        : LETTERS.indexOf(String(q.answer).trim().toUpperCase());
    }

    if (!q.question || !Array.isArray(q.options) || q.answerIndex < 0 || q.answerIndex >= q.options.length) {
      console.warn('[Lucy\'s Lab] Skipping malformed question:', raw);
      return null;
    }

    // Multiple choice: build the pool of wrong answers (the file's other options plus any
    // "extraWrong" ones). deal() later picks some of these at random each time it's shown.
    if (q.type === 'mcq') {
      q.keepOrder = q.keepOrder === true || q.options.some((o) => /\b(all|none|both) of (the )?(above|these)\b/i.test(o));
      q.correct = q.options[q.answerIndex];
      const seen = new Set([q.correct.trim().toLowerCase()]);
      q.wrong = [...q.options.filter((_, i) => i !== q.answerIndex), ...(Array.isArray(q.extraWrong) ? q.extraWrong : [])]
        .filter((o) => {
          const k = String(o).trim().toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    }
    return q;
  }

  const WRONG_SHOWN = 3;   // how many wrong answers to show alongside the correct one

  /**
   * Returns a copy of a question ready to show: for multiple choice, the correct answer
   * plus WRONG_SHOWN random wrong answers from its pool, in a random order.
   * True/false questions are returned unchanged.
   */
  function deal(q) {
    if (q.type !== 'mcq' || !q.wrong) return q;
    // Options like "All of the above" only make sense in their written order, so leave those questions as they are.
    if (q.keepOrder) return q;
    const options = shuffle([q.correct, ...shuffle(q.wrong).slice(0, WRONG_SHOWN)]);
    return { ...q, options, answerIndex: options.indexOf(q.correct) };
  }

  /** Rebuild a previously dealt question from its saved option texts (falls back to a fresh deal). */
  function redeal(q, options) {
    if (q.type !== 'mcq' || !Array.isArray(options) || q.keepOrder) return q;
    const valid = options.includes(q.correct) && options.every((o) => o === q.correct || q.wrong.includes(o));
    return valid ? { ...q, options: [...options], answerIndex: options.indexOf(q.correct) } : deal(q);
  }

  async function loadAll() {
    const { modules, groups } = await loadModules();
    const lists = await Promise.all(
      modules.map((m) =>
        getJSON(m.questions)
          .then((arr) => arr.map((raw, i) => normalise(raw, m, i)).filter(Boolean))
          .catch((err) => { console.warn(`[Lucy's Lab] No questions for ${m.id}:`, err.message); return []; })
      )
    );
    const moduleById = Object.fromEntries(modules.map((m) => [m.id, m]));
    return { modules, groups, questions: lists.flat(), moduleById };
  }

  /** "M11 · Paralleling periapicals" */
  function moduleLabel(m) {
    return m.number != null ? `M${m.number} · ${m.name}` : m.name;
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Label shown for an option: A–D for multiple choice, True/False for TF. */
  function optionLabel(q, i) {
    return q.type === 'tf' ? q.options[i] : LETTERS[i];
  }

  function optionButton(q, i, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = LETTERS[i];
    const text = document.createElement('span');
    text.className = 'opt-text';
    text.textContent = q.options[i];
    b.append(letter, text);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function moduleTag(el, mod, fallback) {
    el.classList.add('module-tag');
    el.textContent = mod ? moduleLabel(mod) : fallback;
    if (mod && mod.colour) el.style.setProperty('--mod', mod.colour);
  }

  /** Restart a CSS animation class on an element. */
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function tweenNumber(el, from, to, ms = 600) {
    if (reducedMotion || from === to) { el.textContent = to.toLocaleString('en-GB'); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased).toLocaleString('en-GB');
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function toast(message) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }

  function showLoadError(container, err) {
    console.error(err);
    const isFile = location.protocol === 'file:';
    container.innerHTML = `
      <div class="card load-error">
        <h2>Couldn't load the question bank</h2>
        <p>${isFile
          ? 'Browsers block loading JSON files when a page is opened directly from disk. Run a tiny local server from the project folder instead, e.g. <code>python3 -m http.server</code>, then open <code>http://localhost:8000</code>.'
          : 'Check the files in the <code>data/</code> folder are valid JSON.'}</p>
        <p class="kbd-hint"></p>
      </div>`;
    container.querySelector('.kbd-hint').textContent = String(err.message || err);
  }

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  };

  return {
    LETTERS, reducedMotion, getJSON, getText, loadModules, loadAll, moduleLabel, shuffle, deal, redeal,
    optionLabel, optionButton, moduleTag, replay, tweenNumber, toast, showLoadError, store,
  };
})();
