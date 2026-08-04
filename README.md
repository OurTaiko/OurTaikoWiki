# Our Taiko Wiki

React + TypeScript 实现的太鼓达人曲目资料库。

## 功能

- 默认且当前唯一歌曲源：`https://cdn.ourtaiko.org/api/cnsongs`
- 全歌曲检索、分类、排序和分页
- 每首歌曲独立路由：`/songs/:id`
- v1（FumenDB）与 v2（Gugu）定数 tabs
- v1 谱面结构与 v2 能力维度雷达图
- 菌菌、Sakura、手动 JSON 成绩导入（仅保存在浏览器本地）
- “和纸档案”亮色主题与 FF14-inspired 深色主题

## 开发

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

## 数据源扩展

歌曲源注册位于 `src/data/sources.ts`。当前只启用 CN 源；新增来源时扩展 `SourceId`、注册项与规范化函数即可。v1/v2 定数接口不属于歌曲列表来源。

## 旧版数据迁移

旧域名（`rating.ourtaiko.org` 来自 `main` 分支、`v2.rating.ourtaiko.org` 来自 `v2` 分支）会在加载时读取需要迁移的 localStorage 数据（Sakura token、菌菌 token/player id、成绩），用 `btoa(encodeURIComponent(JSON.stringify(data)))` 编码进 URL hash，跳转到：

```text
https://wiki.ourtaiko.org/migrate#data=<encoded>
```

新域名 `/migrate` 页面解码后写入：

- `sakuraToken` → `our-taiko-wiki:sakura-token`
- `kinokoApiKey` → `our-taiko-wiki:kinoko-key`
- `kinokoPlayerId` → `our-taiko-wiki:kinoko-player`
- `taikoScoreData` → `our-taiko-wiki:scores`（转换为新版 `ImportedScore` 格式，按 id+difficulty 合并，不覆盖已有成绩）

旧端跳转脚本位于旧仓库 `main` / `v2` 分支的 `index.html`；新端解码逻辑位于 `src/utils/legacyMigration.ts`，接收页面位于 `src/pages/MigratePage.tsx`。
