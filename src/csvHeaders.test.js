import { describe, it, expect } from 'vitest';
import {
  CSV_COLUMNS,
  normalizeHeader,
  isNumericCell,
  isDateLikeCell,
  looksLikeUnmatchedHeader,
  generateDefaultMapping,
  getMappedColumnStatus,
  getMissingRequiredColumns,
  VALID_EXHIBIT,
  VALID_SALE
} from './csvHeaders.js';

describe('csvHeaders - 表头标准化', () => {
  it('应识别中文表头别名', () => {
    expect(normalizeHeader('作者')).toBe('艺术家');
    expect(normalizeHeader('画家')).toBe('艺术家');
    expect(normalizeHeader('创作者')).toBe('艺术家');
    expect(normalizeHeader('作品名称')).toBe('作品名');
    expect(normalizeHeader('标题')).toBe('作品名');
    expect(normalizeHeader('售价')).toBe('价格');
    expect(normalizeHeader('定价')).toBe('价格');
    expect(normalizeHeader('日期')).toBe('入库日期');
    expect(normalizeHeader('状态')).toBe('展态');
    expect(normalizeHeader('位置')).toBe('展态');
    expect(normalizeHeader('销售')).toBe('销售状态');
  });

  it('应识别英文表头别名（大小写不敏感）', () => {
    expect(normalizeHeader('artist')).toBe('艺术家');
    expect(normalizeHeader('Artist')).toBe('艺术家');
    expect(normalizeHeader('ARTIST')).toBe('艺术家');
    expect(normalizeHeader('title')).toBe('作品名');
    expect(normalizeHeader('Title')).toBe('作品名');
    expect(normalizeHeader('price')).toBe('价格');
    expect(normalizeHeader('Price')).toBe('价格');
    expect(normalizeHeader('date')).toBe('入库日期');
    expect(normalizeHeader('exhibit')).toBe('展态');
    expect(normalizeHeader('sale')).toBe('销售状态');
  });

  it('应识别带空格的表头', () => {
    expect(normalizeHeader('  艺术家  ')).toBe('艺术家');
    expect(normalizeHeader('  author  ')).toBe(null);
  });

  it('未知表头应返回null', () => {
    expect(normalizeHeader('未知列')).toBe(null);
    expect(normalizeHeader('foo')).toBe(null);
    expect(normalizeHeader('')).toBe(null);
  });
});

describe('csvHeaders - 单元格类型判断', () => {
  it('isNumericCell 应识别数字格式', () => {
    expect(isNumericCell('12800')).toBe(true);
    expect(isNumericCell('￥12,800')).toBe(true);
    expect(isNumericCell('¥12800')).toBe(true);
    expect(isNumericCell(' 12,800.50 ')).toBe(true);
    expect(isNumericCell('abc')).toBe(false);
    expect(isNumericCell('')).toBe(false);
  });

  it('isDateLikeCell 应识别日期格式', () => {
    expect(isDateLikeCell('2026-01-15')).toBe(true);
    expect(isDateLikeCell('2026/01/15')).toBe(true);
    expect(isDateLikeCell('2026年1月15日')).toBe(true);
    expect(isDateLikeCell('2026-01')).toBe(true);
    expect(isDateLikeCell('not a date')).toBe(false);
    expect(isDateLikeCell('')).toBe(false);
  });
});

describe('csvHeaders - 表头识别', () => {
  it('looksLikeUnmatchedHeader 应识别关键词表头', () => {
    expect(looksLikeUnmatchedHeader(['艺术家姓名', '画作名称', '寄售价格', '到店日期', '存放位置', '售卖状态'])).toBe(true);
    expect(looksLikeUnmatchedHeader(['artist name', 'artwork title', 'price', 'date'])).toBe(true);
  });

  it('looksLikeUnmatchedHeader 不应识别为数据行', () => {
    expect(looksLikeUnmatchedHeader(['齐白石', '墨虾图', '80000', '2026-01-15', '库房', '待售'])).toBe(false);
    expect(looksLikeUnmatchedHeader(['有效数据', '123'])).toBe(false);
  });

  it('looksLikeUnmatchedHeader 少于2个非空单元格时返回false', () => {
    expect(looksLikeUnmatchedHeader(['艺术家'])).toBe(false);
    expect(looksLikeUnmatchedHeader(['', ''])).toBe(false);
  });
});

describe('csvHeaders - 默认映射生成', () => {
  it('generateDefaultMapping 应自动匹配标准列名', () => {
    const columns = ['艺术家', '作品名', '价格', '入库日期', '展态', '销售状态'];
    const mapping = generateDefaultMapping(columns);
    expect(mapping['艺术家']).toBe('艺术家');
    expect(mapping['作品名']).toBe('作品名');
    expect(mapping['价格']).toBe('价格');
  });

  it('generateDefaultMapping 应自动匹配别名列名', () => {
    const columns = ['作者', '标题', '售价', '日期', '状态', '销售'];
    const mapping = generateDefaultMapping(columns);
    expect(mapping['作者']).toBe('艺术家');
    expect(mapping['标题']).toBe('作品名');
    expect(mapping['售价']).toBe('价格');
    expect(mapping['日期']).toBe('入库日期');
    expect(mapping['状态']).toBe('展态');
    expect(mapping['销售']).toBe('销售状态');
  });

  it('generateDefaultMapping 不应重复使用目标字段', () => {
    const columns = ['作者', '艺术家', '画家'];
    const mapping = generateDefaultMapping(columns);
    const usedTargets = Object.values(mapping);
    expect(usedTargets.length).toBe(new Set(usedTargets).size);
  });
});

describe('csvHeaders - 映射状态与必填校验', () => {
  it('getMappedColumnStatus 应返回正确的映射状态', () => {
    const columns = ['艺术家', '作品名', '价格', '备注'];
    const mapping = { '艺术家': '艺术家', '作品名': '作品名', '价格': '价格' };
    const status = getMappedColumnStatus(columns, mapping);
    expect(status[0].source).toBe('艺术家');
    expect(status[0].target).toBe('艺术家');
    expect(status[0].autoMatched).toBe(true);
    expect(status[0].required).toBe(true);
    expect(status[3].target).toBeNull();
    expect(status[3].required).toBe(false);
  });

  it('getMissingRequiredColumns 应找出缺失的必填字段', () => {
    const mappingStatus = [
      { source: 'A', target: '艺术家', required: true },
      { source: 'B', target: '作品名', required: true }
    ];
    const missing = getMissingRequiredColumns(mappingStatus);
    expect(missing).toContain('价格');
    expect(missing).not.toContain('艺术家');
    expect(missing).not.toContain('作品名');
  });

  it('所有必填字段都有时应返回空数组', () => {
    const mappingStatus = [
      { source: 'A', target: '艺术家', required: true },
      { source: 'B', target: '作品名', required: true },
      { source: 'C', target: '价格', required: true }
    ];
    expect(getMissingRequiredColumns(mappingStatus)).toEqual([]);
  });
});

describe('csvHeaders - 常量导出', () => {
  it('应导出正确的列定义', () => {
    expect(CSV_COLUMNS).toEqual(['艺术家', '作品名', '价格', '入库日期', '展态', '销售状态']);
  });

  it('应导出正确的状态枚举', () => {
    expect(VALID_EXHIBIT).toEqual(['展出中', '库房', '借展', '退回']);
    expect(VALID_SALE).toEqual(['待售', '已预订', '已售']);
  });
});
