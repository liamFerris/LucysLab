/* The Million Climb: 15 questions up a prize ladder, with three lifelines. */

(async function () {
  const PRIZES = [100, 250, 500, 1000, 2500, 5000, 10000, 15000, 25000, 50000, 75000, 100000, 250000, 500000, 1000000];
  const SAFE = [4, 9];                  // indexes of the safe rungs (£2,500 and £50,000)
  const SUSPENSE_MS = Lab.reducedMotion ? 300 : 1600;
  const BEST_KEY = 'lucyslab.climb.best';

  const $ = (id) => document.getElementById(id);
  const money = (n) => '£' + n.toLocaleString('en-GB');

  let data;
  try { data = await Lab.loadAll(); }
  catch (err) { Lab.showLoadError($('climbMain'), err); return; }
  const { moduleById } = data;
  // Lifelines need four options, so this mode uses the multiple-choice questions only.
  const pool = data.questions.filter((q) => q.type === 'mcq' && q.options.length === 4);

  const views = { intro: $('climbIntro'), game: $('climbGame'), end: $('climbEnd') };
  const lifelineBtns = { half: $('llHalf'), poll: $('llPoll'), chris: $('llChris') };

  let s = null;   // game state

  function show(name) {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    window.scrollTo(0, 0);
  }

  /* ---------- Intro ---------- */

  function showIntro() {
    const best = Lab.store.get(BEST_KEY, 0);
    $('climbBest').hidden = !best;
    $('climbBest').textContent = `Your best so far: ${money(best)}`;
    show('intro');
  }

  function start() {
    s = {
      questions: Lab.shuffle(pool).slice(0, PRIZES.length),
      level: 0,
      selected: null,
      removed: new Set(),
      used: { half: false, poll: false, chris: false },
      phase: 'question',
    };
    buildLadder();
    show('game');
    renderQuestion();
    window.Chris?.react('climbStart');
  }

  /* ---------- Ladder ---------- */

  function buildLadder() {
    const list = $('ladder');
    list.replaceChildren(...PRIZES.map((p, i) => {
      const li = document.createElement('li');
      li.className = 'rung' + (SAFE.includes(i) ? ' safe' : '') + (i === PRIZES.length - 1 ? ' top' : '');
      li.dataset.level = i;
      li.innerHTML = '<span class="rung-num"></span><span class="rung-prize"></span>';
      li.firstChild.textContent = i + 1;
      li.lastChild.textContent = money(p);
      return li;
    }).reverse());

    $('stripDots').replaceChildren(...PRIZES.map((_, i) => {
      const d = document.createElement('span');
      d.className = 'strip-dot' + (SAFE.includes(i) ? ' safe' : '');
      return d;
    }));
  }

  function updateLadder() {
    $('ladder').querySelectorAll('.rung').forEach((li) => {
      const i = Number(li.dataset.level);
      li.classList.toggle('done', i < s.level);
      li.classList.toggle('current', i === s.level);
    });
    [...$('stripDots').children].forEach((d, i) => {
      d.classList.toggle('done', i < s.level);
      d.classList.toggle('current', i === s.level);
    });
    const banked = s.level > 0 ? money(PRIZES[s.level - 1]) : '£0';
    $('stripText').textContent = s.level < PRIZES.length
      ? `Banked ${banked} · playing for ${money(PRIZES[s.level])}`
      : `Banked ${banked}!`;
  }

  /** What you keep if you get the current question wrong. */
  function safeAmount() {
    const passed = SAFE.filter((i) => i < s.level);
    return passed.length ? PRIZES[passed[passed.length - 1]] : 0;
  }

  /* ---------- Questions ---------- */

  function renderQuestion() {
    const q = s.questions[s.level];
    s.selected = null;
    s.removed = new Set();
    s.phase = 'question';

    $('climbQNum').textContent = `Question ${s.level + 1} of ${PRIZES.length}`;
    $('climbFor').textContent = s.level === PRIZES.length - 1 ? 'For £1,000,000!' : `For ${money(PRIZES[s.level])}`;
    $('climbFor').classList.toggle('million', s.level === PRIZES.length - 1);
    Lab.moduleTag($('qModule'), moduleById[q.module], q.module);
    $('qText').textContent = q.question;
    $('options').replaceChildren(...q.options.map((_, i) => Lab.optionButton(q, i, () => select(i))));
    $('poll').hidden = true;
    $('feedback').hidden = true;
    $('climbActions').hidden = false;
    $('lockBtn').disabled = true;
    $('walkBtn').disabled = s.level === 0;
    $('walkBtn').textContent = s.level === 0 ? 'Walk away' : `Walk away with ${money(PRIZES[s.level - 1])}`;
    updateLifelines();
    updateLadder();
    Lab.replay($('card'), 'enter');
  }

  function optionEls() { return [...$('options').children]; }

  function select(i) {
    if (s.phase !== 'question' || s.removed.has(i)) return;
    s.selected = i;
    optionEls().forEach((b, j) => b.classList.toggle('is-selected', j === i));
    $('lockBtn').disabled = false;
  }

  function lockIn() {
    if (s.phase !== 'question' || s.selected === null) return;
    s.phase = 'locked';
    const q = s.questions[s.level];
    const btns = optionEls();
    btns.forEach((b) => (b.disabled = true));
    btns[s.selected].classList.add('is-locked');
    $('lockBtn').disabled = true;
    $('walkBtn').disabled = true;
    updateLifelines();
    setTimeout(() => reveal(q, btns), SUSPENSE_MS);
  }

  function reveal(q, btns) {
    const right = s.selected === q.answerIndex;
    btns[s.selected].classList.remove('is-locked', 'is-selected');
    btns.forEach((b, j) => {
      if (j === q.answerIndex) b.classList.add('is-correct');
      else if (j === s.selected) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    });
    $('climbActions').hidden = true;
    $('explanation').textContent = q.explanation || '';

    if (!right) {
      s.phase = 'over';
      Lab.replay($('card'), 'shake');
      const keep = safeAmount();
      $('verdict').textContent = `Oh no! The answer was ${Lab.LETTERS[q.answerIndex]}.`;
      $('verdict').className = 'verdict bad';
      $('nextBtn').textContent = 'See how you did';
      $('nextBtn').onclick = () => end('wrong', keep);
      $('feedback').hidden = false;
      window.Chris?.react('climbWrong');
      return;
    }

    const won = PRIZES[s.level];
    Lab.replay(btns[s.selected], 'pop');
    const r = btns[s.selected].getBoundingClientRect();
    Confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 40 + s.level * 6, 1.1);
    s.level++;
    updateLadder();
    const rung = $('ladder').querySelector(`.rung[data-level="${s.level - 1}"]`);
    if (rung) Lab.replay(rung, 'rung-win');

    if (s.level === PRIZES.length) { s.phase = 'over'; setTimeout(win, 700); return; }

    s.phase = 'revealed';
    const safeNow = SAFE.includes(s.level - 1);
    $('verdict').textContent = safeNow
      ? `Correct! ${money(won)} is safe. Nobody can take that away.`
      : `Correct! You've won ${money(won)}.`;
    $('verdict').className = 'verdict good';
    $('nextBtn').textContent = s.level === PRIZES.length - 1 ? 'Play for £1,000,000' : `Next question for ${money(PRIZES[s.level])}`;
    $('nextBtn').onclick = renderQuestion;
    $('feedback').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
    $('feedback').scrollIntoView({ block: 'nearest', behavior: Lab.reducedMotion ? 'auto' : 'smooth' });
    window.Chris?.react('climbCorrect', { prize: money(won), safe: safeNow });
  }

  function walkAway() {
    if (s.phase !== 'question' || s.level === 0) return;
    s.phase = 'over';
    end('walk', PRIZES[s.level - 1]);
  }

  /* ---------- Lifelines ---------- */

  function updateLifelines() {
    Object.entries(lifelineBtns).forEach(([k, b]) => {
      b.classList.toggle('used', s.used[k]);
      b.disabled = s.used[k] || s.phase !== 'question';
    });
  }

  function useHalf() {
    if (s.used.half || s.phase !== 'question') return;
    s.used.half = true;
    const q = s.questions[s.level];
    const wrong = Lab.shuffle([0, 1, 2, 3].filter((i) => i !== q.answerIndex)).slice(0, 2);
    wrong.forEach((i) => s.removed.add(i));
    optionEls().forEach((b, i) => {
      if (!s.removed.has(i)) return;
      b.classList.add('is-removed');
      b.classList.remove('is-selected');
      b.disabled = true;
    });
    if (s.removed.has(s.selected)) { s.selected = null; $('lockBtn').disabled = true; }
    if (!$('poll').hidden) renderPoll(true);
    updateLifelines();
  }

  /** Random-looking percentages that always put the correct answer clearly on top. */
  function pollNumbers() {
    const q = s.questions[s.level];
    const live = [0, 1, 2, 3].filter((i) => !s.removed.has(i));
    const weights = live.map((i) => (i === q.answerIndex ? 40 + Math.random() * 45 : 5 + Math.random() * 30));
    const total = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map((w) => (w / total) * 100);
    const pct = exact.map(Math.floor);
    let left = 100 - pct.reduce((a, b) => a + b, 0);
    exact.map((e, k) => [e - Math.floor(e), k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (left-- > 0) pct[k]++; });
    // Make sure the correct answer is strictly the highest.
    const ci = live.indexOf(q.answerIndex);
    const maxOther = Math.max(0, ...pct.filter((_, k) => k !== ci));
    if (pct[ci] <= maxOther) {
      const k = pct.indexOf(maxOther);
      [pct[ci], pct[k]] = [pct[k], pct[ci]];
      if (pct[ci] === pct[k]) { pct[ci]++; pct[k]--; }
    }
    const out = [null, null, null, null];
    live.forEach((i, k) => (out[i] = pct[k]));
    return out;
  }

  function renderPoll(rerun) {
    const pct = pollNumbers();
    const bars = $('pollBars');
    bars.replaceChildren(...pct.map((p, i) => {
      const col = document.createElement('div');
      col.className = 'poll-col' + (p === null ? ' off' : '');
      col.innerHTML = '<span class="poll-pct"></span><div class="poll-track"><div class="poll-fill"></div></div><span class="poll-letter"></span>';
      col.querySelector('.poll-pct').textContent = p === null ? '' : `${p}%`;
      col.querySelector('.poll-letter').textContent = Lab.LETTERS[i];
      const fill = col.querySelector('.poll-fill');
      requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.height = `${p || 0}%`)));
      return col;
    }));
    $('poll').hidden = false;
    if (!rerun) $('poll').scrollIntoView({ block: 'nearest', behavior: Lab.reducedMotion ? 'auto' : 'smooth' });
  }

  function usePoll() {
    if (s.used.poll || s.phase !== 'question') return;
    s.used.poll = true;
    renderPoll(false);
    updateLifelines();
  }

  function useChris() {
    if (s.used.chris || s.phase !== 'question') return;
    s.used.chris = true;
    const q = s.questions[s.level];
    const L = Lab.LETTERS[q.answerIndex];
    const ans = `${L}: "${q.options[q.answerIndex]}"`;
    const lines = [
      `Hello Lucy! Oh, I know this one. It's ${ans}. I'd put my house on it.`,
      `Easy! It's ${ans}. Go on, lock it in.`,
      `Right, I've checked the notes. The answer is ${ans}.`,
      `It's ${ans}. Trust me, I've asked a few questions in my time.`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    if (window.Chris) window.Chris.say(line, 12000);
    else Lab.toast(line);
    updateLifelines();
  }

  /* ---------- Endings ---------- */

  function saveBest(amount) {
    if (amount > Lab.store.get(BEST_KEY, 0)) Lab.store.set(BEST_KEY, amount);
  }

  function end(how, amount) {
    saveBest(amount);
    const reached = s.level + (how === 'wrong' ? 1 : 0);
    $('endEyebrow').textContent = how === 'walk' ? 'You walked away' : 'Game over';
    $('endTitle').textContent = `You leave with ${money(amount)}`;
    $('endText').textContent = how === 'walk'
      ? `Very sensible. You answered ${s.level} question${s.level === 1 ? '' : 's'} correctly before taking the money.`
      : amount
        ? `You reached question ${reached} and dropped back to your safe ${money(amount)}.`
        : `You reached question ${reached}. Get past question 5 next time to bank £2,500.`;
    show('end');
    if (how === 'walk') window.Chris?.react('climbWalk');
  }

  function win() {
    saveBest(PRIZES[PRIZES.length - 1]);
    const overlay = $('win');
    overlay.hidden = false;
    Lab.replay(overlay, 'show');
    Lab.tweenNumber($('winAmount'), 0, 1000000, 2600);
    const gold = ['#ffd84d', '#f5b83d', '#ffe9a3', '#e39b12', '#fff6d6', '#ff8fb1'];
    [0, 700, 1500, 2400, 3400].forEach((t, k) => setTimeout(() => Confetti.rain(160 + k * 30, gold), t));
    setTimeout(() => window.Chris?.react('climbWin'), 1200);
    $('winAgain').focus({ preventScroll: true });
  }

  /* ---------- Wiring ---------- */

  $('climbStart').addEventListener('click', start);
  $('againBtn').addEventListener('click', start);
  $('winAgain').addEventListener('click', () => { $('win').hidden = true; start(); });
  $('lockBtn').addEventListener('click', lockIn);
  $('walkBtn').addEventListener('click', walkAway);
  lifelineBtns.half.addEventListener('click', useHalf);
  lifelineBtns.poll.addEventListener('click', usePoll);
  lifelineBtns.chris.addEventListener('click', useChris);

  document.addEventListener('keydown', (e) => {
    if (!s || views.game.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const idx = ['a', 'b', 'c', 'd'].indexOf(key);
    if (idx >= 0 && s.phase === 'question') select(idx);
    else if (key === 'enter') {
      if (s.phase === 'question' && s.selected !== null) { e.preventDefault(); lockIn(); }
      else if (!$('feedback').hidden && document.activeElement !== $('nextBtn')) { e.preventDefault(); $('nextBtn').click(); }
    }
  });

  showIntro();
})();
