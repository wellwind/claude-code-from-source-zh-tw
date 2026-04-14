// 主題切換：系統 / 淺色 / 深色
// 內嵌版本在 <head> 中執行以防止閃爍（參見 BaseLayout）

export function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark' | 'system') {
  if (theme === 'system') {
    localStorage.removeItem('theme');
  } else {
    localStorage.setItem('theme', theme);
  }
  applyTheme();
  // 通知 React 元件更新其色彩配置
  window.dispatchEvent(new CustomEvent('theme-changed'));
}

export function applyTheme() {
  const theme = getTheme();
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}
