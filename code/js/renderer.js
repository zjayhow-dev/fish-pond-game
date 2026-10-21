(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  class PondRenderer {
    constructor(canvas, engine) {
      this.canvas = canvas; this.context = canvas.getContext('2d'); this.engine = engine;
      this.ripples = []; this.particles = []; this.labels = []; this.clock = 0;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.cursor = null; this.resize();
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr);
    }
    point(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (clientX - rect.left) / rect.width * 1600, y: (clientY - rect.top) / rect.height * 900 };
    }
    clear() { this.ripples = []; this.particles = []; this.labels = []; }
    event(event) {
      if (event.type === 'feed' || event.type === 'eat') {
        this.ripples.push({ x: event.x, y: event.y, age: 0, max: event.type === 'feed' ? 90 : 35, gold: event.type === 'eat' });
        if (event.type === 'eat') {
          this.labels.push({ x: event.x + (Math.random() - .5) * 55, y: event.y, text: '+' + event.points, age: 0 });
          for (let i = 0; i < 5; i++) this.particles.push({ x: event.x, y: event.y, vx: (Math.random() - .5) * 80, vy: (Math.random() - .5) * 80, age: 0, lifetime: .8, color: '#efdba1' });
        }
      }
      if (event.type === 'won') for (let i = 0; i < 65; i++) {
        const angle = Math.random() * TAU, speed = 60 + Math.random() * 280;
        this.particles.push({ x: 800, y: 430, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, lifetime: 1.8, color: i % 3 ? '#efdba1' : '#efbbbd' });
      }
      this.ripples = this.ripples.slice(-32); this.particles = this.particles.slice(-180); this.labels = this.labels.slice(-30);
    }
    update(dt) {
      this.clock += dt;
      this.ripples.forEach(r => { r.age += dt; }); this.ripples = this.ripples.filter(r => r.age < 1.25);
      this.labels.forEach(l => { l.age += dt; }); this.labels = this.labels.filter(l => l.age < 1);
      this.particles.forEach(p => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 13 * dt; }); this.particles = this.particles.filter(p => p.age < p.lifetime);
    }
    fish(fish) {
      const ctx = this.context;
      const scaleX = this.canvas.width / 1600, scaleY = this.canvas.height / 900;
      ctx.save(); ctx.translate(fish.x, fish.y);
      ctx.scale(Math.sqrt(scaleY / scaleX), Math.sqrt(scaleX / scaleY));
      ctx.rotate(Math.atan2(Math.sin(fish.angle) * scaleY, Math.cos(fish.angle) * scaleX));
      PondFishArt.draw(ctx, PondFishCatalog.get(fish.varietyId), fish.size, fish.phase, fish.variation);
      ctx.restore();
    }
    draw() {
      const ctx = this.context, { width, height } = this.canvas;
      ctx.setTransform(width / 1600, 0, 0, height / 900, 0, 0); ctx.clearRect(0, 0, 1600, 900);
      // Subtle glints are bounded and deterministic in count.
      if (!this.reducedMotion) {
        ctx.fillStyle = '#f3e8b8';
        for (let i = 0; i < 16; i++) { ctx.globalAlpha = .12 * Math.max(0, Math.sin(this.clock * .5 + i * 2)); ctx.beginPath(); ctx.ellipse(160 + (i * 211) % 1350, 150 + (i * 173) % 600, 1.8, 1, 0, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      for (const fish of this.engine.fish) {
        ctx.globalAlpha = this.engine.state === 'menu' && fish.x < 700 ? .25 : .88;
        this.fish(fish);
      }
      ctx.globalAlpha = 1;
      for (const food of this.engine.food) {
        ctx.globalAlpha = Math.min(1, (this.engine.level.foodLifetime - food.age) / 2);
        for (let i = 0; i < food.remaining; i++) { const angle = food.phase + i * 2.4, radius = 5 + Math.sqrt(i) * 7; ctx.fillStyle = i % 2 ? '#efd199' : '#c99d56'; ctx.beginPath(); ctx.arc(food.x + Math.cos(angle) * radius, food.y + Math.sin(angle) * radius, 3.5, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      for (const ripple of this.ripples) {
        for (let ring = 0; ring < 3; ring++) { const progress = ripple.age - ring * .15; if (progress < 0) continue; ctx.globalAlpha = Math.max(0, .45 * (1 - progress)); ctx.strokeStyle = ripple.gold ? '#efdca5' : '#eff5d8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(ripple.x, ripple.y, 6 + progress * ripple.max, 3 + progress * ripple.max * .72, 0, 0, TAU); ctx.stroke(); }
      }
      for (const particle of this.particles) { ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.lifetime); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.ellipse(particle.x, particle.y, 2.5, 1.5, particle.age * 2, 0, TAU); ctx.fill(); }
      ctx.font = '500 22px system-ui'; ctx.textAlign = 'center';
      for (const label of this.labels) { ctx.globalAlpha = 1 - label.age; ctx.fillStyle = '#fff0b8'; ctx.shadowColor = '#1b4438'; ctx.shadowBlur = 6; ctx.fillText(label.text, label.x, label.y - 24 - label.age * 45); }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      if (this.cursor && this.engine.state === 'playing') { ctx.strokeStyle = '#f1dfa6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, 20, 0, TAU); ctx.moveTo(this.cursor.x - 28, this.cursor.y); ctx.lineTo(this.cursor.x + 28, this.cursor.y); ctx.moveTo(this.cursor.x, this.cursor.y - 28); ctx.lineTo(this.cursor.x, this.cursor.y + 28); ctx.stroke(); }
    }
  }
  root.PondRenderer = PondRenderer;
})(globalThis);
