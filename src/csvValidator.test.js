import { describe, it, expect, beforeEach } from 'vitest';
import {
  iso,
  validateRow,
  classifyRows,
  computeImportPreview,
  buildNewArtists
} from './csvValidator.js';

describe('csvValidator - 日期工具', () => {
  it('iso 应返回今天的日期（偏移0）', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(iso(0)).toBe(today);
  });

  it('iso 应正确计算日期偏移', () => {
    const date = new Date();
    date.setDate(date.getDate() + 5);
    expect(iso(5)).toBe(date.toISOString().slice(0, 10));

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    expect(iso(-3)).toBe(pastDate.toISOString().slice(0, 10));
  });
});

describe('csvValidator - 单行校验', () => {
  it('validateRow 应通过完全有效的行', () => {
    const row = { artist: '谢青岚', title: '山水之间', price: '12800', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.cleaned.artist).toBe('谢青岚');
    expect(result.cleaned.title).toBe('山水之间');
    expect(result.cleaned.price).toBe(12800);
    expect(result.cleaned.inDate).toBe('2026-01-15');
    expect(result.cleaned.exhibit).toBe('展出中');
    expect(result.cleaned.sale).toBe('待售');
  });

  it('validateRow 应检测缺少的必填字段', () => {
    const row = { artist: '', title: '', price: '', inDate: '', exhibit: '', sale: '' };
    const result = validateRow(row, new Set(), new Set(), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('缺少艺术家');
    expect(result.errors).toContain('缺少作品名');
    expect(result.errors).toContain('缺少价格');
  });

  it('validateRow 应检测非法价格格式', () => {
    const row = { artist: '谢青岚', title: '山水', price: 'abc', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('价格'))).toBe(true);
  });

  it('validateRow 应自动转换日期格式', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: '2026/01/15', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(true);
    expect(result.cleaned.inDate).toBe('2026-01-15');
    expect(result.info.some(i => i.includes('自动转换'))).toBe(true);
  });

  it('validateRow 应检测非法日期格式', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: 'not a date', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('入库日期'))).toBe(true);
  });

  it('validateRow 应检测重复作品名（已存在）', () => {
    const row = { artist: '谢青岚', title: '墨虾图', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const existingTitles = new Set(['墨虾图']);
    const result = validateRow(row, existingTitles, new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('已存在'))).toBe(true);
  });

  it('validateRow 应检测重复作品名（批次内）', () => {
    const row = { artist: '谢青岚', title: '墨虾图', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const batchTitles = new Set(['墨虾图']);
    const result = validateRow(row, new Set(), new Set(['谢青岚']), batchTitles, true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('导入列表中重复'))).toBe(true);
  });

  it('validateRow 应检测无效展态', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: '2026-01-15', exhibit: '无效状态', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('展态'))).toBe(true);
  });

  it('validateRow 应检测无效销售状态', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '无效状态' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('销售状态'))).toBe(true);
  });

  it('validateRow 已售状态应警告并转为待售', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '已售' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(true);
    expect(result.cleaned.sale).toBe('待售');
    expect(result.warnings.some(w => w.includes('已售'))).toBe(true);
  });

  it('validateRow 开启自动创建时不存在的艺术家应标记为新建', () => {
    const row = { artist: '新艺术家', title: '新作品', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(), new Set(), true);
    expect(result.valid).toBe(true);
    expect(result.artistStatus).toBe('new');
    expect(result.warnings.some(w => w.includes('自动创建'))).toBe(true);
  });

  it('validateRow 关闭自动创建时不存在的艺术家应报错', () => {
    const row = { artist: '新艺术家', title: '新作品', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售' };
    const result = validateRow(row, new Set(), new Set(), new Set(), false);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('未在系统中登记'))).toBe(true);
  });

  it('validateRow 空字段应使用默认值', () => {
    const row = { artist: '谢青岚', title: '山水', price: '100', inDate: '', exhibit: '', sale: '' };
    const result = validateRow(row, new Set(), new Set(['谢青岚']), new Set(), true);
    expect(result.valid).toBe(true);
    expect(result.cleaned.inDate).toBe(iso(0));
    expect(result.cleaned.exhibit).toBe('展出中');
    expect(result.cleaned.sale).toBe('待售');
  });
});

