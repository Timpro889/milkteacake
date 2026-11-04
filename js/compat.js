// 兼容性补丁：检测 Flexbox gap 支持情况。
// 容器最低内核为 Chrome 61（Android 8.1 WebView），其中 flex gap 尚未支持，
// 需要由 app.css 中的 .no-flex-gap 规则用子项 margin 兜底。
// 检测一次即可，不依赖 UA；支持则从 CSS 走 gap，不支持时给 <html> 加 .no-flex-gap。
(function () {
  function supportsFlexGap() {
    var flex = document.createElement('div');
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    var supported = flex.scrollHeight === 1;
    flex.parentNode.removeChild(flex);
    return supported;
  }
  try {
    if (!supportsFlexGap()) document.documentElement.classList.add('no-flex-gap');
  } catch (e) {}
})();
