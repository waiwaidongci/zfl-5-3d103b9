const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

const CATEGORY = {
  WORK_ORDER: 'work-order',
  ORDER_CANCEL: 'order-cancel',
  LOAN_RETURN: 'loan-return',
  SETTLEMENT: 'settlement',
  CUSTOMER: 'customer',
  ORPHAN: 'orphan'
};

const CATEGORY_LABELS = {
  [CATEGORY.WORK_ORDER]: '作品-订单',
  [CATEGORY.ORDER_CANCEL]: '订单撤销',
  [CATEGORY.LOAN_RETURN]: '借展归还',
  [CATEGORY.SETTLEMENT]: '结算对账',
  [CATEGORY.CUSTOMER]: '客户档案',
  [CATEGORY.ORPHAN]: '孤儿记录'
};

function checkSoldWithoutOrder(works, orders) {
  const activeOrderMap = {};
  orders.forEach((o) => {
    if (!o.cancelledAt) {
      activeOrderMap[o.workId] = o;
    }
  });

  const issues = [];
  works.forEach((work) => {
    if (work.sale === '已售' && !activeOrderMap[work.id]) {
      issues.push({
        id: `sold-no-order-${work.id}`,
        category: CATEGORY.WORK_ORDER,
        severity: SEVERITY.CRITICAL,
        title: `作品「${work.title}」已售但无有效订单`,
        description: `作品标记为已售，但不存在对应的未撤销订单。可能是订单被删除或数据迁移后丢失。`,
        entityId: work.id,
        entityType: 'works',
        entitySnapshot: { ...work },
        fixType: 'create-order-or-reset-sale',
        fixLabel: '补录订单或将作品恢复为待售'
      });
    }
  });
  return issues;
}

function checkCancelledOrderStillSold(works, orders) {
  const activeOrderMap = {};
  orders.forEach((o) => {
    if (!o.cancelledAt) {
      activeOrderMap[o.workId] = o;
    }
  });

  const issues = [];
  orders.forEach((order) => {
    if (order.cancelledAt) {
      const work = works.find((w) => w.id === order.workId);
      if (work && work.sale === '已售' && !activeOrderMap[work.id]) {
        issues.push({
          id: `cancelled-still-sold-${order.id}`,
          category: CATEGORY.ORDER_CANCEL,
          severity: SEVERITY.CRITICAL,
          title: `订单已撤销但作品「${work.title}」仍显示已售`,
          description: `订单「${order.customerName} · ${order.workTitle}」已撤销，但对应作品仍标记为已售，且无其他有效订单。`,
          entityId: work.id,
          relatedEntityId: order.id,
          entityType: 'works',
          entitySnapshot: { ...work },
          fixType: 'reset-work-sale',
          fixLabel: '将作品恢复为待售'
        });
      }
    }
  });
  return issues;
}

function checkLoanReturnedNotReverted(works, loans) {
  const issues = [];
  const activeLoanMap = {};
  loans.forEach((l) => {
    if (!l.returnedAt) {
      activeLoanMap[l.workId] = l;
    }
  });

  loans.forEach((loan) => {
    if (loan.returnedAt) {
      const work = works.find((w) => w.id === loan.workId);
      if (work && work.exhibit === '借展' && !activeLoanMap[loan.workId]) {
        issues.push({
          id: `loan-returned-not-reverted-${loan.id}`,
          category: CATEGORY.LOAN_RETURN,
          severity: SEVERITY.WARNING,
          title: `借展已归还但作品「${work.title}」展态仍为借展`,
          description: `借展记录「${loan.borrower} · ${loan.workTitle}」已标记归还，且无其他活跃借展，但作品展态未回库。`,
          entityId: work.id,
          relatedEntityId: loan.id,
          entityType: 'works',
          entitySnapshot: { ...work },
          fixType: 'revert-exhibit-to-storage',
          fixLabel: '将展态改回库房'
        });
      }
    }
  });
  return issues;
}

