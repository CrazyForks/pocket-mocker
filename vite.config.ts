import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import pocketMockPlugin from './vite-plugin-pocket-mock' // 保留我们写的插件

export default defineConfig({
  plugins: [
    svelte({
      // 关键：告诉 Svelte 编译器把组件内的 CSS 编译成 JS 字符串
      // 这样 Dashboard.svelte 里的样式也会被打包进 JS
      compilerOptions: {
        css: 'injected',
      },
      emitCss: false, // 不生成单独的 CSS 文件
    }),
    pocketMockPlugin()
  ],
  build: {
    // 开启库模式
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'PocketMock', // UMD 模式下的全局变量名
      fileName: (format) => `pocket-mock.${format}.js` // 输出文件名
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      // 对于本项目，我们希望它是零依赖的 (Standalone)，所以这里留空
      external: [],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {}
      }
    }
  }
})