const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../code/js/levels.js');
require('../code/js/fish-catalog.js');
require('../code/js/storage.js');
require('../code/js/engine.js');
const catalog = PondFishCatalog;
function random(seed) { return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; }; }

test('30 distinct appearances span five rarities and four body forms', () => {
  assert.equal(catalog.entries.length,30);
  assert.equal(new Set(catalog.entries.map(f=>f.id)).size,30);
  assert.equal(new Set(catalog.entries.map(f=>f.name)).size,30);
  assert.equal(new Set(catalog.entries.map(f=>[f.form,f.body,f.marking,f.accent,f.pattern].join(':'))).size,30);
  assert.equal(new Set(catalog.entries.map(f=>f.rarity)).size,5);
  assert.equal(new Set(catalog.entries.map(f=>f.form)).size,4);
  assert.equal(new Set(catalog.entries.map(f=>f.sizeLabel)).size,3);
});
test('six initial fish, exactly two rewards per cleared chapter including chapter 12', () => {
  let save=PondStorage.defaults();
  assert.equal(catalog.available(catalog.progress(save)).length,6);
  for(let level=1;level<=12;level++) {
    const before=save;save=PondStorage.completeLevel(save,level,PondLevels[level-1].target);
    const unlocked=catalog.newlyUnlocked(before,save);
    assert.equal(unlocked.length,2,`chapter ${level}`);
    assert.ok(unlocked.every(f=>f.unlock===level));
    assert.equal(catalog.available(catalog.progress(save)).length,6+level*2);
  }
  assert.equal(catalog.progress(save),12);
});
test('chapter 12 must be completed, merely unlocking it does not grant its fish', () => {
  const save={...PondStorage.defaults(),currentLevel:12,maxUnlockedLevel:12};
  assert.equal(catalog.progress(save),11);
  assert.equal(catalog.available(catalog.progress(save)).length,28);
  save.bestScores[12]=1;assert.equal(catalog.progress(save),11);
  save.bestScores[12]=760;assert.equal(catalog.progress(save),12);
});
test('legacy saves derive collection without reset and replay cannot revoke or duplicate rewards', () => {
  const old=PondStorage.validate({...PondStorage.defaults(),maxUnlockedLevel:9,currentLevel:2,bestScores:{1:112,8:528}});
  assert.equal(catalog.progress(old),8);assert.equal(catalog.available(catalog.progress(old)).length,22);
  const replay=PondStorage.completeLevel(old,1,120);
  assert.equal(catalog.progress(replay),8);assert.deepEqual(catalog.newlyUnlocked(old,replay),[]);
  const memory={value:null,getItem(){return this.value},setItem(_,v){this.value=v}};
  const store=PondStorage.createStore(memory);store.write(replay);
  assert.equal(catalog.progress(store.read()),8);
});
test('schools contain only unlocked fish, show latest rewards, and favor distinct varieties', () => {
  for(let level=0;level<=12;level++)for(let seed=1;seed<=10;seed++) {
    const fish=catalog.school(20,level,random(seed));
    assert.equal(fish.length,20);assert.ok(fish.every(f=>f.unlock<=level));
    assert.equal(new Set(fish.map(f=>f.id)).size,Math.min(20,6+level*2));
    if(level>0)assert.equal(fish.filter(f=>f.unlock===level).length>=2,true);
  }
});
test('engine population adopts progress, sizes differ, retrying early levels retains the collection', () => {
  const engine=new PondEngine(random(4));engine.collectionProgress=12;engine.start(1);
  assert.ok(engine.fish.some(f=>catalog.get(f.varietyId).unlock===12));
  assert.ok(Math.max(...engine.fish.map(f=>f.size)) / Math.min(...engine.fish.map(f=>f.size)) > 1.6);
  assert.ok(engine.fish.every(f=>catalog.entries.some(v=>v.id===f.varietyId)));
  engine.start(2);assert.equal(engine.collectionProgress,12);
});
test('all 12 chapters remain achievable using their progressively unlocked schools', () => {
  for(let level=1;level<=12;level++)for(let seed=1;seed<=10;seed++) {
    const engine=new PondEngine(random(seed));engine.collectionProgress=level-1;engine.start(level);
    for(let tick=0;tick<1300&&engine.state==='playing';tick++) {
      if(!engine.food.length&&engine.feeds)engine.feed(engine.fish.reduce((s,f)=>s+f.x,0)/engine.fish.length,engine.fish.reduce((s,f)=>s+f.y,0)/engine.fish.length);
      engine.tick(.05);engine.drainEvents();
    }
    assert.equal(engine.state,'won',`level ${level}, seed ${seed}`);
  }
});