function checkSettlementWorkInconsistent(works, orders, statements) {
  const issues = [];
  const activeOrderMap = {};
  orders.forEach((o) => {
    if (!o.cancelledAt) {
      activeOrderMap[o.workId] = o;
    }
  });

  statements.forEach((statement) => {
    if (!statement.confirmed) return;
    statement.items.forEach((item) => {
      const work = works.find((w) => w.id === item.workId);
      if (!work) return;
      if (work.sale !== '已售') {
        issues.push({
          id: `settlement-work-not-sold-${statement.id}-${item.workId}`,
          category: CATEGORY.SETTLEMENT,
          severity: SEVERITY.CRITICAL,
          title: `已确认结算单中的作品「${work.title}」不是已售状态`,
          description: `结算单「${statement.artist} · ${statement.startDate}~${statement.endDate}」已确认，但其中作品当前销售状态为「${work.sale}」，与结算单不一致。`,
          entityId: work.id,
          relatedEntityId: statement.id,
          entityType: 'works',
          entitySnapshot: { ...work },
          fixType: 'set-work-sold',
          fixLabel: '将作品设为已售'
        });
      }
      if (work.settlement === '未结算') {
        issues.push({
          id: `settlement-work-unsettled-${statement.id}-${item.workId}`,
          category: CATEGORY.SETTLEMENT,
          severity: SEVERITY.WARNING,
          title: `已确认结算单中的作品「${work.title}」结算状态为未结算`,
          description: `结算单「${statement.artist}」已确认，但作品结算状态仍为「未结算」，应为「已结算」或「待结算」。`,
          entityId: work.id,
          relatedEntityId: statement.id,
          entityType: 'works',
          entitySnapshot: { ...work },
          fixType: 'set-work-settled',
          fixLabel: '将作品设为已结算'
        });
      }
    });
  });
  return issues;
}

function checkCustomerStatusConflict(inquiries, orders) {
  const issues = [];
  const customerMap = {};

  inquiries.forEach((inq) => {
    if (!inq.customerName || !inq.customerPhone) return;
    const key = `${inq.customerName.trim()}__${inq.customerPhone.trim()}`;
    if (!customerMap[key]) {
      customerMap[key] = { name: inq.customerName.trim(), phone: inq.customerPhone.trim(), inquiries: [], orders: [] };
    }
    customerMap[key].inquiries.push(inq);
  });

  orders.forEach((order) => {
    if (order.cancelledAt) return;
    if (!order.customerName || !order.customerPhone) return;
    const key = `${order.customerName.trim()}__${order.customerPhone.trim()}`;
    if (!customerMap[key]) {
      customerMap[key] = { name: order.customerName.trim(), phone: order.customerPhone.trim(), inquiries: [], orders: [] };
    }
    customerMap[key].orders.push(order);
  });

  Object.entries(customerMap).forEach(([key, profile]) => {
    const hasActiveOrders = profile.orders.length > 0;
    const abandonedInquiries = profile.inquiries.filter((i) => i.status === '已放弃');
    const dealedInquiries = profile.inquiries.filter((i) => i.status === '已成交');

    if (hasActiveOrders && abandonedInquiries.length > 0) {
      const allInquiriesAbandoned = profile.inquiries.length > 0 && profile.inquiries.every((i) => i.status === '已放弃');
      if (allInquiriesAbandoned) {
        issues.push({
          id: `customer-conflict-abandoned-${key}`,
          category: CATEGORY.CUSTOMER,
          severity: SEVERITY.WARNING,
          title: `客户「${profile.name}」所有询价已放弃但存在有效订单`,
          description: `客户有 ${abandonedInquiries.length} 条已放弃询价，但同时存在 ${profile.orders.length} 条有效订单。询价状态可能未正确更新为已成交。`,
          entityId: key,
          entityType: 'inquiries',
          entitySnapshot: { name: profile.name, phone: profile.phone, abandonedCount: abandonedInquiries.length, orderCount: profile.orders.length },
          fixType: 'mark-inquiries-dealed',
          fixLabel: '将已放弃询价标记为已成交'
        });
      }
    }

    if (!hasActiveOrders && dealedInquiries.length > 0) {
      const hasMatchingOrder = profile.orders.some((o) => !o.cancelledAt);
      if (!hasMatchingOrder) {
        issues.push({
          id: `customer-conflict-dealed-no-order-${key}`,
          category: CATEGORY.CUSTOMER,
          severity: SEVERITY.WARNING,
          title: `客户「${profile.name}」有已成交询价但无有效订单`,
          description: `客户有 ${dealedInquiries.length} 条询价标记为已成交，但没有对应的未撤销订单。可能是订单被撤销或未创建。`,
          entityId: key,
          entityType: 'inquiries',
          entitySnapshot: { name: profile.name, phone: profile.phone, dealedInquiryCount: dealedInquiries.length, orderCount: profile.orders.length },
          fixType: 'reset-inquiries-to-following',
          fixLabel: '将已成交询价改回跟进中'
        });
      }
    }
  });

  return issues;
}

