/* Module Notes: Markdown notes per module, picked from a sidebar (or a dropdown on phones). */

(async function () {
  const $ = (id) => document.getElementById(id);
  const main = $('notesMain');

  let modules, questions;
  try { ({ modules, questions } = await Lab.loadAll()); }
  catch (err) { Lab.showLoadError(main, err); return; }

  const list = $('notesList');
  const select = $('notesSelect');

  list.replaceChildren(...modules.map((m) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${m.id}`;
    a.style.setProperty('--mod', m.colour);
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = m.number ?? '';
    const name = document.createElement('span');
    name.textContent = m.name;
    a.append(num, name);
    li.append(a);
    return li;
  }));

  select.replaceChildren(...modules.map((m) => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `Module ${m.number}: ${m.name}`;
    return o;
  }));
  select.addEventListener('change', () => { location.hash = select.value; });

  /** Style blockquotes that start with "Correction:" or "Lucy's note:" as callouts, and mark the subtitle. */
  function decorate(body) {
    body.querySelectorAll('blockquote').forEach((bq) => {
      const lead = bq.querySelector('strong')?.textContent.trim().toLowerCase() || '';
      if (lead.startsWith('correction')) bq.classList.add('callout-correction');
      else if (lead.startsWith("lucy's note") || lead.startsWith('lucy’s note')) bq.classList.add('callout-note');
    });
    const h1 = body.querySelector('h1');
    const next = h1?.nextElementSibling;
    if (next && next.tagName === 'P' && next.children.length === 1 && next.firstElementChild.tagName === 'EM'
        && next.textContent.trim() === next.firstElementChild.textContent.trim()) {
      next.classList.add('subtitle');
    }
  }

  const cache = {};

  async function load() {
    const id = location.hash.slice(1);
    const idx = Math.max(0, modules.findIndex((m) => m.id === id));
    const m = modules[idx];

    [...list.querySelectorAll('a')].forEach((a, i) => {
      a.setAttribute('aria-current', String(i === idx));
      if (i === idx) a.scrollIntoView({ block: 'nearest' });
    });
    select.value = m.id;

    const body = $('notesBody');
    body.style.setProperty('--mod', m.colour);
    document.title = `Module ${m.number}: ${m.name} · Lucy's Lab`;

    const count = questions.filter((q) => q.module === m.id).length;
    const practise = $('practiseBtn');
    practise.hidden = count === 0;
    practise.href = `study.html?modules=${encodeURIComponent(m.id)}`;
    practise.textContent = `Practise ${count} question${count === 1 ? '' : 's'}`;

    const prev = modules[idx - 1];
    const next = modules[idx + 1];
    $('prevNote').hidden = !prev;
    $('nextNote').hidden = !next;
    if (prev) { $('prevNote').href = `#${prev.id}`; $('prevNote').textContent = `← Module ${prev.number}`; }
    if (next) { $('nextNote').href = `#${next.id}`; $('nextNote').textContent = `Module ${next.number} →`; }

    try {
      const md = cache[m.id] ??= await Lab.getText(m.notes);
      if (window.marked) {
        body.innerHTML = window.marked.parse(md);
        decorate(body);
      } else {
        body.textContent = '';
        const pre = document.createElement('pre');
        pre.textContent = md;
        body.append(pre);
      }
    } catch (err) {
      body.innerHTML = '<p>Notes for this module haven\'t been written yet.</p>';
      console.warn(err);
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', load);
  load();
})();
