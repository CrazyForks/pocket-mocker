import { requestLogs } from "./log-store";
import { appReady } from './store';

export interface MockRule {
  id: string;
  url: string;
  method: string;
  response: any;
  enabled: boolean;
  delay: number;
  status: number;
  headers: Record<string, string>
}

// Current rule list
let activeRules: MockRule[] = []

// Method for external updates to rules
export function updateRules(rules: MockRule[]) {
  activeRules = rules
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function patchFetch() {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // 1. 先解析 URL，不要 await
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());

    // 🔥【关键修复】🔥 
    // 如果是 PocketMock 自己的内部请求，直接放行，绝对不要 await appReady！
    // 否则会造成死锁：初始化在等 fetch，fetch 在等初始化
    if (url.includes('/__pocket_mock/')) {
      return originalFetch(input, init);
    }
    await appReady;

    const startTime = performance.now();
    const method = (init?.method || 'GET').toUpperCase();

    // 查找匹配且启用的规则
    const matchedRule = activeRules.find(r => {
      if (!r.enabled || r.method !== method) return false;
      const isExactMatch = url === r.url || url.endsWith(r.url);
      const isIncludeMatch = url.includes(r.url);
      return isExactMatch || isIncludeMatch;
    });

    if (matchedRule) {
      console.log(`[PocketMock] Fetch拦截: ${method} ${url}`);

      if (matchedRule.delay > 0) {
        await sleep(matchedRule.delay);
      }

      const duration = Math.round(performance.now() - startTime);
      requestLogs.add({
        method,
        url,
        status: matchedRule.status,
        timestamp: Date.now(),
        duration,
        isMock: true
      });

      // 检查响应数据格式
      let responseContent = matchedRule.response;
      let responseStatus = matchedRule.status;
      let responseHeaders = matchedRule.headers || {};

      if (matchedRule.response && typeof matchedRule.response === 'object') {
        const resp = matchedRule.response;
        if (resp.body && resp.status !== undefined) {
          // 包装格式：{status, headers, body}
          responseContent = resp.body;
          responseStatus = resp.status;
          responseHeaders = { ...responseHeaders, ...resp.headers };
        }
      }

      return new Response(
        typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent),
        {
          status: responseStatus,
          headers: {
            'Content-Type': 'application/json',
            ...responseHeaders
          }
        }
      );
    }

    return originalFetch(input, init);
  };
}

/**
 * Core: Intercept XMLHttpRequest (new addition)
 * Use inheritance to extend the native XHR class
 */

function patchXHR() {
  const OriginalXHR = window.XMLHttpRequest;

  class PocketXHR extends OriginalXHR {
    private _url: string = '';
    private _method: string = 'GET';
    private _startTime: number = 0;

    open(method: string, url: string | URL, ...args: any[]) {
      this._url = url.toString();
      this._method = method.toUpperCase();
      this._startTime = performance.now();
      // @ts-ignore
      super.open(method, url, ...args);
    }

    send(body?: any) {
      // 1. 白名单：如果是内部请求，直接放行
      if (this._url.includes('/__pocket_mock/')) {
        super.send(body);
        return;
      }

      // 2. 等待初始化完成并检查是否需要拦截
      (async () => {
        try {
          await appReady;

          const matchedRule = activeRules.find(r =>
            r.enabled && this._url.includes(r.url) && r.method === this._method
          );

          if (matchedRule) {
            console.log(`[PocketMock] XHR拦截: ${this._method} ${this._url}`);

            if (matchedRule.delay > 0) await sleep(matchedRule.delay);

            // === 响应数据结构解析 ===
            // 检查是否是包装的响应格式 {status, headers, body}
            let actualResponseData;
            let actualHeaders = matchedRule.headers || {};
            let actualStatus = matchedRule.status;

            if (matchedRule.response && typeof matchedRule.response === 'object') {
              const resp = matchedRule.response;
              if (resp.body && resp.status !== undefined) {
                // 包装格式：{status, headers, body}
                actualResponseData = resp.body;
                actualHeaders = { ...actualHeaders, ...resp.headers };
                actualStatus = resp.status;
              } else {
                // 直接格式：就是响应内容
                actualResponseData = resp;
              }
            } else {
              // 字符串或其他类型
              actualResponseData = matchedRule.response;
            }

            const responseData = typeof actualResponseData === 'string' ? actualResponseData : JSON.stringify(actualResponseData);

            // 设置 XHR 响应属性
            Object.defineProperty(this, 'status', { value: actualStatus, writable: true });
            Object.defineProperty(this, 'statusText', { value: actualStatus === 200 ? 'OK' : 'Mocked', writable: true });
            Object.defineProperty(this, 'readyState', { value: 4, writable: true });
            Object.defineProperty(this, 'response', { value: responseData, writable: true });
            Object.defineProperty(this, 'responseText', { value: responseData, writable: true });
            Object.defineProperty(this, 'responseURL', { value: this._url, writable: true });

            const finalHeaders = Object.entries({
              'content-type': 'application/json',
              ...actualHeaders
            }).map(([k, v]) => `${k}: ${v}`).join('\r\n');

            this.getAllResponseHeaders = () => finalHeaders;
            this.getResponseHeader = (name: string) => actualHeaders[name.toLowerCase()] || null;

            // 记录日志
            const duration = Math.round(performance.now() - this._startTime);
            requestLogs.add({
              method: this._method, url: this._url, status: actualStatus, timestamp: Date.now(), duration, isMock: true
            });

            // 触发完整的事件序列
            setTimeout(() => {
              this.dispatchEvent(new ProgressEvent('loadstart'));
              this.dispatchEvent(new ProgressEvent('progress', {
                lengthComputable: true,
                loaded: responseData.length,
                total: responseData.length
              }));
              this.dispatchEvent(new ProgressEvent('load', {
                lengthComputable: true,
                loaded: responseData.length,
                total: responseData.length
              }));
              this.dispatchEvent(new ProgressEvent('loadend', {
                lengthComputable: true,
                loaded: responseData.length,
                total: responseData.length
              }));
            }, 1);

            return; // 拦截成功，不再发送真实请求
          }

          // 未命中规则，透传
          super.send(body);

        } catch (error) {
          console.error('[PocketMock] XHR Error:', error);
          // 如果出错，尝试透传，避免页面死锁
          super.send(body);
        }
      })();
    }
  }

  // @ts-ignore
  window.XMLHttpRequest = PocketXHR;
}

export function initInterceptor() {
  console.log('%c PocketMock started (Fetch + XHR) ', 'background: #222; color: #bada55');
  patchFetch();
  patchXHR();
}