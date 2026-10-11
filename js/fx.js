// Частицы для эффектных выпадений. Холст живёт на главном экране и работает,
// только пока есть частицы, — в покое не тратит батарею.
(function () {
  let canvas = null, ctx = null, parts = [], running = false, dpr = 1;

  function attach(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    resize();
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }
  window.addEventListener('resize', resize);

  // Взрыв частиц из точки (x, y) в координатах экрана.
  function burst(x, y, color, count = 40, power = 1) {
    if (!canvas || !canvas.isConnected) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (2 + Math.random() * 6) * power;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2 * power,
        life: 1, decay: 0.012 + Math.random() * 0.02,
        size: 2 + Math.random() * 4, color,
        spin: Math.random() * 6, rect: Math.random() < 0.55,
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function loop() {
    if (!canvas || !canvas.isConnected) { parts = []; running = false; return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.18; p.vx *= 0.985;
      p.life -= p.decay; p.spin += 0.2;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.rect) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    parts = parts.filter((p) => p.life > 0);
    if (parts.length) requestAnimationFrame(loop);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); running = false; }
  }

  window.FX = { attach, resize, burst };
})();
