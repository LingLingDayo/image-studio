# 开发指南

[返回 README](../README.md)

## 技术栈与边界

- Vue 3 单页应用，使用 `<script setup lang="ts">`、Pinia 和 SCSS。
- Vite 提供开发服务和生产静态资源构建，Vitest 使用 happy-dom 测试组件；IndexedDB 测试使用 fake-indexeddb。
- 浏览器通过 provider 调用接口，作品保存到本地 IndexedDB。仓库没有工作台后端、账号体系或云端存储。

Node.js 建议使用 22.12+ LTS 或 24 LTS；锁定的 Vite 8.2.2 声明要求 `^20.19.0 || >=22.12.0`。

## 当前依赖兼容问题

仓库锁定 `@vitejs/plugin-vue@5.2.4` 与 `vite@8.2.2`，但该 Vue 插件的 peer 范围只有 Vite 5/6。直接执行 `npm ci` 会产生 `ERESOLVE`。

在协调工具链版本前，可临时使用锁文件安装：

```powershell
npm ci --legacy-peer-deps
```

该参数跳过 peer 校验，**不是解决兼容性问题**，仍需运行测试、类型检查和开发界面验证。不要使用 `--force`，也不要随意重写锁文件。后续应经依赖变更审批，将 Vite 与 Vue 插件调整到明确相容的版本，并一起验证工具链。

## 常用命令

```powershell
# 开发服务，默认端口 3000；结束后在终端按 Ctrl+C
npm run dev

# 全部测试
npm test

# 只验证相关模块（按实际改动选择路径）
npm test -- src/components/settings src/settings

# Vue 与 TypeScript 类型检查，不输出构建文件
npm exec vue-tsc -- --noEmit
```

目前项目没有 lint 脚本或 ESLint 配置，不能把测试或类型检查当作 lint，也不能声称 lint 已通过。增加 lint 工具需要单独确认依赖和规则，避免混入无关格式改动。

普通功能修改不以 build 代替验证；优先补充回归测试，运行相关测试与类型检查。生产部署才运行 `npm run build`，见 [配置与部署](configuration.md#docker-部署)。

## 代码组织

```text
src/
├─ App.vue                应用装配、跨区域事件与弹窗协调
├─ components/
│  ├─ layout/             顶部导航与筛选
│  ├─ studio/             提示词与生成参数输入
│  ├─ gallery/            作品卡片、任务卡片、大图预览
│  ├─ settings/           设置弹窗、导航、分组与字段控件
│  └─ ui/                 可复用基础控件
├─ composables/           工作台、设置会话与图片视口交互
├─ stores/                配置、模型、任务、作品的共享状态
├─ settings/              具体设置分区定义与默认目录装配
├─ core/
│  ├─ providers/          API 协议适配
│  ├─ pipeline/           图像生成与结果处理
│  ├─ scheduler/          任务生命周期、取消与进度估算
│  ├─ storage/            IndexedDB 与本地图片资源管理
│  ├─ services/           提示词优化服务
│  └─ settings/           设置 schema、条件计算与控件注册
├─ types/                 领域类型、模型能力与默认配置
├─ utils/                 尺寸、错误、下载等共享纯逻辑
└─ styles/                全局样式与设计变量
```

测试与被测模块相邻，命名为 `*.test.ts`。`src/test-setup.ts` 负责测试环境初始化。

### 生成流程

`PromptBar` 提交输入 → `useImageStudio` 组合生成参数 → `TaskScheduler` 管理任务 → `ImagePipeline` 调用 provider 并处理图片 → `AssetRepository` 保存作品 → gallery store 更新展示。

保持 UI、任务状态、协议适配和存储各自独立。新增接口能力优先在 provider 与模型能力定义中实现，不在页面组件里直接拼接请求。

### 设置流程

`src/settings/catalog.ts` 注册具体分区；`*.section.ts` 定义字段、可见条件、草稿初始化和持久化行为。`useSettingsSession` 承载草稿与临时状态，设置组件负责渲染和用户操作。

新增常规设置时优先复用现有输入、选择和开关控件；无需为单个字段复制弹窗或引入新一层通用框架。异步模型列表等临时数据不应写入持久化字段。仅校验与提交有修改的分区；关闭或重开设置后，旧异步操作不能写入新草稿。

## 修改与验证约定

1. 先检查相邻实现与测试，沿用现有类型、组件和设计变量。
2. 真实缺陷先补回归测试；交互调整同时验证保存/取消、未配置状态、错误反馈、键盘操作和窄屏布局。
3. 范围限定在需求涉及的模块。大规模重构和依赖变更先评估并确认，不夹带全库格式化。
4. 关键节点使用中文分步 Git 提交；临时脚本、日志和截图放 `.temp/`，不提交。废弃临时文件移入 `.temp/trash/`，不物理删除。
5. 停止本次启动的开发服务或容器，确认端口释放。

## 后续工程改进优先级

- **先修工具链**：协调 Vite/Vue 插件版本，恢复标准 `npm ci`，再讨论增加 lint 和 CI。
- **先稳定用户数据**：本轮已取消升级时重建作品库；未知历史格式的迁移、完整备份与恢复能力仍需另行设计。
- **按职责逐步拆分**：只有组件确实承担多种独立职责时才抽取模块，不为了文件变小而机械拆分。
