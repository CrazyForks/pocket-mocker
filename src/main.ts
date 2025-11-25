import Dashboard from './lib/dashboard.svelte'
import { initInterceptor } from './core/interceptor'
import { initStore } from './core/store';

// 1. Initialize interceptor core
initInterceptor();
initStore();
// 2. Mount Svelte application to document.body
const app = new Dashboard({
  target: document.body,
});

export default app;

const testBtn = document.createElement('button');
testBtn.textContent = "测试：请求 /todos/1";
testBtn.style.position = "fixed";
testBtn.style.bottom = "20px";
testBtn.style.left = "20px";
document.body.appendChild(testBtn);

async function getData() {
  console.log("业务代码发起请求...");
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const data = await res.json();
    console.log(data);

    alert(`收到响应数据:\n${JSON.stringify(data, null, 2)}`);
  } catch (e) {
    alert('请求失败');
  }
}

testBtn.onclick = () => { getData() }
