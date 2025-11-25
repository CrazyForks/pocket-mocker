// src/core/store.ts
import { writable } from 'svelte/store';
import { type MockRule, updateRules } from './interceptor';

const STORAGE_KEY = 'pocket_mock_rules_v1';
let isServerMode = false; // Current runtime mode flag


export const rules = writable<MockRule[]>([]);

// === Initialization logic ===
export const initStore = async () => {
  // Initialize as LocalStorage mode
  isServerMode = false;

  try {
    // Try to connect to Dev Server with 1s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const res = await fetch('/__pocket_mock/rules', {
      signal: controller.signal,
      cache: 'no-store' // Disable cache
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      isServerMode = true;
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        rules.set(data);
        console.log(`[PocketMock] Server Mode: Loaded ${data.length} rules from file (${data.filter((r: any) => r.enabled).length} enabled)`);
        return;
      } else {
        isServerMode = false; // Empty array, fallback to LocalStorage
        console.log('[PocketMock] Server returned empty data, using LocalStorage');
      }
    } else {
      isServerMode = false;
    }
  } catch (e) {
    // Detection failed, use LocalStorage mode
    isServerMode = false;
  }

  // Fallback: read from LocalStorage
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const data = JSON.parse(json);
      rules.set(data);
      console.log(`[PocketMock] LocalStorage Mode: Loaded ${data.length} rules from browser (${data.filter((r: any) => r.enabled).length} enabled)`);
      return;
    }
  } catch (e) {
    console.error('[PocketMock] LocalStorage read failed:', e);
  }

  // Fallback: use default data
  const defaultRules = [{
    id: 'demo-1',
    url: '/api/demo',
    method: 'GET',
    response: { msg: 'Hello PocketMock' },
    enabled: true,
    delay: 500,
    status: 200,
    headers: {}
  }];

  rules.set(defaultRules);
  console.log('[PocketMock] Created default rules');
};

// === Subscription and save logic ===
let saveTimer: any;
rules.subscribe((value) => {
  updateRules(value);

  // Debounced save
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (isServerMode) {
      // Server mode: save to file
      fetch('/__pocket_mock/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value, null, 2)
      }).catch(e => console.error('[PocketMock] File save failed:', e));
    } else {
      // LocalStorage mode: save to browser
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (e) {
        console.error('[PocketMock] LocalStorage save failed:', e);
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
    return true;
  } catch (e) {
    console.error('[PocketMock] JSON format error:', e);
    return false;
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
    console.error('[PocketMock] Headers JSON format error:', e);
    return false;
  }
};

// 新增 action：更新状态码
export const updateRuleStatus = (id: string, status: number) => {
  rules.update(items => items.map(r => r.id === id ? { ...r, status } : r));
};