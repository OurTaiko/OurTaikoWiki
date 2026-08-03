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
