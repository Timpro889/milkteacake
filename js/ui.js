/* ===========================================================
   布布奶茶铺 · 界面
   =========================================================== */
window.UI = (function () {
  let V = null, L = null;
  let lastSig = '', menuSig = '', toolSig = '';
  let shopOpen = false;
  let pendingPopup = null;

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ---------------- 图标（内联 SVG，避免 emoji 跨平台差异） ---------------- */
  const SVG = (d, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
      stroke-linecap="round" stroke-linejoin="round">${d}${extra || ''}</svg>`;
  const ICON = {
    soundOn: SVG(
      '<path d="M4 9.4h3.3L12 5.4v13.2L7.3 14.6H4z" fill="currentColor" stroke-linejoin="round"/>',
      '<path d="M15.9 8.7a4.7 4.7 0 0 1 0 6.6"/><path d="M18.4 6.2a8.1 8.1 0 0 1 0 11.6"/>'),
    soundOff: SVG(
      '<path d="M4 9.4h3.3L12 5.4v13.2L7.3 14.6H4z" fill="currentColor" stroke-linejoin="round"/>',
      '<path d="M16.2 9.6l4.6 4.8M20.8 9.6l-4.6 4.8"/>'),
    delete: SVG(
      '<path d="M4 7h16"/><path d="M9.6 7V5.3A1.3 1.3 0 0 1 10.9 4h2.2A1.3 1.3 0 0 1 14.4 5.3V7"/>' +
      '<path d="M6.5 7l.85 12A1.9 1.9 0 0 0 9.25 20.9h5.5A1.9 1.9 0 0 0 16.65 19L17.5 7"/>' +
      '<path d="M10.4 11v6M13.6 11v6"/>'),
    swap: SVG('<path d="M6.6 8.2h11.2l-3.1-3.1"/><path d="M17.4 15.8H6.2l3.1 3.1"/>'),
    refresh: SVG('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20.2 3.8v4.6h-4.6"/>'),
    disk: SVG(
      '<rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2.6"/>' +
      '<path d="M7.2 4.4v5.4h9.6V4.4"/><rect x="7.2" y="14.6" width="9.6" height="5" rx="1"/>' +
      '<path d="M10.4 17.1h3.2"/>'),
    shop: SVG('<path d="M9.6 3v6.3L4.9 17.5A2.4 2.4 0 0 0 7 21h10a2.4 2.4 0 0 0 2.1-3.5L14.4 9.3V3"/>' +
      '<path d="M8.2 3h7.6"/><path d="M6.9 15.4h10.2"/>'),
  };
  const TOOL_ICON = { delete: 'delete', swap: 'swap', refresh: 'refresh' };

  /* 弹窗大图标：自带配色，不走 ICON 的描边风格 */
  const POP = {
    party:
      `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12.4" r="8.8" fill="#63bd51"/>
        <circle cx="12" cy="12.4" r="8.8" fill="none" stroke="#41892f" stroke-width="1.2"/>
        <circle cx="12" cy="12.4" r="7.2" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
        <path d="M8.1 12.5l2.9 2.9 5.2-5.6" fill="none" stroke="#fff" stroke-width="2.3"
          stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19.7 3.6l.62 1.68 1.68.62-1.68.62-.62 1.68-.62-1.68-1.68-.62 1.68-.62z" fill="#f7c948"/>
        <path d="M4.3 4.4l.46 1.24 1.24.46-1.24.46-.46 1.24-.46-1.24-1.24-.46 1.24-.46z" fill="#f7c948"/>
      </svg>`,
    overflow:
      `<svg viewBox="0 0 24 24">
        <circle cx="12" cy="12.4" r="8.8" fill="#e2603f"/>
        <circle cx="12" cy="12.4" r="8.8" fill="none" stroke="#b8422a" stroke-width="1.2"/>
        <circle cx="12" cy="12.4" r="7.2" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="1"/>
        <path d="M12 7.6v6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="12" cy="16.9" r="1.35" fill="#fff"/>
      </svg>`,
  };

  /* ---------------- 布局 ---------------- */
  function layout(l) {
    L = l;
    const ob = $('#orders');
    if (ob) ob.style.top = l.ordersY + 'px';
    const bt = $('#bottom');
    if (bt) bt.style.top = l.bottomY + 'px';
    const tip = $('#tip');
    if (tip) tip.style.top = (l.table.y + 300) + 'px';
  }

  /* 素材热替换后强制重渲染 */
  function invalidate() {
    lastSig = ''; menuSig = ''; toolSig = '';
    if (!L) return;
    // view 里缓存了 icon 字符串，必须重新拉一次才换得掉
    const fresh = (window.Game && Game.view) ? Game.view() : V;
    if (fresh) render(fresh);
  }

  /* ---------------- 主渲染 ---------------- */
  function render(v) {
    V = v;
    if (!L) return;

    // 顶栏
    $('#coinVal').textContent = v.coins;
    $('#rankLv').textContent = v.rank.level;
    $('#xpFill').style.width = Math.min(100, (v.rank.xp / v.rank.need) * 100) + '%';
    $('#dayPill').textContent = `第${v.day}天 · ${v.ordersDone}/${v.ordersTotal}`;
    const sb = $('#btnSound');
    const want = v.muted ? 'soundOff' : 'soundOn';
    if (sb.dataset.ic !== want) {
      sb.dataset.ic = want;
      sb.innerHTML = ICON[want];
    }

    // 订单（槽位数也纳入签名：买了桌子后要重排 2 列 / 3 列布局）
    const sig = (v.slots || 0) + '|' + JSON.stringify(v.orders.map(o => [o.id, o.ready, o.items.map(i => i.have + '/' + i.count)]));
    if (sig !== lastSig) {
      lastSig = sig;
      renderOrders(v);
    }

    // 菜单
    renderMenu(v);
    renderTools(v);

    if (shopOpen) renderShop(v);
  }


  function renderOrders(v) {
    const box = $('#orders');
    const slots = Math.max(1, v.slots || v.orders.length);
    box.innerHTML = '';
    box.style.gridTemplateColumns = `repeat(${slots}, minmax(0, 1fr))`;
    // 3 张桌子时每张卡只有约 330px 宽，头像+订单+奖励横排会把订单挤没，
    // 改用上下排布（头像在上、订单在下），整卡宽度都留给订单物品。
    box.classList.toggle('cols3', slots >= 3);
    v.orders.forEach(o => {
      const n = o.items.length;
      const card = el('div', 'card n' + n + (o.ready ? ' ready' : ''));
      card.dataset.id = o.id;
      let itemsHtml = '';
      o.items.forEach(it => {
        const full = it.have >= it.count;
        itemsHtml += `<div class="oit ${full ? 'ok' : ''}">
          <img class="ic" data-cat="${it.cat}" data-tier="${it.tier}" alt="">
          <span class="cnt">×${it.count}</span>
        </div>`;
      });
      card.innerHTML = `
        <div class="who">
          <div class="ava"><img src="${Art.cusIcon(o.cus)}" alt=""></div>
        </div>
        <div class="reqbox">
          <div class="reqlabel">订单要求</div>
          <div class="req">${itemsHtml}</div>
        </div>
        <div class="rw"><i class="coin"></i>${o.reward}</div>
        <div class="done">Done</div>`;
      card.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        Game.serve(o.id);
      });
      box.appendChild(card);
      // 把占位 <img> 换成带 LOGO 的实时 <canvas>（file:// 下也能显示 LOGO）
      card.querySelectorAll('img.ic').forEach(img => {
        const cv = Art.makeIcon(img.dataset.cat, +img.dataset.tier, 96);
        cv.className = 'ic';
        img.replaceWith(cv);
      });
    });
  }

  function renderMenu(v) {
    const m = v.menu[v.cat];
    const sig = v.cat + '|' + (m.canSwitch ? 1 : 0) + '|' + m.items.map(t => (t.unlocked ? 1 : 0)).join('');
    if (sig === menuSig) return;
    menuSig = sig;

    const tabs = $('#tabs');
    const tiers = $('#tiers');
    tabs.innerHTML = '';
    ['tea', 'cake'].forEach(cat => {
      const b = el('button', 'tab' + (v.cat === cat ? ' on' : '') + (v.menu[cat].canSwitch ? '' : ' off'));
      b.textContent = v.menu[cat].tabName || v.menu[cat].name;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); Game.setCat(cat); });
      tabs.appendChild(b);
    });

    tiers.innerHTML = '';
    m.items.forEach(t => {
      const d = el('div', 'tier' + (t.unlocked ? '' : ' locked'));
      if (t.unlocked) {
        const cv = Art.makeIcon(v.cat, t.tier, 150);
        cv.className = 'ico';
        d.appendChild(cv);
        const s = document.createElement('span');
        s.className = 'tn';
        s.textContent = t.name;
        d.appendChild(s);
      } else {
        const q = document.createElement('div');
        q.className = 'q';
        q.textContent = '?';
        d.appendChild(q);
      }
      tiers.appendChild(d);
    });
  }

  function renderTools(v) {
    const sig = v.tools.map(t => [t.id, t.active ? 1 : 0, t.unlocked ? 1 : 0, t.charges].join('')).join('|');
    if (sig === toolSig) return;
    toolSig = sig;

    const box = $('#tools');
    box.innerHTML = '';
    v.tools.forEach(t => {
      const b = el('button', 'tool' + (t.active ? ' on' : '') + (t.unlocked ? '' : ' locked'));
      b.innerHTML = `<span class="ic">${ICON[TOOL_ICON[t.id]] || t.name[0]}</span>` +
        `<span class="ch">${t.unlocked ? '×' + t.charges : 'D' + t.needDay}</span>`;
      b.title = t.sub;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); Game.startTool(t.id); });
      box.appendChild(b);
    });
    const shop = el('button', 'tool shopbtn');
    shop.innerHTML = `<span class="ic">${ICON.shop}</span><span class="ch">研发</span>`;
    shop.addEventListener('pointerdown', e => { e.stopPropagation(); openShop(); });
    box.appendChild(shop);
  }

  /* ---------------- 商店 ---------------- */
  function openShop() {
    shopOpen = true;
    renderShop(V);
    $('#modal').classList.add('on');
    $('#modalBody').innerHTML = '';
    buildShopPanel();
    Sfx.tap();
  }
  function closeShop() {
    shopOpen = false;
    $('#modal').classList.remove('on');
  }

  function buildShopPanel() {
    const body = $('#modalBody');
    body.innerHTML = `
      <h2 class="mtitle">研发 & 升级</h2>
      <p class="msub">花掉金币，做出更高级的甜品</p>
      <div class="shoplist" id="shoplist"></div>
      <button class="btn wide" id="shopClose">继续做生意</button>`;
    renderShop(V);
    $('#shopClose').addEventListener('pointerdown', e => { e.stopPropagation(); closeShop(); });
  }

  function renderShop(v) {
    const list = $('#shoplist');
    if (!list || !v) return;
    list.innerHTML = '';
    v.upgrades.forEach(u => {
      const card = el('div', 'ucard' + (u.soldOut ? ' sold' : ''));
      card.innerHTML = `
        <div class="uico" data-cat="${u.icon.cat}" data-tier="${u.icon.tier}"></div>
        <div class="umid">
          <b>${u.name}</b>
          <span>${u.desc}</span>
          <em>${u.effect}</em>
        </div>
        <div class="ubuy">
          ${u.soldOut ? '<span class="doneflag">已完成</span>'
            : `<button class="btn sm ${u.afford ? '' : 'dim'}"><i class="coin"></i>${u.price}</button>
               <span class="lvtag">Lv.${u.lv + 1}/${u.max}</span>`}
        </div>`;
      const uico = card.querySelector('.uico');
      if (uico) {
        const cv = Art.makeIcon(uico.dataset.cat, +uico.dataset.tier, 150);
        cv.className = 'ico';
        uico.appendChild(cv);
      }
      if (!u.soldOut) {
        const btn = card.querySelector('button');
        btn.addEventListener('pointerdown', e => { e.stopPropagation(); Game.buyUpgrade(u.id); });
      }
      list.appendChild(card);
    });
  }

  /* ---------------- 存档面板 ---------------- */
  function fmtAgo(sec) {
    if (!sec) return '尚未保存过';
    const d = Math.max(0, Date.now() / 1000 - sec);
    if (d < 60) return '刚刚保存';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前保存';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前保存';
    return Math.floor(d / 86400) + ' 天前保存';
  }
  function fmtDur(sec) {
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.floor(sec / 60) + ' 分钟';
    return Math.floor(sec / 3600) + ' 小时 ' + Math.floor(sec % 3600 / 60) + ' 分';
  }

  function openSave() {
    const info = Game.saveInfo();
    const chText = {
      localStorage: '本机 localStorage', cookie: '浏览器 Cookie', IndexedDB: 'IndexedDB',
    };
    const badge = info.ok
      ? `<span class="svch ok">已自动保存 · ${chText[info.channel] || info.channel}</span>`
      : `<span class="svch bad">本机不可用，进度只能靠存档码</span>`;

    modal(`
      <div class="pop wide">
        <h2 class="mtitle">进度存档</h2>
        <p class="msub">${badge} · ${fmtAgo(info.savedAt)}</p>
        <div class="svgrid">
          <div class="sv"><b>第 ${info.day} 天</b><span>当前进度</span></div>
          <div class="sv"><b>${info.coins}</b><span>金币</span></div>
          <div class="sv"><b>第 ${info.bestDay} 天</b><span>最远纪录</span></div>
          <div class="sv"><b>${info.served}</b><span>累计交货</span></div>
          <div class="sv"><b>${fmtDur(info.playSec)}</b><span>游玩时长</span></div>
          <div class="sv"><b>${info.merges}</b><span>合成次数</span></div>
        </div>
        <div class="svhint">
          进度写在<b>这台设备的这个浏览器</b>里，重开网页会自动接着打。<br>
          换浏览器、清缓存、用无痕模式都会丢 —— 想带走就复制存档码。
        </div>
        <div class="svrow">
          <button class="btn wide" id="svExport">导出存档码</button>
          <button class="btn wide ghost" id="svImport">导入存档码</button>
        </div>
        <div class="svrow">
          <button class="btn wide danger" id="svWipe">清空重来</button>
        </div>
        <textarea class="svcode" id="svCode" spellcheck="false" placeholder="存档码会出现在这里"></textarea>
        <button class="btn wide" id="svClose">继续做生意</button>
      </div>`);

    const code = $('#svCode');
    $('#svExport').addEventListener('pointerdown', e => {
      e.stopPropagation();
      const c = Game.exportCode();
      if (!c) { toast('生成失败'); return; }
      code.value = c;
      code.classList.add('on');
      copyText(code);
      toast(c.length > 400 ? '存档码已展开，长按全选后手动复制' : '存档码已全选，长按可复制');
    });
    $('#svImport').addEventListener('pointerdown', e => {
      e.stopPropagation();
      code.classList.add('on');
      code.value = '';
      code.focus();
      toast('粘贴存档码后点这里载入');
      code.oninput = () => {
        const v = code.value.trim();
        if (/^BUBU1\.[A-Za-z0-9\-_]{20,}$/.test(v)) {
          code.oninput = null;
          if (Game.importCode(v)) setTimeout(() => closeModal(), 260);
        }
      };
    });
    $('#svWipe').addEventListener('pointerdown', e => {
      e.stopPropagation();
      const b = $('#svWipe');
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1';
        b.textContent = '确定要清空？再点一次';
        setTimeout(() => { if (b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = '清空重来'; } }, 4000);
        return;
      }
      Game.wipe();
      closeModal();
      toast('已清空，从第 1 天重新开始');
    });
    $('#svClose').addEventListener('pointerdown', e => { e.stopPropagation(); closeModal(); });
    Sfx.tap();
  }

  // 小工具容器禁止剪贴板 API（navigator.clipboard / execCommand('copy') 均不可用），
  // 改为：直接全选文本，引导用户长按 / 选中手动复制。
  function copyText(ta) {
    try {
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
    } catch (e) {}
  }

  /* 本机三种存储都被禁用时，明确告诉玩家别白打 */
  function warnNoStorage() {
    const el = document.getElementById('nostore');
    const btn = document.getElementById('btnSave');
    if (btn) btn.classList.add('alert');
    if (el) el.classList.add('on');
    toast('本机存不了档，记得导出存档码');
    setTimeout(() => { if (el && el.classList.contains('on')) el.classList.remove('on'); }, 12000);
  }

  /* ---------------- 弹窗 ---------------- */
  function modal(html, keepShop) {
    if (!keepShop) shopOpen = false;
    const m = $('#modal');
    $('#modalBody').innerHTML = html;
    m.classList.add('on');
  }
  function closeModal() {
    $('#modal').classList.remove('on');
    shopOpen = false;
  }

  function showDayComplete(d) {
    Sfx.day();
    confetti();
    modal(`
      <div class="pop">
        <div class="pstar">${POP.party}</div>
        <h2 class="mtitle">第 ${d.day} 天 · 打烊啦</h2>
        <p class="msub">今天的订单全部完成</p>
        <div class="rowstat">
          <div class="stat"><b>${d.coins}</b><span>金币</span></div>
          <div class="stat"><b>Lv.${d.rank}</b><span>店铺等级</span></div>
        </div>
        <button class="btn wide" id="btnNextDay">开门 · 第 ${d.day + 1} 天</button>
      </div>`);
    $('#btnNextDay').addEventListener('pointerdown', e => {
      e.stopPropagation();
      closeModal();
      Game.nextDay();
    });
  }

  function showFail(d) {
    Sfx.fail();
    const free = d.freeRevive;
    modal(`
      <div class="pop">
        <div class="pstar">${POP.overflow}</div>
        <h2 class="mtitle">桌子堆满啦！</h2>
        <p class="msub">物品越过了红线 3 秒，生意做不下去了</p>
        <div class="hintbox">复活会清掉红线附近的物品，接着做今天剩下的订单</div>
        <button class="btn wide ${free ? '' : ''}" id="btnRevive">
          ${free ? '免费复活' : `花 <i class="coin"></i> ${d.cost} 复活`}
        </button>
        <button class="btn wide ghost" id="btnRetry">重做第 ${d.day} 天</button>
      </div>`);
    $('#btnRevive').addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (Game.revive()) closeModal();
    });
    $('#btnRetry').addEventListener('pointerdown', e => {
      e.stopPropagation();
      closeModal();
      Game.retryDay();
    });
  }

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('on'), 1400);
  }

  function confetti() {
    const box = $('#fx');
    for (let i = 0; i < 26; i++) {
      const s = el('i', 'cf');
      s.style.left = (10 + Math.random() * 80) + '%';
      s.style.background = ['#ffd166', '#f28fb1', '#8ec96e', '#7fc5e8', '#f6a15c'][i % 5];
      s.style.animationDelay = (Math.random() * 0.5) + 's';
      s.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
      box.appendChild(s);
      setTimeout(() => s.remove(), 2400);
    }
  }

  function cardCenter(id) {
    const c = document.querySelector(`.card[data-id="${id}"]`);
    if (!c || !L) return null;
    const r = c.getBoundingClientRect();
    const s = L.scale;
    const st = $('#stage').getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - st.left) / s,
      y: (r.top + r.height / 2 - st.top) / s,
    };
  }

  /* ---------------- 首次提示 ---------------- */
  function tutorial() {
    const st = Game.state;
    if (st.tutorialDone.aim) return;
    const tip = $('#tip');
    tip.innerHTML = `<span>按住桌面左右拖动，松手把奶茶弹上去</span><b>知道了</b>`;
    tip.classList.add('on');
    clearTimeout(tip._h);
    tip._h = setTimeout(() => { if (!st.tutorialDone.aim) close(); }, 7000);
    const close = e => {
      if (e) e.stopPropagation();
      st.tutorialDone.aim = 1;
      tip.classList.remove('on');
      Game.save();
    };
    tip.querySelector('b').addEventListener('pointerdown', close);
    tip.addEventListener('pointerdown', close);
  }

  function hintOnce(key, text) {
    const st = Game.state;
    if (st.tutorialDone[key]) return;
    st.tutorialDone[key] = 1;
    Game.save();
    toast(text);
  }

  /* ---------------- 竖屏提示 ---------------- */
  function checkOrient() {
    const el = document.getElementById('rotate');
    if (!el) return;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const land = window.innerWidth > window.innerHeight * 1.12;
    el.style.display = (touch && land) ? 'flex' : 'none';
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    $('#btnSound').addEventListener('pointerdown', e => {
      e.stopPropagation();
      Game.toggleMute();
    });
    $('#btnSave').innerHTML = ICON.disk;
    $('#btnSave').addEventListener('pointerdown', e => {
      e.stopPropagation();
      openSave();
    });
    checkOrient();
    window.addEventListener('resize', checkOrient);
    window.addEventListener('orientationchange', () => setTimeout(checkOrient, 120));
    Game.boot();
    // 首帧后给提示
    setTimeout(tutorial, 900);
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
  }

  return {
    init, render, layout, showDayComplete, showFail, toast, cardCenter, hintOnce, invalidate,
    openSave, warnNoStorage,
    get shopOpen() { return shopOpen; },
  };
})();

document.addEventListener('DOMContentLoaded', () => UI.init());
