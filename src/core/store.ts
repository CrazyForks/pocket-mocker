// src/core/store.ts
import { writable } from 'svelte/store';
import { type MockRule, updateRules } from './interceptor';

const STORAGE_KEY = 'pocket_mock_rules_v1';
let isServerMode = false; // 标记当前运行模式

export const rules = writable<MockRule[]>([]);

// === 1. 从 Dev Server 加载规则 ===
// === 初始化逻辑 ===
export const initStore = async () => {
  // 初始化确保是 LocalStorage 模式
  isServerMode = false;

  try {
    // 尝试连接 Dev Server，设置1秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const res = await fetch('/__pocket_mock/rules', {
      signal: controller.signal,
      cache: 'no-store' // 禁用缓存
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      isServerMode = true;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        rules.set(data);
        console.log('[PocketMock] 连接到 Dev Server，文件同步模式');
        return;
      } else {
        isServerMode = false; // 空数组，降级到 LocalStorage
      }
    } else {
      isServerMode = false;
    }
  } catch (e) {
    // 探测失败，使用 LocalStorage 模式
    isServerMode = false;
  }

  // 降级：读取 LocalStorage
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const data = JSON.parse(json);
      rules.set(data);
      console.log('[PocketMock] LocalStorage 模式，加载规则:', data.length, '条');
      return;
    }
  } catch (e) {
    console.error('[PocketMock] LocalStorage 读取失败:', e);
  }

  // 兜底：使用默认数据
  rules.set([{
    id: 'demo-1',
    url: '/api/demo',
    method: 'GET',
    response: { msg: 'Hello PocketMock' },
    enabled: true,
    delay: 500,
    status: 200,
    headers: {}
  }]);
  console.log('[PocketMock] LocalStorage 模式，使用默认规则');
};

// === 订阅与保存逻辑 ===
let saveTimer: any;
rules.subscribe((value) => {
  updateRules(value);

  // 防抖保存
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (isServerMode) {
      // Server 模式：保存到文件
      fetch('/__pocket_mock/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value, null, 2)
      }).catch(e => console.error('[PocketMock] 文件保存失败:', e));
    } else {
      // LocalStorage 模式：保存到浏览器
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (e) {
        console.error('[PocketMock] LocalStorage 保存失败:', e);
      }
    }
  }, 500);
});


export const toggleRule = (id: string) => {
  rules.update(items => items.map(r =>
    r.id === id ? { ...r, enabled: !r.enabled } : r
  ));
};

export const updateRuleResponse = (id: string, newResponseJson: string) => {
  try {
    const parsed = JSON.parse(newResponseJson);
    rules.update(items => items.map(r =>
      r.id === id ? { ...r, response: parsed } : r
    ));
    return true; // 更新成功
  } catch (e) {
    console.error("JSON 格式错误", e);
    return false; // 更新失败
  }
};

export const updateRuleDelay = (id: string, delay: number) => {
  rules.update(items => items.map(r => r.id === id ? { ...r, delay } : r));
};

// 新增：添加新规则
export const addRule = (url: string, method: string) => {
  const newRule: MockRule = {
    id: Date.now().toString(),
    url,
    method,
    response: { message: "Hello PocketMock" },
    enabled: true,
    delay: 0,
    status: 200,
    headers: {}
  };
  rules.update(items => [newRule, ...items]);
};


export const deleteRule = (id: string) => {
  rules.update(items => items.filter(r => r.id !== id));
}

export const updateRuleHeaders = (id: string, newHeadersJson: string) => {
  try {
    const parsed = JSON.parse(newHeadersJson);
    rules.update(items => items.map(r =>
      r.id === id ? { ...r, headers: parsed } : r
    ));
    return true;
  } catch (e) {
    console.error("Headers JSON 格式错误", e);
    return false;
  }
};

// 新增 action：更新状态码
export const updateRuleStatus = (id: string, status: number) => {
  rules.update(items => items.map(r => r.id === id ? { ...r, status } : r));
};