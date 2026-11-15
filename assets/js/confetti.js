/* Tiny dependency-free confetti for celebrating correct answers. */

const Confetti = (() => {
  const COLOURS = ['#6b4ef0', '#ff6f4f', '#129e93', '#f5b83d', '#ff5f8f', '#2d8fe0'];
  let canvas, ctx, raf = null;
  let parts = [];

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function particle(x, y, vx, vy, colours = COLOURS) {
    return {
      x, y, vx, vy,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      colour: colours[Math.floor(Math.random() * colours.length)],
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
      life: 0,
      max: 70 + Math.random() * 40,
    };
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /** Radial burst from a point (e.g. the answer button). */
  function burst(x, y, count = 30, power = 1) {
    if (Lab.reducedMotion) return;
    ensureCanvas();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 6) * power;
      parts.push(particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 3 * power));
    }
    start();
  }

  /** Full-screen shower for milestones. Optionally pass a list of colours. */
  function rain(count = 140, colours) {
    if (Lab.reducedMotion) return;
    ensureCanvas();
    for (let i = 0; i < count; i++) {
      const p = particle(Math.random() * innerWidth, -20 - Math.random() * innerHeight * 0.4,
        (Math.random() - 0.5) * 3, 2 + Math.random() * 4, colours);
      p.max = 140 + Math.random() * 60;
      parts.push(p);
    }
    start();
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 40);
    for (const p of parts) {
      p.life++;
      p.vy += 0.16;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.colour;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(tick) : null;
  }

  return { burst, rain };
})();