describe('csvValidator - 新艺术家构建', () => {
  it('buildNewArtists 应生成正确的艺术家对象', () => {
    const names = new Set(['艺术家A', '艺术家B']);
    const result = buildNewArtists(names);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('艺术家A');
    expect(result[0].note).toBe('批量导入自动创建');
    expect(result[0].id).toBeDefined();
    expect(result[1].name).toBe('艺术家B');
  });
});

describe('csvValidator - 行分类', () => {
  it('classifyRows 应正确分类有效、警告、错误和跳过的行', () => {
    const rows = [
      { artist: '谢青岚', title: '山水', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售', rawLine: '', lineNumber: 1, rawCells: [] },
      { artist: '新艺术家', title: '新作品', price: '200', inDate: '2026-01-15', exhibit: '展出中', sale: '已售', rawLine: '', lineNumber: 2, rawCells: [] },
      { artist: '未登记艺术家', title: '错误作品', price: 'abc', inDate: 'bad-date', exhibit: '展出中', sale: '待售', rawLine: '', lineNumber: 3, rawCells: [] }
    ];
    const existingTitles = new Set();
    const existingArtists = new Set(['谢青岚']);

    const result = classifyRows(rows, existingTitles, existingArtists, true);
    expect(result.validRows.length).toBe(2);
    expect(result.warningRows.length).toBe(1);
    expect(result.errorRows.length).toBe(1);
    expect(result.newArtists.length).toBe(1);
    expect(result.newArtists[0].name).toBe('新艺术家');
  });

  it('classifyRows 关闭自动创建时应跳过未登记艺术家', () => {
    const rows = [
      { artist: '未登记艺术家', title: '作品', price: '100', inDate: '2026-01-15', exhibit: '展出中', sale: '待售', rawLine: '', lineNumber: 1, rawCells: [] }
    ];
    const result = classifyRows(rows, new Set(), new Set(), false);
    expect(result.validRows.length).toBe(0);
    expect(result.skippedRows.length).toBe(1);
    expect(result.skippedRows[0].skipReason).toBe('艺术家未登记');
  });
});

describe('csvValidator - 完整导入预览计算', () => {
  const works = [
    { title: '已存在作品', artist: '谢青岚' }
  ];
  const artists = [
    { name: '谢青岚' },
    { name: '赵以南' }
  ];

  it('computeImportPreview 应计算完整的导入预览', () => {
    const csv = '艺术家,作品名,价格,入库日期,展态,销售状态\n谢青岚,新作品1,12800,2026-01-15,展出中,待售\n新艺术家,新作品2,8600,2026-01-10,库房,已预订';
    const preview = computeImportPreview(csv, {}, works, artists, true);

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows.length).toBe(2);
    expect(preview.newArtists.length).toBe(1);
    expect(preview.newArtists[0].name).toBe('新艺术家');
    expect(preview.missingRequired).toEqual([]);
    expect(preview.hasHeader).toBe(true);
  });

  it('computeImportPreview 应使用自定义映射', () => {
    const csv = '列A,列B,列C,列D,列E,列F\n谢青岚,山水,12800,2026-01-15,展出中,待售';
    const customMapping = { '列A': '艺术家', '列B': '作品名', '列C': '价格', '列D': '入库日期', '列E': '展态', '列F': '销售状态' };
    const preview = computeImportPreview(csv, customMapping, works, artists, true);

    expect(preview.totalRows).toBe(1);
    expect(preview.validRows.length).toBe(1);
    expect(preview.activeMapping).toEqual(customMapping);
  });

  it('computeImportPreview 应检测重复作品', () => {
    const csv = '艺术家,作品名,价格,入库日期,展态,销售状态\n谢青岚,已存在作品,12800,2026-01-15,展出中,待售';
    const preview = computeImportPreview(csv, {}, works, artists, true);

    expect(preview.validRows.length).toBe(0);
    expect(preview.errorRows.length).toBe(1);
  });

  it('computeImportPreview 应检测缺失必填映射', () => {
    const csv = '备注,艺术家\n某备注,谢青岚';
    const preview = computeImportPreview(csv, {}, works, artists, true);

    expect(preview.missingRequired.length).toBeGreaterThan(0);
    expect(preview.missingRequired).toContain('作品名');
    expect(preview.missingRequired).toContain('价格');
  });
});
