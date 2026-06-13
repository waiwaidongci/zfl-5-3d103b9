import { describe, it, expect } from 'vitest';
import {
  parseCSVLine,
  countDelimitersOutsideQuotes,
  repairSplitThousandSeparator,
  detectDelimiter,
  parseCSV
} from './csvParser.js';

describe('csvParser - 单行解析', () => {
  it('parseCSVLine 应正确解析逗号分隔的简单行', () => {
    const result = parseCSVLine('谢青岚,山水之间,12800,2026-01-15,展出中,待售', ',');
    expect(result).toEqual(['谢青岚', '山水之间', '12800', '2026-01-15', '展出中', '待售']);
  });

  it('parseCSVLine 应正确处理带引号的字段', () => {
    const result = parseCSVLine('"谢青岚","山水,之间","12,800","2026-01-15","展出中","待售"', ',');
    expect(result).toEqual(['谢青岚', '山水,之间', '12,800', '2026-01-15', '展出中', '待售']);
  });

  it('parseCSVLine 应正确处理转义的双引号', () => {
    const result = parseCSVLine('"作品""A""",100', ',');
    expect(result).toEqual(['作品"A"', '100']);
  });

  it('parseCSVLine 应支持制表符分隔', () => {
    const result = parseCSVLine('谢青岚\t山水之间\t12800', '\t');
    expect(result).toEqual(['谢青岚', '山水之间', '12800']);
  });

  it('parseCSVLine 应自动去除字段首尾空格', () => {
    const result = parseCSVLine(' 谢青岚 , 山水之间 , 12800 ', ',');
    expect(result).toEqual(['谢青岚', '山水之间', '12800']);
  });
});

describe('csvParser - 引号外分隔符计数', () => {
  it('countDelimitersOutsideQuotes 应只计数引号外的分隔符', () => {
    expect(countDelimitersOutsideQuotes('a,b,c', ',')).toBe(2);
    expect(countDelimitersOutsideQuotes('"a,b",c', ',')).toBe(1);
    expect(countDelimitersOutsideQuotes('"a","b",c', ',')).toBe(2);
  });

  it('countDelimitersOutsideQuotes 应处理转义双引号', () => {
    expect(countDelimitersOutsideQuotes('"a""b",c', ',')).toBe(1);
  });
});

describe('csvParser - 千位分隔符修复', () => {
  it('repairSplitThousandSeparator 应修复被逗号分割的价格', () => {
    const cells = ['谢青岚', '山水', '12', '800', '2026-01-15', '展出中', '待售'];
    const repaired = repairSplitThousandSeparator(cells, 6, 2);
    expect(repaired).toEqual(['谢青岚', '山水', '12,800', '2026-01-15', '展出中', '待售']);
  });

  it('repairSplitThousandSeparator 应处理多位千位分隔', () => {
    const cells = ['谢青岚', '山水', '1', '234', '567', '2026-01-15', '展出中', '待售'];
    const repaired = repairSplitThousandSeparator(cells, 6, 2);
    expect(repaired).toEqual(['谢青岚', '山水', '1,234,567', '2026-01-15', '展出中', '待售']);
  });

  it('repairSplitThousandSeparator 单元格数未超标时不应修改', () => {
    const cells = ['谢青岚', '山水', '12800', '2026-01-15', '展出中', '待售'];
    const repaired = repairSplitThousandSeparator(cells, 6, 2);
    expect(repaired).toBe(cells);
  });

  it('repairSplitThousandSeparator 价格索引非法时不应修改', () => {
    const cells = ['谢青岚', '山水', '12', '800', '2026-01-15', '展出中', '待售'];
    const repaired = repairSplitThousandSeparator(cells, 6, 99);
    expect(repaired).toBe(cells);
  });
});

describe('csvParser - 分隔符检测', () => {
  it('detectDelimiter 应检测逗号分隔', () => {
    expect(detectDelimiter('艺术家,作品名,价格,入库日期')).toBe(',');
  });

  it('detectDelimiter 应检测制表符分隔', () => {
    expect(detectDelimiter('艺术家\t作品名\t价格\t入库日期')).toBe('\t');
  });

  it('detectDelimiter 应检测分号分隔', () => {
    expect(detectDelimiter('艺术家;作品名;价格;入库日期')).toBe(';');
  });
});

describe('csvParser - 完整CSV解析', () => {
  it('parseCSV 应正确解析带标准表头的CSV', () => {
    const csv = '艺术家,作品名,价格,入库日期,展态,销售状态\n谢青岚,山水之间,12800,2026-01-15,展出中,待售';
    const result = parseCSV(csv);
    expect(result.header).toEqual(['艺术家', '作品名', '价格', '入库日期', '展态', '销售状态']);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].artist).toBe('谢青岚');
    expect(result.rows[0].title).toBe('山水之间');
    expect(result.rows[0].price).toBe('12800');
    expect(result.rows[0].inDate).toBe('2026-01-15');
    expect(result.rows[0].exhibit).toBe('展出中');
    expect(result.rows[0].sale).toBe('待售');
    expect(result.hasHeader).toBe(true);
  });

  it('parseCSV 应自动识别别名字段', () => {
    const csv = '作者,标题,售价,日期,位置,售卖\n谢青岚,山水之间,12800,2026-01-15,展出中,待售';
    const result = parseCSV(csv);
    expect(result.rows[0].artist).toBe('谢青岚');
    expect(result.rows[0].title).toBe('山水之间');
    expect(result.rows[0].price).toBe('12800');
  });

  it('parseCSV 应支持自定义字段映射', () => {
    const csv = '列A,列B,列C,列D,列E,列F\n谢青岚,山水之间,12800,2026-01-15,展出中,待售';
    const customMapping = { '列A': '艺术家', '列B': '作品名', '列C': '价格', '列D': '入库日期', '列E': '展态', '列F': '销售状态' };
    const result = parseCSV(csv, customMapping);
    expect(result.rows[0].artist).toBe('谢青岚');
    expect(result.rows[0].title).toBe('山水之间');
    expect(result.rows[0].price).toBe('12800');
  });

  it('parseCSV 空文件应返回空结果', () => {
    const result = parseCSV('');
    expect(result.header).toBeNull();
    expect(result.rows).toEqual([]);
    expect(result.detectedColumns).toEqual([]);
  });

  it('parseCSV 应自动修复被千位分隔符拆散的价格', () => {
    const csv = '艺术家,作品名,价格,入库日期,展态,销售状态\n谢青岚,山水之间,"12,800",2026-01-15,展出中,待售';
    const result = parseCSV(csv);
    expect(result.rows[0].price).toBe('12,800');
  });

  it('parseCSV 应跳过全空行', () => {
    const csv = '艺术家,作品名,价格\n谢青岚,山水,100\n\n, , \n赵以南,静物,200';
    const result = parseCSV(csv);
    expect(result.rows.length).toBe(2);
  });

  it('parseCSV 应返回正确的映射状态', () => {
    const csv = '艺术家,作品名,价格,入库日期,展态,销售状态\n谢青岚,山水,12800,2026-01-15,展出中,待售';
    const result = parseCSV(csv);
    expect(result.mappingStatus.length).toBe(6);
    expect(result.missingRequired).toEqual([]);
  });

  it('parseCSV 无表头时应按位置分配列', () => {
    const csv = '谢青岚,山水之间,12800,2026-01-15,展出中,待售\n赵以南,静物,8600,2026-01-10,库房,已预订';
    const result = parseCSV(csv);
    expect(result.hasHeader).toBe(false);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].artist).toBe('谢青岚');
    expect(result.rows[1].artist).toBe('赵以南');
  });
});
