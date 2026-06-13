import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCustomerKey,
  normalizePhone,
  normalizeName,
  getPhoneSimilarity,
  getNameSimilarity,
  calculateDuplicateScore,
  formatCustomerDisplay,
  findDuplicateCustomers,
  buildMergedCustomerPreview,
  executeCustomerMerge,
  buildCustomerProfile,
  filterCustomers,
  isPairIgnored,
  clearMergeIgnoredPairs,
  CUSTOMER_STATUS
} from './customerUtils.js';

describe('customerUtils - getCustomerKey', () => {
  it('应拼接姓名和手机号', () => {
    expect(getCustomerKey('张三', '13800138000')).toBe('张三__13800138000');
  });

  it('应自动去除首尾空格', () => {
    expect(getCustomerKey('  张三  ', '  13800138000  ')).toBe('张三__13800138000');
  });
});

describe('customerUtils - normalizePhone', () => {
  it('应去除空格、横线、括号等字符', () => {
    expect(normalizePhone('138-0013-8000')).toBe('13800138000');
    expect(normalizePhone('138 0013 8000')).toBe('13800138000');
    expect(normalizePhone('(021)12345678')).toBe('2112345678');
  });

  it('应去除国际区号 +86 / 86', () => {
    expect(normalizePhone('+8613800138000')).toBe('13800138000');
    expect(normalizePhone('8613800138000')).toBe('13800138000');
  });

  it('应去除前导零', () => {
    expect(normalizePhone('013800138000')).toBe('13800138000');
  });

  it('空值应返回空字符串', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('customerUtils - normalizeName', () => {
  it('应去除空格和间隔号并转小写', () => {
    expect(normalizeName('张 三')).toBe('张三');
    expect(normalizeName('O\'Brien')).toBe('o\'brien');
  });

  it('应去除中间点号', () => {
    expect(normalizeName('张·三')).toBe('张三');
    expect(normalizeName('张•三')).toBe('张三');
  });

  it('空值应返回空字符串', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
  });
});

describe('customerUtils - getPhoneSimilarity', () => {
  it('完全相同手机号应返回 1', () => {
    expect(getPhoneSimilarity('13800138000', '13800138000')).toBe(1);
  });

  it('空号码应返回 0', () => {
    expect(getPhoneSimilarity('', '13800138000')).toBe(0);
    expect(getPhoneSimilarity('13800138000', '')).toBe(0);
  });

  it('前后缀匹配且长度差不超过3时应返回高相似度', () => {
    const sim = getPhoneSimilarity('13800138000', '00138000');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('完全不同号码应返回低相似度', () => {
    const sim = getPhoneSimilarity('13800138000', '15912345678');
    expect(sim).toBeLessThan(0.3);
  });
});

describe('customerUtils - getNameSimilarity', () => {
  it('完全相同姓名应返回 1', () => {
    expect(getNameSimilarity('张三', '张三')).toBe(1);
  });

  it('空姓名应返回 0', () => {
    expect(getNameSimilarity('', '张三')).toBe(0);
  });

  it('包含关系应返回较高相似度', () => {
    const sim = getNameSimilarity('张三丰', '张三');
    expect(sim).toBeGreaterThan(0.5);
  });

  it('部分字符相同应返回一定相似度', () => {
    const sim = getNameSimilarity('张三', '张四');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('customerUtils - calculateDuplicateScore', () => {
  it('相同手机号 + 相同姓名应得高分', () => {
    const result = calculateDuplicateScore(
      { name: '张三', phone: '13800138000' },
      { name: '张三', phone: '13800138000' }
    );
    expect(result.score).toBe(100);
    expect(result.reasons).toContain('手机号相同');
    expect(result.reasons).toContain('姓名相同');
  });

  it('仅手机号相同应得60分', () => {
    const result = calculateDuplicateScore(
      { name: '张三', phone: '13800138000' },
      { name: '李四', phone: '13800138000' }
    );
    expect(result.score).toBe(60);
    expect(result.reasons).toContain('手机号相同');
  });

  it('仅姓名相同应得40分', () => {
    const result = calculateDuplicateScore(
      { name: '张三', phone: '13800138000' },
      { name: '张三', phone: '15912345678' }
    );
    expect(result.score).toBe(40);
    expect(result.reasons).toContain('姓名相同');
  });

  it('完全无关的客户应得低分', () => {
    const result = calculateDuplicateScore(
      { name: '张三', phone: '13800138000' },
      { name: '李四', phone: '15912345678' }
    );
    expect(result.score).toBeLessThan(50);
  });

  it('分数不应超过100', () => {
    const result = calculateDuplicateScore(
      { name: '张三', phone: '13800138000' },
      { name: '张三', phone: '13800138000' }
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('姓名与对方手机号关联应加分', () => {
    const result = calculateDuplicateScore(
      { name: '13800138000', phone: '13900139000' },
      { name: '王五', phone: '13800138000' }
    );
    expect(result.reasons).toContain('姓名与对方手机号存在关联');
  });
});

describe('customerUtils - formatCustomerDisplay', () => {
  it('空记录应返回默认值', () => {
    const result = formatCustomerDisplay(null);
    expect(result.namePart).toBe('');
    expect(result.isMerged).toBe(false);
  });

  it('未合并记录应正常显示', () => {
    const record = { customerName: '张三', customerPhone: '13800138000' };
    const result = formatCustomerDisplay(record);
    expect(result.name).toBe('张三');
    expect(result.phone).toBe('13800138000');
    expect(result.isMerged).toBeFalsy();
    expect(result.originalName).toBeNull();
  });

  it('已合并记录应显示原始信息', () => {
    const record = {
      customerName: '张三',
      customerPhone: '13800138000',
      originalCustomerName: '张  三',
      originalCustomerPhone: '138-0013-8000'
    };
    const result = formatCustomerDisplay(record);
    expect(result.isMerged).toBe(true);
    expect(result.originalName).toBe('张  三');
    expect(result.originalPhone).toBe('138-0013-8000');
  });

  it('隐藏手机号时应不显示号码', () => {
    const record = { customerName: '张三', customerPhone: '13800138000' };
    const result = formatCustomerDisplay(record, false);
    expect(result.phone).toBe('');
    expect(result.originalPhone).toBeNull();
  });
});

describe('customerUtils - executeCustomerMerge', () => {
  it('应将源客户的询价记录合并到目标客户', () => {
    const inquiries = [
      { customerName: '张三', customerPhone: '13800138000', createdAt: '2026-01-01' },
      { customerName: '张 三', customerPhone: '138-0013-8000', createdAt: '2026-01-02' }
    ];
    const orders = [];
    const followUps = [];
    const sourceKeys = ['张 三__138-0013-8000'];

    const result = executeCustomerMerge(inquiries, orders, followUps, '张三', '13800138000', sourceKeys);

    expect(result.inquiries[0].customerName).toBe('张三');
    expect(result.inquiries[0].customerPhone).toBe('13800138000');
    expect(result.inquiries[0].originalCustomerName).toBeUndefined();
    expect(result.inquiries[1].customerName).toBe('张三');
    expect(result.inquiries[1].customerPhone).toBe('13800138000');
    expect(result.inquiries[1].originalCustomerName).toBe('张 三');
    expect(result.inquiries[1].originalCustomerPhone).toBe('138-0013-8000');
    expect(result.inquiries[1].mergedFrom).toBe('张 三__138-0013-8000');
  });

  it('应将源客户的订单和跟进记录一并合并', () => {
    const inquiries = [];
    const orders = [
      { customerName: '李四', customerPhone: '13900139000', dealPrice: 50000, createdAt: '2026-01-01' }
    ];
    const followUps = [
      { customerName: '李 四', customerPhone: '13900139000', content: '回访', createdAt: '2026-02-01' }
    ];
    const sourceKeys = ['李 四__13900139000'];

    const result = executeCustomerMerge(inquiries, orders, followUps, '李四', '13900139000', sourceKeys);

    expect(result.orders[0].customerName).toBe('李四');
    expect(result.followUps[0].customerName).toBe('李四');
  });

  it('不在源key集合中的记录不应被修改', () => {
    const inquiries = [
      { customerName: '张三', customerPhone: '13800138000', createdAt: '2026-01-01' },
      { customerName: '王五', customerPhone: '13700137000', createdAt: '2026-01-02' }
    ];
    const orders = [];
    const followUps = [];
    const sourceKeys = ['王五__13700137000'];

    const result = executeCustomerMerge(inquiries, orders, followUps, '张三', '13800138000', sourceKeys);

    expect(result.inquiries[0].customerName).toBe('张三');
    expect(result.inquiries[1].customerName).toBe('张三');
    expect(result.inquiries[0].originalCustomerName).toBeUndefined();
  });

  it('已合并的记录再次合并应保留最早的原始信息', () => {
    const inquiries = [
      { customerName: '张三', customerPhone: '13800138000', originalCustomerName: '张  三', originalCustomerPhone: '138-0013-8000', createdAt: '2026-01-01' }
    ];
    const orders = [];
    const followUps = [];
    const sourceKeys = ['张三__13800138000'];

    const result = executeCustomerMerge(inquiries, orders, followUps, '张三丰', '13800138000', sourceKeys);

    expect(result.inquiries[0].originalCustomerName).toBe('张  三');
  });
});

describe('customerUtils - buildMergedCustomerPreview', () => {
  const customerA = {
    key: '张三__13800138000',
    name: '张三',
    phone: '13800138000',
    inquiries: [{ status: '跟进中', createdAt: '2026-01-01' }],
    orders: [{ dealPrice: 50000, dealDate: '2026-02-01', createdAt: '2026-01-15' }],
    followUps: [{ completedAt: null, scheduledDate: '2026-03-01', createdAt: '2026-02-15' }]
  };

  const customerB = {
    key: '李四__13900139000',
    name: '李四',
    phone: '13900139000',
    inquiries: [{ status: '已放弃', createdAt: '2026-01-05' }],
    orders: [],
    followUps: []
  };

  it('应正确汇总合并后的数据', () => {
    const preview = buildMergedCustomerPreview(customerA, customerB);
    expect(preview.totalInquiries).toBe(2);
    expect(preview.totalOrders).toBe(1);
    expect(preview.totalFollowUps).toBe(1);
    expect(preview.totalDealAmount).toBe(50000);
    expect(preview.pendingFollowUpCount).toBe(1);
  });

  it('默认以 customerA 为主', () => {
    const preview = buildMergedCustomerPreview(customerA, customerB);
    expect(preview.primaryName).toBe('张三');
    expect(preview.primaryPhone).toBe('13800138000');
    expect(preview.secondaryName).toBe('李四');
  });

  it('指定 primaryKey 时应以指定客户为主', () => {
    const preview = buildMergedCustomerPreview(customerA, customerB, customerB.key);
    expect(preview.primaryName).toBe('李四');
    expect(preview.secondaryName).toBe('张三');
  });

  it('有订单时应为已成交状态', () => {
    const preview = buildMergedCustomerPreview(customerA, customerB);
    expect(preview.mergedStatus).toBe(CUSTOMER_STATUS.DEALED);
  });

  it('仅有跟进中询价应为跟进中状态', () => {
    const simpleA = {
      key: '王五__13700137000', name: '王五', phone: '13700137000',
      inquiries: [{ status: '跟进中', createdAt: '2026-01-01' }],
      orders: [], followUps: []
    };
    const simpleB = {
      key: '赵六__13600136000', name: '赵六', phone: '13600136000',
      inquiries: [], orders: [], followUps: []
    };
    const preview = buildMergedCustomerPreview(simpleA, simpleB);
    expect(preview.mergedStatus).toBe(CUSTOMER_STATUS.FOLLOWING);
  });
});

describe('customerUtils - buildCustomerProfile', () => {
  it('应按客户名+手机号聚合数据', () => {
    const inquiries = [
      { customerName: '张三', customerPhone: '13800138000', status: '跟进中', createdAt: '2026-01-01' },
      { customerName: '张三', customerPhone: '13800138000', status: '已成交', createdAt: '2026-02-01' }
    ];
    const orders = [
      { customerName: '张三', customerPhone: '13800138000', dealPrice: 50000, createdAt: '2026-03-01', dealDate: '2026-03-01' }
    ];
    const followUps = [];

    const profiles = buildCustomerProfile(inquiries, orders, followUps);
    expect(profiles.length).toBe(1);
    expect(profiles[0].name).toBe('张三');
    expect(profiles[0].inquiryCount).toBe(2);
    expect(profiles[0].orderCount).toBe(1);
    expect(profiles[0].totalDealAmount).toBe(50000);
  });

  it('应跳过缺少姓名或手机号的记录', () => {
    const inquiries = [
      { customerName: '', customerPhone: '13800138000', createdAt: '2026-01-01' },
      { customerName: '张三', customerPhone: '', createdAt: '2026-01-01' },
      { customerName: '张三', customerPhone: '13800138000', createdAt: '2026-01-01' }
    ];
    const orders = [];
    const followUps = [];

    const profiles = buildCustomerProfile(inquiries, orders, followUps);
    expect(profiles.length).toBe(1);
  });

  it('应跳过已撤销的订单', () => {
    const inquiries = [];
    const orders = [
      { customerName: '张三', customerPhone: '13800138000', dealPrice: 50000, createdAt: '2026-01-01', cancelledAt: '2026-02-01' }
    ];
    const followUps = [];

    const profiles = buildCustomerProfile(inquiries, orders, followUps);
    expect(profiles.length).toBe(0);
  });

  it('应根据询价状态正确判断客户跟进状态', () => {
    const inquiries = [
      { customerName: '王五', customerPhone: '13700137000', status: '已成交', createdAt: '2026-01-01' }
    ];
    const orders = [];
    const followUps = [];

    const profiles = buildCustomerProfile(inquiries, orders, followUps);
    expect(profiles[0].followStatus).toBe(CUSTOMER_STATUS.DEALED);
  });

  it('全部放弃的询价应为未成交状态', () => {
    const inquiries = [
      { customerName: '王五', customerPhone: '13700137000', status: '已放弃', createdAt: '2026-01-01' }
    ];
    const orders = [];
    const followUps = [];

    const profiles = buildCustomerProfile(inquiries, orders, followUps);
    expect(profiles[0].followStatus).toBe(CUSTOMER_STATUS.INACTIVE);
  });
});

describe('customerUtils - filterCustomers', () => {
  const customers = [
    { name: '张三', phone: '13800138000' },
    { name: '李四', phone: '13900139000' },
    { name: '王五', phone: '13700137000' }
  ];

  it('空搜索词应返回全部客户', () => {
    expect(filterCustomers(customers, '')).toEqual(customers);
    expect(filterCustomers(customers, '  ')).toEqual(customers);
  });

  it('应按姓名模糊搜索', () => {
    const result = filterCustomers(customers, '张');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('张三');
  });

  it('应按手机号模糊搜索', () => {
    const result = filterCustomers(customers, '139');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('李四');
  });

  it('搜索应大小写不敏感', () => {
    const customersWithEnglish = [
      { name: 'Alice', phone: '13800138000' },
      { name: 'Bob', phone: '13900139000' }
    ];
    expect(filterCustomers(customersWithEnglish, 'alice').length).toBe(1);
  });
});

describe('customerUtils - 忽略对管理', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('初始状态不应有忽略对', () => {
    expect(isPairIgnored('A', 'B')).toBe(false);
  });

  it('保存后应能检测到忽略对', () => {
    const keyA = '张三__13800138000';
    const keyB = '李四__13900139000';
    clearMergeIgnoredPairs();
    expect(isPairIgnored(keyA, keyB)).toBe(false);
  });

  it('清除后应恢复为空', () => {
    clearMergeIgnoredPairs();
    const raw = localStorage.getItem('zfl-5-merge-ignored');
    expect(raw).toBeNull();
  });
});

describe('customerUtils - findDuplicateCustomers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('应在客户列表中查找重复项', () => {
    const customers = [
      { key: '张三__13800138000', name: '张三', phone: '13800138000', inquiries: [], orders: [], followUps: [] },
      { key: '张 三__13800138000', name: '张 三', phone: '13800138000', inquiries: [], orders: [], followUps: [] }
    ];

    const duplicates = findDuplicateCustomers(customers, 50);
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].score).toBeGreaterThanOrEqual(50);
  });

  it('无重复时应返回空数组', () => {
    const customers = [
      { key: '张三__13800138000', name: '张三', phone: '13800138000', inquiries: [], orders: [], followUps: [] },
      { key: '李四__15912345678', name: '李四', phone: '15912345678', inquiries: [], orders: [], followUps: [] }
    ];

    const duplicates = findDuplicateCustomers(customers, 50);
    expect(duplicates.length).toBe(0);
  });

  it('结果应按分数降序排列', () => {
    const customers = [
      { key: 'A__13800138000', name: 'A', phone: '13800138000', inquiries: [], orders: [], followUps: [] },
      { key: 'A__13800138001', name: 'A', phone: '13800138001', inquiries: [], orders: [], followUps: [] },
      { key: 'B__13800138002', name: 'B', phone: '13800138002', inquiries: [], orders: [], followUps: [] }
    ];

    const duplicates = findDuplicateCustomers(customers, 30);
    for (let i = 1; i < duplicates.length; i++) {
      expect(duplicates[i - 1].score).toBeGreaterThanOrEqual(duplicates[i].score);
    }
  });
});
