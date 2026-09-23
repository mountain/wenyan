# 六爻与三段论：显式研究接口

设计：苑明理；实现与自审：Codex（OpenAI），2026-09-23，通过苑明理账号提交。
新增程序为 MIT 许可。现有编译器语法与叙事评分保持原行为。

`changes.ts` 提供六爻位置、64 配置、变爻、三种分开的变换与古籍索引读取。
字符串自下而上，阴 0、阳 1。三才配对与上下卦对应配对形成交替六环；
64 配置上的变化图则是六维立方体。这两个图和原文含义分开处理。

`syllogism.ts` 提供 A/E/I/O 三段论、六位编码、四种格、两种明确存在假设的完全有限判定。
语法和 API 不把 64 候选式称为 64 个重言式。

```ts
import { readSyllogism, changeLines, readChanges, runInscriptionPipeline } from "../parser";

readSyllogism("凡「人」皆「动物」。凡「学者」皆「人」。故凡「学者」皆「动物」。");
// Parsed + judgment.Valid, with figure=1 and policy=boolean retained

readSyllogism("凡「猫」皆「动物」。凡「狗」皆「动物」。故凡「狗」皆「猫」。");
// Same mood AAA, figure=2: Refuted + explicit countermodel

changeLines("111111", [1]); // "011111"

// catalog is loaded explicitly by the caller from the relation-data repository.
readChanges("觀「乾」之初爻。", catalog);
runInscriptionPipeline("觀「乾」之初爻。", { changes: { catalog }, steps: 2 });
```

`readChanges` 验证 catalog 结构，不替调用者证明文本来源；返回 caller-supplied-catalog 标记。
原文、许可、来源跨度校验及可修订的读法学习由
[`wenyan-relation-learning`](https://github.com/mountain/wenyan-relation-learning) 管理。
这里只提供数据注入接口，不捆绑古籍或访问网络，不自动训练。

存在假设 `boolean` 允许项空，`terms-nonempty` 要求 S/M/P 各非空；两者都要求论域非空。
检查 255 个非空 Venn 区占据掩码即可完全判定这一片段：每个非空原子区保留一个代表，
不会改变 A/E/I/O 的真值。预算不足返回 Unknown，反例返回 Refuted，完全覆盖才返回 Valid。
它不涵盖一般一阶逻辑，也不赋予卦象逻辑有效性。

Node 24/26 的零依赖研究回归：

```sh
node --max-old-space-size=256 tools/changes/selftest.mjs
```

这项测试覆盖 64 编码、4096 变化往返、512 逻辑契约、256 受控语句和 pipeline opt-in；
研究测试不替代项目已有 TypeScript/Jest/build 流程，新增独立 CI 保留两条验证路径。
