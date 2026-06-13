import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateFixPreview,
  applyFixes,
  persistFixedData,
  STORAGE_KEYS
} from './fixExecutor.js';
import {
  checkSoldWithoutOrder,
  checkCancelledOrderStillSold,
  checkOrphanInquiries,
  checkOrphanOrders,
  checkOrphanLoans,
  checkPaymentConsistency,
  runAllDiagnostics,
  RULE_ID
} from './diagnosticRules.js';
import { createMockData } from './testFixtures.js';

describe('修复执行器 - 修复预览生成', () => {
  it('应为已售无订单问题生成恢复待售的修复预览', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售', settlement: '待结算', saleDate: '2026-01-01', settlementDate: '2026-01-15' }
    ];
    const orders = [];

    const issues = checkSoldWithoutOrder(works, orders);
    const data = { works, orders, inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('reset-work-sale');
    expect(preview.patches[0].entityId).toBe('w1');
    expect(preview.patches[0].before.sale).toBe('已售');
    expect(preview.patches[0].after.sale).toBe('待售');
    expect(preview.patches[0].after.settlement).toBe('未结算');
    expect(preview.patches[0].after.saleDate).toBeNull();
  });

  it('应为撤销订单后仍已售的作品生成恢复待售的修复预览', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售', settlement: '未结算' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', workTitle: '作品A', customerName: '客户A', cancelledAt: '2026-01-01' }
    ];

    const issues = checkCancelledOrderStillSold(works, orders);
    const data = { works, orders, inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('reset-work-sale');
    expect(preview.patches[0].entityId).toBe('w1');
  });

  it('应为孤儿询价生成删除修复预览', () => {
    const works = [];
    const inquiries = [
      { id: 'inq1', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户A' }
    ];

    const issues = checkOrphanInquiries(works, inquiries);
    const data = { works: [], orders: [], inquiries, loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('delete-orphan-inquiry');
    expect(preview.patches[0].entityId).toBe('inq1');
    expect(preview.patches[0].entityType).toBe('inquiries');
    expect(preview.patches[0].before.exists).toBe(true);
    expect(preview.patches[0].after.exists).toBe(false);
  });

  it('应为孤儿订单生成删除修复预览', () => {
    const works = [];
    const orders = [
      { id: 'o1', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户A' }
    ];

    const issues = checkOrphanOrders(works, orders);
    const data = { works: [], orders, inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('delete-orphan-order');
    expect(preview.patches[0].entityId).toBe('o1');
    expect(preview.patches[0].entityType).toBe('orders');
  });

  it('应为孤儿借展生成删除修复预览', () => {
    const works = [];
    const loans = [
      { id: 'l1', workId: 'non-existent', workTitle: '失踪作品', borrower: '机构A' }
    ];

    const issues = checkOrphanLoans(works, loans);
    const data = { works: [], orders: [], inquiries: [], loans, statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('delete-orphan-loan');
    expect(preview.patches[0].entityId).toBe('l1');
    expect(preview.patches[0].entityType).toBe('loans');
  });

  it('应为对账单已付款但金额不足生成修复预览', () => {
    const statements = [
      {
        id: 's1',
        artist: '艺术家1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        confirmed: true,
        totalPayable: 100000,
        paidAmount: 50000,
        paymentStatus: '已付款'
      }
    ];

    const issues = checkPaymentConsistency(statements);
    const filtered = issues.filter(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL);
    const data = { works: [], orders: [], inquiries: [], loans: [], statements, inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(filtered, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('fix-payment-status-to-partial');
    expect(preview.patches[0].entityId).toBe('s1');
    expect(preview.patches[0].before.paymentStatus).toBe('已付款');
    expect(preview.patches[0].after.paymentStatus).toBe('部分付款');
  });

  it('应为对账单部分付款但金额已付清生成修复预览', () => {
    const statements = [
      {
        id: 's1',
        artist: '艺术家1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        confirmed: true,
        totalPayable: 100000,
        paidAmount: 100000,
        paymentStatus: '部分付款'
      }
    ];

    const issues = checkPaymentConsistency(statements);
    const filtered = issues.filter(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID);
    const data = { works: [], orders: [], inquiries: [], loans: [], statements, inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(filtered, data);

    expect(preview.totalPatches).toBe(1);
    expect(preview.patches[0].fixType).toBe('fix-payment-status-to-paid');
    expect(preview.patches[0].after.paymentStatus).toBe('已付款');
  });

  it('应正确统计受影响的实体数量', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售', settlement: '未结算' },
      { id: 'w2', title: '作品B', artist: '艺术家2', sale: '已售', settlement: '未结算' }
    ];
    const orders = [];

    const issues = checkSoldWithoutOrder(works, orders);
    const data = { works, orders, inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const preview = generateFixPreview(issues, data);

    expect(preview.totalAffectedEntities).toBe(2);
    expect(preview.totalPatches).toBe(2);
  });
});

describe('修复执行器 - 应用修复', () => {
  it('应将已售无订单的作品恢复为待售', () => {
    const originalWorks = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售', settlement: '待结算', saleDate: '2026-01-01', settlementDate: '2026-01-15' }
    ];
    const data = { works: originalWorks, orders: [], inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const issues = checkSoldWithoutOrder(originalWorks, []);
    const preview = generateFixPreview(issues, data);

    const updated = applyFixes(preview.patches, data);

    expect(updated.works[0].sale).toBe('待售');
    expect(updated.works[0].settlement).toBe('未结算');
    expect(updated.works[0].saleDate).toBeNull();
    expect(updated.works[0].settlementDate).toBeNull();
  });

  it('应删除孤儿询价记录', () => {
    const originalInquiries = [
      { id: 'inq1', workId: 'w1', workTitle: '作品A', customerName: '客户A' },
      { id: 'inq2', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户B' }
    ];
    const data = { works: [{ id: 'w1' }], orders: [], inquiries: originalInquiries, loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const issues = checkOrphanInquiries(data.works, originalInquiries);
    const preview = generateFixPreview(issues, data);

    const updated = applyFixes(preview.patches, data);

    expect(updated.inquiries.length).toBe(1);
    expect(updated.inquiries[0].id).toBe('inq1');
  });

  it('应删除孤儿订单记录', () => {
    const originalOrders = [
      { id: 'o1', workId: 'w1', workTitle: '作品A', customerName: '客户A' },
      { id: 'o2', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户B' }
    ];
    const data = { works: [{ id: 'w1' }], orders: originalOrders, inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const issues = checkOrphanOrders(data.works, originalOrders);
    const preview = generateFixPreview(issues, data);

    const updated = applyFixes(preview.patches, data);

    expect(updated.orders.length).toBe(1);
    expect(updated.orders[0].id).toBe('o1');
  });

  it('应删除孤儿借展记录', () => {
    const originalLoans = [
      { id: 'l1', workId: 'w1', workTitle: '作品A', borrower: '机构A' },
      { id: 'l2', workId: 'non-existent', workTitle: '失踪作品', borrower: '机构B' }
    ];
    const data = { works: [{ id: 'w1' }], orders: [], inquiries: [], loans: originalLoans, statements: [], inventoryTasks: [], followUps: [] };
    const issues = checkOrphanLoans(data.works, originalLoans);
    const preview = generateFixPreview(issues, data);

    const updated = applyFixes(preview.patches, data);

    expect(updated.loans.length).toBe(1);
    expect(updated.loans[0].id).toBe('l1');
  });

  it('应修正对账单付款状态', () => {
    const originalStatements = [
      {
        id: 's1',
        artist: '艺术家1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        confirmed: true,
        totalPayable: 100000,
        paidAmount: 50000,
        paymentStatus: '已付款'
      }
    ];
    const data = { works: [], orders: [], inquiries: [], loans: [], statements: originalStatements, inventoryTasks: [], followUps: [] };
    const issues = checkPaymentConsistency(originalStatements);
    const filtered = issues.filter(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL);
    const preview = generateFixPreview(filtered, data);

    const updated = applyFixes(preview.patches, data);

    expect(updated.statements[0].paymentStatus).toBe('部分付款');
  });

  it('修复后再次诊断不应再出现相同问题', () => {
    const data = createMockData();

    const beforeResult = runAllDiagnostics(data);
    const issuesToFix = beforeResult.issues.filter(i => i.autoFixable);
    const preview = generateFixPreview(issuesToFix, data);
    const updated = applyFixes(preview.patches, data);

    const afterResult = runAllDiagnostics(updated);
    const remainingAutoFixable = afterResult.issues.filter(i => i.autoFixable);

    expect(remainingAutoFixable.length).toBe(0);
  });

  it('应用修复不应修改原始数据', () => {
    const originalWorks = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售', settlement: '未结算' }
    ];
    const data = { works: originalWorks, orders: [], inquiries: [], loans: [], statements: [], inventoryTasks: [], followUps: [] };
    const issues = checkSoldWithoutOrder(originalWorks, []);
    const preview = generateFixPreview(issues, data);

    const updated = applyFixes(preview.patches, data);

    expect(originalWorks[0].sale).toBe('已售');
    expect(updated.works[0].sale).toBe('待售');
    expect(updated.works).not.toBe(originalWorks);
  });
});

describe('修复执行器 - 数据持久化', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      store: {},
      setItem(key, value) {
        this.store[key] = value;
      },
      getItem(key) {
        return this.store[key] || null;
      },
      clear() {
        this.store = {};
      }
    };
  });

  it('应将修复后的数据持久化到存储', () => {
    const patches = [
      { entityType: 'works', entityId: 'w1', fixType: 'reset-work-sale' }
    ];
    const updatedData = {
      works: [{ id: 'w1', title: '作品A', sale: '待售' }],
      orders: [],
      inquiries: [],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    persistFixedData(updatedData, patches, mockStorage);

    const storedWorks = JSON.parse(mockStorage.getItem(STORAGE_KEYS.works));
    expect(storedWorks).toEqual(updatedData.works);
  });

  it('应只持久化受补丁影响的实体类型', () => {
    const patches = [
      { entityType: 'inquiries', entityId: 'inq1', fixType: 'delete-orphan-inquiry' }
    ];
    const updatedData = {
      works: [{ id: 'w1', title: '作品A' }],
      orders: [{ id: 'o1', workId: 'w1' }],
      inquiries: [],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    persistFixedData(updatedData, patches, mockStorage);

    expect(mockStorage.getItem(STORAGE_KEYS.inquiries)).toBeDefined();
    expect(mockStorage.getItem(STORAGE_KEYS.works)).toBeNull();
    expect(mockStorage.getItem(STORAGE_KEYS.orders)).toBeNull();
  });

  it('未传 storage 参数时应使用 localStorage', () => {
    const patches = [
      { entityType: 'works', entityId: 'w1', fixType: 'reset-work-sale' }
    ];
    const updatedData = {
      works: [{ id: 'w1', title: '作品A', sale: '待售' }],
      orders: [],
      inquiries: [],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    persistFixedData(updatedData, patches);

    const storedWorks = JSON.parse(localStorage.getItem(STORAGE_KEYS.works));
    expect(storedWorks).toEqual(updatedData.works);
  });
});

describe('诊断 + 修复完整链路', () => {
  it('完整链路：诊断 -> 预览 -> 修复 -> 验证', () => {
    const data = createMockData();

    const diagnosticResult = runAllDiagnostics(data);
    expect(diagnosticResult.totalIssues).toBeGreaterThan(0);

    const autoFixableIssues = diagnosticResult.issues.filter(i => i.autoFixable);
    expect(autoFixableIssues.length).toBeGreaterThan(0);

    const preview = generateFixPreview(autoFixableIssues, data);
    expect(preview.totalPatches).toBe(autoFixableIssues.length);

    const updatedData = applyFixes(preview.patches, data);

    const finalResult = runAllDiagnostics(updatedData);
    const remainingAutoFixable = finalResult.issues.filter(i => i.autoFixable);
    expect(remainingAutoFixable.length).toBe(0);
  });
});