function checkOrphanRecords(works, orders, inquiries, loans, inventoryTasks) {
  const issues = [];
  const workIdSet = new Set(works.map((w) => w.id));

  inquiries.forEach((inq) => {
    if (inq.workId && !workIdSet.has(inq.workId)) {
      issues.push({
        id: `orphan-inquiry-${inq.id}`,
        category: CATEGORY.ORPHAN,
        severity: SEVERITY.CRITICAL,
        title: `询价记录「${inq.workTitle || inq.id}」引用了不存在的作品`,
        description: `该询价记录关联的作品ID「${inq.workId}」在当前作品列表中不存在，可能是备份恢复后丢失。`,
        entityId: inq.id,
        entityType: 'inquiries',
        entitySnapshot: { ...inq },
        fixType: 'delete-orphan-inquiry',
        fixLabel: '删除孤儿询价记录'
      });
    }
  });

  orders.forEach((order) => {
    if (order.workId && !workIdSet.has(order.workId)) {
      issues.push({
        id: `orphan-order-${order.id}`,
        category: CATEGORY.ORPHAN,
        severity: SEVERITY.CRITICAL,
        title: `订单记录「${order.workTitle || order.id}」引用了不存在的作品`,
        description: `该订单关联的作品ID「${order.workId}」在当前作品列表中不存在，可能是备份恢复后丢失。`,
        entityId: order.id,
        entityType: 'orders',
        entitySnapshot: { ...order },
        fixType: 'delete-orphan-order',
        fixLabel: '删除孤儿订单记录'
      });
    }
  });

  loans.forEach((loan) => {
    if (loan.workId && !workIdSet.has(loan.workId)) {
      issues.push({
        id: `orphan-loan-${loan.id}`,
        category: CATEGORY.ORPHAN,
        severity: SEVERITY.CRITICAL,
        title: `借展记录「${loan.workTitle || loan.id}」引用了不存在的作品`,
        description: `该借展记录关联的作品ID「${loan.workId}」在当前作品列表中不存在，可能是备份恢复后丢失。`,
        entityId: loan.id,
        entityType: 'loans',
        entitySnapshot: { ...loan },
        fixType: 'delete-orphan-loan',
        fixLabel: '删除孤儿借展记录'
      });
    }
  });

  inventoryTasks.forEach((task) => {
    task.items.forEach((item) => {
      if (item.workId && !workIdSet.has(item.workId)) {
        issues.push({
          id: `orphan-inventory-${task.id}-${item.id}`,
          category: CATEGORY.ORPHAN,
          severity: SEVERITY.WARNING,
          title: `盘点任务「${task.name}」中存在引用不存在作品的条目`,
          description: `盘点条目关联的作品ID「${item.workId}」不存在，快照作品名为「${item.workSnapshot?.title || '未知'}」。`,
          entityId: item.id,
          relatedEntityId: task.id,
          entityType: 'inventoryItems',
          entitySnapshot: { taskName: task.name, ...item },
          fixType: 'flag-orphan-inventory',
          fixLabel: '标记为异常'
        });
      }
    });
  });

  return issues;
}

function runAllDiagnostics(data) {
  const { works, orders, inquiries, loans, statements, inventoryTasks } = data;

  const allIssues = [
    ...checkSoldWithoutOrder(works, orders),
    ...checkCancelledOrderStillSold(works, orders),
    ...checkLoanReturnedNotReverted(works, loans),
    ...checkSettlementWorkInconsistent(works, orders, statements),
    ...checkCustomerStatusConflict(inquiries, orders),
    ...checkOrphanRecords(works, orders, inquiries, loans, inventoryTasks)
  ];

  const byCategory = {};
  const bySeverity = {};
  allIssues.forEach((issue) => {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });

  return {
    issues: allIssues,
    totalIssues: allIssues.length,
    criticalCount: bySeverity[SEVERITY.CRITICAL] || 0,
    warningCount: bySeverity[SEVERITY.WARNING] || 0,
    infoCount: bySeverity[SEVERITY.INFO] || 0,
    byCategory,
    bySeverity,
    scannedAt: new Date().toISOString()
  };
}

export {
  SEVERITY,
  CATEGORY,
  CATEGORY_LABELS,
  checkSoldWithoutOrder,
  checkCancelledOrderStillSold,
  checkLoanReturnedNotReverted,
  checkSettlementWorkInconsistent,
  checkCustomerStatusConflict,
  checkOrphanRecords,
  runAllDiagnostics
};
