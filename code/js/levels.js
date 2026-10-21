(function (root) {
  'use strict';
  const names = ['初见荷塘', '晨光微漾', '双鲤逐光', '荷影回廊', '金鳞浅滩', '花雨池心', '青叶深处', '锦影成群', '月色清池', '流光回旋', '百鳞竞游', '碧池拾光'];
  const levels = names.map((name, index) => Object.freeze({
    id: index + 1, name, target: 100 + index * 60,
    seconds: 60 - Math.floor(index / 2) * 2,
    feeds: 7 + Math.floor(index / 3),
    fishCount: Math.min(10 + index, 20),
    pellets: 6 + Math.floor(index / 4),
    speed: 58 + index * 2.5,
    foodLifetime: 15,
    comboWindow: 2.4
  }));
  root.PondLevels = Object.freeze(levels);
})(globalThis);
