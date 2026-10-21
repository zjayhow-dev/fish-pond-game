(function (root) {
  'use strict';
  const KEY = 'bichi-shiguang-save-v1';
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, fallback, min = 0, max = 1e9) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
  const nickname = value => typeof value === 'string' && value.trim() ? [...value.trim()].slice(0, 16).join('') : '池塘旅人';
  function defaults() {
    return { schemaVersion: 1, currentLevel: 1, maxUnlockedLevel: 1, runScore: 0, bestCampaignScore: 0, bestScores: {}, nickname: '池塘旅人', settings: { soundOn: false }, localRanking: [], updatedAt: 0 };
  }
  function validRecord(record) {
    return object(record) && typeof record.nickname === 'string' && record.nickname.trim().length > 0 &&
      Number.isSafeInteger(record.score) && record.score >= 0 && record.score <= 1e9 &&
      Number.isInteger(record.level) && record.level >= 1 && record.level <= 12 &&
      Number.isSafeInteger(record.timestamp) && record.timestamp >= 0 && record.timestamp <= 8640000000000000;
  }
  function sortRanking(records) {
    return (Array.isArray(records) ? records : []).filter(validRecord).map(r => ({ nickname: nickname(r.nickname), score: r.score, level: r.level, timestamp: r.timestamp }))
      .sort((a, b) => b.score - a.score || b.level - a.level || a.timestamp - b.timestamp).slice(0, 20);
  }
  function validate(raw) {
    const save = defaults();
    if (!object(raw) || raw.schemaVersion !== 1) return save;
    if (object(raw.bestScores)) {
      for (let level = 1; level <= 12; level++) {
        const score = integer(raw.bestScores[level], 0, 0, 100000);
        if (score > 0) save.bestScores[level] = score;
      }
    }
    const completed = Object.keys(save.bestScores).map(Number);
    save.maxUnlockedLevel = Math.max(integer(raw.maxUnlockedLevel, 1, 1, 12), ...completed.map(l => Math.min(l + 1, 12)));
    save.currentLevel = Math.min(integer(raw.currentLevel, 1, 1, 12), save.maxUnlockedLevel);
    // A journey is the sum of each chapter's best result, so replay cannot farm progress.
    save.runScore = Object.values(save.bestScores).reduce((sum, score) => sum + score, 0);
    save.bestCampaignScore = Math.max(save.runScore, integer(raw.bestCampaignScore, 0));
    save.nickname = nickname(raw.nickname);
    save.settings.soundOn = object(raw.settings) && raw.settings.soundOn === true;
    save.localRanking = sortRanking(raw.localRanking);
    save.updatedAt = integer(raw.updatedAt, 0, 0, 8640000000000000);
    return save;
  }
  function createStore(storage) {
    let available = true;
    function read() {
      try {
        const text = storage.getItem(KEY);
        if (!text) return defaults();
        try { return validate(JSON.parse(text)); } catch { return defaults(); }
      } catch { available = false; return defaults(); }
    }
    function write(save) {
      try { storage.setItem(KEY, JSON.stringify(save)); available = true; return true; }
      catch { available = false; return false; }
    }
    return { read, write, get available() { return available; } };
  }
  function completeLevel(save, level, score, timestamp = Date.now()) {
    const next = validate(save);
    if (!Number.isInteger(level) || level < 1 || level > next.maxUnlockedLevel || !Number.isInteger(score) || score < 0 || score > 100000) return next;
    next.bestScores[level] = Math.max(next.bestScores[level] || 0, score);
    next.runScore = Object.values(next.bestScores).reduce((sum, n) => sum + n, 0);
    next.bestCampaignScore = Math.max(next.bestCampaignScore, next.runScore);
    next.maxUnlockedLevel = Math.max(next.maxUnlockedLevel, Math.min(12, level + 1));
    next.currentLevel = Math.max(next.currentLevel, Math.min(12, level + 1));
    next.updatedAt = timestamp;
    const highest = Math.max(...Object.keys(next.bestScores).map(Number));
    next.localRanking = sortRanking([...next.localRanking, { nickname: next.nickname, score: next.runScore, level: highest, timestamp }]);
    return next;
  }
  root.PondStorage = { KEY, defaults, validate, validRecord, sortRanking, createStore, completeLevel, nickname };
})(globalThis);
