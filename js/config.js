/* ===========================================================
   布布奶茶铺 · 数据配置
   一切数值集中在这里，方便平衡调整
   =========================================================== */
window.CFG = (function () {
  const design = { w: 1080, baseH: 1920 };

  // 桌面（设计像素）
  const table = {
    x: 62,
    w: 956,
    h: 1112,
    topBase: 496,
    wallInset: 15,
  };

  const launch = {
    speed: 1500,        // 发射初速度（px/s，向上）
    cooldown: 0.1,      // 两次发射最小间隔
    previewLift: 96,    // 预览物中心相对桌面下沿的偏移
    minR: 65,
  };

  const phys = {
    gravity: 820,       // 向上重力（px/s²），朝桌面远端
    damping: 0.5,       // 空气阻尼（每秒衰减比例）
    restitution: 0.06,  // 弹性
    friction: 0.55,     // 切向摩擦
    wallRestitution: 0.12,
    maxSpeed: 4200,
    mergeImpulse: 45,
    sleepVel: 6,
    depthScale: 0.06,   // 伪透视：远端 1.0 → 近端 1.06（只调视觉尺寸）
  };

  const fail = {
    lineOffset: 115,    // 红线在桌面下沿上方多少
    grace: 3.0,         // 越线后允许停留秒数
    highlight: 0.5,     // 多少秒后开始高亮
    reviveMargin: 80,
  };

  const economy = {
    /* 单件售价曲线
       value = round(base * growth^(tier-1) * (1 + premium*(tier-1)))
       为什么必须接近 2 的幂：合成 tier N 需要 2^(N-1) 个 tier1（= 2^(N-1) 次发射），
       售价只有跟着 2 的幂走，「每发射一次的收益」才不会随档位崩塌；
       再叠一点 premium 溢价，让解锁高档 = 明明白白地表态「更赚钱」。
       旧的线性公式 5+5*tier 会让 unlock 越深越亏（t8 只有 0.35 金币/发射），已弃用。 */
    value: { base: 5, growth: 1.9, premium: 0.15 },

    orderXp: 10,
    dayXp: 25,
    rankBaseXp: 60,
    rankStepXp: 30,
    rankCoinPerLevel: 25,
    reviveCost: 400,
  };

  // 某个档位单件卖多少钱（整个游戏只有这一个定价入口）
  function itemValue(tier) {
    const v = economy.value;
    return Math.round(v.base * Math.pow(v.growth, tier - 1) * (1 + v.premium * (tier - 1)));
  }

  /* ---------------- 奶茶 8 阶 ---------------- */
  const tea = [
    { id: 't1', name: '珍珠奶茶', r: 65,  liquid: '#c8894f', cup: '#f3e2c9', top: 'pearl',   cap: '#8d5a34' },
    { id: 't2', name: '芋泥奶茶', r: 75,  liquid: '#b49ad6', cup: '#f6e8d6', top: 'taro',    cap: '#8c6fb0' },
    { id: 't3', name: '抹茶奶绿', r: 81,  liquid: '#a9c97f', cup: '#f2f6e6', top: 'foam',    cap: '#7b9c52' },
    { id: 't4', name: '草莓奶昔', r: 80,  liquid: '#f2879b', cup: '#fdeef1', top: 'berry',   cap: '#cf5f78' },
    { id: 't5', name: '焦糖布丁', r: 90,  liquid: '#d9a05b', cup: '#fdf0dc', top: 'pudding', cap: '#b27b3c' },
    { id: 't6', name: '芒果芝士', r: 100, liquid: '#f2b33d', cup: '#fff6df', top: 'cheese',  cap: '#d99323' },
    { id: 't7', name: '黑糖冰沙', r: 105, liquid: '#5a3b2e', cup: '#f0e0cd', top: 'whip',    cap: '#3f281f' },
    { id: 't8', name: '水果茶塔', r: 118, liquid: '#f2645a', cup: '#fff2e2', top: 'tower',   cap: '#d9483f' },
  ];

  /* ---------------- 蛋糕 6 阶 ---------------- */
  const cake = [
    { id: 'c1', name: '纸杯蛋糕', r: 67,  liquid: '#f2b6c6', cup: '#fff0f3', top: 'cup',    cap: '#e4572e' },
    { id: 'c2', name: '三角蛋糕', r: 74,  liquid: '#f6dda9', cup: '#fff6ea', top: 'slice',  cap: '#ee5e6e' },
    { id: 'c3', name: '甜甜圈',   r: 82,  liquid: '#e5b27a', cup: '#f7a8c4', top: 'donut',  cap: '#d1798f' },
    { id: 'c4', name: '慕斯杯',   r: 88,  liquid: '#c9a0dc', cup: '#fff3f6', top: 'mousse', cap: '#a479bd' },
    { id: 'c5', name: '双层蛋糕', r: 101, liquid: '#f7c6d3', cup: '#fff8f2', top: 'two',    cap: '#e08fa5' },
    { id: 'c6', name: '三层蛋糕', r: 120, liquid: '#ffe1c9', cup: '#fffdf6', top: 'three',  cap: '#d9a05b' },
  ];

  tea.forEach((t, i) => { t.cat = 'tea'; t.tier = i + 1; t.all = tea; });
  cake.forEach((c, i) => { c.cat = 'cake'; c.tier = i + 1; c.all = cake; });

  // tabName = 底部大 TAB 按钮上的文案（name 是短名，仍用于其它地方）
  const cats = {
    tea:  { key: 'tea',  name: '奶茶', tabName: '冲调奶茶', tiers: tea,  startUnlocked: 4 },
    cake: { key: 'cake', name: '蛋糕', tabName: '制作蛋糕', tiers: cake, startUnlocked: 2 },
  };

  /* ---------------- 每日难度 ---------------- */
  const days = [
    { orders: 5,  min: 1, max: 1, lowWeight: 4, lastTypes: 3, onlyCat: 'tea' },
    { orders: 6,  min: 1, max: 1, lowWeight: 3, lastTypes: 3, fixed: [{ cat: 'tea', tier: 3 }, { cat: 'tea', tier: 3 }] },
    { orders: 7,  min: 1, max: 1, lowWeight: 2, lastTypes: 4, onlyCat: 'cake' },
    { orders: 8,  min: 1, max: 2, lowWeight: 2, lastTypes: 4 },
    { orders: 9,  min: 1, max: 2, lowWeight: 2, lastTypes: 4 },
    { orders: 10, min: 1, max: 2, lowWeight: 1, lastTypes: 5 },
    { orders: 11, min: 2, max: 2, lowWeight: 1, lastTypes: 5 },
    { orders: 12, min: 1, max: 3, lowWeight: 1, lastTypes: 5 },
  ];

  /* ---------------- 升级（金币消费） ---------------- */
  const upgrades = [
    {
      id: 'teaMenu', cat: 'tea', name: '菜单研发 · 奶茶', desc: '解锁下一阶奶茶，大单更好赚',
      icon: { cat: 'tea', tier: 6 },
      levels: [{ price: 130 }, { price: 420 }, { price: 1400 }, { price: 4600 }],
    },
    {
      id: 'cakeMenu', cat: 'cake', name: '甜品柜 · 蛋糕', desc: '解锁下一阶蛋糕，大单更好赚',
      icon: { cat: 'cake', tier: 6 },
      levels: [{ price: 220 }, { price: 720 }, { price: 2400 }, { price: 7600 }],
    },
    {
      id: 'spawn', name: '出杯机', desc: '发射时随机档位 +1（省一半手速）',
      icon: { cat: 'tea', tier: 3 },
      levels: [{ price: 600 }, { price: 1800 }, { price: 4200 }],
    },
    {
      id: 'seat', name: '加一张桌子', desc: '同时接待的顾客 +1',
      icon: { cat: 'cake', tier: 5 },
      levels: [{ price: 3200 }],
    },
  ];

  const tools = [
    { id: 'delete', name: '删除', sub: '移走一个物品', price: 900, charges: 3, unlockDay: 1 },
    { id: 'swap',   name: '交换', sub: '两个物品换位', price: 900, charges: 3, unlockDay: 2 },
    { id: 'refresh', name: '换单', sub: '刷新第一个订单', price: 900, charges: 3, unlockDay: 3 },
  ];

  // 顾客形象：12 种（skin 0~11）。每次来的顾客从这里随机抽，
  // 且同一时间挂出的订单里不会重复出现同一种形象（见 game.js pickCus）。
  // 想换成自己画的头像：assets/cus0.png ~ cus11.png（png/webp/jpg 均可，512×512 脸居中）
  const customers = [
    { skin: 0, name: '小圆' },
    { skin: 1, name: '阿福' },
    { skin: 2, name: '布布' },
    { skin: 3, name: '奶昔' },
    { skin: 4, name: '豆豆' },
    { skin: 5, name: '阿茶' },
    { skin: 6, name: '果果' },
    { skin: 7, name: '团团' },
    { skin: 8, name: '可可' },
    { skin: 9, name: '糯米' },
    { skin: 10, name: '芋圆' },
    { skin: 11, name: '布丁' },
  ];

  // 奶茶杯品牌 LOGO：把一张小图标放到 assets/logo.png 即可在每只奶茶杯上烙印（透明 PNG 最佳）
  // logoFile 留空字符串则完全不加；scale 越大 LOGO 越大；dx/dy 是相对杯子中心的微调（单位 = 杯子半径 R）
  const brand = {
    logoFile: 'logo',   // assets/logo.png（png/webp/jpg 自动探测），想要关闭就改成 ''
    scale: 1.00,        // LOGO 宽度 = 杯子半径 R 的倍数（一倍 = 半杯宽；0.5 为原值，已按需求翻倍）
    dx: 0.0,           // 水平偏移（右为正）
    dy: 0.15,          // 垂直偏移（下为正，避开顶部奶油/水果）
  };

  return { design, table, launch, phys, fail, economy, cats, tea, cake, days, upgrades, tools, customers, itemValue, brand };
})();
