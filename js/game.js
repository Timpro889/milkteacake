/* ===========================================================
   布布奶茶铺 · 核心引擎
   =========================================================== */
window.Game = (function () {
  const C = window.CFG;
  const E = C.economy;

  let cv, ctx, stage, scene = null;
  let L = { W: 1080, H: 1920, scale: 1 };
  let bodies = [];
  let ghosts = [];      // 合成消散
  let parts = [];       // 粒子
  let flyers = [];      // 飞向订单的物品
  let floats = [];      // 飘字

  // 飘字统一入口：同文案短时间去重 + 总量上限，避免连击时刷屏重叠
  function addFloat(f, dedupWin) {
    const win = dedupWin == null ? 0.4 : dedupWin;
    for (let i = floats.length - 1; i >= 0; i--) {
      if (floats[i].text === f.text && floats[i].t < win) return;
    }
    floats.push(f);
    while (floats.length > 4) floats.shift();
  }
  let S = null;
  let ids = 1;
  let acc = 0, last = 0, running = false;
  let aim = { active: false, x: 480, cooldown: 0 };
  let shake = 0;
  let landSndT = 0;
  let preloadDone = false;

  const STEP = 1 / 120;

  /* ---------------- 存档 ----------------
     三层持久化，尽量不丢档：
       1) localStorage   首选，file:// 下多数浏览器也支持
       2) document.cookie 次选，localStorage 被禁时（部分隐私模式/file:// 策略）顶上
       3) IndexedDB      异步兜底，http(s) 下可用
     再不行就让用户抄「存档码」手动带走（首页存档面板）。
     每次写入都会记 meta.savedAt，读档成功与否会回传给 UI 做可见反馈。        */
  const SAVEKEY = 'bubu_milktea_v2';
  const OLDKEYS = ['bubu_milktea_v1'];
  const SAVEVER = 2;
  const IDB = { db: 'bubu_milktea', os: 'save', key: 'main' };

  const store = { channels: [], lastWrite: '', lastChannel: '', idb: null, xhs: null };

  function defaults() {
    return {
      ver: SAVEVER,
      coins: 0,
      day: 1,
      rank: { level: 1, xp: 0 },
      unlocked: { tea: C.cats.tea.startUnlocked, cake: C.cats.cake.startUnlocked },
      spawnMax: 1,
      orderSlots: 2,
      upgrades: { teaMenu: 0, cakeMenu: 0, spawn: 0, seat: 0 },
      tools: { delete: 2, swap: 0, refresh: 0 },
      reviveUsed: 0,
      muted: false,
      tutorialDone: {},
      best: 0,
      orders: [],
      ordersDone: 0,
      ordersTotal: C.days[0].orders,
      meta: {
        savedAt: 0, playSec: 0, served: 0,
        bestDay: 1, bestCoins: 0, launches: 0, merges: 0,
        phase: 'play',
      },
    };
  }

  /* ---- 介质可用性探测（只做一次） ---- */
  function probe() {
    const has = [];
    try {
      const k = '__probe__' + Date.now();
      localStorage.setItem(k, '1');
      if (localStorage.getItem(k) === '1') has.push('localStorage');
      localStorage.removeItem(k);
    } catch (e) { /* 被禁 */ }
    try {
      document.cookie = '__probe__=1; max-age=5; path=/; SameSite=Lax';
      if (/__probe__=1/.test(document.cookie)) {
        document.cookie = '__probe__=; max-age=0; path=/; SameSite=Lax';
        has.push('cookie');
      }
    } catch (e) { /* 被禁 */ }
    // 容器端能力：小红书小工具 Storage（9.46+）。在线文档将其列为推荐本地缓存，
    // 浏览器存储仅作降级兜底。存在即用，失败静默回退，不影响游戏。
    try {
      const mt = window.xhs && window.xhs.miniTool;
      if (mt && typeof mt.setStorage === 'function' && typeof mt.getStorage === 'function') {
        store.xhs = mt;
        has.push('xhsStorage');
      }
    } catch (e) {}
    store.channels = has;
    return has;
  }

  /* ---- 同步读：按通道优先级回捞 ---- */
  function readRawSync() {
    if (store.channels.indexOf('localStorage') >= 0) {
      try {
        const v = localStorage.getItem(SAVEKEY);
        if (v) return { raw: v, ch: 'localStorage' };
        for (const k of OLDKEYS) {           // v1 老存档迁移
          const old = localStorage.getItem(k);
          if (old) return { raw: old, ch: 'localStorage', legacy: k };
        }
      } catch (e) {}
    }
    if (store.channels.indexOf('cookie') >= 0) {
      try {
        const m = document.cookie.match(/(?:^|;\s*)bubu_mt2=([^;]*)/);
        if (m) return { raw: decodeURIComponent(m[1]), ch: 'cookie' };
      } catch (e) {}
    }
    return { raw: '', ch: '' };
  }

  /* ---- 同步写：所有可用通道都写一遍 ---- */
  function writeRawSync(str) {
    let ok = '', reason = '';
    if (store.channels.indexOf('localStorage') >= 0) {
      try { localStorage.setItem(SAVEKEY, str); ok = 'localStorage'; } catch (e) { reason = e && e.name || 'setItem 失败'; }
    }
    if (store.channels.indexOf('cookie') >= 0) {
      try {
        // cookie 有 ~4KB 上限，存档一般 1KB 内；超了就放弃这条通道而不是静默截断
        if (encodeURIComponent(str).length < 3800) {
          document.cookie = 'bubu_mt2=' + encodeURIComponent(str) + '; max-age=315360000; path=/; SameSite=Lax';
          ok = ok || 'cookie';
        }
      } catch (e) { reason = reason || (e && e.name) || 'cookie 失败'; }
    }
    store.lastWrite = ok;
    store.lastChannel = ok;
    store.lastError = ok ? '' : reason;
    return { ok: !!ok, channel: ok, error: reason };
  }

  /* ---- 异步兜底：IndexedDB ---- */
  function idbOpen() {
    return new Promise(res => {
      if (store.idb) return res(store.idb);
      let req;
      try { req = indexedDB.open(IDB.db, 1); } catch (e) { return res(null); }
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore(IDB.os); } catch (e) {}
      };
      req.onsuccess = () => { store.idb = req.result; res(store.idb); };
      req.onerror = () => res(null);
      req.onblocked = () => res(null);
    });
  }
  async function idbWrite(str) {
    const db = await idbOpen();
    if (!db) return false;
    try {
      await new Promise(res => {
        const tx = db.transaction(IDB.os, 'readwrite');
        tx.objectStore(IDB.os).put(str, IDB.key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
        tx.onabort = () => res(false);
      });
      if (store.channels.indexOf('IndexedDB') < 0) store.channels.push('IndexedDB');
      return true;
    } catch (e) { return false; }
  }
  async function idbRead() {
    const db = await idbOpen();
    if (!db) return '';
    try {
      return await new Promise(res => {
        const tx = db.transaction(IDB.os, 'readonly');
        const r = tx.objectStore(IDB.os).get(IDB.key);
        r.onsuccess = () => res(r.result || '');
        r.onerror = () => res('');
      });
    } catch (e) { return ''; }
  }

  /* ---- 容器端能力：小红书小工具 Storage（9.46+） ---- */
  async function xhsWrite(str) {
    if (!store.xhs) return false;
    try { await store.xhs.setStorage({ key: SAVEKEY, data: str }); return true; }
    catch (e) { return false; }
  }
  async function xhsRead() {
    if (!store.xhs) return '';
    try {
      const r = await store.xhs.getStorage({ key: SAVEKEY });
      return (r && typeof r.data === 'string') ? r.data : '';
    } catch (e) { return ''; }
  }

  /* ---- 读档：把任意来源的 raw 归一化成合法 state ---- */
  function parse(raw) {
    const d = JSON.parse(raw);
    const base = defaults();
    if (d.meta) base.meta = Object.assign(base.meta, d.meta);
    const s = Object.assign(base, d, {
      ver: SAVEVER,
      rank: Object.assign(base.rank, d.rank),
      unlocked: Object.assign(base.unlocked, d.unlocked),
      upgrades: Object.assign(base.upgrades, d.upgrades),
      tools: Object.assign(base.tools, d.tools),
      tutorialDone: d.tutorialDone || {},
      orders: Array.isArray(d.orders) ? d.orders : [],
      meta: base.meta,
    });
    s.day = Math.max(1, Math.min(999, Math.round(Number(s.day)) || 1));
    s.coins = Math.max(0, Math.round(Number(s.coins)) || 0);
    s.unlocked.tea = Math.max(0, Math.min(C.tea.length, Math.round(Number(s.unlocked.tea)) || 0));
    s.unlocked.cake = Math.max(0, Math.min(C.cake.length, Math.round(Number(s.unlocked.cake)) || 0));
    return s;
  }

  function load() {
    probe();
    const r = readRawSync();
    if (r.raw) {
      try {
        const s = parse(r.raw);
        s._from = r.ch;
        s._resumed = !!(s.meta && s.meta.savedAt);
        return s;
      } catch (e) { /* 坏档，落到 defaults */ }
      store.lastError = '存档损坏，已重来';
    }
    const s = defaults();
    s._from = '';
    s._resumed = false;
    return s;
  }

  /* ---- 写档：节流 + 全通道 + 记录结果 ---- */
  let saveTimer = 0, savePending = false, lastSaveAt = 0;
  function nowSec() { return Math.round(Date.now() / 1000); }

  function save(force) {
    if (typeof S !== 'object' || !S) return false;
    const t = Date.now();
    if (!force && t - lastSaveAt < 400) {           // 400ms 内的连续调用合并
      if (!savePending) { savePending = true; clearTimeout(saveTimer); saveTimer = setTimeout(() => { savePending = false; save(true); }, 400); }
      return !!store.lastWrite;
    }
    lastSaveAt = t;
    if (!S.meta) S.meta = defaults().meta;
    S.meta.savedAt = nowSec();
    S.meta.ver = SAVEVER;
    S.meta.phase = S.phase || 'play';
    S.ver = SAVEVER;
    let str;
    try { str = JSON.stringify(S); } catch (e) { return false; }
    const w = writeRawSync(str);
    store.lastSaveOk = w.ok;
    if (w.ok) idbWrite(str);                        // 异步再兜一层，失败也不影响游戏
    if (store.xhs) xhsWrite(str);                   // 容器内优先落到推荐的小工具 Storage
    // 本地通道全挂、但有容器 Storage 时，不要误报「本机存不了档」
    if (!w.ok && store.xhs) { store.lastChannel = 'xhsStorage'; store.lastError = ''; }
    return w.ok || !!store.xhs;
  }

  /* 页面隐藏/关闭前最后一存（手机切后台也覆盖到） */
  function flushSave() {
    if (savePending) { clearTimeout(saveTimer); savePending = false; }
    save(true);
  }
  /* ---------------- 布局 ---------------- */
  // 上一次布局用到的视口尺寸：容器（小红书小工具外壳 / 系统栏弹出）会在动画期间
  // 连续抛 resize，每次重排都会重建画布，旧画布被清空的瞬间就是一次「闪屏」。
  let lastVW = 0, lastVH = 0;

  function layout(force) {
    // 用 #viewport 的尺寸而不是 window，这样能算进刘海/手势条安全区
    const vp = document.getElementById('viewport');
    const vw = vp ? vp.clientWidth : window.innerWidth;
    const vh = vp ? vp.clientHeight : window.innerHeight;
    if (!vw || !vh) return;
    // 高度抖动 4px 以内不动（安卓地址栏/手势条的像素级抖动），避免反复重烘焙场景
    if (!force && vw === lastVW && Math.abs(vh - lastVH) <= 4 && cv && cv.width) return;
    lastVW = vw; lastVH = vh;
    const s = Math.min(vw / C.design.w, vh / C.design.baseH);
    L.scale = s;
    L.W = C.design.w;
    // 设计高度按屏幕比例自适应；上限放到 2800（约 21:9）以覆盖全部手机，
    // 避免像 390x844 这种比例被截断后上下露出深色空隙
    L.H = Math.max(C.design.baseH, Math.min(2800, Math.round(vh / s)));

    stage.style.width = L.W + 'px';
    stage.style.height = L.H + 'px';
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    stage.style.left = '50%';
    stage.style.top = '50%';

    const extra = L.H - C.design.baseH;
    const top = C.table.topBase + extra * 0.5;
    L.table = { x: C.table.x, y: top, w: C.table.w, h: C.table.h };
    L.failY = L.table.y + L.table.h - C.fail.lineOffset;
    L.previewY = L.table.y + L.table.h - C.launch.previewLift;
    L.ordersY = 166;
    L.bottomY = L.H - 312;

    // ---- 画布后备缓冲：只按「屏幕真实像素」渲染 ----
    // 旧写法 cv.width = 1080 * dpr(最多 2)。iPhone/安卓高刷机 s≈0.36 时
    // 设计高 2340 → 画布高 4680px，已经超过安卓 GPU 单纹理上限
    // （GL_MAX_TEXTURE_SIZE 常见 4096，低端机只有 2048）。装不下的纹理会被
    // 拆块/每帧重新上传，表现就是整屏图块错位、持续闪烁；两块 40MB 的位图
    // 还会把内存挤爆，合成层 tiles 被丢弃后同样表现为局部闪白。
    // 现在 px = s * dpr，即「设计像素 → 屏幕物理像素」，画布正好等于屏幕分辨率，
    // 各边再压到 4096 以内、总面积压到 4.2M 像素以内。
    const dev = window.devicePixelRatio || 1;
    const MAX_DIM = 4096, MAX_AREA = 4200000;
    let px = s * dev;
    px = Math.min(px, MAX_DIM / L.W, MAX_DIM / L.H, Math.sqrt(MAX_AREA / (L.W * L.H)));
    px = Math.max(px, 0.3);
    L.px = px;
    cv.width = Math.round(L.W * px);
    cv.height = Math.round(L.H * px);
    cv.style.width = L.W + 'px';
    cv.style.height = L.H + 'px';
    // 实际变换系数（取整后可能与 px 有极小偏差，以真实值反算，避免缩放糊 0.5px）
    L.px = cv.width / L.W;

    scene = Art.buildScene(L);
    const cl = document.getElementById('orders');
    if (cl) cl.style.top = L.ordersY + 'px';
    const bt = document.getElementById('bottom');
    if (bt) bt.style.top = L.bottomY + 'px';
    if (window.UI) UI.layout(L);
  }

  function resize() {
    layout();
    if (window.UI) UI.layout(L);
    render();
  }

  // resize 用 rAF 合并：一次尺寸变化可能连抛十几个事件，
  // 逐个处理会反复重置画布（每次重置 = 一次闪屏）+ 反复重烘焙场景
  let rzQueued = 0;
  function requestResize() {
    if (rzQueued) return;
    rzQueued = requestAnimationFrame(() => { rzQueued = 0; resize(); });
  }

  /* ---------------- 工具函数 ---------------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function tierInfo(cat, tier) {
    return C.cats[cat].tiers[tier - 1];
  }
  function unlockedOf(cat) { return S.unlocked[cat]; }
  function nextTierOf(cat, tier) {
    const t = Math.round(Number(tier)) || 0;
    const un = unlockedOf(cat) || 0;
    return t > 0 && t < un ? t + 1 : 0;
  }

  /* ---------------- 发射队列 ---------------- */
  function spawnPool(cat) {
    const n = Math.min(S.spawnMax, unlockedOf(cat));
    const out = [];
    for (let i = 1; i <= Math.max(1, n); i++) out.push(i);
    return out;
  }
  function rollItem(cat) {
    const pool = spawnPool(cat);
    return { cat, tier: pick(pool) };
  }
  function ensureQueue() {
    if (!S.queue) S.queue = {};
    ['tea', 'cake'].forEach(cat => {
      if (unlockedOf(cat) <= 0) return;
      const q = S.queue[cat];
      if (!q || !q.cur || q.cur > unlockedOf(cat)) {
        S.queue[cat] = { cur: 1, next: pick(spawnPool(cat)) };
      }
    });
    if (!S.queue[S.cat]) S.cat = unlockedOf('tea') > 0 ? 'tea' : 'cake';
  }

  /* ---------------- 通知 UI ---------------- */
  function sync() {
    if (window.UI) UI.render(view());
    if (window.UI) UI.layout(L);
  }

  function view() {
    const d = dayCfg();
    return {
      coins: S.coins,
      day: S.day,
      cat: S.cat,
      rank: { ...S.rank, need: E.rankBaseXp + (S.rank.level - 1) * E.rankStepXp },
      ordersDone: S.ordersDone,
      slots: S.orderSlots,
      ordersTotal: S.ordersTotal || d.orders,
      orders: S.orders.map(o => {
        const counts = availableCounts();
        const items = o.items.map(it => ({
          cat: it.cat, tier: it.tier,
          count: it.count,
          have: Math.min(it.count, counts[it.cat + it.tier] || 0),
        }));
        return {
          id: o.id, items, reward: o.reward, ready: o.ready,
          cus: o.cus, free: o.free,
        };
      }),
      menu: {
        tea: menuView('tea'), cake: menuView('cake'),
      },
      tools: C.tools.map(t => ({
        id: t.id, name: t.name, sub: t.sub,
        charges: S.tools[t.id] || 0,
        unlocked: S.day >= t.unlockDay,
        needDay: t.unlockDay,
        active: S.tool === t.id,
        price: t.price,
      })),
      queue: S.queue ? {
        cur: S.queue[S.cat] ? S.queue[S.cat].cur : 1,
        next: S.queue[S.cat] ? S.queue[S.cat].next : 1,
        cat: S.cat,
      } : null,
      phase: S.phase,
      upgrades: C.upgrades.map(u => {
        const lv = S.upgrades[u.id] || 0;
        const max = u.levels.length;
        const price = lv < max ? u.levels[lv].price : 0;
        return {
          id: u.id, name: u.name, desc: u.desc, icon: u.icon,
          lv, max, price, soldOut: lv >= max,
          afford: S.coins >= price,
          effect: upgradeEffectText(u.id, lv),
        };
      }),
      muted: S.muted,
      tip: S.tip || null,
    };
  }

  function upgradeEffectText(id, lv) {
    if (id === 'teaMenu' || id === 'cakeMenu') {
      const cat = id === 'teaMenu' ? 'tea' : 'cake';
      const cur = unlockedOf(cat), max = C.cats[cat].tiers.length;
      if (cur >= max) return `已解锁全部 ${max} 阶`;
      // 直接把「赚钱能力提升」量化给玩家看，避免花钱买了个寂寞
      const nm = tierInfo(cat, cur).name, nname = tierInfo(cat, cur + 1).name;
      const v0 = C.itemValue(cur), v1 = C.itemValue(cur + 1);
      return `${nm} <i class="coin"></i>${v0} → ${nname} <i class="coin"></i>${v1}`;
    }
    if (id === 'spawn') return `发射随机档数 ${Math.min(S.spawnMax, 3)}`;
    if (id === 'seat') return `同时挂单 ${S.orderSlots}`;
    return '';
  }

  function menuView(cat) {
    const max = C.cats[cat].tiers.length;
    const un = unlockedOf(cat);
    return {
      name: C.cats[cat].name,
      tabName: C.cats[cat].tabName || C.cats[cat].name,
      items: C.cats[cat].tiers.map((t, i) => ({
        tier: i + 1, unlocked: i + 1 <= un, name: t.name,
        icon: i + 1 <= un ? Art.icon(cat, i + 1) : '',
      })),
      canSwitch: un > 0,
      active: S.cat === cat,
    };
  }

  /* ---------------- 桌面物品 ---------------- */
  function addBody(cat, tier, x, y, vx, vy, launched) {
    const list = (C.cats[cat] || {}).tiers || [];
    const t = Math.max(1, Math.min(list.length, Math.round(Number(tier)) || 1));
    const info = tierInfo(cat, t);
    if (!info) return null;
    tier = t;
    const b = {
      id: ids++, cat, tier, r: info.r,
      x, y, vx: vx || 0, vy: vy || 0,
      dead: false, merging: false, launched: launched !== false,
      pop: 0, born: performance.now(), spin: rnd(-0.05, 0.05),
      sound: 0,
    };
    bodies.push(b);
    return b;
  }

  function removeBody(b) {
    b.dead = true;
  }

  function availableCounts() {
    const c = {};
    for (const b of bodies) {
      if (b.dead || b.merging) continue;
      const k = b.cat + b.tier;
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }

  /* ---------------- 物理 ---------------- */
  function bounds() {
    const t = L.table, inset = C.table.wallInset;
    return {
      left: t.x + inset, right: t.x + t.w - inset,
      top: t.y + inset, bottom: t.y + t.h - inset,
    };
  }

  function stepPhysics(dt) {
    const B = bounds();
    const alive = bodies.filter(b => !b.dead && !b.merging);
    const g = C.phys.gravity;

    for (const b of alive) {
      b.vy -= g * dt;                       // 重力朝远端（屏幕上方）
      const damp = 1 - C.phys.damping * dt;
      b.vx *= damp; b.vy *= damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > C.phys.maxSpeed) {
        b.vx *= C.phys.maxSpeed / sp; b.vy *= C.phys.maxSpeed / sp;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 墙
      if (b.x - b.r < B.left) { b.x = B.left + b.r; b.vx = Math.abs(b.vx) * C.phys.wallRestitution; }
      if (b.x + b.r > B.right) { b.x = B.right - b.r; b.vx = -Math.abs(b.vx) * C.phys.wallRestitution; }
      if (b.y - b.r < B.top) { b.y = B.top + b.r; b.vy = Math.abs(b.vy) * C.phys.wallRestitution; }
      if (b.y + b.r > B.bottom) { b.y = B.bottom - b.r; b.vy = -Math.abs(b.vy) * C.phys.wallRestitution; }
    }

    // 同档吸附：让相同物品主动靠拢，合成更跟手
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      if (a.merging) continue;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j];
        if (b.merging || a.cat !== b.cat || a.tier !== b.tier) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const rs = a.r + b.r;
        if (d > rs * 1.7 || d < 1) continue;
        const pull = 620 * (1 - (d - rs) / (rs * 0.7));
        if (pull <= 0) continue;
        const nx = dx / d, ny = dy / d;
        a.vx += nx * pull * dt; a.vy += ny * pull * dt;
        b.vx -= nx * pull * dt; b.vy -= ny * pull * dt;
      }
    }

    // 两两求解
    const merges = [];
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < alive.length; i++) {
        const a = alive[i];
        for (let j = i + 1; j < alive.length; j++) {
          const b = alive[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          const rs = a.r + b.r;
          if (d2 >= rs * rs || d2 === 0) continue;
          let d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const pen = rs - d;

          // 可合成？
          if (iter === 0 && a.cat === b.cat && a.tier === b.tier && !a.merging && !b.merging) {
            const nt = nextTierOf(a.cat, a.tier);
            if (nt && d < rs - 1.2) {
              merges.push([a, b]);
              a.merging = b.merging = true;
              continue;
            }
          }

          const im1 = 1 / (a.r * a.r), im2 = 1 / (b.r * b.r);
          const imSum = im1 + im2;
          // 位置修正
          const corr = pen * 0.86;
          a.x -= nx * corr * (im1 / imSum);
          a.y -= ny * corr * (im1 / imSum);
          b.x += nx * corr * (im2 / imSum);
          b.y += ny * corr * (im2 / imSum);

          // 冲量
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const e = C.phys.restitution;
            const jn = -(1 + e) * vn / imSum;
            a.vx -= nx * jn * im1; a.vy -= ny * jn * im1;
            b.vx += nx * jn * im2; b.vy += ny * jn * im2;

            // 摩擦
            const tx = -ny, ty = nx;
            const vt = rvx * tx + rvy * ty;
            const jt = Math.max(-Math.abs(jn) * C.phys.friction, Math.min(Math.abs(jn) * C.phys.friction, -vt / imSum));
            a.vx -= tx * jt * im1; a.vy -= ty * jt * im1;
            b.vx += tx * jt * im2; b.vy += ty * jt * im2;

            if (Math.abs(vn) > 420 && performance.now() - landSndT > 60) {
              landSndT = performance.now();
              Sfx.land();
            }
          }
        }
      }
    }

    // 处理合成
    for (const [a, b] of merges) {
      if (a.dead || b.dead) continue;
      doMerge(a, b);
    }
  }

  function doMerge(a, b) {
    const cp = Math.cos(Math.PI * 0), k = 0.5;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const vx = (a.vx + b.vx) / 2, vy = (a.vy + b.vy) / 2;
    const nt = nextTierOf(a.cat, a.tier);
    const cat = a.cat, tier = a.tier;

    removeBody(a); removeBody(b);
    ghosts.push({ cat, tier, x: a.x, y: a.y, t: 0 });
    ghosts.push({ cat, tier, x: b.x, y: b.y, t: 0 });

    // 粒子
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2, sp = rnd(60, 260);
      parts.push({
        x: mx, y: my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.5, max: 0.5, r: rnd(3, 8),
        col: i % 2 ? '#fff3d0' : '#ffd88a',
      });
    }

    const nb = addBody(cat, nt, mx, my, vx, vy, true);
    if (!nb) {
      // 档位异常（存档损坏等）：把原物品还回去，别让它们凭空消失
      addBody(cat, tier, a.x, a.y, vx, vy, true);
      addBody(cat, tier, b.x, b.y, -vx, -vy, true);
      return;
    }
    nb.pop = 1;
    // 横向推力：推离中线
    const centerX = L.table.x + L.table.w / 2;
    const dir = mx < centerX ? 1 : -1;
    nb.vx += dir * C.phys.mergeImpulse * 1.2;
    nb.vy -= 40;

    Sfx.merge(nt);
    if (S.meta) S.meta.merges = (S.meta.merges || 0) + 1;
    shake = Math.min(9, 3 + nt * 0.7);
    addFloat({ x: mx, y: my - 40, text: tierInfo(cat, nt).name, t: 0, life: 1.1, size: 30, col: '#7a4a22' });

    if (tierInfo(cat, nt).tier === unlockedOf(cat)) {
      // 合成了当前最高阶
      addFloat({ x: mx, y: my - 82, text: '已到顶阶！去研发更高档', t: 0, life: 1.7, size: 26, col: '#8a4718' }, 3.2);
    }
    checkOrders();
    if (window.UI) UI.hintOnce('merge', '两个一样的叠在一起，就会合成更高一档');
  }

  /* ---------------- 订单 ---------------- */
  function dayCfg() {
    const idx = Math.min(S.day, C.days.length) - 1;
    return C.days[idx];
  }

  function orderPool() {
    const d = dayCfg();
    const pool = [];
    ['tea', 'cake'].forEach(cat => {
      const un = unlockedOf(cat);
      if (un <= 0) return;
      if (d.onlyCat && d.onlyCat !== cat) return;
      const from = Math.max(1, un - (d.lastTypes - 1));
      for (let tier = from; tier <= un; tier++) pool.push({ cat, tier });
    });
    return pool;
  }

  function pickWeighted(pool, lowW, prev) {
    if (!pool.length) return null;
    let minL = 99, maxL = 0;
    pool.forEach(p => { minL = Math.min(minL, p.tier); maxL = Math.max(maxL, p.tier); });
    const weights = pool.map(p => {
      const prog = maxL > minL ? (maxL - p.tier) / (maxL - minL) : 0;
      return 1 + (lowW - 1) * prog;
    });
    let total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function makeOrder() {
    const d = dayCfg();
    const n = Math.floor(rnd(d.min, d.max + 1));
    const pool = orderPool();
    if (!pool.length) return null;
    const items = [];
    for (let i = 0; i < n; i++) {
      const p = pickWeighted(pool, d.lowWeight);
      if (!p) continue;
      const found = items.find(it => it.cat === p.cat && it.tier === p.tier);
      if (found) found.count++;
      else items.push({ cat: p.cat, tier: p.tier, count: 1 });
    }
    if (!items.length) return null;
    const reward = items.reduce((s, it) => s + it.count * C.itemValue(it.tier), 0);
    return {
      id: ids++,
      items, reward, ready: false,
      cus: pickCus(),
      free: false,
    };
  }

  // 随机挑一位顾客形象：保证与「当前已挂出的订单」不重复（同屏不会同时出现两个一样的形象）。
  // 槽位数最多 3、形象有 10 种，池子不会空；真空了就退化为纯随机。
  function pickCus() {
    const n = C.customers.length;
    const used = new Set((S.orders || []).map(o => o.cus));
    const pool = [];
    for (let i = 0; i < n; i++) if (!used.has(i)) pool.push(i);
    if (!pool.length) return Math.floor(Math.random() * n);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function fillOrders() {
    while (S.orders.length < S.orderSlots && S.ordersDone + S.orders.length < S.ordersTotal) {
      let o = null;
      // 第 2 天的指定首单
      const d = dayCfg();
      if (d.fixed && S.orders.length === 0 && S.ordersDone < d.fixed.length) {
        const f = d.fixed[S.ordersDone];
        o = {
          id: ids++, items: [{ cat: f.cat, tier: f.tier, count: 1 }],
          reward: C.itemValue(f.tier), ready: false,
          cus: pickCus(), free: false,
        };
      } else {
        o = makeOrder();
      }
      if (!o) break;
      S.orders.push(o);
    }
    checkOrders(true);
  }

  function checkOrders(silent) {
    const counts = availableCounts();
    let changed = false;
    for (const o of S.orders) {
      const ok = o.items.every(it => (counts[it.cat + it.tier] || 0) >= it.count);
      if (ok !== o.ready) { o.ready = ok; changed = true; }
    }
    if (changed && !silent) {
      if (S.orders.some(o => o.ready)) Sfx.tap();
      sync();
    }
    if (changed && window.UI && S.orders.some(o => o.ready)) {
      UI.hintOnce('order', '顾客要的东西齐了，点它的卡片交货');
    }
  }

  function serve(orderId) {
    if (S.phase !== 'play') return;
    const o = S.orders.find(x => x.id === orderId);
    if (!o || !o.ready) { Sfx.deny(); return; }

    // 找出要消耗的物品
    const used = [];
    for (const it of o.items) {
      let need = it.count;
      const list = bodies.filter(b => !b.dead && !b.merging && b.cat === it.cat && b.tier === it.tier && !used.includes(b));
      for (const b of list) {
        if (need <= 0) break;
        used.push(b); need--;
      }
    }
    const cardPos = UI.cardCenter(o.id);
    used.forEach((b, i) => {
      flyers.push({
        cat: b.cat, tier: b.tier, r: b.r,
        x: b.x, y: b.y,
        x0: b.x, y0: b.y,
        tx: cardPos ? cardPos.x : L.W / 2,
        ty: cardPos ? cardPos.y : 120,
        t: 0, dur: 0.42 + i * 0.04,
      });
      removeBody(b);
    });

    S.coins += o.reward;
    S.rank.xp += E.orderXp;
    S.ordersDone++;
    if (S.meta) {
      S.meta.served = (S.meta.served || 0) + 1;
      S.meta.bestCoins = Math.max(S.meta.bestCoins || 0, S.coins);
    }
    addFloat({
      x: L.W / 2, y: L.ordersY + 240, text: '+' + o.reward,
      t: 0, life: 1.2, size: 46, col: '#e08a1e', coin: true,
    });
    Sfx.order();
    rankCheck();

    const idx = S.orders.indexOf(o);
    if (idx >= 0) S.orders.splice(idx, 1);
    fillOrders();
    save();
    sync();

    if (S.ordersDone >= S.ordersTotal) {
      completeDay();
    }
  }

  function rankCheck() {
    let up = 0;
    while (S.rank.xp >= E.rankBaseXp + (S.rank.level - 1) * E.rankStepXp) {
      S.rank.xp -= E.rankBaseXp + (S.rank.level - 1) * E.rankStepXp;
      S.rank.level++;
      up++;
    }
    if (up > 0) {
      const bonus = E.rankCoinPerLevel * S.rank.level;
      S.coins += bonus;
      addFloat({
        x: L.W / 2, y: L.H * 0.42, text: `奶茶铺 ${S.rank.level} 级  +${bonus}`, t: 0, life: 2.0, size: 44, col: '#b0621f',
      });
      Sfx.day();
    }
  }

  function completeDay() {
    S.phase = 'day';
    if (S.meta) {
      S.meta.bestDay = Math.max(S.meta.bestDay || 1, S.day);
      S.meta.bestCoins = Math.max(S.meta.bestCoins || 0, S.coins);
    }
    Sfx.day();
    save(true);
    sync();
    UI.showDayComplete({
      day: S.day,
      coins: S.coins,
      rank: S.rank.level,
    });
  }

  function nextDay() {
    S.day++;
    S.ordersDone = 0;
    S.ordersTotal = dayCfg().orders;
    S.orders = [];
    bodies = []; ghosts = []; flyers = []; parts = []; floats = [];
    S.phase = 'play';
    S.tool = null;
    S.reviveUsed = 0;
    if (S.meta) S.meta.bestDay = Math.max(S.meta.bestDay || 1, S.day);
    ensureQueue();
    fillOrders();
    save(true);
    sync();
  }

  /* ---------------- 失败 ---------------- */
  function failTick(dt) {
    if (S.phase !== 'play') return;
    let danger = 0;
    const B = bounds();
    for (const b of bodies) {
      if (b.dead || b.merging) continue;
      if (b.y + b.r > L.failY + 4) {
        b.danger = (b.danger || 0) + dt;
        if (b.danger > C.fail.highlight) danger = Math.max(danger, 1);
        if (b.danger > C.fail.grace) {
          lose();
          return;
        }
      } else {
        b.danger = 0;
      }
    }
    S.danger = danger;
  }

  function lose() {
    S.phase = 'fail';
    Sfx.fail();
    shake = 14;
    save();
    sync();
    UI.showFail({ day: S.day, coins: S.coins, cost: reviveCost(), freeRevive: S.reviveUsed === 0 });
  }

  function reviveCost() {
    return S.reviveUsed === 0 ? 0 : E.reviveCost;
  }

  function revive() {
    const cost = reviveCost();
    if (cost > S.coins) { Sfx.deny(); return false; }
    S.coins -= cost;
    S.reviveUsed++;
    // 删除危险区物品
    for (const b of bodies) {
      if (b.dead || b.merging) continue;
      if (b.y + b.r > L.failY - C.fail.reviveMargin) {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * 6.28;
          parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 0.45, max: 0.45, r: 7, col: '#ffe0a0' });
        }
        removeBody(b);
      }
    }
    bodies = bodies.filter(b => !b.dead);
    bodies.forEach(b => b.danger = 0);
    S.phase = 'play';
    save();
    sync();
    return true;
  }

  function retryDay() {
    bodies = []; ghosts = []; flyers = []; parts = []; floats = [];
    S.ordersDone = 0;
    S.ordersTotal = dayCfg().orders;
    S.orders = [];
    S.phase = 'play';
    S.tool = null;
    S.reviveUsed = 0;
    ensureQueue();
    fillOrders();
    save();
    sync();
  }

  /* ---------------- 工具 ---------------- */
  function startTool(id) {
    const t = C.tools.find(x => x.id === id);
    if (!t) return;
    if (S.day < t.unlockDay) { Sfx.deny(); UI.toast(`第 ${t.unlockDay} 天解锁`); return; }
    if ((S.tools[id] || 0) <= 0) {
      if (S.coins >= t.price) {
        S.coins -= t.price;
        S.tools[id] = (S.tools[id] || 0) + t.charges;
        Sfx.buy();
        save();
      } else {
        Sfx.deny(); UI.toast('金币不够啦');
        return;
      }
    }
    if (S.tool === id) { S.tool = null; S.toolPick = []; }
    else { S.tool = id; S.toolPick = []; }
    if (id === 'refresh') {
      useRefresh();
      S.tool = null;
    }
    if (S.tool === 'delete') UI.toast('点一个物品把它清走');
    if (S.tool === 'swap') UI.toast('依次点两个物品交换位置');
    sync();
  }

  function useRefresh() {
    if (S.phase !== 'play' || !S.orders.length) return;
    S.tools.refresh = Math.max(0, (S.tools.refresh || 0) - 1);
    const o = { ...makeOrder(), id: ids++ };
    if (o) { S.orders[0] = o; }
    Sfx.coin();
    save(); sync();
  }

  function bodyAt(x, y) {
    let best = null, bd = 1e9;
    for (const b of bodies) {
      if (b.dead || b.merging) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < b.r * 1.15 && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function toolTap(x, y) {
    if (S.tool === 'delete') {
      const b = bodyAt(x, y);
      if (!b) return;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * 6.28, sp = rnd(80, 320);
        parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, r: rnd(3, 9), col: '#ffd6a0' });
      }
      removeBody(b);
      bodies = bodies.filter(x2 => !x2.dead);
      S.tools.delete--;
      S.tool = null;
      Sfx.buy();
      save(); sync();
    } else if (S.tool === 'swap') {
      const b = bodyAt(x, y);
      if (!b) return;
      if (S.toolPick.includes(b)) { S.toolPick = []; sync(); return; }
      S.toolPick.push(b);
      Sfx.tap();
      if (S.toolPick.length === 2) {
        const [a, c] = S.toolPick;
        const ax = a.x, ay = a.y;
        a.x = c.x; a.y = c.y; c.x = ax; c.y = ay;
        const avx = a.vx, avy = a.vy;
        a.vx = c.vx; a.vy = c.vy; c.vx = avx; c.vy = avy;
        S.tools.swap--;
        S.tool = null; S.toolPick = [];
        Sfx.buy();
        save();
      }
      sync();
    }
  }

  /* ---------------- 升级 ---------------- */
  function buyUpgrade(id) {
    const u = C.upgrades.find(x => x.id === id);
    if (!u) return;
    const lv = S.upgrades[id] || 0;
    if (lv >= u.levels.length) { Sfx.deny(); return; }
    const price = u.levels[lv].price;
    if (S.coins < price) { Sfx.deny(); UI.toast('金币不够啦'); return; }
    S.coins -= price;
    S.upgrades[id] = lv + 1;

    if (id === 'teaMenu' || id === 'cakeMenu') {
      const cat = id === 'teaMenu' ? 'tea' : 'cake';
      if (S.unlocked[cat] < C.cats[cat].tiers.length) S.unlocked[cat]++;
    } else if (id === 'spawn') {
      S.spawnMax = Math.min(3, S.spawnMax + 1);
    } else if (id === 'seat') {
      S.orderSlots = 3;
    }
    ensureQueue();
    fillOrders();
    Sfx.buy();
    save();
    sync();
  }

  /* ---------------- 输入 ---------------- */
  function pointerPos(e) {
    const rect = stage.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / L.scale,
      y: (e.clientY - rect.top) / L.scale,
    };
  }

  function clampAim(x) {
    const cat = S.cat, tier = S.queue[cat] ? S.queue[cat].cur : 1;
    const r = tierInfo(cat, tier).r;
    const B = bounds();
    return Math.max(B.left + r, Math.min(B.right - r, x));
  }

  function onDown(e) {
    if (!running) return;
    Sfx.init();
    const p = pointerPos(e);
    if (p.y < L.table.y - 40) return;
    if (S.phase !== 'play') return;
    if (S.tool) { toolTap(p.x, p.y); return; }
    aim.active = true;
    aim.x = clampAim(p.x);
  }
  function onMove(e) {
    if (!aim.active) return;
    const p = pointerPos(e);
    aim.x = clampAim(p.x);
  }
  function onUp(e) {
    if (!aim.active) return;
    aim.active = false;
    const p = pointerPos(e);
    aim.x = clampAim(p.x);
    launch();
  }

  function launch() {
    if (S.phase !== 'play') return;
    if (aim.cooldown > 0) return;
    const cat = S.cat;
    const q = S.queue[cat];
    if (!q) return;
    const tier = q.cur;
    const r = tierInfo(cat, tier).r;
    addBody(cat, tier, aim.x, L.previewY - 6, 0, -C.launch.speed, true);
    Sfx.launch();
    if (S.meta) S.meta.launches = (S.meta.launches || 0) + 1;
    q.cur = q.next;
    q.next = pick(spawnPool(cat));
    aim.cooldown = C.launch.cooldown;
    // 轻微后坐
    shake = Math.max(shake, 2.5);
    save();
    sync();
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!ctx) return;
    const px = L.px;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    // scene 是全幅不透明的背景层，直接盖满即可；
    // 省掉每帧一次全画布 clearRect，少一遍几十 MB 的位图写入
    ctx.save();
    if (shake > 0.2) {
      ctx.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5);
    }
    if (scene) ctx.drawImage(scene, 0, 0, L.W, L.H);
    else ctx.clearRect(0, 0, L.W, L.H);

    drawFailZone();
    if (S.phase === 'play' && !S.tool) drawAimGuide();

    // 物品：按深度排序，逐个「接触阴影 → 本体」
    // 阴影跟随排序、画在本体之前，因此会正确落在更远的物品上，堆叠才有体积感
    const sorted = bodies.filter(b => !b.dead).sort((a, b) => a.y - b.y);
    const tb = L.table;
    const shSpr = Art.shadow();
    const nowMs = performance.now();

    for (const b of sorted) {
      const sp = Art.soul(b.cat, b.tier);
      if (!sp) continue;

      const pop = b.pop > 0 ? 1 + Math.sin(b.pop * Math.PI) * 0.18 * b.pop : 1;
      // 伪透视：远端 1.0 → 近端 1 + depthScale（只调尺寸，不动位置，相切不受影响）
      const dz = Math.max(0, Math.min(1, (b.y - tb.y) / tb.h));
      const dScale = 1 + C.phys.depthScale * dz;
      const size = sp.size * pop * dScale;
      const r = b.r * pop;

      if (shSpr) {
        ctx.save();
        // 外投影：淡、范围略大
        ctx.globalAlpha = 0.22;
        ctx.drawImage(shSpr, b.x - r * 1.00 + r * 0.12, b.y + r * 0.62, r * 2.00, r * 0.58);
        // 接触暗边：小而实，紧贴底部
        ctx.globalAlpha = 0.50;
        ctx.drawImage(shSpr, b.x - r * 0.62, b.y + r * 0.76, r * 1.24, r * 0.26);
        ctx.restore();
      }

      const isPick = S.toolPick && S.toolPick.includes(b);
      ctx.save();
      if (b.danger > C.fail.highlight) {
        ctx.globalAlpha = 0.75 + Math.sin(nowMs / 90) * 0.2;
        ctx.shadowColor = 'rgba(230,70,60,0.95)';
        ctx.shadowBlur = 34;
      } else if (isPick) {
        ctx.shadowColor = 'rgba(255,196,60,0.95)';
        ctx.shadowBlur = 30;
      }
      ctx.drawImage(sp.cv, b.x - size / 2, b.y - size / 2, size, size);
      ctx.restore();

      // 底部内阴影：本体与桌面的贴合暗部（压在本体之上才「坐实」）
      if (shSpr) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.drawImage(shSpr, b.x - r * 0.72, b.y + r * 0.66, r * 1.44, r * 0.30);
        ctx.restore();
      }
    }

    // 合成残影
    for (const g of ghosts) {
      const sp = Art.soul(g.cat, g.tier);
      const k = 1 - g.t / 0.32;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k) * 0.7;
      const size = sp.size * (0.9 + (1 - k) * 0.7);
      ctx.drawImage(sp.cv, g.x - size / 2, g.y - size / 2, size, size);
      ctx.restore();
    }

    // 瞄准线 + 预览
    if (S.phase === 'play' && !S.tool) drawAim();

    // 粒子
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 飞向订单的物品
    for (const f of flyers) {
      const k = Math.min(1, f.t / f.dur);
      const e = 1 - Math.pow(1 - k, 2.2);
      const x = f.x0 + (f.tx - f.x0) * e;
      const y = f.y0 + (f.ty - f.y0) * e - Math.sin(k * Math.PI) * 90;
      const sp = Art.soul(f.cat, f.tier);
      if (!sp) continue;
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, (k - 0.75) / 0.25);
      const size = sp.size * (1 - e * 0.55);
      ctx.drawImage(sp.cv, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }

    // 飘字
    for (const f of floats) {
      const k = f.t / f.life;
      ctx.save();
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : Math.max(0, 1 - Math.pow(k, 2.2));
      ctx.font = `800 ${f.size}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = f.size * 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(f.text, f.x, f.y - k * 62);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x, f.y - k * 62);
      ctx.restore();
    }

    // 危险闪边
    if (S.danger) {
      const a = 0.12 + Math.sin(performance.now() / 120) * 0.07;
      const gr = ctx.createLinearGradient(0, L.failY - 120, 0, L.table.y + L.table.h);
      gr.addColorStop(0, 'rgba(230,60,50,0)');
      gr.addColorStop(1, `rgba(230,60,50,${a + 0.12})`);
      ctx.fillStyle = gr;
      ctx.fillRect(L.table.x, L.failY - 120, L.table.w, L.table.h);
    }

    ctx.restore();
  }

  function drawFailZone() {
    const t = L.table;
    const y = L.failY;
    const x0 = t.x + 30, x1 = t.x + t.w - 30;
    const now = performance.now();

    // 危险区（越近越浓）
    const g = ctx.createLinearGradient(0, y, 0, t.y + t.h);
    g.addColorStop(0, S.danger ? 'rgba(226,70,60,0.15)' : 'rgba(226,70,60,0.06)');
    g.addColorStop(0.55, S.danger ? 'rgba(226,70,60,0.05)' : 'rgba(226,70,60,0.02)');
    g.addColorStop(1, 'rgba(226,70,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(t.x + 4, y, t.w - 8, t.y + t.h - y);

    // 刻痕：布面上压出的一道凹槽（上沿受光 → 槽身 → 槽底阴影）
    ctx.save();
    ctx.lineCap = 'butt';

    // 凹槽上沿：受光的布面凸起
    ctx.strokeStyle = 'rgba(255,250,236,0.72)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x0, y - 4);
    ctx.lineTo(x1, y - 4);
    ctx.stroke();

    // 槽身
    ctx.strokeStyle = S.danger ? 'rgba(214,54,42,0.95)' : 'rgba(168,92,64,0.74)';
    ctx.lineWidth = S.danger ? 8 : 5.5;
    if (S.danger) {
      ctx.shadowColor = 'rgba(232,62,50,0.9)';
      ctx.shadowBlur = 26 + Math.sin(now / 200) * 12;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    // 槽底阴影
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(96,58,28,0.30)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y + 2.5);
    ctx.lineTo(x1, y + 2.5);
    ctx.stroke();
    ctx.restore();

    // 两端缝点
    ctx.save();
    ctx.fillStyle = S.danger ? 'rgba(214,54,42,0.95)' : 'rgba(150,86,58,0.80)';
    ctx.beginPath();
    ctx.arc(x0, y - 1, S.danger ? 7 : 6, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x1, y - 1, S.danger ? 7 : 6, 0, 6.3);
    ctx.fill();
    ctx.restore();

    // 危险时：沿刻痕脉动的光带
    if (S.danger) {
      const k = 0.5 + Math.sin(now / 220) * 0.5;
      const pg = ctx.createLinearGradient(0, y - 28, 0, y + 28);
      pg.addColorStop(0, 'rgba(240,90,70,0)');
      pg.addColorStop(0.5, 'rgba(240,90,70,' + (0.14 + k * 0.16).toFixed(3) + ')');
      pg.addColorStop(1, 'rgba(240,90,70,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(x0 - 24, y - 28, x1 - x0 + 48, 56);
    }
  }

  // 瞄准导轨：画在物品之前，才会被物品正确遮挡（否则导轨会「划过」物品，破坏遮挡关系）
  function drawAimGuide() {
    const cat = S.cat;
    if (!S.queue[cat]) return;
    const r = tierInfo(cat, S.queue[cat].cur).r;
    const y = L.previewY;
    const t = L.table;

    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 26]);
    ctx.beginPath();
    ctx.moveTo(aim.x, y - r * 0.9);
    ctx.lineTo(aim.x, t.y + r + 26);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(aim.x, t.y + r + 34, r * 0.92, r * 0.26, 0, 0, 6.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawAim() {
    const cat = S.cat;
    if (!S.queue[cat]) return;
    const tier = S.queue[cat].cur;
    const sp = Art.soul(cat, tier);
    const r = tierInfo(cat, tier).r;
    const y = L.previewY;

    // 下一个：右侧小圆片
    const nsp = Art.soul(cat, S.queue[cat].next);
    if (nsp) {
      const side = aim.x > L.W / 2 ? -1 : 1;
      const nx = aim.x + side * (r + 96);
      const ny = y - r * 0.35;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(255,253,246,0.92)';
      ctx.beginPath();
      ctx.arc(nx, ny, 56, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(196,160,120,0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
      const s2 = nsp.size * 0.5;
      ctx.drawImage(nsp.cv, nx - s2 / 2, ny - s2 / 2, s2, s2);
      ctx.globalAlpha = 0.9;
      ctx.font = '700 24px "PingFang SC",system-ui,sans-serif';
      ctx.fillStyle = 'rgba(140,100,62,0.95)';
      ctx.textAlign = 'center';
      ctx.fillText('下一个', nx, ny + 96);
      ctx.restore();
    }

    // 预览物
    const bob = Math.sin(performance.now() / 460) * 3;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#5a3618';
    ctx.beginPath();
    ctx.ellipse(aim.x + 4, y + r * 0.88, r * 0.66, r * 0.17, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(sp.cv, aim.x - sp.size / 2, y - sp.size / 2 + bob, sp.size, sp.size);
  }

  /* ---------------- 主循环 ---------------- */
  function update(dt) {
    if (aim.cooldown > 0) aim.cooldown -= dt;
    shake *= 0.86;
    if (S.phase === 'play') {
      let rest = dt;
      while (rest > 0) {
        const d = Math.min(STEP, rest);
        stepPhysics(d);
        rest -= d;
      }
      bodies = bodies.filter(b => !b.dead);
    }
    failTick(dt);

    for (const g of ghosts) g.t += dt;
    ghosts = ghosts.filter(g => g.t < 0.34);
    for (const p of parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
    }
    parts = parts.filter(p => p.life > 0);
    for (const f of flyers) f.t += dt;
    flyers = flyers.filter(f => f.t < f.dur + 0.1);
    for (const f of floats) f.t += dt;
    floats = floats.filter(f => f.t < f.life);

    // pop 动画
    for (const b of bodies) {
      if (b.pop > 0) {
        b.pop -= dt * 4.2;
        if (b.pop < 0) b.pop = 0;
      }
    }
    checkOrders();
  }

  // 画面里是否还有会动的东西（决定要不要每帧重绘）
  function hasMotion() {
    return bodies.length > 0 || parts.length > 0 || ghosts.length > 0 ||
      flyers.length > 0 || floats.length > 0 || shake > 0.25 || aim.active ||
      S.phase !== 'play';
  }

  let lastPaint = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    // 静止时把重绘降到 ~30fps：安卓上每帧都要把整块画布重新上传合成，
    // 空转的 60fps 只是白烧带宽，还会放大合成抖动的观感
    if (hasMotion() || ts - lastPaint >= 32) {
      render();
      lastPaint = ts;
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    stage = document.getElementById('stage');
    cv = document.getElementById('cv');
    ctx = cv.getContext('2d');
    L = { W: 1080, H: 1920, scale: 1 };

    Art.build();
    // 兜底：logo 图若是异步后才加载完成，确保全部奶茶档最终都重烙一遍 LOGO
    setTimeout(() => { if (Art.rebakeLogos) Art.rebakeLogos(); }, 600);
    S = load();
    const resumed = S._resumed;
    const fromCh = S._from;
    delete S._from; delete S._resumed;

    S.cat = S.unlocked.tea > 0 ? 'tea' : 'cake';
    S.orders = S.orders || [];
    S.ordersTotal = S.ordersTotal || dayCfg().orders;
    S.ordersDone = S.ordersDone || 0;
    if (!Number.isFinite(S.ordersTotal) || S.ordersTotal <= 0) S.ordersTotal = dayCfg().orders;
    if (S.ordersDone > S.ordersTotal) S.ordersDone = 0;
    ids = Math.max(ids, ...S.orders.map(o => Number(o.id) + 1 || 1), 1);
    ensureQueue();

    layout();
    Sfx.muted; // noop
    if (S.muted) Sfx.toggle();

    /* --- 恢复「上次玩到一半」的局面 --- */
    let resumeNote = '';
    if (resumed) {
      const left = Math.max(0, S.ordersTotal - S.ordersDone);
      const lastPhase = S.meta.phase;
      if (lastPhase === 'day' || (S.ordersDone >= S.ordersTotal && left === 0)) {
        // 上次停在日结弹窗：直接把打烊结算重新摆出来，不让玩家卡在没订单的空桌面
        S.phase = 'day';
        resumeNote = `回到第 ${S.day} 天的打烊结算`;
      } else if (lastPhase === 'fail') {
        S.phase = 'fail';
        resumeNote = `回到第 ${S.day} 天 · 上次没撑过去`;
      } else {
        S.phase = 'play';
        resumeNote = `继续第 ${S.day} 天 · 还剩 ${left} 单`;
      }
    } else {
      S.phase = 'play';
    }
    if (S.phase === 'play' && S.orders.length + S.ordersDone < S.ordersTotal) fillOrders();

    window.addEventListener('resize', requestResize);
    window.addEventListener('orientationchange', () => setTimeout(() => { layout(true); render(); }, 260));
    cv.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', () => { aim.active = false; });

    // 自动存档：离开页面 / 切后台 / 定时
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
    setInterval(() => { if (running) save(); }, 8000);
    setInterval(() => { if (running && S.meta) S.meta.playSec = (S.meta.playSec || 0) + 5; }, 5000);

    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
    sync();

    // 兜底补档：如果同步通道全挂、IndexedDB 里却有更新的档，静默补回来
    idbRead().then(raw => {
      if (!raw || !store.lastSaveOk) return;
      try {
        const d = JSON.parse(raw);
        if (d.meta && d.meta.savedAt > (S.meta.savedAt || 0) + 30) { S = parse(raw); afterRestore(); }
      } catch (e) {}
    });

    // 容器 Storage 兜底补档：优先于浏览器存储；小工具 Storage 里有更新的档则补回
    xhsRead().then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (d.meta && d.meta.savedAt > (S.meta.savedAt || 0) + 30) { S = parse(raw); afterRestore(); }
      } catch (e) {}
    });

    // 可见的读档反馈：让玩家一眼知道进度有没有被记住
    setTimeout(() => {
      if (!window.UI) return;
      if (resumed) UI.toast(resumeNote);
      else UI.toast('新店开张 · 第 1 天');
      if (!store.lastChannel) UI.warnNoStorage();
    }, 420);

    // 回到日结 / 失败界面
    if (S.phase === 'day') setTimeout(() => UI.showDayComplete({ day: S.day, coins: S.coins, rank: S.rank.level }), 500);
    if (S.phase === 'fail') setTimeout(() => UI.showFail({ day: S.day, coins: S.coins, cost: reviveCost(), freeRevive: S.reviveUsed === 0 }), 500);

    save(true);
  }

  function afterRestore() {
    ensureQueue();
    if (S.phase === 'play' && S.orders.length + S.ordersDone < S.ordersTotal) fillOrders();
    sync();
  }

  /* ---------------- 对外 ---------------- */
  return {
    boot,
    view: () => view(),
    serve, revive, retryDay, nextDay, buyUpgrade, startTool,
    setCat(cat) {
      if (unlockedOf(cat) > 0) { S.cat = cat; S.tool = null; Sfx.tap(); sync(); save(); }
    },
    toggleMute() {
      S.muted = Sfx.toggle();
      save(); sync();
      return S.muted;
    },
    cancelTool() { S.tool = null; S.toolPick = []; sync(); },
    get state() { return S; },
    get layout() { return L; },
    toast(t) { UI.toast(t); },
    save, flushSave,

    /* ---- 存档面板用 ---- */
    saveInfo() {
      const m = S.meta || {};
      return {
        ok: !!store.lastChannel,
        channel: store.lastChannel || '无',
        channels: store.channels.slice(),
        error: store.lastError || '',
        savedAt: m.savedAt || 0,
        playSec: m.playSec || 0,
        served: m.served || 0,
        bestDay: m.bestDay || S.day,
        bestCoins: m.bestCoins || 0,
        launches: m.launches || 0,
        merges: m.merges || 0,
        day: S.day, coins: S.coins, dayMax: Math.max(S.day, m.bestDay || 1),
      };
    },
    exportCode() {
      const slim = {
        v: SAVEVER, coins: S.coins, day: S.day, rank: S.rank,
        unlocked: S.unlocked, spawnMax: S.spawnMax, orderSlots: S.orderSlots,
        upgrades: S.upgrades, tools: S.tools, tutorialDone: S.tutorialDone,
        meta: S.meta, ordersDone: S.ordersDone, ordersTotal: S.ordersTotal,
      };
      try {
        return 'BUBU1.' + btoa(unescape(encodeURIComponent(JSON.stringify(slim))))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch (e) { return ''; }
    },
    importCode(code) {
      const s = String(code || '').trim();
      if (!/^BUBU1\./.test(s)) { UI && UI.toast('存档码格式不对'); return false; }
      try {
        let b = s.slice(6).replace(/-/g, '+').replace(/_/g, '/');
        while (b.length % 4) b += '=';
        const d = JSON.parse(decodeURIComponent(escape(atob(b))));
        if (!d || typeof d.day !== 'number') throw 0;
        const ns = parse(JSON.stringify(Object.assign(d, { ver: SAVEVER })));
        S = ns;
        bodies = []; ghosts = []; flyers = []; parts = []; floats = [];
        S.orders = [];
        S.phase = 'play';
        ensureQueue(); fillOrders();
        save(true); sync();
        UI && UI.toast(`读档成功 · 第 ${S.day} 天`);
        return true;
      } catch (e) { UI && UI.toast('存档码无法识别'); return false; }
    },
    wipe() {
      try { localStorage.removeItem(SAVEKEY); OLDKEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {}
      try { document.cookie = 'bubu_mt2=; max-age=0; path=/; SameSite=Lax'; } catch (e) {}
      idbWrite('').catch(() => {});
      if (store.xhs) { try { store.xhs.removeStorage({ key: SAVEKEY }); } catch (e) {} }
      S = defaults();
      S.phase = 'play';
      bodies = []; ghosts = []; flyers = []; parts = []; floats = [];
      ensureQueue(); fillOrders();
      save(true); sync();
    },
    _add(cat, tier) { addBody(cat, tier, L.table.x + L.table.w / 2, L.table.y + 300, 0, 0, true); checkOrders(); sync(); },
    _clear() { bodies = []; sync(); },
    _dbg() { return bodies.map(b => ({ c: b.cat, t: b.tier, x: Math.round(b.x), y: Math.round(b.y), m: !!b.merging, vy: Math.round(b.vy) })); },
    get L() { return L; },   // 只读：排查布局/画布尺寸用
  };
})();
