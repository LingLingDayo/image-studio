# 开发指南

[返回 README](../README.md)

## 技术栈与边界

- Vue 3 单页应用，使用 `<script setup lang="ts">`、Pinia 和 SCSS。
- Vite 提供开发服务和生产静态资源构建，Vitest 使用 happy-dom 测试组件；IndexedDB 测试使用 fake-indexeddb。
- 浏览器通过 provider 调用接口，作品保存到本地 IndexedDB。仓库没有工作台后端、账号体系或云端存储。

Node.js 建议使用 22.12+ LTS 或 24 LTS；锁定的 Vite 8.2.2 声明要求 `^20.19.0 || >=22.12.0`。

## 工具链与依赖安装

已将 Vue 插件协调到 `@vitejs/plugin-vue@6.0.10`，其 peer 范围支持现有 Vite 8.2.2。使用提交的锁文件进行标准安装，不再需要 `--legacy-peer-deps` 或 `--force`：

```powershell
npm ci
```

不要随意重写锁文件或批量升级无关依赖。项目的 GitHub Actions 质量检查使用 Windows、Node.js 22，执行标准依赖安装、类型检查与测试；流水线配置已加入仓库，实际远端执行仍需推送后确认。
## 常用命令

```powershell
# 开发服务，默认端口 3000；结束后在终端按 Ctrl+C
npm run dev

# 全部测试
npm test

# 只验证相关模块（按实际改动选择路径）
npm test -- src/components/settings src/settings

# Vue 与 TypeScript 类型检查，不输出构建文件
npm run typecheck
```

目前项目没有 lint 脚本或 ESLint 配置，不能把测试或类型检查当作 lint，也不能声称 lint 已通过。本轮已申请新增 ESLint 相关开发依赖，尚未获得批准，因此没有擅自安装或声称 lint 通过。批准后再接入，以问题检查为主，不夹带全库格式化。

普通功能修改不以 build 代替验证；优先补充回归测试，运行相关测试与类型检查。生产部署才运行 `npm run build`，见 [配置与部署](configuration.md#docker-部署)。

## 代码组织

```text
src/
├─ App.vue                应用装配、跨区域事件与弹窗协调
├─ components/
│  ├─ layout/             顶部导航与筛选
│  ├─ studio/             提示词、生成参数与独立参考图预览
│  ├─ gallery/            作品卡片、任务卡片、大图预览
│  ├─ settings/           设置分区控件与本地备份界面
│  └─ ui/                 可复用基础控件
├─ composables/           工作台、优化会话、设置草稿与视口交互
├─ stores/                配置、模型、任务、作品的共享状态
├─ settings/              具体设置分区定义与默认目录装配
├─ core/
│  ├─ providers/          API 协议适配
│  ├─ pipeline/           图像生成与结果处理
│  ├─ scheduler/          任务生命周期、取消与进度估算
│  ├─ storage/            IndexedDB、图片资源与备份合并
│  ├─ services/           优化服务及 Chat / Responses / Messages 协议适配
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

## 维护重点

- 保持标准 `npm ci`、类型检查与测试可以独立执行；lint 依赖批准后再补齐。
- 提示词优化协议适配位于 `core/services/optimizer`，模型列表按所选协议使用对应认证。不要在 UI 中拼接厂商请求。
- 备份仅覆盖现有作品字段、图片与本地参考图，不导出配置；合并导入的异步准备放在事务外，事务完成后才报告成功，禁止先清空原库。
- 最近 30 个成功/取消任务保留历史；活跃与失败待处理任务不自动驱逐。移除失败任务同时释放历史引用，不撤销输入区拥有的预览 URL。
- `ReferencePreviewModal` 独占预览交互；`usePromptOptimizer` 独占优化、撤销/重做与异步请求版本，组件负责展示和事件协调。