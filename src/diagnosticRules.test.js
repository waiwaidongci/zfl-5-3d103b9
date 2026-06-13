import { describe, it, expect } from 'vitest';
import {
  checkSoldWithoutOrder,
  checkCancelledOrderStillSold,
  checkOrphanInquiries,
  checkOrphanOrders,
  checkOrphanLoans,
  checkPaymentConsistency,
  RULE_ID,
  SEVERITY
} from './diagnosticRules.js';
import {
  mockWorks,
  mockOrders,
  mockInquiries,
  mockLoans,
  mockStatements
} from './testFixtures.js';

describe('诊断规则 - 已售无订单', () => {
  it('应检测到已售但无有效订单的作品', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' },
      { id: 'w2', title: '作品B', artist: '艺术家2', sale: '已售' },
      { id: 'w3', title: '作品C', artist: '艺术家3', sale: '待售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w2', cancelledAt: null }
    ];

    const issues = checkSoldWithoutOrder(works, orders);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.SOLD_WITHOUT_ORDER);
    expect(issues[0].workId).toBe('w1');
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].autoFixable).toBe(true);
  });

  it('不应误报有有效订单的已售作品', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', cancelledAt: null }
    ];

    const issues = checkSoldWithoutOrder(works, orders);

    expect(issues.length).toBe(0);
  });

  it('已撤销订单不应算作有效订单', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', cancelledAt: '2026-01-01' }
    ];

    const issues = checkSoldWithoutOrder(works, orders);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.SOLD_WITHOUT_ORDER);
  });

  it('待售作品不应被检测', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '待售' }
    ];
    const orders = [];

    const issues = checkSoldWithoutOrder(works, orders);

    expect(issues.length).toBe(0);
  });
});

describe('诊断规则 - 撤销订单后作品仍已售', () => {
  it('应检测到订单已撤销但作品仍显示已售', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', workTitle: '作品A', customerName: '客户A', cancelledAt: '2026-01-01' }
    ];

    const issues = checkCancelledOrderStillSold(works, orders);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.CANCELLED_ORDER_STILL_SOLD);
    expect(issues[0].workId).toBe('w1');
    expect(issues[0].orderId).toBe('o1');
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].autoFixable).toBe(true);
  });

  it('如果有其他有效订单则不应误报', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', cancelledAt: '2026-01-01' },
      { id: 'o2', workId: 'w1', cancelledAt: null }
    ];

    const issues = checkCancelledOrderStillSold(works, orders);

    expect(issues.length).toBe(0);
  });

  it('未撤销的订单不应触发检测', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '已售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', cancelledAt: null }
    ];

    const issues = checkCancelledOrderStillSold(works, orders);

    expect(issues.length).toBe(0);
  });

  it('作品状态非已售时不应误报', () => {
    const works = [
      { id: 'w1', title: '作品A', artist: '艺术家1', sale: '待售' }
    ];
    const orders = [
      { id: 'o1', workId: 'w1', cancelledAt: '2026-01-01' }
    ];

    const issues = checkCancelledOrderStillSold(works, orders);

    expect(issues.length).toBe(0);
  });
});

describe('诊断规则 - 孤儿记录检测', () => {
  it('应检测到引用不存在作品的询价记录', () => {
    const works = [{ id: 'w1', title: '作品A', artist: '艺术家1' }];
    const inquiries = [
      { id: 'inq1', workId: 'w1', workTitle: '作品A', customerName: '客户A' },
      { id: 'inq2', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户B' }
    ];

    const issues = checkOrphanInquiries(works, inquiries);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.ORPHAN_INQUIRY);
    expect(issues[0].entityId).toBe('inq2');
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].autoFixable).toBe(true);
  });

  it('应检测到引用不存在作品的订单记录', () => {
    const works = [{ id: 'w1', title: '作品A', artist: '艺术家1' }];
    const orders = [
      { id: 'o1', workId: 'w1', workTitle: '作品A', customerName: '客户A' },
      { id: 'o2', workId: 'non-existent', workTitle: '失踪作品', customerName: '客户B' }
    ];

    const issues = checkOrphanOrders(works, orders);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.ORPHAN_ORDER);
    expect(issues[0].entityId).toBe('o2');
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].autoFixable).toBe(true);
  });

  it('应检测到引用不存在作品的借展记录', () => {
    const works = [{ id: 'w1', title: '作品A', artist: '艺术家1' }];
    const loans = [
      { id: 'l1', workId: 'w1', workTitle: '作品A', borrower: '机构A' },
      { id: 'l2', workId: 'non-existent', workTitle: '失踪作品', borrower: '机构B' }
    ];

    const issues = checkOrphanLoans(works, loans);

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe(RULE_ID.ORPHAN_LOAN);
    expect(issues[0].entityId).toBe('l2');
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].autoFixable).toBe(true);
  });

  it('空数据不应产生误报', () => {
    const works = [];
    const inquiries = [];
    const orders = [];
    const loans = [];

    expect(checkOrphanInquiries(works, inquiries).length).toBe(0);
    expect(checkOrphanOrders(works, orders).length).toBe(0);
    expect(checkOrphanLoans(works, loans).length).toBe(0);
  });
});

describe('诊断规则 - 对账单付款状态修正', () => {
  it('应检测到标记已付款但金额不足的对账单', () => {
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

    const found = issues.find(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL);
    expect(found).toBeDefined();
    expect(found.entityId).toBe('s1');
    expect(found.autoFixable).toBe(true);
    expect(found.fixType).toBe('fix-payment-status-to-partial');
  });

  it('应检测到标记待付款但已有付款的对账单', () => {
    const statements = [
      {
        id: 's1',
        artist: '艺术家1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        confirmed: true,
        totalPayable: 100000,
        paidAmount: 30000,
        paymentStatus: '待付款'
      }
    ];

    const issues = checkPaymentConsistency(statements);

    const found = issues.find(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PENDING_BUT_PAID);
    expect(found).toBeDefined();
    expect(found.entityId).toBe('s1');
    expect(found.autoFixable).toBe(true);
    expect(found.fixType).toBe('fix-payment-status-to-partial');
  });

  it('应检测到标记部分付款但金额已付清的对账单', () => {
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

    const found = issues.find(i => i.ruleId === RULE_ID.PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID);
    expect(found).toBeDefined();
    expect(found.entityId).toBe('s1');
    expect(found.autoFixable).toBe(true);
    expect(found.fixType).toBe('fix-payment-status-to-paid');
  });

  it('未确认的对账单不应被检测', () => {
    const statements = [
      {
        id: 's1',
        confirmed: false,
        totalPayable: 100000,
        paidAmount: 50000,
        paymentStatus: '已付款'
      }
    ];

    const issues = checkPaymentConsistency(statements);

    expect(issues.length).toBe(0);
  });

  it('应通过 now 参数控制逾期检测时间', () => {
    const statements = [
      {
        id: 's1',
        artist: '艺术家1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        confirmed: true,
        confirmedAt: '2026-04-01',
        totalPayable: 100000,
        paidAmount: 50000,
        paymentStatus: '部分付款'
      }
    ];

    const issuesBefore30Days = checkPaymentConsistency(statements, new Date('2026-04-30'));
    const issuesAfter30Days = checkPaymentConsistency(statements, new Date('2026-05-02'));

    const overdueBefore = issuesBefore30Days.find(i => i.ruleId === RULE_ID.PAYMENT_OVERDUE);
    const overdueAfter = issuesAfter30Days.find(i => i.ruleId === RULE_ID.PAYMENT_OVERDUE);

    expect(overdueBefore).toBeUndefined();
    expect(overdueAfter).toBeDefined();
  });
});
