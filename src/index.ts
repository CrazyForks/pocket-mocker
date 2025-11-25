// src/index.ts
import Dashboard from './lib/dashboard.svelte';
import { initInterceptor } from './core/interceptor';
import { initStore } from './core/store';
// 引入全局样式字符串 (Vite 会把 CSS 变成字符串赋值给这个变量)
import globalStyles from './app.css?inline';

let app: Dashboard | null = null;
let shadowHost: HTMLElement | null = null;

export interface PocketMockOptions {
  enable?: boolean;
}

export function start(options: PocketMockOptions = {}) {
  // 1. 启动拦截器核心
  initInterceptor();

  // 2. 尝试连接 Dev Server 加载配置
  // (如果用户没配 Vite 插件，这个请求会 404，但不影响基本使用)
  initStore();

  // 3. 挂载 UI (Shadow DOM)
  mountUI();

  console.log('%c PocketMock Started 🚀', 'color: #00d1b2; font-weight: bold;');
}

function mountUI() {
  if (app) return; // 防止重复挂载

  // 创建宿主
  const hostId = 'pocket-mock-host';
  shadowHost = document.getElementById(hostId);
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = hostId;
    shadowHost.style.position = 'fixed';
    shadowHost.style.zIndex = '99999';
    document.body.appendChild(shadowHost);
  }

  const shadow = shadowHost.attachShadow({ mode: 'open' });

  // === 关键：自动注入样式 ===
  // 这样用户就不需要手动引入 CSS 文件了
  const styleTag = document.createElement('style');
  styleTag.textContent = globalStyles;
  shadow.appendChild(styleTag);

  // 挂载 Svelte 组件
  app = new Dashboard({
    target: shadow,
  });
}

// 导出类型定义，方便用户使用 TS
export type { MockRule } from './core/interceptor';