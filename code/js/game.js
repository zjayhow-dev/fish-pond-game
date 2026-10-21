(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let browserStorage;
  try { browserStorage = window.localStorage; } catch { browserStorage = null; }
  const store = PondStorage.createStore(browserStorage);
  let save = store.read();
  const nativeProvider = createTapTapLeaderboardProvider(window.tap, window.BICHI_TAPTAP_LEADERBOARD_ID);
  const adapter = new TapTapAdapter(window.BICHI_TAPTAP_PROVIDER || nativeProvider);
  const engine = new PondEngine();
  engine.collectionProgress = PondFishCatalog.progress(save);
  engine.seedFish(12);
  const renderer = new PondRenderer($('pond'), engine);
  let view = null, returnView = null, previousFocus = null, toastTimer, raf = 0, lastFrame = 0;
  let revision = 0, panelToken = 0, saveWarning = false, hudSignature = '';
  let audioContext = null, lastTone = -Infinity;
  let cloudQueue = Promise.resolve();
  const serviceText = result => ({ offline: '线上排行榜未连接', timeout: '线上服务响应超时，本机成绩已保留', invalid: '线上数据异常，本机成绩已保留', failed: '线上服务暂不可用，本机成绩已保留' }[result.status] || '线上服务暂不可用');

  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }
  function persist(change = true) {
    if (change) { save.updatedAt = Date.now(); revision++; }
    const ok = store.write(save);
    $('storageStatus').textContent = ok ? '本机存档 · 进度自动保存' : '本机存档不可用 · 刷新可能丢失进度';
    if (!ok && !saveWarning) { saveWarning = true; toast('本机存档不可用，本次仍可游玩；刷新后进度可能丢失'); }
    return ok;
  }
  function sound(kind, combo = 0) {
    if (!save.settings.soundOn || document.hidden || engine.state === 'paused') return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      if (kind === 'eat' && now - lastTone < .075) return;
      lastTone = now;
      const frequencies = kind === 'won' ? [523, 659, 784] : kind === 'lost' ? [196, 165] : kind === 'feed' ? [440, 660] : [620 + Math.min(combo, 5) * 40];
      frequencies.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
        const start = now + index * .15, duration = kind === 'won' ? .55 : .22;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .8, start + duration);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .012); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
        oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration + .03);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { toast('当前浏览器暂不支持音效'); }
  }
  function syncSound() {
    $('soundButton').innerHTML = icon(save.settings.soundOn ? 'sound' : 'muted');
    $('soundButton').setAttribute('aria-label', save.settings.soundOn ? '关闭音效' : '开启音效');
    $('soundButton').setAttribute('aria-pressed', String(save.settings.soundOn));
  }
  function updateMenu() {
    $('atlasCount').textContent = '已解锁 ' + PondFishCatalog.available(PondFishCatalog.progress(save)).length + ' / ' + PondFishCatalog.entries.length;
    const level = PondLevels[save.currentLevel - 1];
    $('continueLabel').textContent = (save.bestScores[12] ? '重游第 ' : '继续第 ') + level.id + ' 关';
    $('journeyNumber').textContent = String(level.id).padStart(2, '0');
    $('journeyName').textContent = level.name;
    $('journeyNote').textContent = save.runScore ? '已拾起 ' + save.runScore + ' 分微光，下一段风景等你来。' : '从一圈涟漪开始，遇见池中的小伙伴。';
    $('journeyDots').innerHTML = PondLevels.map(l => '<i class="' + (l.id <= save.maxUnlockedLevel ? 'unlocked ' : '') + (l.id === level.id ? 'current' : '') + '"></i>').join('');
  }
  function updateHUD() {
    const time = Math.ceil(engine.time);
    const signature = [engine.level.id, engine.state, engine.score, time, engine.feeds, engine.combo, engine.food.length].join(':');
    if (signature === hudSignature) return;
    hudSignature = signature;
    $('score').textContent = engine.score;
    $('time').textContent = String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');
    $('time').classList.toggle('urgent', time <= 10);
    $('feeds').textContent = engine.feeds;
    $('progressText').textContent = engine.score + ' / ' + engine.level.target;
    $('progressFill').style.width = Math.min(100, engine.score / engine.level.target * 100) + '%';
    $('progressBar').setAttribute('aria-valuenow', Math.min(engine.score, engine.level.target));
    $('progressBar').setAttribute('aria-valuemax', engine.level.target);
    $('foodDots').innerHTML = Array.from({ length: engine.level.feeds }, (_, i) => '<i class="' + (i < engine.feeds ? '' : 'used') + '"></i>').join('');
    $('combo').hidden = engine.combo < 2 || engine.state === 'menu';
    $('comboNumber').textContent = engine.combo;
    $('feedingHint').textContent = engine.feeds ? '点击水面投喂，吸引锦鲤追食' : (engine.food.length ? '投喂已用完 · 等待锦鲤享用' : '鱼食已用完 · 可暂停后重试');
  }
  function hidePanel(restoreFocus = true) {
    $('overlay').hidden = true; view = null; panelToken++;
    $('menu').inert = false; $('hud').inert = false; $('pond').inert = false; $('soundButton').inert = false; $('pauseButton').inert = false;
    if (restoreFocus && previousFocus && previousFocus.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus();
  }
  function showPanel(type, title, subtitle, body, wide = false, close = true) {
    if ($('overlay').hidden) previousFocus = document.activeElement;
    view = type; panelToken++;
    $('panel').className = 'panel' + (wide ? ' wide' : '');
    $('panel').innerHTML = (close ? '<button class="icon-button close" data-action="close" aria-label="关闭面板">' + icon('close') + '</button>' : '') +
      '<div class="eyebrow">BICHI · SHIGUANG</div><h2 id="panelTitle">' + title + '</h2><p class="panel-subtitle">' + subtitle + '</p>' + body;
    $('overlay').hidden = false;
    $('menu').inert = true; $('hud').inert = true; $('pond').inert = true; $('soundButton').inert = true; $('pauseButton').inert = true;
    const initial = $('panel').querySelector('.primary:not(:disabled)') || $('panel').querySelector('.level-card.current') || $('panel').querySelector('input') || $('panel').querySelector('button:not(:disabled)');
    (initial || $('panel')).focus();
  }
  function startLevel(id) {
    if (!Number.isInteger(id) || id < 1 || id > save.maxUnlockedLevel) return;
    hidePanel(false); returnView = null; renderer.clear(); renderer.cursor = null;
    engine.collectionProgress = PondFishCatalog.progress(save);
    engine.start(id); save.currentLevel = id; persist();
    $('stage').classList.add('playing'); $('menu').hidden = true; $('journeyCard').hidden = true; $('menuFooter').hidden = true;
    $('hud').hidden = false; $('gameStats').hidden = false; $('pauseButton').hidden = false;
    $('chapterLabel').textContent = '第 ' + id + ' 关 · ' + engine.level.name;
    $('levelLabel').textContent = '第 ' + id + ' 关 · ' + engine.level.name;
    updateHUD(); $('pond').focus({ preventScroll: true });
    if (id === 1 && !save.bestScores[1]) toast('试着点在游动的锦鲤旁边，每团鱼食都能被多次享用');
  }
  function menu() {
    hidePanel(false); returnView = null; engine.menu(); renderer.clear(); renderer.cursor = null;
    engine.collectionProgress = PondFishCatalog.progress(save); engine.seedFish(12);
    $('stage').classList.remove('playing'); $('menu').hidden = false; $('journeyCard').hidden = false; $('menuFooter').hidden = false;
    $('hud').hidden = true; $('gameStats').hidden = true; $('pauseButton').hidden = true; $('combo').hidden = true;
    $('chapterLabel').textContent = '荷风轻拂 · 锦鲤相伴'; updateMenu(); persist(false); $('continueButton').focus({ preventScroll: true });
  }
  function pause() {
    if (engine.state !== 'playing' && engine.state !== 'paused') return;
    engine.pause();
    if (audioContext && audioContext.state === 'running') audioContext.suspend().catch(() => {});
    showPanel('pause', '稍歇片刻', '荷塘会等你，时间也会。', '<div class="panel-actions vertical"><button class="primary" data-action="resume">继续游戏 ' + icon('arrow') + '</button><button class="secondary" data-action="retry">重新开始本关</button><button class="text-button" data-action="menu">返回主菜单</button></div>');
  }
  function resume() {
    hidePanel(); returnView = null; engine.resume();
    if (audioContext && save.settings.soundOn) audioContext.resume().catch(() => {});
  }
  function beginSubpanel() {
    returnView = view === 'pause' ? 'pause' : view === 'result' ? 'result' : engine.state === 'playing' ? 'playing' : 'menu';
    if (engine.state === 'playing') engine.pause();
    if (audioContext && audioContext.state === 'running') audioContext.suspend().catch(() => {});
  }
  function closePanel() {
    if (view === 'pause') { resume(); return; }
    if (view === 'result') { menu(); return; }
    const back = returnView; returnView = null;
    if (back === 'playing') resume();
    else if (back === 'pause') pause();
    else if (back === 'result') resultPanel();
    else hidePanel();
  }
  function levels() {
    beginSubpanel();
    const cards = PondLevels.map(level => {
      const locked = level.id > save.maxUnlockedLevel;
      return '<button class="level-card ' + (level.id === save.currentLevel ? 'current' : '') + '" data-level="' + level.id + '" ' + (locked ? 'disabled' : '') + ' aria-label="第 ' + level.id + ' 关 ' + level.name + (locked ? '，未解锁' : '') + '"><b>' + String(level.id).padStart(2, '0') + '</b>' + (locked ? icon('lock') : '') + '<span>' + level.name + '</span><small>' + (locked ? '前一关达成后解锁' : save.bestScores[level.id] ? '最佳 ' + save.bestScores[level.id] + ' 分' : '目标 ' + level.target + ' 分') + '</small></button>';
    }).join('');
    showPanel('levels', '十二段荷塘时光', '从初见到相伴，每一圈涟漪都是旅程。', '<div class="level-grid">' + cards + '</div><p class="service-note">已解锁 ' + save.maxUnlockedLevel + ' / 12 关 · 重游可以刷新最佳成绩</p>', true);
  }
  function help() {
    beginSubpanel();
    showPanel('help', '与锦鲤一起拾光', '简单三步，把日常放慢一点。', '<div class="steps"><div class="step"><b>01</b><div><h3>轻点水面，投下一颗期待</h3><p>点击锦鲤附近的水面，撒下一团鱼食。留意剩余投喂次数。</p></div></div><div class="step"><b>02</b><div><h3>锦鲤追食，微光汇成分数</h3><p>连续吞食会触发连击，让每一次相聚收获更多分数。</p></div></div><div class="step"><b>03</b><div><h3>时间结束前，点亮下一程</h3><p>达成目标即可通关，十二段荷塘风景会依次解锁。</p></div></div></div><div class="help-tip">小窍门：靠近游动的鱼群投喂，比一次撒完所有鱼食更有效。<br>Esc / 空格：暂停或继续 · 方向键移动投喂点，F 键投喂<br>旅程分数为各关最佳分数之和，重玩只计提升部分。</div><div class="panel-actions"><button class="primary" data-action="close">知道了，去看看荷塘 ' + icon('arrow') + '</button></div>');
  }
  let atlasRarity = 'all', atlasOwned = false, selectedFish = 'koi-01';
  function atlas() {
    beginSubpanel(); atlasRarity = 'all'; atlasOwned = false;
    selectedFish = PondFishCatalog.available(PondFishCatalog.progress(save)).slice(-1)[0].id;
    const count = PondFishCatalog.available(PondFishCatalog.progress(save)).length;
    showPanel('atlas', '鱼类图谱', '收集 ' + count + ' / 30 种花色 · 每通关一关，遇见两位新伙伴',
      '<div class="atlas-filters" role="group" aria-label="按稀有度筛选"><button data-rarity="all" aria-pressed="true">全部</button>' +
      PondFishCatalog.rarities.map((r,i) => '<button data-rarity="' + i + '" aria-pressed="false" style="--rarity:' + r.color + '">' + r.name + '</button>').join('') +
      '<button class="owned-filter" data-action="atlasOwned" aria-pressed="false">只看已解锁</button></div>' +
      '<div class="atlas-body"><div id="fishDetail" class="fish-detail" aria-live="polite"></div><p id="atlasFilterCount" class="atlas-filter-count"></p><div id="atlasGrid" class="atlas-grid" role="group" aria-label="锦鲤花色列表"></div></div><p class="atlas-footnote">艺术花色 · 非生物分类 · 体型与稀有度不改变得分</p>',true);
    $('panel').classList.add('atlas-panel'); renderAtlas();
  }
  function drawAtlasPreviews(container) {
    container.querySelectorAll('canvas[data-fish-art]').forEach(canvas => {
      const fish = PondFishCatalog.get(canvas.dataset.fishArt);
      PondFishArt.preview(canvas, fish, fish.unlock > PondFishCatalog.progress(save));
    });
  }
  function fishDetail(id) {
    selectedFish = id;
    const fish = PondFishCatalog.get(id), rarity = PondFishCatalog.rarities[fish.rarity];
    const locked = fish.unlock > PondFishCatalog.progress(save);
    $('fishDetail').innerHTML = '<div class="fish-detail-art"><canvas width="400" height="170" data-fish-art="' + fish.id + '" aria-label="' + fish.name + '外观预览"></canvas></div>' +
      '<div class="fish-detail-copy"><span class="rarity-badge" style="--rarity:' + rarity.color + '">' + rarity.name + ' · ' + String(fish.number).padStart(2,'0') + '</span><h3>' + fish.name + '</h3><span class="fish-traits">' + PondFishCatalog.forms[fish.form] + ' / ' + fish.sizeLabel + '</span><p>' + fish.description + '</p><b class="fish-unlock ' + (locked ? 'locked' : '') + '">' +
      (locked ? '通关第 ' + fish.unlock + ' 关「' + PondLevels[fish.unlock-1].name + '」解锁' : fish.unlock ? '已解锁 · 通关第 ' + fish.unlock + ' 关获得' : '初始伙伴 · 已解锁') + '</b></div>';
    $('atlasGrid').querySelectorAll('[data-fish]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fish === id)));
    drawAtlasPreviews($('fishDetail'));
  }
  function renderAtlas() {
    const progress = PondFishCatalog.progress(save);
    const entries = PondFishCatalog.entries.filter(f => (atlasRarity === 'all' || f.rarity === Number(atlasRarity)) && (!atlasOwned || f.unlock <= progress));
    document.querySelectorAll('[data-rarity]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rarity === atlasRarity)));
    $('panel').querySelector('[data-action="atlasOwned"]').setAttribute('aria-pressed', String(atlasOwned));
    $('atlasFilterCount').textContent = '当前展示 ' + entries.length + ' 种 · 点击卡片查看外观与解锁条件';
    $('atlasGrid').innerHTML = entries.length ? entries.map(f => {
      const rarity = PondFishCatalog.rarities[f.rarity], locked = f.unlock > progress;
      return '<button class="fish-card ' + (locked ? 'is-locked' : '') + '" data-fish="' + f.id + '" style="--rarity:' + rarity.color + '" aria-pressed="false" aria-label="' + f.name + '，' + rarity.name + '，' + (locked ? '通关第'+f.unlock+'关解锁' : '已解锁') + '"><div class="fish-card-top"><small>' + String(f.number).padStart(2,'0') + '</small><span>' + rarity.name + '</span></div><canvas width="240" height="100" data-fish-art="' + f.id + '" aria-hidden="true"></canvas><b>' + f.name + '</b><small class="fish-card-note">' + (locked ? '◇ 通关第 ' + f.unlock + ' 关' : PondFishCatalog.forms[f.form] + ' · ' + f.sizeLabel) + '</small></button>';
    }).join('') : '<p class="atlas-empty">这一稀有度还没有解锁。<br>继续旅程，或关闭“只看已解锁”预览。</p>';
    if (entries.length) {
      if (!entries.some(f => f.id === selectedFish)) selectedFish = entries[0].id;
      fishDetail(selectedFish); $('fishDetail').hidden = false;
    } else $('fishDetail').hidden = true;
    drawAtlasPreviews($('atlasGrid')); $('atlasGrid').scrollTop = 0;
  }
  function rankingRows(records) {
    if (!records.length) return '<p class="empty">荷塘还在等待第一束微光。<br>完成一关，就能留下你的第一条记录。</p>';
    return '<table class="ranking-table"><thead><tr><th>名次</th><th>池塘旅人</th><th>旅程分数</th><th>通关</th><th>记录日期</th></tr></thead><tbody>' + records.map((r, i) => '<tr><td>' + String(i + 1).padStart(2, '0') + '</td><td>' + escape(r.nickname) + '</td><td>' + r.score + '</td><td>第 ' + r.level + ' 关</td><td>' + new Date(r.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + '</td></tr>').join('') + '</tbody></table>';
  }
  async function ranking() {
    beginSubpanel();
    showPanel('ranking', '池塘排行榜', '每一点微光，都值得被记住。', '<form id="nicknameForm" class="nickname"><label for="nickname">你的昵称</label><input id="nickname" name="nickname" maxlength="16" value="' + escape(save.nickname) + '" autocomplete="off"><button class="secondary" type="submit">保存</button></form><div id="onlineRanking"><p class="service-note">正在检查线上排行榜…</p></div><h3 class="ranking-section">本机记录</h3>' + rankingRows(save.localRanking) + '<p class="service-note">仅此浏览器保存 · 最多 20 条 · 不代表全球排名</p>', true);
    const token = panelToken;
    const result = await adapter.getLeaderboard();
    if (view !== 'ranking' || token !== panelToken) return;
    if (result.ok) $('onlineRanking').innerHTML = '<h3 class="ranking-section">线上排行榜</h3>' + rankingRows(PondStorage.sortRanking(result.records));
    else if (adapter.provider && typeof adapter.provider.openLeaderboard === 'function') $('onlineRanking').innerHTML = '<button class="secondary" data-action="nativeRanking">打开 TapTap 官方排行榜</button><p class="service-note">线上榜单在平台面板中显示，以下为本机记录。</p>';
    else $('onlineRanking').innerHTML = '<p class="service-note">' + serviceText(result) + '；以下为本机记录。</p>';
  }
  let lastSubmission = { ok: false, status: 'offline' };
  let settlementSerial = 0;
  let newFish = [];
  function resultPanel() {
    const won = engine.state === 'won', final = won && engine.level.id === 12;
    const stats = '<div class="result-score">' + engine.score + '<span style="font:12px system-ui;margin-left:8px">分</span></div><div class="result-stats"><div><small>本关目标</small><b>' + engine.level.target + '</b></div><div><small>最高连击</small><b>× ' + engine.maxCombo + '</b></div><div><small>旅程分数</small><b>' + save.runScore + '</b></div></div>';
    const rewards = newFish.length && won ? '<div class="fish-rewards"><span>新花色已解锁</span><div>' + newFish.map(f => '<span style="--rarity:' + PondFishCatalog.rarities[f.rarity].color + '"><canvas width="160" height="64" data-fish-art="' + f.id + '" aria-hidden="true"></canvas><b>' + f.name + '</b><small>' + PondFishCatalog.rarities[f.rarity].name + '</small></span>').join('') + '</div><button class="text-button" data-action="atlas">前往鱼类图谱 →</button></div>' : '';
    const actions = rewards + '<div class="panel-actions vertical"><button class="primary" data-action="' + (won ? final ? 'menu' : 'next' : 'retry') + '">' + (won ? final ? '旅程完成 · 返回荷塘' : '下一关 · ' + PondLevels[engine.level.id].name : '重试本关') + icon('arrow') + '</button><div><button class="text-button" data-action="' + (won ? 'retry' : 'levels') + '">' + (won ? '再玩一次' : '选择关卡') + '</button><button class="text-button" data-action="menu">返回主菜单</button></div></div>';
    showPanel('result', won ? final ? '一池微光，圆满相逢' : '本关达成' : '再试一次', won ? '你与锦鲤的默契，又点亮了一段时光。' : '还差 ' + (engine.level.target - engine.score) + ' 分。下次试着靠近鱼群投喂。', '<svg class="result-flower"><use href="#i-lotus"/></svg>' + stats + actions + (won ? '<p id="submitStatus" class="service-note">' + (lastSubmission.ok ? '线上成绩已提交' : lastSubmission.status === 'pending' ? '本机成绩已保存，正在提交线上成绩…' : serviceText(lastSubmission) + ' · 本机成绩已保留') + '</p>' : ''), false, false);
    drawAtlasPreviews($('panel'));
  }
  async function settle(won) {
    const serial = ++settlementSerial;
    sound(won ? 'won' : 'lost');
    newFish = [];
    if (won) {
      const previousSave = save;
      save = PondStorage.completeLevel(save, engine.level.id, engine.score);
      newFish = PondFishCatalog.newlyUnlocked(previousSave, save); persist();
      lastSubmission = { ok: false, status: 'pending' };
    } else { save.currentLevel = engine.level.id; persist(); }
    updateHUD(); resultPanel();
    if (!won) return;
    const snapshot = JSON.parse(JSON.stringify(save));
    const record = { nickname: save.nickname, score: save.runScore, level: Math.max(...Object.keys(save.bestScores).map(Number)), timestamp: save.updatedAt };
    // Serialize cloud operations so providers cannot write snapshots out of order.
    cloudQueue = cloudQueue.then(() => adapter.saveProgress(snapshot));
    const result = await adapter.submitScore(record);
    if (serial === settlementSerial) {
      lastSubmission = result;
      if (view === 'result' && $('submitStatus')) $('submitStatus').textContent = result.ok ? '线上成绩已提交' : serviceText(result) + ' · 本机成绩已保留';
    }
  }
  function processEvents() {
    for (const event of engine.drainEvents()) {
      renderer.event(event);
      if (event.type === 'feed') sound('feed');
      if (event.type === 'eat') sound('eat', event.combo);
      if (event.type === 'empty') toast('投喂次数已用完，等等锦鲤，或暂停后重新挑战');
      if (event.type === 'won' || event.type === 'lost') void settle(event.type === 'won');
    }
  }
  $('continueButton').addEventListener('click', () => startLevel(save.currentLevel));
  $('pauseButton').addEventListener('click', pause);
  $('soundButton').addEventListener('click', () => { save.settings.soundOn = !save.settings.soundOn; persist(); syncSound(); if (save.settings.soundOn) sound('feed'); else if (audioContext) audioContext.suspend().catch(() => {}); });
  $('dismissOrientation').addEventListener('click', () => $('stage').classList.add('orientation-dismissed'));
  $('pond').addEventListener('pointerdown', event => {
    if (event.button !== 0 || engine.state !== 'playing' || !$('overlay').hidden) return;
    renderer.cursor = null;
    const point = renderer.point(event.clientX, event.clientY); engine.feed(point.x, point.y); processEvents(); updateHUD();
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.level) { startLevel(Number(button.dataset.level)); return; }
    if (button.dataset.fish) { fishDetail(button.dataset.fish); return; }
    if (button.dataset.rarity) { atlasRarity = button.dataset.rarity; renderAtlas(); return; }
    const actions = { levels, help, ranking, atlas, atlasOwned: () => { atlasOwned = !atlasOwned; renderAtlas(); }, close: closePanel, resume, retry: () => startLevel(engine.level.id), next: () => startLevel(engine.level.id + 1), menu };
    if (actions[button.dataset.action]) actions[button.dataset.action]();
    if (button.dataset.action === 'nativeRanking') {
      button.disabled = true; const result = await adapter.openLeaderboard(); button.disabled = false;
      if (!result.ok) toast(serviceText(result));
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'nicknameForm') return;
    event.preventDefault(); save.nickname = PondStorage.nickname($('nickname').value); $('nickname').value = save.nickname; persist(); toast('昵称已保存，将用于下一次通关记录');
  });
  document.addEventListener('keydown', event => {
    const typing = event.target.matches('input,textarea,select,[contenteditable="true"]');
    if (event.key === 'Tab' && !$('overlay').hidden) {
      const elements = [...$('panel').querySelectorAll('button:not(:disabled),input,[tabindex="0"]')];
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); if (view && view !== 'result') closePanel(); else if (engine.state === 'playing') pause(); return; }
    if (typing || event.repeat) return;
    if (event.code === 'Space' && (engine.state === 'playing' || view === 'pause') && !event.target.closest('button')) { event.preventDefault(); view === 'pause' ? resume() : pause(); }
    if (event.key === 'Enter' && engine.state === 'menu' && !view && !event.target.closest('button')) { event.preventDefault(); startLevel(save.currentLevel); }
    if (engine.state === 'playing' && (event.key.startsWith('Arrow') || event.code === 'KeyF')) {
      event.preventDefault(); renderer.cursor ||= { x: 800, y: 450 };
      if (event.key === 'ArrowLeft') renderer.cursor.x = Math.max(60, renderer.cursor.x - 65);
      if (event.key === 'ArrowRight') renderer.cursor.x = Math.min(1540, renderer.cursor.x + 65);
      if (event.key === 'ArrowUp') renderer.cursor.y = Math.max(130, renderer.cursor.y - 65);
      if (event.key === 'ArrowDown') renderer.cursor.y = Math.min(770, renderer.cursor.y + 65);
      if (event.code === 'KeyF') { engine.feed(renderer.cursor.x, renderer.cursor.y); processEvents(); updateHUD(); }
    }
  });
  new ResizeObserver(() => { renderer.resize(); renderer.draw(); }).observe($('stage'));
  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
    const frozen = engine.state === 'paused' || (engine.state === 'menu' && view);
    if (!frozen) { engine.tick(dt); renderer.update(dt); processEvents(); }
    renderer.draw();
    if (engine.state === 'playing') updateHUD();
    raf = requestAnimationFrame(frame);
  }
  function suspend() {
    if (engine.state === 'playing') pause();
    persist(false);
    if (audioContext) audioContext.suspend().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { suspend(); cancelAnimationFrame(raf); raf = 0; lastFrame = 0; }
    else if (!raf) { lastFrame = 0; raf = requestAnimationFrame(frame); }
  });
  window.addEventListener('blur', suspend);
  window.addEventListener('pagehide', suspend);
  persist(false); syncSound(); updateMenu(); raf = requestAnimationFrame(frame);
  // Do not let a slow cloud read overwrite any interaction since boot.
  const bootRevision = revision;
  adapter.loadProgress().then(result => {
    if (!result.ok || !result.save || revision !== bootRevision || engine.state !== 'menu' || view) return;
    const cloud = PondStorage.validate(result.save);
    if (cloud.updatedAt <= save.updatedAt) return;
    cloud.maxUnlockedLevel = Math.max(cloud.maxUnlockedLevel, save.maxUnlockedLevel);
    for (const [level, score] of Object.entries(save.bestScores)) cloud.bestScores[level] = Math.max(score, cloud.bestScores[level] || 0);
    cloud.settings = save.settings; cloud.nickname = save.nickname;
    cloud.localRanking = save.localRanking; // Local history stays specific to this device.
    save = PondStorage.validate(cloud); persist(); syncSound(); updateMenu();
    engine.collectionProgress = PondFishCatalog.progress(save); engine.seedFish(12);
    toast('已读取云端进度');
  });
})();
