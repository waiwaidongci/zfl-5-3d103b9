# 开发验证说明

## 质量门禁脚本

| 命令 | 用途 |
|------|------|
| `npm test` | 单次运行全部测试 |
| `npm run test:watch` | 监听模式，文件变更自动重跑 |
| `npm run test:ci` | CI 模式（verbose 输出） |
| `npm run build` | 生产构建（prebuild 钩子会先跑测试） |
| `npm run check` | **提交前完整检查**：测试 + 构建 |

## 提交前验证流程

```bash
npm run check
```

该命令依次执行：
1. `vitest run --reporter=verbose` — 全量测试
2. `vite build` — 确认构建无报错

两个阶段都通过即可提交。

## 测试覆盖的业务模块

| 模块 | 文件 | 覆盖逻辑 |
|------|------|----------|
| CSV 导入 | `csvHeaders.js` / `csvParser.js` / `csvValidator.js` | 表头识别、行解析、千位分隔修复、字段校验、导入预览 |
| 客户合并 | `customerUtils.js` | 手机/姓名归一化、重复评分、合并执行、档案构建 |
| 数据健康修复 | `diagnosticRules.js` / `fixExecutor.js` | 17 条诊断规则、修复预览生成、修复应用、闭环验证 |
| 备份迁移 | `migrationWizard.js` | 备份校验、冲突分析、策略求解、导入执行、迁移后健康扫描 |

## 覆盖率检查

```bash
npx vitest run --coverage
```

覆盖率阈值（vite.config.js 中配置）：
- 行覆盖率 ≥ 70%
- 函数覆盖率 ≥ 70%
- 分支覆盖率 ≥ 60%

## 新增业务函数时的检查清单

1. 纯函数放在独立 `.js` 文件中并 `export`
2. 同目录下新建 `.test.js`，覆盖正常路径和边界情况
3. 在 `vite.config.js` 的 `coverage.include` 中添加新文件
4. 运行 `npm run check` 确认通过
