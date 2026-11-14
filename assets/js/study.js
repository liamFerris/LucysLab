/* Study Cards: endless random questions with points, streaks and a multiplier. */

(async function () {
  const BASE_POINTS = 10;      // points for a correct answer at ×1
  const MULT_STEP = 0.5;       // multiplier gained per correct answer in a row
  const MILESTONE_EVERY = 5;   // celebrate every N in a row
  const BEST_KEY = 'lucyslab.study.best';
  const PRAISE = ['Correct!', 'Nailed it!', 'Spot on!', 'Brilliant!', 'Yes!', 'Lovely!', 'Exactly right!'];

  const $ = (id) => document.getElementById(id);
  const main = $('studyMain');

  let data;
  try { data = await Lab.loadAll(); }
  catch (err) { Lab.showLoadError(main, err); return; }
  const { modules, groups, questions, moduleById } = data;

  const els = {
    points: $('points'), answered: $('answered'), mult: $('mult'), multValue: $('multValue'),
    streak: $('streakStat'), accuracy: $('accuracyStat'), best: $('bestStat'),
    filter: $('filter'), filterGroups: $('filterGroups'), filterSummary: $('filterSummary'),
    filterAll: $('filterAll'), filterDone: $('filterDone'), card: $('card'), qModule: $('qModule'), qType: $('qType'),
    qText: $('qText'), options: $('options'), feedback: $('feedback'), verdict: $('verdict'),
    explanation: $('explanation'), next: $('nextBtn'),
    banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
  };

  const state = {
    selected: new Set(),   // empty = all modules
    deck: [],
    current: null,
    points: 0,
    answered: 0,
    correct: 0,
    streak: 0,
    locked: false,
  };
  let best = Lab.store.get(BEST_KEY, { points: 0, streak: 0 });

  // Allow deep links like study.html?modules=radiation-physics,anatomy-positioning
  const urlModules = new URLSearchParams(location.search).get('modules');
  if (urlModules) urlModules.split(',').forEach((id) => moduleById[id] && state.selected.add(id));
  normaliseSelection();

  const multiplier = () => 1 + MULT_STEP * state.streak;
  const fmtMult = (m) => '×' + (Number.isInteger(m) ? m : m.toFixed(1));
  const multLevel = (s) => (s >= 10 ? 4 : s >= 6 ? 3 : s >= 3 ? 2 : s >= 1 ? 1 : 0);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const pool = () => (state.selected.size ? questions.filter((q) => state.selected.has(q.module)) : questions);

  /* ---------- Module filter ---------- */

  // A function declaration (not const) so it's usable during start-up, before this line runs.
  function countFor(id) { return questions.filter((q) => q.module === id).length; }

  function renderChips() {
    const groupList = groups.length ? groups : [{ id: null, name: 'Modules' }];
    els.filterGroups.replaceChildren(...groupList.map((g) => {
      const mods = modules.filter((m) => (g.id ? m.group === g.id : true) && countFor(m.id) > 0);
      if (!mods.length) return document.createDocumentFragment();

      const wrap = document.createElement('section');
      wrap.className = 'filter-group';
      if (g.colour) wrap.style.setProperty('--mod', g.colour);

      const head = document.createElement('div');
      head.className = 'filter-group-head';
      const title = document.createElement('h3');
      title.textContent = g.name;
      const allOn = mods.every((m) => state.selected.has(m.id));
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'link-btn';
      toggle.textContent = allOn ? 'Clear group' : 'Select group';
      toggle.addEventListener('click', () => {
        mods.forEach((m) => (allOn ? state.selected.delete(m.id) : state.selected.add(m.id)));
        normaliseSelection();
        changeFilter();
      });
      head.append(title, toggle);

      const chips = document.createElement('div');
      chips.className = 'chips';
      chips.append(...mods.map((m) => chip(Lab.moduleLabel(m), countFor(m.id), state.selected.has(m.id), m.colour, () => {
        state.selected.has(m.id) ? state.selected.delete(m.id) : state.selected.add(m.id);
        normaliseSelection();
        changeFilter();
      })));

      wrap.append(head, chips);
      return wrap;
    }));

    const n = pool().length;
    const sel = [...state.selected].map((id) => moduleById[id]);
    els.filterSummary.textContent = sel.length === 0
      ? `All modules · ${n} questions`
      : sel.length === 1
        ? `${Lab.moduleLabel(sel[0])} · ${n} questions`
        : `${sel.length} modules · ${n} questions`;
    els.filterAll.disabled = state.selected.size === 0;
  }

  function normaliseSelection() {
    const withQuestions = modules.filter((m) => countFor(m.id) > 0);
    if (state.selected.size >= withQuestions.length) state.selected.clear();
  }

  function chip(label, count, active, colour, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(active));
    if (colour) b.style.setProperty('--mod', colour);
    b.disabled = count === 0;
    const dot = document.createElement('span'); dot.className = 'chip-dot';
    const text = document.createElement('span'); text.textContent = label;
    const n = document.createElement('span'); n.className = 'chip-count'; n.textContent = count;
    b.append(dot, text, n);
    b.addEventListener('click', onClick);
    return b;
  }

  function changeFilter() {
    const hadProgress = state.answered > 0;
    resetSession();
    renderChips();
    syncUrl();
    nextQuestion();
    if (hadProgress) Lab.toast('Modules changed, so your score has been reset');
  }

  function syncUrl() {
    const url = new URL(location.href);
    if (state.selected.size) url.searchParams.set('modules', [...state.selected].join(','));
    else url.searchParams.delete('modules');
    history.replaceState(null, '', url);
  }

  function resetSession() {
    Object.assign(state, { deck: [], points: 0, answered: 0, correct: 0, streak: 0 });
    renderScore(false);
  }

  /* ---------- Questions ---------- */

  function nextQuestion() {
    const available = pool();
    if (!available.length) {
      els.card.innerHTML = '<div class="empty-state"><h2>No questions yet</h2><p>There are no questions for the selected modules.</p></div>';
      return;
    }
    if (!state.deck.length) {
      // Work through a shuffled deck so nothing repeats until everything has been seen.
      state.deck = Lab.shuffle(available);
      const last = state.deck.length - 1;
      if (state.current && last > 0 && state.deck[last].id === state.current.id) {
        [state.deck[0], state.deck[last]] = [state.deck[last], state.deck[0]];
      }
    }
    state.current = state.deck.pop();
    state.locked = false;
    renderQuestion(state.current);
  }

  function renderQuestion(q) {
    Lab.moduleTag(els.qModule, moduleById[q.module], q.module);
    els.qType.textContent = q.type === 'tf' ? 'True or false' : 'Multiple choice';
    els.qText.textContent = q.question;
    els.options.className = 'options' + (q.type === 'tf' ? ' tf' : '');
    els.options.replaceChildren(...q.options.map((_, i) => Lab.optionButton(q, i, () => answer(i))));
    els.feedback.hidden = true;
    Lab.replay(els.card, 'enter');
  }

  function answer(i) {
    if (state.locked) return;
    state.locked = true;

    const q = state.current;
    const right = i === q.answerIndex;
    const buttons = [...els.options.children];
    const chosen = buttons[i];

    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === q.answerIndex) b.classList.add('is-correct');
      else if (j === i) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    });

    state.answered++;

    if (right) {
      const gained = BASE_POINTS * multiplier();
      state.points += gained;
      state.correct++;
      state.streak++;

      Lab.replay(chosen, 'pop');
      floatText(chosen, `+${gained}`);
      const r = chosen.getBoundingClientRect();
      Confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 22 + Math.min(state.streak * 5, 70), 1 + Math.min(state.streak, 10) * 0.05);
      if (state.streak > 1) Lab.replay(els.mult, 'bump');
      if (state.streak % MILESTONE_EVERY === 0) milestone();

      els.verdict.textContent = `${pick(PRAISE)} +${gained} points`;
      els.verdict.className = 'verdict good';
    } else {
      const lostStreak = state.streak;
      state.streak = 0;
      Lab.replay(els.card, 'shake');
      if (lostStreak >= 2) Lab.replay(els.mult, 'drop');
      els.verdict.textContent = `Not quite. The answer is ${Lab.optionLabel(q, q.answerIndex)}.`;
      els.verdict.className = 'verdict bad';
    }

    els.explanation.textContent = q.explanation || '';
    els.explanation.hidden = !q.explanation;

    if (state.points > best.points || state.streak > best.streak) {
      best = { points: Math.max(best.points, state.points), streak: Math.max(best.streak, state.streak) };
      Lab.store.set(BEST_KEY, best);
    }

    renderScore(true);
    els.feedback.hidden = false;
    els.next.focus({ preventScroll: true });
    els.feedback.scrollIntoView({ block: 'nearest', behavior: Lab.reducedMotion ? 'auto' : 'smooth' });
  }

  /* ---------- Score & effects ---------- */

  let shownPoints = 0;
  function renderScore(animate) {
    if (animate) Lab.tweenNumber(els.points, shownPoints, state.points);
    else els.points.textContent = state.points.toLocaleString('en-GB');
    shownPoints = state.points;
    els.answered.textContent = state.answered.toLocaleString('en-GB');
    els.multValue.textContent = fmtMult(multiplier());
    els.mult.dataset.level = multLevel(state.streak);
    els.streak.textContent = state.streak;
    els.accuracy.textContent = state.answered ? Math.round((state.correct / state.answered) * 100) + '%' : '–';
    els.best.textContent = best.points.toLocaleString('en-GB');
  }

  function floatText(anchor, text) {
    const r = anchor.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-points';
    f.textContent = text;
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top - 6}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  function milestone() {
    els.bannerTitle.textContent = `${state.streak} in a row!`;
    els.bannerSub.textContent = `Multiplier now ${fmtMult(multiplier())}`;
    Lab.replay(els.banner, 'show');
    Confetti.rain(100 + Math.min(state.streak, 30) * 4);
  }

  /* ---------- Input ---------- */

  els.next.addEventListener('click', nextQuestion);
  els.filterAll.addEventListener('click', () => {
    if (!state.selected.size) return;
    state.selected.clear();
    changeFilter();
  });
  els.filterDone.addEventListener('click', () => { els.filter.open = false; });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const q = state.current;
    if (!q) return;
    const key = e.key.toLowerCase();

    if (state.locked) {
      if (key === 'enter' || key === 'arrowright' || key === ' ') {
        e.preventDefault();
        nextQuestion();
      }
      return;
    }
    let idx = -1;
    if (q.type === 'tf') idx = key === 't' ? 0 : key === 'f' ? 1 : -1;
    else idx = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(key);
    if (idx === -1 && /^[1-6]$/.test(key)) idx = Number(key) - 1;
    if (idx >= 0 && idx < q.options.length) answer(idx);
  });

  /* ---------- Go ---------- */

  renderChips();
  renderScore(false);
  nextQuestion();
})();
