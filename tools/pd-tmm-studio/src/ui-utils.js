// 输入限制与绘图坐标共用范围裁剪，参数依次为数值、下限、上限
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// 非有限数值保留占位符，实际计算精度不在展示层截断
export const formatNumber = (value, digits = 3) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—';

// 层名会进入页面和 SVG，插入模板前转义文本中的特殊字符
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char],
  );
