(function (root) {
  'use strict';
  const WIDTH = 1600, HEIGHT = 900, TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  class PondEngine {
    constructor(random = Math.random) {
      this.random = random; this.state = 'menu'; this.level = root.PondLevels[0];
      this.fish = []; this.food = []; this.events = []; this.time = 0; this.score = 0; this.feeds = 0;
      this.elapsed = 0; this.combo = 0; this.maxCombo = 0; this.lastEat = -Infinity; this.foodId = 0;
      this.seedFish(12);
    }
    seedFish(count) {
      this.fish = Array.from({ length: count }, (_, i) => ({
        x: 250 + this.random() * 1100, y: 190 + this.random() * 500,
        angle: this.random() * TAU, phase: this.random() * TAU,
        size: 29 + this.random() * 17, pattern: i % 5, speed: .8 + this.random() * .45,
        cooldown: this.random() * .3, wander: this.random() * TAU,
        wanderTime: 0, targetId: null
      }));
    }
    start(id) {
      const level = root.PondLevels[id - 1];
      if (!level) return false;
      this.level = level; this.state = 'playing'; this.time = level.seconds; this.feeds = level.feeds;
      this.score = 0; this.combo = 0; this.maxCombo = 0; this.lastEat = -Infinity; this.elapsed = 0;
      this.food = []; this.events = []; this.seedFish(level.fishCount); return true;
    }
    menu() { this.state = 'menu'; this.food = []; this.events = []; }
    pause() { if (this.state === 'playing') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'playing'; }
    feed(x, y) {
      if (this.state !== 'playing') return false;
      if (this.feeds <= 0) { this.events.push({ type: 'empty' }); return false; }
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      this.feeds--;
      const food = { id: ++this.foodId, x: clamp(x, 45, WIDTH - 45), y: clamp(y, 120, HEIGHT - 115), remaining: this.level.pellets, age: 0, phase: this.random() * TAU };
      this.food.push(food); this.events.push({ type: 'feed', x: food.x, y: food.y }); return true;
    }
    drainEvents() { return this.events.splice(0); }
    tick(delta) {
      if (this.state !== 'playing' && this.state !== 'menu') return;
      const dt = clamp(delta, 0, .05);
      const playing = this.state === 'playing';
      this.elapsed += dt;
      if (playing) {
        this.time = Math.max(0, this.time - dt);
        if (this.time <= 0) { this.state = 'lost'; this.events.push({ type: 'lost' }); return; }
        this.food.forEach(food => { food.age += dt; });
        this.food = this.food.filter(food => food.remaining > 0 && food.age < this.level.foodLifetime);
        if (this.elapsed - this.lastEat > this.level.comboWindow) this.combo = 0;
      }
      for (const fish of this.fish) {
        fish.cooldown -= dt;
        fish.wanderTime -= dt;
        let target = null, nearest = Infinity;
        for (const food of this.food) {
          if (food.remaining <= 0) continue;
          const distance = Math.hypot(food.x - fish.x, food.y - fish.y);
          if (distance < nearest) { nearest = distance; target = food; }
        }
        fish.targetId = target ? target.id : null;
        if (fish.wanderTime <= 0) { fish.wander += (this.random() - .5) * 1.6; fish.wanderTime = 1.5 + this.random() * 3; }
        let desired = target ? Math.atan2(target.y - fish.y, target.x - fish.x) : fish.wander;
        if (!target && (fish.x < 120 || fish.x > WIDTH - 120 || fish.y < 150 || fish.y > HEIGHT - 130)) {
          desired = Math.atan2(HEIGHT / 2 - fish.y, WIDTH / 2 - fish.x); fish.wander = desired;
        }
        fish.angle += clamp(angleDelta(fish.angle, desired), -(target ? 3.4 : .75) * dt, (target ? 3.4 : .75) * dt);
        const speed = (target ? this.level.speed * 2.15 : 27) * fish.speed * (target && nearest < 70 ? .5 : 1);
        fish.x = clamp(fish.x + Math.cos(fish.angle) * speed * dt, 40, WIDTH - 40);
        fish.y = clamp(fish.y + Math.sin(fish.angle) * speed * dt, 100, HEIGHT - 70);
        fish.phase += dt * (target ? 8 : 3.6);
        if (playing && target && nearest < fish.size * .65 + 15 && fish.cooldown <= 0) {
          target.remaining--; fish.cooldown = .48;
          this.combo = this.elapsed - this.lastEat <= this.level.comboWindow ? this.combo + 1 : 1;
          this.lastEat = this.elapsed; this.maxCombo = Math.max(this.maxCombo, this.combo);
          const points = 12 + Math.min(this.combo, 5) * 2 + Math.floor(this.level.id / 2);
          this.score += points;
          this.events.push({ type: 'eat', x: target.x, y: target.y, points, combo: this.combo });
          if (this.score >= this.level.target) { this.state = 'won'; this.events.push({ type: 'won' }); break; }
        }
      }
      this.food = this.food.filter(food => food.remaining > 0);
    }
  }
  root.PondEngine = PondEngine;
})(globalThis);
