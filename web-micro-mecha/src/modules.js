// Minimal module definitions and application

export const MODULES = [
  {
    id: 'overclock', name: 'オーバークロック', tags: ['連射'],
    text: '連射+20%（Heatに有効）',
    apply(s) { s.stats.firerateMult *= 1.2; }
  },
  {
    id: 'ignite', name: 'イグナイト', tags: ['熱','DoT'],
    text: '弾に2sの炎上(毎秒20%)',
    apply(s) { s.flags.ignite = true; }
  },
  {
    id: 'pierce', name: 'ピアス弾', tags: ['貫通'],
    text: '弾貫通+1',
    apply(s) { s.stats.pierce += 1; }
  },
  {
    id: 'vacuum', name: 'バキュームコイル', tags: ['吸引'],
    text: '取得範囲+80',
    apply(s) { s.stats.pickup += 80; }
  },
  {
    id: 'repair', name: '修復ナノ', tags: ['防御'],
    text: '再生+1.5 HP/s',
    apply(s) { s.stats.regen += 1.5; }
  },
];

export const START_WEAPON = {
  id: 'heat_blaster', name: 'ヒートブラスター', tags: ['熱'],
  base: { dps: 18, range: 180, firerate: 6 },
};

