import Dashboard from './lib/dashboard.svelte'
import { initInterceptor } from './core/interceptor'
import { mount } from 'svelte'
import { initStore } from './core/store';

// 1. 启动拦截核心
initInterceptor();
initStore();
// 2. 挂载 Svelte 应用到 document.body
const app = mount(Dashboard, {
  target: document.body,
});

export default app;

// ... 下面的测试按钮逻辑保持不变 ...