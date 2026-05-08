export const THEME_BOOTSTRAP_SCRIPT =
  "(()=>{try{const t=localStorage.getItem('muga.theme')||document.cookie.match(/(?:^|; )muga\\.theme=([^;]+)/)?.[1]||'system';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch{}})();";
