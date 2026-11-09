import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/main.scss';
import { applyThemeAttribute, readStoredThemeMode } from './core/theme';

// 挂载前应用已保存的主题，避免深色模式首屏闪白。
applyThemeAttribute(readStoredThemeMode() ?? 'light');

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
