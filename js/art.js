/* ===========================================================
   布布奶茶铺 · 程序化美术（无外部图片）
   =========================================================== */
window.Art = (function () {
  const SS = 2; // 精灵超采样倍率
  const sprites = {};
  const icons = {};
  const CFG = window.CFG;

  // 奶茶杯品牌 LOGO：把 assets/logo.* 烙印到每只奶茶杯上（内置绘制与自制图片都覆盖）
  let logoImg = null, logoReady = false;
  const teaBase = {};   // key -> 未加 LOGO 的原始奶茶精灵 { cv, size, custom }

  /* ---------- 基础工具 ---------- */
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }
  // 圆角矩形 → Path2D（可填充/描边/裁剪）
  function rrP(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    const p = new Path2D();
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.arcTo(x + w, y, x + w, y + r, r);
    p.lineTo(x + w, y + h - r);
    p.arcTo(x + w, y + h, x + w - r, y + h, r);
    p.lineTo(x + r, y + h);
    p.arcTo(x, y + h, x, y + h - r, r);
    p.lineTo(x, y + r);
    p.arcTo(x, y, x + r, y, r);
    p.closePath();
    return p;
  }
  // 梯形圆角矩形：顶/底边外扩量不同 → 俯视透视（近宽远窄）
  function taperFrame(ctx, x, y, w, h, oT, oB, r) {
    const yT = y - oT, yB = y + h + oB;
    const xT0 = x - oT, xT1 = x + w + oT;
    const xB0 = x - oB, xB1 = x + w + oB;
    const ky = r / Math.max(1, yB - yT);
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(xT0 + r, yT);
    ctx.lineTo(xT1 - r, yT);
    ctx.quadraticCurveTo(xT1, yT, xT1 + (xB1 - xT1) * ky, yT + r);
    ctx.lineTo(xB1, yB - r);
    ctx.quadraticCurveTo(xB1, yB, xB1 - r, yB);
    ctx.lineTo(xB0 + r, yB);
    ctx.quadraticCurveTo(xB0, yB, xB0, yB - r);
    ctx.lineTo(xT0 + (xB0 - xT0) * ky, yT + r);
    ctx.quadraticCurveTo(xT0, yT, xT0 + r, yT);
    ctx.closePath();
  }

  function shade(ctx, x, y, rx, ry, col, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ell(ctx, x, y, rx, ry);
    ctx.fill();
    ctx.restore();
  }

  /* ===========================================================
     奶茶杯
     =========================================================== */
  function drawTea(ctx, t, R) {
    const W = R * 1.88;           // 杯宽
    const H = R * 2.0;            // 杯高
    const top = -H * 0.52;
    const bot = H * 0.48;
    const rimW = W * 0.98;
    const baseW = W * 0.74;
    const bodyTop = top + H * 0.16;

    // 杯身路径（上宽下窄 + 圆底）
    function cupPath() {
      const p = new Path2D();
      const hw1 = rimW / 2, hw2 = baseW / 2;
      const br = baseW * 0.34;
      p.moveTo(-hw1, bodyTop);
      p.lineTo(hw1, bodyTop);
      p.lineTo(hw2, bot - br);
      p.quadraticCurveTo(hw2, bot, hw2 - br, bot);
      p.lineTo(-hw2 + br, bot);
      p.quadraticCurveTo(-hw2, bot, -hw2, bot - br);
      p.closePath();
      return p;
    }
    const cp = cupPath();

    // 液体
    ctx.save();
    ctx.clip(cp);
    const g = ctx.createLinearGradient(0, bodyTop, 0, bot);
    g.addColorStop(0, t.liquid);
    g.addColorStop(1, shadeHex(t.liquid, -0.22));
    ctx.fillStyle = g;
    ctx.fillRect(-W, bodyTop - 4, W * 2, H * 2);

    // 液体内的层次（珍珠/果粒）
    ctx.globalAlpha = 0.85;
    if (t.top === 'pearl' || t.top === 'tower') {
      ctx.fillStyle = '#3d2620';
      for (let i = 0; i < 9; i++) {
        const px = -baseW * 0.3 + (i % 3) * baseW * 0.3 + (i % 2) * 4;
        const py = bot - 10 - Math.floor(i / 3) * 13;
        ell(ctx, px, py, R * 0.085, R * 0.085);
        ctx.fill();
      }
    }
    if (t.top === 'taro') {
      ctx.fillStyle = '#e6d5f5';
      for (let i = 0; i < 6; i++) {
        const px = -baseW * 0.26 + (i % 3) * baseW * 0.26;
        const py = bot - 12 - Math.floor(i / 3) * 16;
        rr(ctx, px, py, R * 0.13, R * 0.11, 3);
        ctx.fill();
      }
    }
    if (t.top === 'tower') {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 5; i++) {
        ell(ctx, -baseW * 0.28 + (i % 2) * baseW * 0.5, bot - 46 - i * 12, R * 0.1, R * 0.07);
        ctx.fill();
      }
    }
    // 杯身高光
    ctx.globalAlpha = 1;
    const hl = ctx.createLinearGradient(-W * 0.5, 0, W * 0.5, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0.42)');
    hl.addColorStop(0.35, 'rgba(255,255,255,0.05)');
    hl.addColorStop(0.75, 'rgba(255,255,255,0.0)');
    hl.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = hl;
    ctx.fillRect(-W, bodyTop - 4, W * 2, H * 2);
    ctx.restore();

    // 杯口奶油/泡沫（高于杯口）
    if (t.top === 'foam' || t.top === 'cheese' || t.top === 'whip') {
      const domeH = t.top === 'cheese' ? R * 0.44 : R * 0.34;
      const col = t.top === 'foam' ? '#f3f9e4' : t.top === 'cheese' ? '#ffca5c' : '#fff4e6';
      const shadow = t.top === 'cheese' ? '#e09a20' : shadeHex(col, -0.12);
      ctx.fillStyle = col;
      ell(ctx, 0, bodyTop + 2, rimW * 0.5, domeH * 0.62);
      ctx.fill();
      // 奶油尖
      const peak = new Path2D();
      peak.moveTo(-rimW * 0.3, bodyTop);
      peak.quadraticCurveTo(-R * 0.06, bodyTop - domeH * 1.5, R * 0.12, bodyTop - domeH * 1.1);
      peak.quadraticCurveTo(R * 0.2, bodyTop - domeH * 0.4, rimW * 0.3, bodyTop);
      peak.closePath();
      ctx.fillStyle = shadeHex(col, 0.06);
      ctx.fill(peak);
      contour(ctx, peak, R, 0.26);
      // 顶部暗边（增加立体）
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = shadow;
      ell(ctx, 0, bodyTop + domeH * 0.22, rimW * 0.5, domeH * 0.26);
      ctx.fill();
      ctx.restore();
      if (t.top === 'cheese') {
        // 芝士垂落
        ctx.fillStyle = col;
        for (let i = -1; i <= 1; i++) {
          const dx = i * rimW * 0.26 + R * 0.04;
          const dl = R * (0.26 + (i === 0 ? 0.16 : 0.06));
          ctx.beginPath();
          ctx.moveTo(dx - R * 0.11, bodyTop + 4);
          ctx.quadraticCurveTo(dx, bodyTop + dl * 1.6, dx + R * 0.11, bodyTop + 4);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t.top === 'whip') {
        // 巧克力淋线 + 樱桃
        ctx.strokeStyle = 'rgba(70,42,28,0.9)';
        ctx.lineWidth = R * 0.06;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * R * 0.10, bodyTop - R * 0.06);
          ctx.quadraticCurveTo(i * R * 0.26, bodyTop - R * 0.42, i * R * 0.06, bodyTop - R * 0.60);
          ctx.stroke();
        }
        cherry(ctx, R * 0.02, bodyTop - domeH * 1.55, R * 0.13);
      }
    } else if (t.top === 'pudding') {
      // 焦糖布丁：上窄下宽的圆台 + 深色焦糖顶
      const w = rimW * 0.58, hh = R * 0.42;
      const p = new Path2D();
      p.moveTo(-w * 0.44, bodyTop - hh);
      p.lineTo(w * 0.44, bodyTop - hh);
      p.lineTo(w * 0.5, bodyTop + 4);
      p.lineTo(-w * 0.5, bodyTop + 4);
      p.closePath();
      const g = ctx.createLinearGradient(0, bodyTop - hh, 0, bodyTop);
      g.addColorStop(0, '#ffd97a');
      g.addColorStop(1, '#e6a83c');
      ctx.fillStyle = g;
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      // 焦糖顶
      ctx.fillStyle = '#8f4d17';
      ell(ctx, 0, bodyTop - hh, w * 0.5, hh * 0.26);
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-w * 0.34, bodyTop - hh * 0.55, w * 0.13, hh * 0.62);
      ctx.restore();
      contour(ctx, p, R, 0.30);
    } else if (t.top === 'berry') {
      ctx.fillStyle = '#ffd9e2';
      ell(ctx, 0, bodyTop, rimW * 0.5, R * 0.2);
      ctx.fill();
      drawStrawberry(ctx, -R * 0.18, bodyTop - R * 0.3, R * 0.22);
      drawStrawberry(ctx, R * 0.2, bodyTop - R * 0.18, R * 0.18);
    } else if (t.top === 'tower') {
      // 水果塔
      ctx.fillStyle = '#fff3e0';
      ell(ctx, 0, bodyTop, rimW * 0.52, R * 0.18);
      ctx.fill();
      drawStrawberry(ctx, -R * 0.3, bodyTop - R * 0.24, R * 0.24);
      drawStrawberry(ctx, R * 0.26, bodyTop - R * 0.2, R * 0.2);
      ctx.fillStyle = '#f9c74f';
      ell(ctx, 0, bodyTop - R * 0.44, R * 0.18, R * 0.16);
      ctx.fill();
      ctx.fillStyle = '#8ec96e';
      ctx.beginPath();
      ctx.ellipse(R * 0.02, bodyTop - R * 0.36, R * 0.1, R * 0.06, -0.5, 0, 7);
      ctx.fill();
    }

    // 杯口圈
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = R * 0.075;
    ctx.beginPath();
    ctx.ellipse(0, bodyTop - R * 0.02, rimW * 0.5, R * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 杯身描边
    ctx.strokeStyle = 'rgba(104,60,28,0.30)';
    ctx.lineWidth = R * 0.05;
    ctx.stroke(cp);

    // 吸管
    ctx.save();
    ctx.translate(rimW * 0.22, bodyTop);
    ctx.rotate(0.22);
    ctx.fillStyle = t.cap;
    rr(ctx, -R * 0.075, -R * 0.86, R * 0.15, R * 0.95, R * 0.06);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rr(ctx, -R * 0.075, -R * 0.86, R * 0.05, R * 0.95, R * 0.03);
    ctx.fill();
    ctx.restore();
  }

  function drawStrawberry(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ee5e6e';
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(-r * 1.1, r * 0.3, -r * 0.9, -r * 0.8, 0, -r * 0.75);
    ctx.bezierCurveTo(r * 0.9, -r * 0.8, r * 1.1, r * 0.3, 0, r);
    ctx.fill();
    ctx.fillStyle = '#67a84f';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.lineTo(Math.cos(a) * r * 0.7, -r * 0.75 + Math.sin(a) * r * 0.35);
      ctx.lineTo(Math.cos(a + 0.25) * r * 0.25, -r * 0.8);
    }
    ctx.fill();
    ctx.restore();
  }

  /* ===========================================================
     蛋糕 / 通用绘制工具
     =========================================================== */
  // 暖色轮廓：让浅色蛋糕从米色桌面上"浮"起来
  function contour(ctx, p, R, a) {
    ctx.save();
    ctx.strokeStyle = 'rgba(104,60,28,' + (a == null ? 0.28 : a) + ')';
    ctx.lineWidth = Math.max(1.6, R * 0.05);
    ctx.lineJoin = 'round';
    ctx.stroke(p);
    ctx.restore();
  }
  // 体积感：顶部受光 + 底部环境遮蔽
  function volume(ctx, p, x, y, w, h, topA, botA) {
    ctx.save();
    ctx.clip(p);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255,255,255,' + (topA == null ? 0.35 : topA) + ')');
    g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(146,92,52,' + (botA == null ? 0.16 : botA) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  // 奶油花：波浪底 + 三座圆峰
  function cream(ctx, w, h, y0, c1, c2) {
    const p = new Path2D();
    p.moveTo(-w / 2, y0);
    p.bezierCurveTo(-w * 0.46, y0 - h * 0.72, -w * 0.20, y0 - h * 0.60, -w * 0.07, y0 - h * 0.30);
    p.bezierCurveTo(-w * 0.03, y0 - h * 1.02, w * 0.10, y0 - h * 0.96, w * 0.11, y0 - h * 0.54);
    p.bezierCurveTo(w * 0.22, y0 - h * 0.70, w * 0.44, y0 - h * 0.60, w / 2, y0);
    p.quadraticCurveTo(w * 0.32, y0 + h * 0.26, w * 0.17, y0 + h * 0.02);
    p.quadraticCurveTo(0, y0 + h * 0.30, -w * 0.17, y0 + h * 0.02);
    p.quadraticCurveTo(-w * 0.32, y0 + h * 0.26, -w / 2, y0);
    p.closePath();
    const g = ctx.createLinearGradient(0, y0 - h, 0, y0 + h * 0.3);
    g.addColorStop(0, c1 || '#ffffff');
    g.addColorStop(1, c2 || '#f6e3cd');
    ctx.fillStyle = g;
    ctx.fill(p);
    return p;
  }
  // 淋面：平顶 + 下垂的圆弧
  function glaze(ctx, w, y, h, col, n) {
    n = n || 4;
    const p = new Path2D();
    p.moveTo(-w / 2, y);
    p.lineTo(w / 2, y);
    p.lineTo(w / 2, y + h * 0.42);
    for (let i = n; i > 0; i--) {
      const x1 = -w / 2 + (i / n) * w;
      const x0 = -w / 2 + ((i - 1) / n) * w;
      const drop = (i % 2 === 0) ? 1.5 : 0.9;
      p.quadraticCurveTo((x0 + x1) / 2, y + h * drop, x0, y + h * 0.42);
    }
    p.closePath();
    ctx.fillStyle = col;
    ctx.fill(p);
    return p;
  }
  function cherry(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, '#ff7d74');
    g.addColorStop(1, '#c02233');
    ctx.fillStyle = g;
    ell(ctx, x, y, r, r * 1.04);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = r * 0.32;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.56, Math.PI * 1.05, Math.PI * 1.48);
    ctx.stroke();
    ctx.strokeStyle = '#4d7a34';
    ctx.lineWidth = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.08, y - r * 0.94);
    ctx.quadraticCurveTo(x + r * 0.62, y - r * 1.6, x + r * 1.05, y - r * 1.42);
    ctx.stroke();
  }

  function drawCake(ctx, t, R) {
    const W = R * 1.98;
    const H = R * 1.78;
    const bot = H * 0.46;

    if (t.top === 'cup') {
      const wTop = W * 0.84, wBot = W * 0.54, hh = H * 0.54;
      const topY = bot - hh;
      // 纸杯（梯形 + 圆底）
      const p = new Path2D();
      p.moveTo(-wTop / 2, topY);
      p.lineTo(wTop / 2, topY);
      p.lineTo(wBot / 2, bot - R * 0.12);
      p.quadraticCurveTo(0, bot + R * 0.12, -wBot / 2, bot - R * 0.12);
      p.closePath();
      const g = ctx.createLinearGradient(-wTop / 2, 0, wTop / 2, 0);
      g.addColorStop(0, '#cf6c8b');
      g.addColorStop(0.26, '#f8b6c9');
      g.addColorStop(0.62, '#f2a0b8');
      g.addColorStop(1, '#c85f80');
      ctx.fillStyle = g;
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = '#a8425f';
      ctx.lineWidth = R * 0.045;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * wTop * 0.18, topY);
        ctx.lineTo(i * wBot * 0.20, bot + 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(140,50,80,0.28)';
      ctx.fillRect(-wTop, topY, wTop * 2, R * 0.10);
      ctx.restore();
      volume(ctx, p, -wTop, topY, wTop * 2, bot - topY, 0.28, 0.22);
      contour(ctx, p, R, 0.30);
      // 糖霜
      const cp = cream(ctx, wTop * 1.02, R * 0.62, topY + R * 0.02);
      contour(ctx, cp, R, 0.22);
      cherry(ctx, wTop * 0.16, topY - R * 0.62, R * 0.15);
    } else if (t.top === 'slice') {
      /* 三角切片：一块「躺」在台面上的蛋糕楔形
         正面 = 切面（露出海绵/奶油/果酱夹层），上面 = 糖霜顶面收向远端的尖角
         这样才和俯视的铁板视角一致，不会像一张立在桌上的纸片 */
      const fh = H * 0.44;              // 切面高度
      const depth = H * 0.36;           // 顶面进深（已做透视压缩）
      const yF = bot - fh;              // 切面上沿
      const apexY = yF - depth;         // 顶面尖端
      const wB = W * 0.90, wT = W * 0.82;

      // ---- 顶面（糖霜）----
      const top = new Path2D();
      top.moveTo(-wT / 2, yF);
      top.lineTo(wT / 2, yF);
      top.lineTo(wT * 0.10, apexY);
      top.closePath();
      const tg = ctx.createLinearGradient(0, apexY, 0, yF);
      tg.addColorStop(0, '#fff0f3');
      tg.addColorStop(0.55, '#fffaf6');
      tg.addColorStop(1, '#fdf1e2');
      ctx.fillStyle = tg;
      ctx.fill(top);
      // 顶面靠远端的暗部，做出斜度
      ctx.save();
      ctx.clip(top);
      const tg2 = ctx.createLinearGradient(-wT * 0.5, apexY, wT * 0.5, yF);
      tg2.addColorStop(0, 'rgba(198,148,104,0.24)');
      tg2.addColorStop(0.6, 'rgba(198,148,104,0)');
      ctx.fillStyle = tg2;
      ctx.fillRect(-W, apexY - H, W * 2, H * 2);
      // 顶面糖霜的一道粉色纹
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#f3a9bb';
      ctx.lineWidth = R * 0.10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-wT * 0.26, yF - depth * 0.30);
      ctx.quadraticCurveTo(0, yF - depth * 0.52, wT * 0.22, yF - depth * 0.24);
      ctx.stroke();
      ctx.restore();
      contour(ctx, top, R, 0.26);

      // ---- 切面（夹层）----
      const face = new Path2D();
      face.moveTo(-wB / 2, bot);
      face.lineTo(wB / 2, bot);
      face.lineTo(wT / 2, yF + R * 0.02);
      face.lineTo(-wT / 2, yF + R * 0.02);
      face.closePath();
      ctx.save();
      ctx.clip(face);
      const bands = [
        [0.00, 0.16, '#d99856'],   // 底部焦皮
        [0.16, 0.52, '#f2c489'],   // 海绵
        [0.52, 0.62, '#fff8ea'],   // 奶油
        [0.62, 0.72, '#e05572'],   // 果酱
        [0.72, 0.84, '#fff8ea'],   // 奶油
        [0.84, 1.00, '#f7d19b'],   // 海绵
      ];
      for (const bd of bands) {
        ctx.fillStyle = bd[2];
        ctx.fillRect(-wB, bot - fh * bd[1], wB * 2, fh * (bd[1] - bd[0]) + 1);
      }
      // 切面左侧受光
      const fg = ctx.createLinearGradient(-wB / 2, 0, wB / 2, 0);
      fg.addColorStop(0, 'rgba(255,255,255,0.26)');
      fg.addColorStop(0.45, 'rgba(255,255,255,0)');
      fg.addColorStop(1, 'rgba(120,70,30,0.16)');
      ctx.fillStyle = fg;
      ctx.fillRect(-wB, yF, wB * 2, fh);
      ctx.restore();
      contour(ctx, face, R, 0.30);

      // 糖霜从顶面垂到切面上沿，遮住生硬的分界
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-wT / 2, yF);
      ctx.lineTo(wT / 2, yF);
      for (let i = 3; i >= 0; i--) {
        const t0 = i / 3;
        const px = wT / 2 - wT * t0;
        const dip = R * (0.16 + 0.10 * Math.sin(i * 2.1));
        ctx.lineTo(px, yF + dip);
      }
      ctx.closePath();
      ctx.fillStyle = '#fffaf4';
      ctx.fill();
      ctx.restore();

      drawStrawberry(ctx, wT * 0.06, apexY + R * 0.26, R * 0.20);
    } else if (t.top === 'donut') {
      const th = R * 0.34;                       // 侧壁厚度（有厚度才不像贴纸）
      const cy = bot - H * 0.36 - th;
      const rx = W * 0.50, ry = H * 0.40;
      // 侧壁：下半圈 + 直壁，构成圆柱侧面
      const wallG = ctx.createLinearGradient(0, cy, 0, cy + th + ry);
      wallG.addColorStop(0, '#cf9050');
      wallG.addColorStop(0.55, '#b0703a');
      wallG.addColorStop(1, '#82501f');
      ctx.fillStyle = wallG;
      ctx.beginPath();
      ctx.ellipse(0, cy + th, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-rx, cy, rx * 2, th);
      // 顶面
      const dough = new Path2D();
      dough.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
      const dg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
      dg.addColorStop(0, '#e8b878');
      dg.addColorStop(1, '#b8783f');
      ctx.fillStyle = dg;
      ctx.fill(dough);
      // 糖霜
      const glz = new Path2D();
      glz.ellipse(0, cy - R * 0.05, rx * 0.92, ry * 0.90, 0, 0, Math.PI * 2);
      ctx.save();
      ctx.clip(dough);
      ctx.fillStyle = t.cup;
      ctx.fill(glz);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = R * 0.07;
      ctx.stroke(glz);
      ctx.restore();
      // 洞
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ell(ctx, 0, cy, rx * 0.30, ry * 0.27);
      ctx.fill();
      ctx.restore();
      // 洞内暗影
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = '#7a4a22';
      ctx.beginPath();
      ctx.ellipse(rx * 0.02, cy - ry * 0.03, rx * 0.34, ry * 0.31, 0, 0, 6.3);
      ctx.ellipse(0, cy, rx * 0.30, ry * 0.27, 0, 0, 6.3);
      ctx.fill('evenodd');
      ctx.restore();
      contour(ctx, dough, R, 0.34);
      // 糖粒
      const cols = ['#ffffff', '#ffd93b', '#5fd0f0', '#ff5f92', '#8be07a'];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.35;
        const k = 0.56 + (i % 3) * 0.13;
        const px = Math.cos(a) * rx * k, py = cy - R * 0.05 + Math.sin(a) * ry * k;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * 1.6);
        ctx.fillStyle = cols[i % 5];
        rr(ctx, -R * 0.085, -R * 0.032, R * 0.17, R * 0.064, R * 0.03);
        ctx.fill();
        ctx.restore();
      }
    } else if (t.top === 'mousse') {
      const h = H * 0.66, w = W * 0.68;
      const topY = bot - h;
      // 玻璃杯（上宽下窄 + 圆底）
      const glass = new Path2D();
      glass.moveTo(-w / 2, topY);
      glass.lineTo(w / 2, topY);
      glass.lineTo(w * 0.42, topY + h - R * 0.10);
      glass.quadraticCurveTo(0, topY + h + R * 0.10, -w * 0.42, topY + h - R * 0.10);
      glass.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.60)';
      ctx.fill(glass);
      ctx.save();
      ctx.clip(glass);
      // 分层：草莓 / 奶油 / 紫薯 / 奶油（自下而上）
      const layers = [
        [0.00, 0.34, '#ef7086'],
        [0.34, 0.50, '#fff4ec'],
        [0.50, 0.74, '#b98ed2'],
        [0.74, 1.00, '#fff8f0'],
      ];
      for (const ly of layers) {
        ctx.fillStyle = ly[2];
        ctx.fillRect(-w, topY + h * (1 - ly[1]), w * 2, h * (ly[1] - ly[0]) + 1);
      }
      // 玻璃反光
      const hg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      hg.addColorStop(0, 'rgba(255,255,255,0.55)');
      hg.addColorStop(0.30, 'rgba(255,255,255,0.05)');
      hg.addColorStop(0.72, 'rgba(255,255,255,0)');
      hg.addColorStop(1, 'rgba(255,255,255,0.40)');
      ctx.fillStyle = hg;
      ctx.fillRect(-w, topY, w * 2, h);
      ctx.restore();
      contour(ctx, glass, R, 0.30);
      // 杯口金边
      ctx.strokeStyle = '#d8a94e';
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.ellipse(0, topY, w * 0.5, R * 0.10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 顶层奶油 + 装饰
      const cp = cream(ctx, w * 1.0, R * 0.46, topY + R * 0.03);
      contour(ctx, cp, R, 0.20);
      cherry(ctx, w * 0.22, topY - R * 0.50, R * 0.14);
      drawStrawberry(ctx, -w * 0.26, topY - R * 0.30, R * 0.16);
    } else if (t.top === 'two') {
      const wB = W * 0.94, hB = H * 0.30;
      const wT = W * 0.72, hT = H * 0.26;
      const yB = bot - hB;
      const yT = yB - hT;
      // 下层
      const pb = rrP(-wB / 2, yB, wB, hB + R * 0.05, R * 0.10);
      const gb = ctx.createLinearGradient(0, yB, 0, yB + hB);
      gb.addColorStop(0, '#fbe6c4');
      gb.addColorStop(1, '#e0b27a');
      ctx.fillStyle = gb;
      ctx.fill(pb);
      ctx.save();
      ctx.clip(pb);
      ctx.fillStyle = t.liquid;
      ctx.fillRect(-wB, yB + hB * 0.50, wB * 2, hB * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(-wB, yB + hB * 0.66, wB * 2, hB * 0.10);
      ctx.restore();
      volume(ctx, pb, -wB, yB, wB, hB, 0.18, 0.24);
      contour(ctx, pb, R, 0.30);
      glaze(ctx, wB * 1.00, yB + R * 0.01, R * 0.24, shadeHex(t.liquid, 0.14), 5);
      // 上层
      const pt = rrP(-wT / 2, yT, wT, hT + R * 0.05, R * 0.09);
      const gt = ctx.createLinearGradient(0, yT, 0, yT + hT);
      gt.addColorStop(0, '#fdf1d8');
      gt.addColorStop(1, '#e8be86');
      ctx.fillStyle = gt;
      ctx.fill(pt);
      ctx.save();
      ctx.clip(pt);
      ctx.fillStyle = t.cup;
      ctx.fillRect(-wT, yT + hT * 0.48, wT * 2, hT * 0.16);
      ctx.restore();
      volume(ctx, pt, -wT, yT, wT, hT, 0.24, 0.20);
      contour(ctx, pt, R, 0.30);
      glaze(ctx, wT * 1.02, yT - R * 0.01, R * 0.34, t.liquid, 4);
      cherry(ctx, 0, yT - R * 0.40, R * 0.17);
    } else {
      // 三层蛋糕
      const tiers = [
        { w: W * 0.98, h: H * 0.26, c1: '#fbe7c6', c2: '#e0b27b', gl: '#f7a8bd', jam: '#e8687f' },
        { w: W * 0.76, h: H * 0.24, c1: '#fdf0da', c2: '#e9c08c', gl: '#fff0e6', jam: '#f5b7c8' },
        { w: W * 0.54, h: H * 0.22, c1: '#fff7e6', c2: '#eecb96', gl: '#f7a8bd', jam: '#e8687f' },
      ];
      let y = bot;
      for (let i = 0; i < tiers.length; i++) {
        const tt = tiers[i];
        y -= tt.h;
        const p = rrP(-tt.w / 2, y, tt.w, tt.h + R * 0.05, R * 0.07);
        const g = ctx.createLinearGradient(0, y, 0, y + tt.h);
        g.addColorStop(0, tt.c1);
        g.addColorStop(1, tt.c2);
        ctx.fillStyle = g;
        ctx.fill(p);
        ctx.save();
        ctx.clip(p);
        ctx.fillStyle = tt.jam;
        ctx.fillRect(-tt.w, y + tt.h * 0.50, tt.w * 2, tt.h * 0.14);
        ctx.restore();
        volume(ctx, p, -tt.w, y, tt.w, tt.h, 0.20, 0.22);
        contour(ctx, p, R, 0.30);
        glaze(ctx, tt.w * 1.01, y - R * 0.01, R * 0.30, tt.gl, 5);
        ctx.fillStyle = '#e8c15c';
        for (let k = 0; k < 6; k++) {
          ell(ctx, -tt.w * 0.38 + k * tt.w * 0.152, y + tt.h * 0.80, R * 0.030, R * 0.030);
          ctx.fill();
        }
      }
      // 蜡烛
      for (let i = -1; i <= 1; i++) {
        const cx = i * R * 0.20;
        ctx.fillStyle = ['#f28fb1', '#8ec96e', '#7fc5e8'][i + 1];
        rr(ctx, cx - R * 0.04, y - R * 0.44, R * 0.08, R * 0.46, R * 0.03);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        rr(ctx, cx - R * 0.04, y - R * 0.44, R * 0.026, R * 0.46, R * 0.012);
        ctx.fill();
        const fg = ctx.createRadialGradient(cx, y - R * 0.52, 0, cx, y - R * 0.52, R * 0.11);
        fg.addColorStop(0, '#fff8cc');
        fg.addColorStop(0.45, '#ffb703');
        fg.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = fg;
        ell(ctx, cx, y - R * 0.52, R * 0.064, R * 0.11);
        ctx.fill();
      }
      drawStrawberry(ctx, W * 0.33, bot - H * 0.20, R * 0.17);
    }
  }

  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /* ===========================================================
     顾客头像
     =========================================================== */
  function drawCustomer(ctx, i, S) {
    // S = 头像半径
    // 12 种顾客形象：发色/肤色/衣服/发型组合各不相同（skin 0~11）
    // style: long 长发 | curly 卷发 | panda 熊猫 | short 短发 | bun 丸子头 | twin 双马尾
    const skins = [
      { hair: '#f6c26b', skin: '#ffe0c9', shirt: '#f28fb1', style: 'long' },
      { hair: '#5b3a2a', skin: '#f6d3b3', shirt: '#7fc5e8', style: 'curly' },
      { hair: '#ffffff', skin: '#fff2e6', shirt: '#8ec96e', style: 'panda' },
      { hair: '#c9743f', skin: '#ffe6d2', shirt: '#f7c6d3', style: 'short' },
      { hair: '#3f4a63', skin: '#fbe0c6', shirt: '#ffd166', style: 'bun' },
      { hair: '#8e5aa8', skin: '#f3d8bd', shirt: '#a5e3d0', style: 'twin' },
      { hair: '#d94f4f', skin: '#fff0dc', shirt: '#6fa8f5', style: 'long' },
      { hair: '#2f2f33', skin: '#e8c39e', shirt: '#f2a2c0', style: 'short' },
      { hair: '#6b4a2f', skin: '#d9a877', shirt: '#c9b6f0', style: 'curly' },
      { hair: '#9aa7b8', skin: '#ffe9d6', shirt: '#f9a76c', style: 'bun' },
      { hair: '#3f7d5a', skin: '#ffe8d2', shirt: '#f6a5c0', style: 'long' },
      { hair: '#f0efe9', skin: '#e8bb95', shirt: '#4f86c6', style: 'twin' },
    ];
    const s = skins[i % skins.length];
    ctx.save();
    // 衣服
    ctx.fillStyle = s.shirt;
    ctx.beginPath();
    ctx.ellipse(0, S * 0.95, S * 0.92, S * 0.62, 0, Math.PI, 0);
    ctx.fill();
    if (s.style === 'panda') {
      // 布布：熊猫
      ctx.fillStyle = '#ffffff';
      ell(ctx, 0, 0, S * 0.78, S * 0.76);
      ctx.fill();
      ctx.fillStyle = '#2f2f33';
      ell(ctx, -S * 0.62, -S * 0.52, S * 0.26, S * 0.24);
      ctx.fill();
      ell(ctx, S * 0.62, -S * 0.52, S * 0.26, S * 0.24);
      ctx.fill();
      ell(ctx, -S * 0.3, -S * 0.05, S * 0.2, S * 0.24);
      ctx.fill();
      ell(ctx, S * 0.3, -S * 0.05, S * 0.2, S * 0.24);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ell(ctx, -S * 0.27, -S * 0.1, S * 0.07, S * 0.09);
      ctx.fill();
      ell(ctx, S * 0.33, -S * 0.1, S * 0.07, S * 0.09);
      ctx.fill();
      ctx.fillStyle = '#2f2f33';
      ell(ctx, 0, S * 0.22, S * 0.1, S * 0.07);
      ctx.fill();
      // 红头带
      ctx.fillStyle = '#e05a4f';
      rr(ctx, -S * 0.8, -S * 0.62, S * 1.6, S * 0.2, S * 0.07);
      ctx.fill();
    } else {
      // 头发后层
      ctx.fillStyle = s.hair;
      if (s.style === 'long' || s.style === 'twin') {
        ctx.beginPath();
        ctx.ellipse(0, S * 0.12, S * 0.86, S * 0.92, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.style === 'bun') {
        ctx.beginPath();
        ctx.ellipse(0, S * 0.10, S * 0.76, S * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 双马尾：两侧发束（画在头之前，被头挡住一半）
      if (s.style === 'twin') {
        ctx.beginPath();
        ctx.ellipse(-S * 0.82, S * 0.26, S * 0.22, S * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(S * 0.82, S * 0.26, S * 0.22, S * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 头
      ctx.fillStyle = s.skin;
      ell(ctx, 0, -S * 0.02, S * 0.68, S * 0.72);
      ctx.fill();
      // 刘海
      ctx.fillStyle = s.hair;
      ctx.beginPath();
      ctx.ellipse(0, -S * 0.4, S * 0.7, S * 0.5, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      if (s.style === 'curly') {
        for (let k = 0; k < 5; k++) {
          ell(ctx, -S * 0.55 + k * S * 0.28, -S * 0.52, S * 0.2, S * 0.2);
          ctx.fill();
        }
      }
      // 丸子头：头顶发髻
      if (s.style === 'bun') {
        ctx.fillStyle = s.hair;
        ell(ctx, 0, -S * 0.92, S * 0.28, S * 0.26);
        ctx.fill();
      }
      // 眼睛
      ctx.fillStyle = '#40302c';
      ell(ctx, -S * 0.24, S * 0.03, S * 0.075, S * 0.1);
      ctx.fill();
      ell(ctx, S * 0.24, S * 0.03, S * 0.075, S * 0.1);
      ctx.fill();
      // 腮红
      shade(ctx, -S * 0.44, S * 0.26, S * 0.14, S * 0.09, '#f58a9a', 0.55);
      shade(ctx, S * 0.44, S * 0.26, S * 0.14, S * 0.09, '#f58a9a', 0.55);
      // 嘴
      ctx.strokeStyle = '#a4614f';
      ctx.lineWidth = S * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, S * 0.22, S * 0.12, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ===========================================================
     软阴影贴图（预渲染，绘制时按尺寸缩放）
     =========================================================== */
  let shadowSpr = null;
  function buildShadow() {
    const S = 128;
    const c = mk(S, S);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(64,38,20,0.90)');
    g.addColorStop(0.34, 'rgba(64,38,20,0.72)');
    g.addColorStop(0.62, 'rgba(64,38,20,0.26)');
    g.addColorStop(1, 'rgba(64,38,20,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    shadowSpr = c;
  }

  /* ===========================================================
     背景 / 桌面（静态层，缓存）
     =========================================================== */
  function buildScene(L) {
    // 背景层按主画布同一个像素比烘焙（L.px 由 layout 算出，≈ 屏幕物理像素）。
    // 原来固定 SS=2 超采样，2340 高时会烘出 4680px 的位图 —— 超过安卓 GPU
    // 单纹理上限（2048/4096），每帧都退化成 CPU 拷贝，是闪屏的主因之一。
    const k = L.px && L.px > 0 ? L.px : SS;
    const c = mk(L.W * k, L.H * k);
    const ctx = c.getContext('2d');
    ctx.scale(k, k);

    // 墙面
    const wall = ctx.createLinearGradient(0, 0, 0, L.table.y + L.table.h);
    wall.addColorStop(0, '#f3e3cd');
    wall.addColorStop(0.55, '#f7ead8');
    wall.addColorStop(1, '#efdcc2');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, L.W, L.H);

    // 墙纸竖纹
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#c08a52';
    for (let x = 0; x < L.W; x += 54) ctx.fillRect(x, 0, 18, L.table.y + 40);
    ctx.restore();

    // 顶部暖光
    const glow = ctx.createRadialGradient(L.W * 0.5, -120, 60, L.W * 0.5, -120, L.W * 0.95);
    glow.addColorStop(0, 'rgba(255,246,214,0.95)');
    glow.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, L.W, L.table.y + 260);

    // 墙上小挂饰（左右各一个相框，避开顶栏与订单卡）
    (function frame(x, y, w, h, tilt) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = '#c99a63';
      rr(ctx, -w / 2, -h / 2, w, h, 12);
      ctx.fill();
      ctx.fillStyle = '#fdf3e0';
      rr(ctx, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 6);
      ctx.fill();
      ctx.fillStyle = '#e9c9a0';
      ctx.beginPath();
      ctx.arc(0, 6, w * 0.16, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#b6d59a';
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, h * 0.16);
      ctx.lineTo(0, -h * 0.04);
      ctx.lineTo(w * 0.24, h * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    })(96, L.table.y - 86, 96, 78, -0.06);
    (function frame(x, y, w, h, tilt) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = '#c99a63';
      rr(ctx, -w / 2, -h / 2, w, h, 12);
      ctx.fill();
      ctx.fillStyle = '#fdf3e0';
      rr(ctx, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 6);
      ctx.fill();
      ctx.fillStyle = '#f7c6d3';
      ctx.beginPath();
      ctx.arc(0, 4, w * 0.2, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 4, w * 0.1, 0, 6.3);
      ctx.fill();
      ctx.restore();
    })(L.W - 96, L.table.y - 96, 84, 70, 0.07);

    // 两侧绿植
    function plant(x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#c98a5a';
      ctx.beginPath();
      ctx.moveTo(-30 * s, 0);
      ctx.lineTo(30 * s, 0);
      ctx.lineTo(22 * s, 42 * s);
      ctx.lineTo(-22 * s, 42 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7aa85a';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.42;
        ctx.save();
        ctx.translate(0, -6 * s);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -34 * s, 13 * s, 34 * s, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    plant(L.W * 0.09, L.table.y + 30, 1.15);
    plant(L.W * 0.91, L.table.y + 30, 1.15);

    // ============ 木台（俯视透视：近宽远窄）============
    const t = L.table;
    const oT = 11;   // 远端桌沿外扩（薄）
    const oB = 48;   // 近端桌沿外扩（厚 → 俯视感）

    // 桌面落在墙面上的投影
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#6b3f1c';
    taperFrame(ctx, t.x, t.y + 20, t.w, t.h, oT, oB + 10, 56);
    ctx.fill();
    ctx.restore();

    // 木框主体
    const frameG = ctx.createLinearGradient(0, t.y - oT, 0, t.y + t.h + oB);
    frameG.addColorStop(0, '#d9a26a');
    frameG.addColorStop(0.10, '#c68b52');
    frameG.addColorStop(0.62, '#b87d47');
    frameG.addColorStop(1, '#8d5a2d');
    ctx.fillStyle = frameG;
    taperFrame(ctx, t.x, t.y, t.w, t.h, oT, oB, 56);
    ctx.fill();

    // 木纹（远端密、近端疏）
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = '#4d2a10';
    ctx.lineWidth = 3;
    let yy = t.y - oT;
    while (yy < t.y + t.h + oB) {
      const p = Math.max(0, Math.min(1, (yy - t.y) / t.h));
      const ex = oT + (oB - oT) * p;
      ctx.beginPath();
      ctx.moveTo(t.x - ex + 5, yy);
      ctx.bezierCurveTo(L.W * 0.32, yy + 5, L.W * 0.68, yy - 5, t.x + t.w + ex - 5, yy);
      ctx.stroke();
      yy += 18 + p * 16;
    }
    ctx.restore();

    // ============ 布面（远端略收，配合透视）============
    const cT = -6;
    const cloth = ctx.createLinearGradient(0, t.y, 0, t.y + t.h);
    cloth.addColorStop(0, '#e2c9a6');
    cloth.addColorStop(0.16, '#efdabc');
    cloth.addColorStop(0.60, '#f6e7ce');
    cloth.addColorStop(1, '#fdf4e4');
    ctx.fillStyle = cloth;
    taperFrame(ctx, t.x, t.y, t.w, t.h, cT, 0, 44);
    ctx.fill();

    ctx.save();
    taperFrame(ctx, t.x, t.y, t.w, t.h, cT, 0, 44);
    ctx.clip();

    // 斜纹亚麻（远端密、近端疏）
    ctx.globalAlpha = 0.036;
    ctx.strokeStyle = '#a87a4a';
    ctx.lineWidth = 7;
    let sx = -t.h * 0.6;
    while (sx < t.w) {
      const p = Math.max(0, Math.min(1, (sx + t.h * 0.5) / (t.w + t.h * 0.5)));
      ctx.beginPath();
      ctx.moveTo(t.x + sx, t.y);
      ctx.lineTo(t.x + sx + t.h, t.y + t.h);
      ctx.stroke();
      sx += 34 + p * 30;
    }

    // 横向褶皱（近端更疏）
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = 15;
    for (let i = 1; i <= 4; i++) {
      const yy = t.y + Math.pow(i / 5, 1.3) * t.h;
      ctx.beginPath();
      ctx.moveTo(t.x, yy);
      ctx.bezierCurveTo(t.x + t.w * 0.3, yy - 9, t.x + t.w * 0.7, yy + 9, t.x + t.w, yy);
      ctx.stroke();
    }

    // 内阴影：远端（背光）更暗
    const ig = ctx.createLinearGradient(0, t.y, 0, t.y + t.h * 0.42);
    ig.addColorStop(0, 'rgba(132,88,50,0.34)');
    ig.addColorStop(1, 'rgba(132,88,50,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = ig;
    ctx.fillRect(t.x - 30, t.y - 10, t.w + 60, t.h * 0.42 + 10);

    // 两侧内阴影
    const sideG = ctx.createLinearGradient(t.x, 0, t.x + t.w, 0);
    sideG.addColorStop(0, 'rgba(132,88,50,0.24)');
    sideG.addColorStop(0.12, 'rgba(132,88,50,0)');
    sideG.addColorStop(0.88, 'rgba(132,88,50,0)');
    sideG.addColorStop(1, 'rgba(132,88,50,0.24)');
    ctx.fillStyle = sideG;
    ctx.fillRect(t.x, t.y, t.w, t.h);

    // 近端内阴影：贴着桌沿的暗带，让布面读作「凹进去的台面」而不是一块平贴的纸
    const nearG = ctx.createLinearGradient(0, t.y + t.h, 0, t.y + t.h - 150);
    nearG.addColorStop(0, 'rgba(120,76,40,0.30)');
    nearG.addColorStop(0.45, 'rgba(120,76,40,0.10)');
    nearG.addColorStop(1, 'rgba(120,76,40,0)');
    ctx.fillStyle = nearG;
    ctx.fillRect(t.x, t.y + t.h - 150, t.w, 150);

    // 整体压角：四周略暗，中间受光
    const vg = ctx.createRadialGradient(
      t.x + t.w / 2, t.y + t.h * 0.54, t.w * 0.26,
      t.x + t.w / 2, t.y + t.h * 0.54, t.w * 0.88
    );
    vg.addColorStop(0, 'rgba(148,98,56,0)');
    vg.addColorStop(1, 'rgba(148,98,56,0.20)');
    ctx.fillStyle = vg;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.restore();

    // 布面边缘受光
    ctx.save();
    ctx.strokeStyle = 'rgba(255,250,235,0.38)';
    ctx.lineWidth = 3.5;
    taperFrame(ctx, t.x + 3, t.y + 3, t.w - 6, t.h - 6, cT, 0, 42);
    ctx.stroke();
    ctx.restore();

    // 近端桌沿内侧面（厚度暗示）
    const lipG = ctx.createLinearGradient(0, t.y + t.h, 0, t.y + t.h + oB);
    lipG.addColorStop(0, 'rgba(88,50,20,0.34)');
    lipG.addColorStop(1, 'rgba(88,50,20,0)');
    ctx.fillStyle = lipG;
    ctx.fillRect(t.x - oB, t.y + t.h + 1, t.w + oB * 2, oB);

    // 底部柜台（桌面下方）
    const cy = t.y + t.h + oB + 18;
    if (cy < L.H) {
      const cg = ctx.createLinearGradient(0, cy, 0, L.H);
      cg.addColorStop(0, '#c0854f');
      cg.addColorStop(1, '#9c6338');
      ctx.fillStyle = cg;
      ctx.fillRect(0, cy, L.W, L.H - cy);
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#4a2b12';
      ctx.lineWidth = 4;
      for (let x = 0; x < L.W; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.lineTo(x, L.H);
        ctx.stroke();
      }
      ctx.restore();
      // 柜台上沿阴影
      ctx.fillStyle = 'rgba(80,45,15,0.25)';
      ctx.fillRect(0, cy, L.W, 10);
    }

    // 四周暗角
    const vig = ctx.createRadialGradient(L.W / 2, L.H * 0.45, L.H * 0.35, L.W / 2, L.H * 0.45, L.H * 0.85);
    vig.addColorStop(0, 'rgba(60,30,10,0)');
    vig.addColorStop(1, 'rgba(60,30,10,0.20)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, L.W, L.H);

    return c;
  }

  /* ===========================================================
     初始化精灵
     =========================================================== */
  function build() {
    buildShadow();
    const all = [];
    window.CFG.tea.forEach(t => all.push(t));
    window.CFG.cake.forEach(t => all.push(t));
    all.forEach(t => {
      const R = t.r;
      const size = R * 2.16;
      const c = mk(size * SS, size * SS);
      const ctx = c.getContext('2d');
      ctx.scale(SS, SS);
      ctx.translate(size / 2, size / 2);
      if (t.cat === 'tea') drawTea(ctx, t, R);
      else drawCake(ctx, t, R);
      sprites[t.cat + t.tier] = { cv: c, size: size };
      if (t.cat === 'tea') teaBase[t.cat + t.tier] = { cv: c, size: size, custom: false };
      // DOM 图标
      const ico = mk(160, 160);
      const ictx = ico.getContext('2d');
      ictx.drawImage(c, 0, 0, 160, 160);
      icons[t.cat + t.tier] = ico.toDataURL('image/png');
    });

    // 顾客头像（数量跟随 CFG.customers，当前 12 种）
    for (let i = 0; i < CFG.customers.length; i++) {
      const size = 220;
      const c = mk(size * SS, size * SS);
      const ctx = c.getContext('2d');
      ctx.scale(SS, SS);
      ctx.translate(size / 2, size / 2);
      drawCustomer(ctx, i, size * 0.40);
      sprites['cus' + i] = { cv: c, size: size };
      const ico = mk(160, 160);
      ico.getContext('2d').drawImage(c, 0, 0, 160, 160);
      icons['cus' + i] = ico.toDataURL('image/png');
    }

    loadCustom(all);
    loadCustomCustomers();
    loadLogo();
  }

  /* ===========================================================
     自制图片素材（可选）
     把下列文件放进 assets/ 目录就会自动替换内置绘制，缺哪个就用回内置版：
       奶茶   tea1.png ~ tea8.png
       蛋糕   cake1.png ~ cake6.png
       顾客头像 cus0.png ~ cus11.png   （512×512 正方形，脸居中，建议不透明）
     要求：正方形、内容占画布约 92.6%（四周留透明边，头像可不留）
     =========================================================== */
  const CUSTOM_DIR = 'assets/';
  const CUSTOM_EXT = ['png', 'webp', 'jpg', 'jpeg'];
  const customState = {};   // key -> 'none' | 'loaded' | 'missing'

  // 通用的「探测式」加载：按 png→webp→jpg 顺序尝试，命中即用
  function probeCustom(key, onLoaded) {
    customState[key] = 'none';
    let i = 0;
    const next = () => {
      if (i >= CUSTOM_EXT.length) { customState[key] = 'missing'; return; }
      const ext = CUSTOM_EXT[i++];
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth) { next(); return; }
        onLoaded(img);
        customState[key] = 'loaded';
        // 让 HUD 重新拉一次图标
        if (window.UI && window.UI.invalidate) window.UI.invalidate();
      };
      img.onerror = () => next();
      img.src = CUSTOM_DIR + key + '.' + ext;
    };
    next();
  }

  function loadCustom(list) {
    list.forEach(t => {
      const key = t.cat + t.tier;
      const keepSize = sprites[key].size;
      probeCustom(key, img => {
        if (t.cat === 'tea') {
          // 奶茶：先存「原图」，再统一走 LOGO 焙印
          teaBase[key] = { cv: img, size: keepSize, custom: true };
          bakeTea(key);
        } else {
          sprites[key] = { cv: img, size: keepSize, custom: true };
          icons[key] = img.src;
        }
      });
    });
  }

  /* ===========================================================
     奶茶杯品牌 LOGO
     assets/logo.png（或 webp/jpg）会被烙印到每只奶茶杯上，
     无论杯子是内置程序化绘制还是用户自制图片，都会自动带上。
     =========================================================== */
  function loadLogo() {
    if (!CFG.brand || !CFG.brand.logoFile) return;
    const exts = ['png', 'webp', 'jpg', 'jpeg'];
    let i = 0;
    const next = () => {
      if (i >= exts.length) return;
      const ext = exts[i++];
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth) { next(); return; }
        logoImg = img; logoReady = true;
        rebakeAllTea();
      };
      img.onerror = () => next();
      img.src = CUSTOM_DIR + CFG.brand.logoFile + '.' + ext;
    };
    next();
  }

  // LOGO 在精灵上的位置/尺寸（与杯子半径 R 成比例），所有渲染位共用
  function logoGeom(dev) {
    // dev = 设备像素下的杯子半径
    const lw = dev * CFG.brand.scale;
    return {
      lw,
      lx: dev * 2.16 / 2 + dev * CFG.brand.dx,   // 画布宽 = R*2.16 → 中心 + 偏移
      ly: dev * 2.16 / 2 + dev * CFG.brand.dy,
    };
  }

  // 把 LOGO 焙印进某一档奶茶：以 teaBase[key] 为底，叠加 LOGO 后写回 sprites + icons
  function bakeTea(key) {
    const base = teaBase[key];
    if (!base) return;
    if (!logoReady) {                 // 还没 LOGO：直接用原图（保证 no-logo 时行为不变）
      sprites[key] = base;
      rebakeIcon(key, base.cv);
      return;
    }
    const W = Math.ceil(base.size * SS), H = Math.ceil(base.size * SS);
    const cv = mk(W, H);
    const ctx = cv.getContext('2d');
    ctx.drawImage(base.cv, 0, 0, W, H);   // 程序化与自制图片都统一缩放进 W×H
    const Rdev = W / 2.16;                 // size = R*2.16 → 还原杯子半径（设备像素）
    const g = logoGeom(Rdev);
    ctx.drawImage(logoImg, g.lx - g.lw / 2, g.ly - g.lw / 2, g.lw, g.lw);
    sprites[key] = { cv, size: base.size, custom: base.custom };
    rebakeIcon(key, cv);
  }

  function rebakeIcon(key, cv) {
    try {
      // 部分环境下（直接 file:// 打开）跨域图片会让画布被「污染」，
      // toDataURL 会抛 SecurityError。这里 try 住：失败就保留原图标（无 LOGO 版），绝不中断循环。
      const ico = mk(160, 160);
      ico.getContext('2d').drawImage(cv, 0, 0, 160, 160);
      icons[key] = ico.toDataURL('image/png');
    } catch (e) {
      /* tainted canvas（file:// 场景）：保留 build() 阶段已生成的原图标 */
    }
  }

  function rebakeAllTea() {
    // 逐档焙印，且每一档独立 try —— 任何一档失败都不能中断其它档（这正是之前「只有最低级奶茶有 LOGO」的根因）
    Object.keys(teaBase).forEach(k => {
      try { bakeTea(k); }
      catch (e) { if (window.console) console.error('[Art] bakeTea', k, e); }
    });
    if (window.UI && window.UI.invalidate) window.UI.invalidate();
  }

  // 生成「带 LOGO 的图标」为实时 <canvas>（不调用 toDataURL，因此 file:// 下也能正常显示 LOGO）。
  // 用于 HUD（订单卡 / 菜单 / 商店），避免被跨域画布污染问题卡住。
  function makeIcon(cat, tier, px) {
    px = px || 160;
    const c = mk(px, px);
    const x = c.getContext('2d');
    const sp = sprites[cat + tier];
    if (sp) x.drawImage(sp.cv, 0, 0, px, px);
    if (cat === 'tea' && logoReady && logoImg) {
      const dev = px / 2.16;              // 图标内杯子半径（CSS 像素）
      const g = logoGeom(dev);
      x.drawImage(logoImg, g.lx - g.lw / 2, g.ly - g.lw / 2, g.lw, g.lw);
    }
    return c;
  }

  // 顾客头像也支持自制替换（cus0.png ~ cus11.png，数量跟随 CFG.customers）
  function loadCustomCustomers() {
    for (let i = 0; i < CFG.customers.length; i++) {
      const key = 'cus' + i;
      if (!sprites[key]) continue;
      const keepSize = sprites[key].size;
      probeCustom(key, img => {
        sprites[key] = { cv: img, size: keepSize, custom: true };
        icons[key] = img.src;
      });
    }
  }

  // 排查用：返回哪些物品用了自制图，以及 LOGO 状态
  function customReport() {
    const out = { loaded: [], missing: [], logo: 'disabled' };
    Object.keys(customState).forEach(k => {
      (customState[k] === 'loaded' ? out.loaded : out.missing).push(k);
    });
    out.logo = !CFG.brand || !CFG.brand.logoFile ? 'disabled'
      : (logoReady ? 'loaded' : 'missing');
    return out;
  }

  function soul(cat, tier) {
    return sprites[cat + tier];
  }

  return {
    build, buildScene, soul, customReport,
    rebakeLogos: rebakeAllTea,   // 强制把 LOGO 重新烙印到全部奶茶档（兜底用）
    shadow: () => shadowSpr,
    icon: (cat, tier) => icons[cat + tier] || '',
    makeIcon,                    // 返回带 LOGO 的 <canvas>（HUD 用，file:// 也能显示）
    logoReady: () => logoReady,
    cusIcon: i => icons['cus' + i] || '',
    cusSprite: i => sprites['cus' + i],
    rr, ell, shade,
  };
})();
