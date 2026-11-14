/* Mock Test: 100 random questions, 60-minute timer, graded at the end. */

(async function () {
  const TEST_SIZE = 100;
  const DURATION_MS = 60 * 60 * 1000;
  const ACTIVE_KEY = 'lucyslab.mock.active';
  const HISTORY_KEY = 'lucyslab.mock.history';

  // Grade boundaries (minimum % for each grade). Tweak here if the course uses different bands.
  const GRADES = [
    { grade: 'A', min: 70, msg: 'Outstanding!', colour: 'var(--good)' },
    { grade: 'B', min: 60, msg: 'Great work!', colour: '#2d8fe0' },
    { grade: 'C', min: 50, msg: 'Solid, keep it up', colour: 'var(--notes)' },
    { grade: 'D', min: 40, msg: 'Getting there', colour: 'var(--study)' },
    { grade: 'F', min: 0, msg: 'Time for more revision', colour: 'var(--bad)' },
  ];

  const $ = (id) => document.getElementById(id);
  const main = $('mockMain');

  let data;
  try { data = await Lab.loadAll(); }
  catch (err) { Lab.showLoadError(main, err); return; }
  const { modules, questions, moduleById } = data;
  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]));

  const views = { intro: $('intro'), test: $('test'), results: $('results') };
  let test = null;       // { ids, answers, flags, current, startTime, endTime }
  let timerId = null;

  function show(name) {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    window.scrollTo(0, 0);
  }

  const save = () => test && Lab.store.set(ACTIVE_KEY, test);
  const testQuestions = () => test.ids.map((id) => questionById[id]);

  /* ---------- Intro ---------- */

  function showIntro() {
    const count = Math.min(TEST_SIZE, questions.length);
    $('factCount').textContent = count;
    $('factModules').textContent = modules.length;

    const note = $('introNote');
    note.hidden = questions.length >= TEST_SIZE;
    note.textContent = `Only ${questions.length} questions in the bank so far, so this test will use all of them.`;

    const saved = Lab.store.get(ACTIVE_KEY, null);
    $('resumeBtn').hidden = !saved;
    $('startBtn').textContent = saved ? 'Start a new test' : 'Start the clock';
    $('startBtn').className = saved ? 'btn btn-ghost' : 'btn btn-primary';

    const history = Lab.store.get(HISTORY_KEY, []);
    $('history').hidden = !history.length;
    $('historyList').replaceChildren(...history.slice(0, 5).map((h) => {
      const li = document.createElement('li');
      const when = new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.innerHTML = '<span></span><span><b></b> · </span>';
      li.firstChild.textContent = when;
      li.lastChild.firstChild.textContent = h.grade;
      li.lastChild.append(`${h.pct}%`);
      return li;
    }));

    show('intro');
  }

  /**
   * Pick TEST_SIZE questions spread across every module, in proportion to how many
   * questions each module has (at least one from each), then shuffle the lot.
   */
  function pickQuestions() {
    if (questions.length <= TEST_SIZE) return Lab.shuffle(questions);
    const byModule = modules
      .map((m) => ({ list: Lab.shuffle(questions.filter((q) => q.module === m.id)) }))
      .filter((g) => g.list.length);
    byModule.forEach((g) => {
      g.exact = (g.list.length / questions.length) * TEST_SIZE;
      g.take = Math.min(g.list.length, Math.max(1, Math.floor(g.exact)));
    });
    // Hand out any remaining places to the modules with the largest remainders.
    let left = TEST_SIZE - byModule.reduce((n, g) => n + g.take, 0);
    const byRemainder = [...byModule].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
    for (let i = 0; left > 0 && i < byRemainder.length * 4; i++) {
      const g = byRemainder[i % byRemainder.length];
      if (g.take < g.list.length) { g.take++; left--; }
    }
    return Lab.shuffle(byModule.flatMap((g) => g.list.slice(0, g.take))).slice(0, TEST_SIZE);
  }

  $('startBtn').addEventListener('click', () => {
    const ids = pickQuestions().map((q) => q.id);
    const now = Date.now();
    test = {
      ids,
      answers: ids.map(() => null),
      flags: ids.map(() => false),
      current: 0,
      startTime: now,
      endTime: now + DURATION_MS,
    };
    save();
    startTest();
  });

  $('resumeBtn').addEventListener('click', () => {
    test = Lab.store.get(ACTIVE_KEY, null);
    if (test) startTest();
  });

  /* ---------- Test ---------- */

  function startTest() {
    // Drop any questions that no longer exist in the bank (e.g. after an edit).
    const keep = test.ids.map((id, i) => (questionById[id] ? i : -1)).filter((i) => i >= 0);
    if (keep.length !== test.ids.length) {
      test.ids = keep.map((i) => test.ids[i]);
      test.answers = keep.map((i) => test.answers[i]);
      test.flags = keep.map((i) => test.flags[i]);
      test.current = Math.min(test.current, test.ids.length - 1);
    }
    $('qTotal').textContent = test.ids.length;
    buildPalette();
    show('test');
    renderCurrent();
    tick();
    clearInterval(timerId);
    timerId = setInterval(tick, 500);
  }

  function tick() {
    const left = test.endTime - Date.now();
    if (left <= 0) { finish(true); return; }
    const total = Math.ceil(left / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    $('timerText').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    $('timer').className = 'timer' + (left <= 60_000 ? ' danger' : left <= 5 * 60_000 ? ' warn' : '');
  }

  function renderCurrent() {
    const i = test.current;
    const q = questionById[test.ids[i]];
    $('qNum').textContent = i + 1;
    Lab.moduleTag($('qModule'), moduleById[q.module], q.module);
    $('qType').textContent = q.type === 'tf' ? 'True or false' : 'Multiple choice';
    $('qText').textContent = q.question;

    const opts = $('options');
    opts.className = 'options' + (q.type === 'tf' ? ' tf' : '');
    opts.replaceChildren(...q.options.map((_, j) => {
      const b = Lab.optionButton(q, j, () => choose(j));
      b.setAttribute('aria-pressed', String(test.answers[i] === j));
      if (test.answers[i] === j) b.classList.add('is-selected');
      return b;
    }));

    $('prevBtn').disabled = i === 0;
    const last = i === test.ids.length - 1;
    $('nextBtn').innerHTML = last
      ? 'Finish <svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
      : 'Next <svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
    $('flagBtn').setAttribute('aria-pressed', String(test.flags[i]));

    Lab.replay($('card'), 'enter');
    updatePalette();
  }

  function choose(j) {
    const i = test.current;
    test.answers[i] = j;
    save();
    [...$('options').children].forEach((b, k) => {
      b.classList.toggle('is-selected', k === j);
      b.setAttribute('aria-pressed', String(k === j));
    });
    updatePalette();
  }

  function go(i) {
    if (i < 0 || i >= test.ids.length) return;
    test.current = i;
    save();
    renderCurrent();
  }

  function buildPalette() {
    $('palette').replaceChildren(...test.ids.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal';
      b.textContent = i + 1;
      b.setAttribute('aria-label', `Question ${i + 1}`);
      b.addEventListener('click', () => go(i));
      return b;
    }));
  }

  function updatePalette() {
    const btns = $('palette').children;
    let answered = 0;
    test.ids.forEach((_, i) => {
      const done = test.answers[i] !== null;
      if (done) answered++;
      btns[i].classList.toggle('answered', done);
      btns[i].classList.toggle('flagged', test.flags[i]);
      btns[i].classList.toggle('current', i === test.current);
    });
    $('answeredCount').textContent = answered;
    $('progressFill').style.width = `${(answered / test.ids.length) * 100}%`;
  }

  $('prevBtn').addEventListener('click', () => go(test.current - 1));
  $('nextBtn').addEventListener('click', () => {
    if (test.current === test.ids.length - 1) confirmFinish();
    else go(test.current + 1);
  });
  $('flagBtn').addEventListener('click', () => {
    test.flags[test.current] = !test.flags[test.current];
    save();
    $('flagBtn').setAttribute('aria-pressed', String(test.flags[test.current]));
    updatePalette();
  });
  $('finishBtn').addEventListener('click', confirmFinish);

  document.addEventListener('keydown', (e) => {
    if (views.test.hidden || $('confirmDialog').open || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = questionById[test.ids[test.current]];
    const key = e.key.toLowerCase();
    if (key === 'arrowright') go(test.current + 1);
    else if (key === 'arrowleft') go(test.current - 1);
    else if (q.type === 'tf' && (key === 't' || key === 'f')) choose(key === 't' ? 0 : 1);
    else if (q.type === 'mcq') {
      const idx = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(key);
      if (idx >= 0 && idx < q.options.length) choose(idx);
    }
  });

  /* ---------- Finish ---------- */

  const dialog = $('confirmDialog');
  function confirmFinish() {
    const unanswered = test.answers.filter((a) => a === null).length;
    const flagged = test.flags.filter(Boolean).length;
    const bits = [];
    if (unanswered) bits.push(`${unanswered} unanswered question${unanswered === 1 ? '' : 's'}`);
    if (flagged) bits.push(`${flagged} flagged for review`);
    $('confirmText').textContent = bits.length
      ? `You still have ${bits.join(' and ')}. Unanswered questions count as wrong.`
      : 'All questions answered. Ready to see how you did?';
    dialog.showModal();
  }
  $('confirmCancel').addEventListener('click', () => dialog.close());
  $('confirmOk').addEventListener('click', () => { dialog.close(); finish(false); });

  function finish(timeUp) {
    clearInterval(timerId);
    if (dialog.open) dialog.close();
    Lab.store.remove(ACTIVE_KEY);

    const qs = testQuestions();
    const total = qs.length;
    const correct = qs.filter((q, i) => test.answers[i] === q.answerIndex).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const g = GRADES.find((band) => pct >= band.min);
    const taken = Math.min(Date.now(), test.endTime) - test.startTime;

    const history = Lab.store.get(HISTORY_KEY, []);
    history.unshift({ date: Date.now(), pct, grade: g.grade, correct, total });
    Lab.store.set(HISTORY_KEY, history.slice(0, 20));

    renderResults({ qs, total, correct, pct, g, taken, timeUp });
  }

  /* ---------- Results ---------- */

  function renderResults({ qs, total, correct, pct, g, taken, timeUp }) {
    show('results');

    const grade = $('grade');
    grade.style.setProperty('--g', g.colour);
    grade.style.setProperty('--pct', pct);
    $('gradeLetter').textContent = g.grade;
    $('gradeMsg').textContent = g.msg;
    $('pctText').textContent = `${pct}%`;
    $('scoreText').textContent = `${correct} / ${total} correct`;
    const mins = Math.floor(taken / 60000);
    const secs = Math.floor((taken % 60000) / 1000);
    $('timeText').textContent = `Time taken ${mins}m ${String(secs).padStart(2, '0')}s`;
    $('timeUp').hidden = !timeUp;

    // Per-module breakdown
    const byModule = {};
    qs.forEach((q, i) => {
      const m = (byModule[q.module] ||= { total: 0, correct: 0 });
      m.total++;
      if (test.answers[i] === q.answerIndex) m.correct++;
    });
    $('modBars').replaceChildren(...modules.filter((m) => byModule[m.id]).map((m) => {
      const s = byModule[m.id];
      const p = Math.round((s.correct / s.total) * 100);
      const row = document.createElement('div');
      row.innerHTML = `<div class="mod-bar-head"><span></span><span></span></div><div class="mod-bar-track"><div class="mod-bar-fill"></div></div>`;
      row.querySelector('span').textContent = Lab.moduleLabel(m);
      row.querySelector('span:last-child').textContent = `${s.correct}/${s.total} · ${p}%`;
      const fill = row.querySelector('.mod-bar-fill');
      fill.style.setProperty('--mod', m.colour);
      requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = `${p}%`)));
      return row;
    }));

    // Review list
    const items = qs.map((q, i) => ({ q, i, chosen: test.answers[i] }));
    const status = (it) => (it.chosen === null ? 'skipped' : it.chosen === it.q.answerIndex ? 'correct' : 'wrong');
    const filters = [
      { key: 'all', label: `All (${items.length})`, test: () => true },
      { key: 'wrong', label: `Got wrong (${items.filter((it) => status(it) !== 'correct').length})`, test: (it) => status(it) !== 'correct' },
      { key: 'correct', label: `Got right (${correct})`, test: (it) => status(it) === 'correct' },
    ];

    const renderList = (f) => {
      $('reviewList').replaceChildren(...items.filter(f.test).map((it) => reviewItem(it, status(it))));
    };
    $('reviewFilters').replaceChildren(...filters.map((f, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = f.label;
      b.setAttribute('aria-pressed', String(idx === 0));
      b.addEventListener('click', () => {
        [...$('reviewFilters').children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
        renderList(f);
      });
      return b;
    }));
    renderList(filters[0]);

    if (pct >= 70) setTimeout(() => Confetti.rain(180), 400);
  }

  function reviewItem({ q, i, chosen }, st) {
    const card = document.createElement('article');
    card.className = 'card review-item';
    card.innerHTML = `
      <div class="qmeta">
        <span class="review-num">Q${i + 1} <span class="status-pill ${st}">${st === 'skipped' ? 'Not answered' : st === 'correct' ? 'Correct' : 'Incorrect'}</span></span>
        <span class="module-tag"></span>
      </div>
      <h3 class="qtext"></h3>
      <div class="options ${q.type === 'tf' ? 'tf' : ''}"></div>`;
    Lab.moduleTag(card.querySelector('.module-tag'), moduleById[q.module], q.module);
    card.querySelector('.qtext').textContent = q.question;
    card.querySelector('.options').replaceChildren(...q.options.map((_, j) => {
      const b = Lab.optionButton(q, j);
      b.disabled = true;
      const note = document.createElement('span');
      note.className = 'opt-note';
      if (j === q.answerIndex) {
        b.classList.add('is-correct');
        note.textContent = j === chosen ? 'Your answer ✓' : 'Correct answer';
      } else if (j === chosen) {
        b.classList.add('is-wrong');
        note.textContent = 'Your answer';
      } else {
        b.classList.add('is-dim');
      }
      if (note.textContent) b.append(note);
      return b;
    }));
    if (q.explanation) {
      const p = document.createElement('p');
      p.className = 'explanation';
      p.textContent = q.explanation;
      card.append(p);
    }
    return card;
  }

  $('againBtn').addEventListener('click', () => { test = null; showIntro(); });

  /* ---------- Boot ---------- */

  // If a saved test ran out of time while the page was closed, mark it straight away.
  const saved = Lab.store.get(ACTIVE_KEY, null);
  if (saved && Date.now() >= saved.endTime) {
    test = saved;
    finish(true);
  } else {
    showIntro();
  }
})();
