const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../code/js/levels.js');
require('../code/js/fish-catalog.js');
require('../code/js/storage.js');
require('../code/js/taptap-adapter.js');
require('../code/js/engine.js');

function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function memory(initial) {
  let value = initial;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
}
test('all 12 levels match the design table', () => {
  assert.equal(PondLevels.length, 12);
  assert.deepEqual(PondLevels.map(l => l.target), [100,160,220,280,340,400,460,520,580,640,700,760]);
  assert.deepEqual(PondLevels.map(l => l.seconds), [60,60,58,58,56,56,54,54,52,52,50,50]);
  assert.deepEqual(PondLevels.map(l => l.feeds), [7,7,7,8,8,8,9,9,9,10,10,10]);
});
test('corrupt JSON and unavailable storage recover without crashing', () => {
  assert.equal(PondStorage.createStore(memory('{broken')).read().currentLevel, 1);
  const unavailable = PondStorage.createStore({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } });
  assert.equal(unavailable.read().currentLevel, 1);
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.write(PondStorage.defaults()), false);
  assert.equal(PondStorage.createStore(null).read().settings.soundOn, false);
});
test('save validation strips invalid types, ranges and ranking entries', () => {
  const save = PondStorage.validate({ schemaVersion:1, currentLevel:99, maxUnlockedLevel:-3, runScore:Infinity, bestScores:{1:100,2:'500',13:500}, nickname:7, settings:{soundOn:'true'}, localRanking:[{score:999}], updatedAt:-1 });
  assert.equal(save.maxUnlockedLevel, 2); assert.equal(save.currentLevel,1);
  assert.equal(save.runScore,100); assert.equal(save.settings.soundOn,false);
  assert.deepEqual(save.localRanking,[]); assert.equal(save.nickname,'池塘旅人');
});
test('completion persists, unlocks, and counts replay improvements only', () => {
  let save = PondStorage.completeLevel(PondStorage.defaults(), 1, 112, 10);
  assert.equal(save.currentLevel,2); assert.equal(save.maxUnlockedLevel,2); assert.equal(save.runScore,112);
  save = PondStorage.completeLevel(save,2,170,20);
  save = PondStorage.completeLevel(save,1,110,30);
  assert.equal(save.runScore,282); assert.equal(save.currentLevel,3); assert.equal(save.maxUnlockedLevel,3);
  save = PondStorage.completeLevel(save,1,120,40);
  assert.equal(save.runScore,290);
  const store = PondStorage.createStore(memory()); store.write(save);
  assert.deepEqual(store.read(),save);
});
test('locked levels cannot be completed via storage helper', () => {
  assert.equal(PondStorage.completeLevel(PondStorage.defaults(),12,760).maxUnlockedLevel,1);
});
test('ranking sorts by score, level, time, and retains 20 entries', () => {
  const records = Array.from({length:25},(_,i)=>({nickname:'旅人',score:i,level:1,timestamp:i}));
  assert.equal(PondStorage.sortRanking(records).length,20);
  assert.equal(PondStorage.sortRanking(records)[0].score,24);
  const tied = [{nickname:'A',score:100,level:2,timestamp:20},{nickname:'B',score:100,level:3,timestamp:30},{nickname:'C',score:100,level:3,timestamp:10}];
  assert.deepEqual(PondStorage.sortRanking(tied).map(r=>r.nickname),['C','B','A']);
});
test('pause freezes timer, fish, combo, and food, and rejects feeding', () => {
  const engine = new PondEngine(random(1)); engine.start(1); engine.feed(800,450); engine.tick(.05); engine.pause();
  const before = JSON.stringify(engine);
  for(let i=0;i<200;i++) engine.tick(.05);
  assert.equal(JSON.stringify(engine),before); assert.equal(engine.feed(800,450),false);
  engine.resume(); engine.tick(.05); assert.ok(engine.time < 60);
});
test('feeding respects budget, bounds and expiry', () => {
  const engine = new PondEngine(random(2)); engine.start(1);
  assert.equal(engine.feed(NaN,0),false);
  for(let i=0;i<7;i++) assert.equal(engine.feed(-100,5000),true);
  assert.equal(engine.feeds,0); assert.equal(engine.feed(0,0),false);
  assert.equal(engine.food[0].x,45); assert.equal(engine.food[0].y,785);
  engine.fish=[];
  for(let i=0;i<310;i++) engine.tick(.05);
  assert.equal(engine.food.length,0); assert.equal(engine.score,0);
});
test('timeout loses and replay resets transient state', () => {
  const engine = new PondEngine(random(3)); engine.start(1);
  for(let i=0;i<1201;i++) engine.tick(.05);
  assert.equal(engine.state,'lost'); assert.equal(engine.time,0);
  assert.equal(engine.drainEvents().filter(e=>e.type==='lost').length,1);
  engine.start(1); assert.equal(engine.state,'playing'); assert.equal(engine.time,60); assert.equal(engine.score,0); assert.equal(engine.feeds,7);
});
test('eating applies the specified combo formula and times out combos', () => {
  const engine=new PondEngine(random(4)); engine.start(1);
  engine.fish=[{...engine.fish[0],x:800,y:450,cooldown:0}]; engine.feed(800,450); engine.tick(.01);
  assert.equal(engine.score,14); assert.equal(engine.combo,1);
  engine.fish[0].cooldown=0; engine.tick(.01); assert.equal(engine.score,30); assert.equal(engine.combo,2);
  engine.food=[]; for(let i=0;i<50;i++) engine.tick(.05); assert.equal(engine.combo,0);
});
test('winning happens immediately and cannot score twice after settlement', () => {
  const engine = new PondEngine(random(5)); engine.start(1); engine.score=99;
  engine.fish=[{...engine.fish[0],x:800,y:450,cooldown:0}]; engine.feed(800,450); engine.tick(.01);
  assert.equal(engine.state,'won'); assert.equal(engine.score,113);
  const snapshot=JSON.stringify(engine); engine.tick(.05); assert.equal(JSON.stringify(engine),snapshot);
  assert.equal(engine.drainEvents().filter(e=>e.type==='won').length,1);
});
test('12 levels are achievable with conservative feeding over 120 seeded simulations', () => {
  for(let level=1;level<=12;level++) for(let seed=1;seed<=10;seed++) {
    const engine = new PondEngine(random(seed)); engine.start(level);
    for(let tick=0;tick<1300 && engine.state==='playing';tick++) {
      if(!engine.food.length && engine.feeds>0) {
        const x=engine.fish.reduce((sum,f)=>sum+f.x,0)/engine.fish.length;
        const y=engine.fish.reduce((sum,f)=>sum+f.y,0)/engine.fish.length;
        engine.feed(x,y);
      }
      engine.tick(.05); engine.drainEvents();
    }
    assert.equal(engine.state,'won',`level ${level}, seed ${seed}, score ${engine.score}`);
  }
});
test('adapter distinguishes offline, invalid, failure, timeout and success', async () => {
  assert.equal((await new TapTapAdapter().getLeaderboard()).status,'offline');
  assert.equal((await new TapTapAdapter({getLeaderboard:()=>({ok:true,records:[{score:'bad'}]})}).getLeaderboard()).status,'invalid');
  assert.equal((await new TapTapAdapter({submitScore:()=>{throw null;}}).submitScore({})).status,'failed');
  assert.equal((await new TapTapAdapter({getLeaderboard:()=>new Promise(()=>{})},5).getLeaderboard()).status,'timeout');
  assert.equal((await new TapTapAdapter({getLeaderboard:()=>({ok:true,records:[]})}).getLeaderboard()).ok,true);
  assert.equal((await new TapTapAdapter({submitScore:()=>({ok:false})}).submitScore({})).status,'failed');
});
test('adapter rejects invalid cloud records and copies outgoing saves', async () => {
  const invalid=new TapTapAdapter({loadProgress:()=>({ok:true,save:{schemaVersion:1,currentLevel:99,updatedAt:3}})});
  assert.equal((await invalid.loadProgress()).status,'invalid');
  const save=PondStorage.defaults();
  const provider=new TapTapAdapter({saveProgress:value=>{value.currentLevel=12;return {ok:true};},loadProgress:()=>({ok:true,save})});
  assert.equal((await provider.loadProgress()).ok,true); await provider.saveProgress(save); assert.equal(save.currentLevel,1);
});
test('native TapTap leaderboard uses documented callback APIs and actual configured ID', async () => {
  assert.equal(createTapTapLeaderboardProvider({},''),null);
  const calls=[];
  const tap={getLeaderboardManager:()=>({submitScores:args=>{calls.push(args.scores);args.callback.onSuccess({});},openLeaderboard:args=>{calls.push(args.leaderboardId);args.callback.onSuccess({});}})};
  const adapter=new TapTapAdapter(createTapTapLeaderboardProvider(tap,'test-board'));
  assert.equal((await adapter.submitScore({score:100})).ok,true);
  assert.deepEqual(calls[0],[{leaderboardId:'test-board',score:100}]);
  assert.equal((await adapter.openLeaderboard()).ok,true); assert.equal(calls[1],'test-board');
  assert.equal((await adapter.getLeaderboard()).status,'offline');
});
