(function (root) {
  'use strict';
  // Internal provider contract; these names are not TapTap SDK method names.
  class TapTapAdapter {
    constructor(provider = null, timeout = 6000) { this.provider = provider; this.timeout = timeout; }
    register(provider) { this.provider = provider; }
    async call(method, payload) {
      if (!this.provider || typeof this.provider[method] !== 'function') return { ok: false, status: 'offline' };
      let timer;
      try {
        const request = Promise.resolve().then(() => this.provider[method](payload));
        const result = await Promise.race([request, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), this.timeout); })]);
        if (!result || result.ok !== true) return { ok: false, status: 'failed' };
        if (method === 'getLeaderboard' && (!Array.isArray(result.records) || result.records.length > 1000 || !result.records.every(root.PondStorage.validRecord))) return { ok: false, status: 'invalid' };
        if (method === 'loadProgress' && result.save !== null && (!result.save || result.save.schemaVersion !== 1 || !Number.isInteger(result.save.updatedAt) || result.save.updatedAt < 0 || !Number.isInteger(result.save.currentLevel) || result.save.currentLevel < 1 || result.save.currentLevel > 12 || !Number.isInteger(result.save.maxUnlockedLevel) || result.save.maxUnlockedLevel < result.save.currentLevel || result.save.maxUnlockedLevel > 12)) return { ok: false, status: 'invalid' };
        return result;
      } catch (error) { return { ok: false, status: error?.message === 'timeout' ? 'timeout' : 'failed' }; }
      finally { clearTimeout(timer); }
    }
    loadProgress() { return this.call('loadProgress'); }
    saveProgress(save) { return this.call('saveProgress', JSON.parse(JSON.stringify(save))); }
    getLeaderboard() { return this.call('getLeaderboard'); }
    submitScore(record) { return this.call('submitScore', { ...record }); }
    openLeaderboard() { return this.call('openLeaderboard'); }
  }
  // Verified against the installed TapTap MCP integration guide. The native API
  // opens its own leaderboard UI; it does not return records for our custom table.
  // Configure an actual leaderboard ID before game.js, after choosing the app.
  function nativeLeaderboardProvider(tap, leaderboardId) {
    if (!tap || typeof tap.getLeaderboardManager !== 'function' || typeof leaderboardId !== 'string' || !leaderboardId.trim()) return null;
    const invoke = (method, args) => new Promise((resolve, reject) => {
      tap.getLeaderboardManager()[method]({ ...args, callback: { onSuccess: () => resolve({ ok: true }), onFailure: (code, message) => reject(new Error(String(code) + ': ' + message)) } });
    });
    return {
      submitScore: record => invoke('submitScores', { scores: [{ leaderboardId, score: record.score }] }),
      openLeaderboard: () => invoke('openLeaderboard', { leaderboardId, collection: 'public' })
    };
  }
  root.TapTapAdapter = TapTapAdapter;
  root.createTapTapLeaderboardProvider = nativeLeaderboardProvider;
})(globalThis);
