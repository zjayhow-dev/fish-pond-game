(function (root) {
  'use strict';
  const rarities = Object.freeze([
    { id: 'common', name: '寻常', color: '#c8d7b3' },
    { id: 'uncommon', name: '雅品', color: '#8cddc6' },
    { id: 'rare', name: '珍稀', color: '#9bc9f4' },
    { id: 'epic', name: '绝品', color: '#d6b1ee' },
    { id: 'legendary', name: '传说', color: '#f3d185' }
  ].map(Object.freeze));
  const forms = Object.freeze({ classic: '锦鲤', slender: '流线鲤', round: '圆身鲤', butterfly: '长鳍蝶鲤' });
  // Artistic varieties, not a scientific taxonomy. Size is a visual scale only.
  const rows = [
    ['红白',0,'classic',38,'#f2eee1','#d94c39','#773526','islands','雪白底色上落着三段朱红，荷塘里最初的相逢。'],
    ['山吹',0,'slender',29,'#e4b84c','#a97627','#fff2b1','solid','细长金鳞，像一片游动的暖阳。'],
    ['墨点',0,'classic',44,'#e4e9df','#273b3c','#77908b','speckles','墨色小点散落在乳白鳞片间。'],
    ['丹顶',0,'round',33,'#f0ede0','#cb4238','#ead7a3','crown','额间一点朱砂，圆润身形轻轻摆动。'],
    ['茶鲤',0,'classic',56,'#a98a58','#70543a','#d9c79a','net','茶褐色网纹，沉静而敦厚。'],
    ['白蝶',0,'butterfly',40,'#e7eee4','#b1d0cb','#ffffff','solid','银白长鳍似薄纱，转身时轻轻舒展。'],
    ['绯霞',1,'slender',31,'#db6745','#a5352f','#f3c383','bands','赤橙底色衬着深红横斑。'],
    ['乌金',1,'round',48,'#374044','#c29c44','#f1d696','back','墨色鱼身浮起一道金色背脊。'],
    ['柠檬雪',2,'classic',42,'#f1edd7','#d9c342','#9b8832','islands','乳白与浅柠黄交错，像初春的光。'],
    ['青苔',2,'slender',26,'#8caa83','#435f54','#c6d5a2','net','鼠尾草绿细鳞，隐在荷影之间。'],
    ['三色锦',3,'classic',52,'#f0e7d7','#ce523c','#2c3841','tricolor','红、白、墨三色大斑彼此交错。'],
    ['浅葱',3,'slender',36,'#8daab9','#dd7856','#3c5f74','sides','蓝灰背鳞与朱红腹侧相映。'],
    ['银松叶',4,'classic',58,'#d5dfe0','#516d75','#f8f6df','net','银色鳞片被细密深灰网纹勾勒。'],
    ['落樱',4,'butterfly',39,'#f2dce2','#c77596','#efd5ad','petals','长鳍间散着樱粉花瓣般的碎斑。'],
    ['琥珀',5,'round',62,'#d99e46','#7e4c32','#f8daa0','marble','琥珀色身躯中流动着深褐纹理。'],
    ['蓝雪',5,'slender',28,'#d5e8e7','#5c92b9','#faf3dd','bands','浅蓝斑带掠过雪色鱼身。'],
    ['孔雀',6,'classic',54,'#d8d4bb','#3e6f75','#c87846','tricolor','铜橙大斑叠着蓝绿细网纹。'],
    ['紫藤',6,'butterfly',45,'#cab4da','#795b9b','#f1dfed','petals','紫藤色碎斑与柔长尾鳍相伴。'],
    ['赤龙',7,'slender',60,'#b74332','#542f37','#e4b265','net','绯红细鳞覆着暗色纹路，身形修长。'],
    ['月白',7,'round',34,'#dce7ec','#7e9dab','#f9f3df','back','冷白身躯与银蓝背线，如月光入水。'],
    ['金砂',8,'classic',49,'#f0d79a','#b17b35','#fff4cc','speckles','细小金褐斑点浮在暖白鳞底。'],
    ['碧玉蝶',8,'butterfly',57,'#9bc6ad','#386f66','#e5eac2','sides','碧玉色长鳍，两侧镶着深青纹。'],
    ['星河',9,'slender',43,'#364e77','#b5d8ec','#f4dba6','stars','深蓝鱼身点缀银白与浅金星斑。'],
    ['胭脂雪',9,'butterfly',51,'#f1e4e6','#a73f65','#ddb0be','marble','胭脂色云纹铺过雪白长鳍。'],
    ['黑曜金',10,'round',66,'#282f3c','#d3ac52','#f1dfac','bands','黑曜底色与宽阔金带，沉稳醒目。'],
    ['霜虹',10,'classic',47,'#dce9e6','#8c9fd4','#dc9cae','tricolor','霜白鳞底交织淡蓝与粉紫光泽。'],
    ['日曜',11,'butterfly',63,'#e9bb4e','#b66a35','#fff5c9','back','金色长鳍如日光流动，背脊透出暖白。'],
    ['月魄',11,'slender',55,'#dfe8f0','#617daa','#c8b5e5','stars','银蓝身影披着稀疏紫色星纹。'],
    ['五彩祥云',12,'classic',64,'#f0dfbc','#cc6a68','#4b9997','cloud','红、金、青、紫的云纹，在终章相逢。'],
    ['碧池龙影',12,'butterfly',70,'#254f4c','#d6ba72','#b4ddd1','dragon','深碧鳞身镶金，长尾带出最后一束微光。']
  ];
  const rarityFor = level => level <= 2 ? 0 : level <= 5 ? 1 : level <= 8 ? 2 : level <= 10 ? 3 : 4;
  const entries = Object.freeze(rows.map((r, i) => Object.freeze({
    id: 'koi-' + String(i + 1).padStart(2, '0'), number: i + 1, name:r[0], unlock:r[1], form:r[2], size:r[3],
    body:r[4], marking:r[5], accent:r[6], pattern:r[7], description:r[8], rarity:rarityFor(r[1]),
    sizeLabel:r[3] < 36 ? '小型' : r[3] < 53 ? '中型' : '大型'
  })));
  function progress(save) {
    const unlocked = Number.isInteger(save?.maxUnlockedLevel) ? Math.max(1, Math.min(12, save.maxUnlockedLevel)) : 1;
    return save?.bestScores?.[12] >= root.PondLevels[11].target ? 12 : unlocked - 1;
  }
  const available = cleared => entries.filter(f => f.unlock <= Math.max(0, Math.min(12, cleared)));
  function newlyUnlocked(before, after) {
    const previous = new Set(available(progress(before)).map(f => f.id));
    return available(progress(after)).filter(f => !previous.has(f.id));
  }
  function school(count, cleared, random = Math.random) {
    const pool = available(cleared), newest = pool.filter(f => f.unlock === pool[pool.length - 1].unlock);
    const chosen = newest.slice(0, Math.min(2, count));
    let remaining = pool.filter(f => !chosen.includes(f));
    while (chosen.length < count) {
      if (!remaining.length) remaining = [...pool];
      const total = remaining.reduce((sum, f) => sum + 1 / (1 + f.rarity), 0);
      let pick = random() * total, index = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) { pick -= 1 / (1 + remaining[i].rarity); if (pick < 0) { index = i; break; } }
      chosen.push(remaining.splice(index, 1)[0]);
    }
    return chosen;
  }
  root.PondFishCatalog = Object.freeze({ entries, rarities, forms, progress, available, newlyUnlocked, school, get: id => entries.find(f => f.id === id) || entries[0] });
})(globalThis);
