/* Chris: a little quiz-host mascot in the bottom-left corner.
   Click him for a message. Pages can also call Chris.react(event, data) so he comments on answers. */

const Chris = (() => {
  const SHOW_MS = 5200;

  const LINES = {
    click: [
      'Is that your final answer, Lucy?',
      "Let's play... Lucy's Lab!",
      "Fancy a lifeline? I asked the audience. They're all saying \"keep revising\".",
      "Phone a friend? You don't need to. You've got the notes.",
      "50:50? I'd rather you went for 100%.",
      "You're doing brilliantly. I'd lock that in.",
      "Take your time. There's no clock ticking... unless you're in the mock test.",
      'Every question you get wrong now is one you get right in the exam.',
      "I believe in you. And I've met a LOT of contestants.",
      'A few questions a day adds up to a lot of questions by exam day.',
      'Have a drink of water, stretch your legs, then come back and smash it.',
      "SLOB: Same Lingual, Opposite Buccal. I'm writing that one on my hand.",
      "Inverse square law: double the distance, a quarter of the dose. That's why I'm all the way down here.",
      'Paralleling, bisecting, bitewings... you\'ll be a millionaire in radiographs.',
      "I've asked a lot of questions in my time. Never one about bitewings, mind.",
      "There's no such thing as a safe dose of radiation. But there IS such a thing as a safe pair of hands. That's you.",
      "Time, distance, shielding. And snacks. Don't forget the snacks.",
      "You don't have to know everything today. Just a bit more than yesterday.",
      "The audience are behind you. I'm behind you. Well, I'm in the corner. But I'm with you.",
    ],
    correct: [
      "That's the right answer! Lock it in.",
      "Correct! You've just won... ten points. Don't spend it all at once.",
      'Ooh, very confident. I like it.',
      "Bang on. I didn't doubt you for a second.",
      "You could have phoned a friend, but you didn't need to, did you?",
      'Textbook! Quite literally.',
      'Yes! The audience are going wild.',
    ],
    streak: [
      '{n} in a row! The audience are on their feet.',
      "{n} in a row! We're climbing the money tree now.",
      "{n} on the bounce! I'm getting nervous for the bank.",
      'Multiplier ×{m}! Keep this up and they\'ll need a bigger cheque.',
    ],
    wrong: [
      "Ohhh. We don't want to give you that... but it's not quite right.",
      "Not to worry. Read the explanation and you'll nail it next time.",
      'Unlucky! Even the best contestants walk away with a lesson.',
      "Tricky one, that. Have a look at the notes and it'll stick.",
      "That's not it, but you've learnt something, and that's the whole point.",
    ],
    lostStreak: [
      "Ah, and the streak's gone. Deep breath, start climbing again.",
      "Oh no, there goes the multiplier! You'll have it back in no time.",
    ],
    mockStart: [
      "The clock's ticking. No lifelines in here, but you don't need them.",
      'Sixty minutes, one hundred questions. Read each one carefully. Off you go!',
    ],
    mockA: ["Fantastic! You haven't won a million, but an A is close enough.", 'An A! Get in! I knew you had it in you.'],
    mockB: ["A B! That's a cracking score. A little more and you're at the top.", 'Great result! The audience are very impressed.'],
    mockC: ['A solid pass! Have a look at the weaker modules and you\'ll climb higher.'],
    mockLow: ["Tough one. Look through the review, find the gaps, and we'll go again.", "Don't be disheartened. That's exactly what mock tests are for."],
    hello: ["Hello Lucy! Click me any time if you need a pep talk."],
  };

  let root, bubble, text, hideTimer;
  const last = {};

  function pick(kind) {
    const list = LINES[kind] || LINES.click;
    if (list.length === 1) return list[0];
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (i === last[kind]);
    last[kind] = i;
    return list[i];
  }

  function build() {
    root = document.createElement('div');
    root.className = 'chris';
    root.innerHTML = `
      <div class="chris-bubble" role="status" aria-live="polite" hidden><p></p></div>
      <button class="chris-btn" type="button" aria-label="Chris, the quiz host. Click for a message.">
        <img src="assets/img/chris.png" alt="" width="300" height="300" draggable="false">
      </button>`;
    document.body.appendChild(root);
    bubble = root.querySelector('.chris-bubble');
    text = bubble.querySelector('p');
    root.querySelector('.chris-btn').addEventListener('click', () => say(pick('click')));
  }

  function say(message, ms = SHOW_MS) {
    if (!root) return;
    text.textContent = message;
    bubble.hidden = false;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    root.classList.remove('talking');
    void root.offsetWidth;
    root.classList.add('talking');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, ms + Math.min(3000, message.length * 25));
  }

  function hide() {
    clearTimeout(hideTimer);
    if (bubble) bubble.hidden = true;
    root?.classList.remove('talking');
  }

  /** Let pages tell Chris what just happened. He doesn't comment on everything, so he doesn't get annoying. */
  function react(event, data = {}) {
    const fill = (s) => s.replace('{n}', data.streak).replace('{m}', data.mult);
    switch (event) {
      case 'correct':
        if (data.streak >= 3 && (data.streak === 3 || data.streak % 5 === 0)) say(fill(pick('streak')));
        else if (Math.random() < 0.3) say(pick('correct'));
        break;
      case 'wrong':
        if (data.lost >= 3) say(pick('lostStreak'));
        else if (Math.random() < 0.45) say(pick('wrong'));
        break;
      case 'mockStart':
        say(pick('mockStart'));
        break;
      case 'mockResult': {
        const g = data.grade;
        say(pick(g === 'A' ? 'mockA' : g === 'B' ? 'mockB' : g === 'C' ? 'mockC' : 'mockLow'), 7000);
        break;
      }
      default:
        if (LINES[event]) say(pick(event));
    }
  }

  function init() {
    build();
    // Say hello once per browser session, on whichever page is opened first.
    try {
      if (!sessionStorage.getItem('lucyslab.chris.hello')) {
        sessionStorage.setItem('lucyslab.chris.hello', '1');
        setTimeout(() => say(pick('hello')), 1200);
      }
    } catch { /* storage blocked: skip the hello */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { say, react, hide };
})();

// Top-level const isn't a window property, so expose it for pages that call window.Chris?.react(...).
window.Chris = Chris;
