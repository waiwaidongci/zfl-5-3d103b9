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
  ORPHAN: 'orphan',
  INVENTORY_DISCREPANCY: 'inventory-discrepancy'
};

const CATEGORY_LABELS = {
  [CATEGORY.WORK_ORDER]: '作品-订单',
  [CATEGORY.ORDER_CANCEL]: '订单撤销',
  [CATEGORY.LOAN_RETURN]: '借展归还',
  [CATEGORY.SETTLEMENT]: '结算对账',
  [CATEGORY.CUSTOMER]: '客户档案',
  [CATEGORY.ORPHAN]: '孤儿记录',
  [CATEGORY.INVENTORY_DISCREPANCY]: '盘点差异'
};

const RULE_ID = {
  SOLD_WITHOUT_ORDER: 'sold-without-order',
  CANCELED_ORDER_PENDING_SETTLEMENT: 'canceled-order-pending-settlement',
  CANCELLED_ORDER_STILL_SOLD: 'cancelled-order-still-sold',
  SETTLED_WITHOUT_ORDER: 'settled-without-order',
  BOOKED_WITHOUT_INQUIRY: 'booked-without-inquiry',
  DEAL_WITHOUT_DEPOSIT: 'deal-without-deposit',
  BALANCE_OVERDUE: 'balance-overdue',
  ORPHAN_INQUIRY: 'orphan-inquiry',
  ORPHAN_ORDER: 'orphan-order',
  ORPHAN_LOAN: 'orphan-loan',
  ORPHAN_INVENTORY: 'orphan-inventory',
  LOAN_RETURNED_NOT_REVERTED: 'loan-returned-not-reverted',
  SETTLEMENT_WORK_NOT_SOLD: 'settlement-work-not-sold',
  SETTLEMENT_WORK_UNSETTLED: 'settlement-work-unsettled',
  PAYMENT_STATUS_PAID_BUT_NOT_FULL: 'payment-status-paid-but-not-full',
  PAYMENT_STATUS_PENDING_BUT_PAID: 'payment-status-pending-but-paid',
  PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID: 'payment-status-partial-but-fully-paid',
  PAYMENT_OVERPAID: 'payment-overpaid',
  PAYMENT_MISSING_DATE: 'payment-missing-date',
  PAYMENT_OVERDUE: 'payment-overdue',
  CUSTOMER_CONFLICT_ABANDONED: 'customer-conflict-abandoned',
  CUSTOMER_CONFLICT_DEALED_NO_ORDER: 'customer-conflict-dealed-no-order',
  CUSTOMER_DUPLICATE_SUSPECTED: 'customer-duplicate-suspected',
  INVENTORY_DISCREPANCY: 'inventory-discrepancy'
};

const RULE_LABELS = {
  [RULE_ID.SOLD_WITHOUT_ORDER]: '已售但缺订单',
  [RULE_ID.CANCELED_ORDER_PENDING_SETTLEMENT]: '订单已撤销但作品仍待结算',
  [RULE_ID.CANCELLED_ORDER_STILL_SOLD]: '订单已撤销但作品仍显示已售',
  [RULE_ID.SETTLED_WITHOUT_ORDER]: '已结算但无有效订单',
  [RULE_ID.BOOKED_WITHOUT_INQUIRY]: '已预订但无询价记录',
  [RULE_ID.DEAL_WITHOUT_DEPOSIT]: '已成交但未收订金',
  [RULE_ID.BALANCE_OVERDUE]: '尾款逾期未付',
  [RULE_ID.ORPHAN_INQUIRY]: '询价记录关联作品不存在',
  [RULE_ID.ORPHAN_ORDER]: '订单关联作品不存在',
  [RULE_ID.ORPHAN_LOAN]: '借展记录关联作品不存在',
  [RULE_ID.ORPHAN_INVENTORY]: '盘点条目引用不存在作品',
  [RULE_ID.LOAN_RETURNED_NOT_REVERTED]: '借展已归还但展态未回库',
  [RULE_ID.SETTLEMENT_WORK_NOT_SOLD]: '已确认结算单中作品非已售',
  [RULE_ID.SETTLEMENT_WORK_UNSETTLED]: '已确认结算单中作品未结算',
  [RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL]: '对账单标记已付款但金额不足',
  [RULE_ID.PAYMENT_STATUS_PENDING_BUT_PAID]: '对账单标记待付款但已有付款',
  [RULE_ID.PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID]: '对账单标记部分付款但已付清',
  [RULE_ID.PAYMENT_OVERPAID]: '对账单超额支付',
  [RULE_ID.PAYMENT_MISSING_DATE]: '对账单缺少付款日期',
  [RULE_ID.PAYMENT_OVERDUE]: '对账单确认超30天未付清',
  [RULE_ID.CUSTOMER_CONFLICT_ABANDONED]: '客户询价已放弃但有有效订单',
  [RULE_ID.CUSTOMER_CONFLICT_DEALED_NO_ORDER]: '客户询价已成交但无有效订单',
  [RULE_ID.CUSTOMER_DUPLICATE_SUSPECTED]: '疑似重复客户',
  [RULE_ID.INVENTORY_DISCREPANCY]: '盘点差异未处理'
};

const RULE_META = {
  [RULE_ID.SOLD_WITHOUT_ORDER]: { category: CATEGORY.WORK_ORDER, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'create-order-or-reset-sale', fixLabel: '将作品恢复为待售（补录订单需手动操作）' },
  [RULE_ID.CANCELED_ORDER_PENDING_SETTLEMENT]: { category: CATEGORY.ORDER_CANCEL, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'reset-work-settlement-unsettled', fixLabel: '将作品结算状态改为未结算' },
  [RULE_ID.CANCELLED_ORDER_STILL_SOLD]: { category: CATEGORY.ORDER_CANCEL, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'reset-work-sale', fixLabel: '将作品恢复为待售' },
  [RULE_ID.SETTLED_WITHOUT_ORDER]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.BOOKED_WITHOUT_INQUIRY]: { category: CATEGORY.WORK_ORDER, severity: SEVERITY.INFO, autoFixable: false },
  [RULE_ID.DEAL_WITHOUT_DEPOSIT]: { category: CATEGORY.WORK_ORDER, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.BALANCE_OVERDUE]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.ORPHAN_INQUIRY]: { category: CATEGORY.ORPHAN, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'delete-orphan-inquiry', fixLabel: '删除孤儿询价记录' },
  [RULE_ID.ORPHAN_ORDER]: { category: CATEGORY.ORPHAN, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'delete-orphan-order', fixLabel: '删除孤儿订单记录' },
  [RULE_ID.ORPHAN_LOAN]: { category: CATEGORY.ORPHAN, severity: SEVERITY.CRITICAL, autoFixable: true, fixType: 'delete-orphan-loan', fixLabel: '删除孤儿借展记录' },
  [RULE_ID.ORPHAN_INVENTORY]: { category: CATEGORY.ORPHAN, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.LOAN_RETURNED_NOT_REVERTED]: { category: CATEGORY.LOAN_RETURN, severity: SEVERITY.WARNING, autoFixable: true, fixType: 'revert-exhibit-to-storage', fixLabel: '将展态改回库房' },
  [RULE_ID.SETTLEMENT_WORK_NOT_SOLD]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.CRITICAL, autoFixable: false },
  [RULE_ID.SETTLEMENT_WORK_UNSETTLED]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: true, fixType: 'fix-payment-status-to-partial', fixLabel: '将付款状态改为部分付款' },
  [RULE_ID.PAYMENT_STATUS_PENDING_BUT_PAID]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: true, fixType: 'fix-payment-status-to-partial', fixLabel: '将付款状态改为部分付款' },
  [RULE_ID.PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: true, fixType: 'fix-payment-status-to-paid', fixLabel: '将付款状态改为已付款' },
  [RULE_ID.PAYMENT_OVERPAID]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.INFO, autoFixable: false },
  [RULE_ID.PAYMENT_MISSING_DATE]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.INFO, autoFixable: false },
  [RULE_ID.PAYMENT_OVERDUE]: { category: CATEGORY.SETTLEMENT, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.CUSTOMER_CONFLICT_ABANDONED]: { category: CATEGORY.CUSTOMER, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.CUSTOMER_CONFLICT_DEALED_NO_ORDER]: { category: CATEGORY.CUSTOMER, severity: SEVERITY.WARNING, autoFixable: false },
  [RULE_ID.CUSTOMER_DUPLICATE_SUSPECTED]: { category: CATEGORY.CUSTOMER, severity: SEVERITY.INFO, autoFixable: false },
  [RULE_ID.INVENTORY_DISCREPANCY]: { category: CATEGORY.INVENTORY_DISCREPANCY, severity: SEVERITY.WARNING, autoFixable: false }
};

function createIssue(ruleId, overrides) {
  const meta = RULE_META[ruleId];
  return {
    ruleId,
    category: meta.category,
    severity: meta.severity,
    label: RULE_LABELS[ruleId],
    autoFixable: meta.autoFixable,
    fixType: meta.autoFixable ? meta.fixType : null,
    fixLabel: meta.autoFixable ? meta.fixLabel : null,
    workId: null,
    orderId: null,
    inquiryId: null,
    entityId: null,
    entityType: null,
    relatedEntityId: null,
    workTitle: null,
    workArtist: null,
    customerName: null,
    daysOverdue: null,
    overdueAmount: null,
    ...overrides
  };
}

function checkSoldWithoutOrder(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  const issues = [];
  works.forEach((work) => {
    if (work.sale === '已售' && !activeOrderWorkIds.has(work.id)) {
      issues.push(createIssue(RULE_ID.SOLD_WITHOUT_ORDER, {
        id: `sold-no-order-${work.id}`,
        title: `作品「${work.title}」已售但无有效订单`,
        description: `作品「${work.title}」标记为已售，但不存在对应的未撤销订单。可能是订单被删除或数据迁移后丢失。`,
        suggestion: '补录订单或将作品恢复为待售状态',
        workId: work.id,
        entityId: work.id,
        entityType: 'works',
        workTitle: work.title,
        workArtist: work.artist,
        entitySnapshot: { ...work }
      }));
    }
  });
  return issues;
}

function checkCanceledOrderPendingSettlement(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  const issues = [];
  orders.forEach((order) => {
    if (order.cancelledAt) {
      const work = works.find((w) => w.id === order.workId);
      if (work && work.settlement === '待结算' && !activeOrderWorkIds.has(work.id)) {
        issues.push(createIssue(RULE_ID.CANCELED_ORDER_PENDING_SETTLEMENT, {
          id: `canceled-pending-settlement-${order.id}`,
          title: `订单已撤销但作品「${work.title}」仍待结算`,
          description: `订单「${order.customerName} · ${order.workTitle}」已撤销，但对应作品「${work.title}」仍标记为待结算，且无其他有效订单。`,
          suggestion: '将作品结算状态改为未结算',
          workId: work.id,
          orderId: order.id,
          entityId: work.id,
          entityType: 'works',
          relatedEntityId: order.id,
          workTitle: work.title,
          workArtist: work.artist,
          customerName: order.customerName,
          entitySnapshot: { work: { ...work }, order: { ...order } }
        }));
      }
    }
  });
  return issues;
}

function checkCancelledOrderStillSold(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  const issues = [];
  orders.forEach((order) => {
    if (order.cancelledAt) {
      const work = works.find((w) => w.id === order.workId);
      if (work && work.sale === '已售' && !activeOrderWorkIds.has(work.id)) {
        issues.push(createIssue(RULE_ID.CANCELLED_ORDER_STILL_SOLD, {
          id: `cancelled-still-sold-${order.id}`,
          title: `订单已撤销但作品「${work.title}」仍显示已售`,
          description: `订单「${order.customerName} · ${order.workTitle}」已撤销，但对应作品仍标记为已售，且无其他有效订单。`,
          suggestion: '将作品恢复为待售状态',
          workId: work.id,
          orderId: order.id,
          entityId: work.id,
          entityType: 'works',
          relatedEntityId: order.id,
          workTitle: work.title,
          workArtist: work.artist,
          customerName: order.customerName,
          entitySnapshot: { ...work }
        }));
      }
    }
  });
  return issues;
}

function checkSettledWithoutOrder(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  const issues = [];
  works.forEach((work) => {
    if (work.settlement === '已结算' && !activeOrderWorkIds.has(work.id)) {
      issues.push(createIssue(RULE_ID.SETTLED_WITHOUT_ORDER, {
        id: `settled-no-order-${work.id}`,
        title: `作品「${work.title}」已结算但无有效订单`,
        description: `作品「${work.title}」标记为已结算，但不存在对应的有效订单。`,
        suggestion: '检查结算记录是否正确，或补录关联订单',
        workId: work.id,
        entityId: work.id,
        entityType: 'works',
        workTitle: work.title,
        workArtist: work.artist,
        entitySnapshot: { ...work }
      }));
    }
  });
  return issues;
}

function checkBookedWithoutInquiry(works, inquiries) {
  const workIdsWithInquiries = new Set(inquiries.map((inq) => inq.workId));
  const issues = [];
  works.forEach((work) => {
    if (work.sale === '已预订' && !workIdsWithInquiries.has(work.id)) {
      issues.push(createIssue(RULE_ID.BOOKED_WITHOUT_INQUIRY, {
        id: `booked-no-inquiry-${work.id}`,
        title: `作品「${work.title}」已预订但无询价记录`,
        description: `作品「${work.title}」已预订，但没有对应的询价记录。`,
        suggestion: '如需完整追踪销售流程，建议补充询价记录',
        workId: work.id,
        entityId: work.id,
        entityType: 'works',
        workTitle: work.title,
        workArtist: work.artist,
        entitySnapshot: { ...work }
      }));
    }
  });
  return issues;
}

function checkDealWithoutDeposit(works, orders) {
  const issues = [];
  orders.forEach((order) => {
    if (!order.cancelledAt) {
      const deposit = Number(order.deposit || 0);
      if (deposit <= 0) {
        const work = works.find((w) => w.id === order.workId);
        if (work && work.sale === '已售') {
          issues.push(createIssue(RULE_ID.DEAL_WITHOUT_DEPOSIT, {
            id: `deal-no-deposit-${order.id}`,
            title: `订单「${order.customerName} · ${order.workTitle}」已成交但未收订金`,
            description: `订单「${order.customerName} · ${order.workTitle}」已成交，但未收取订金。`,
            suggestion: '确认订金收取情况，及时跟进回款',
            workId: order.workId,
            orderId: order.id,
            entityId: order.id,
            entityType: 'orders',
            workTitle: order.workTitle,
            workArtist: order.workArtist,
            customerName: order.customerName,
            entitySnapshot: { order: { ...order }, work: work ? { ...work } : null }
          }));
        }
      }
    }
  });
  return issues;
}

function checkBalanceOverdue(works, orders, now) {
  const issues = [];
  const today = (now ? new Date(now) : new Date()).toISOString().slice(0, 10);
  orders.forEach((order) => {
    if (order.cancelledAt) return;
    if (order.balanceStatus === '已支付') return;
    const balance = Number(order.dealPrice || 0) - Number(order.deposit || 0);
    if (balance <= 0) return;
    const dealDate = order.dealDate;
    if (!dealDate) return;
    const daysSinceDeal = Math.floor(
      (new Date(today) - new Date(dealDate)) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceDeal > 30) {
      issues.push(createIssue(RULE_ID.BALANCE_OVERDUE, {
        id: `balance-overdue-${order.id}`,
        title: `订单「${order.customerName} · ${order.workTitle}」尾款逾期`,
        description: `订单「${order.customerName} · ${order.workTitle}」成交已超过 30 天，尾款 ¥${balance.toLocaleString()} 仍未结清。`,
        suggestion: '及时跟进客户，催收尾款',
        workId: order.workId,
        orderId: order.id,
        entityId: order.id,
        entityType: 'orders',
        workTitle: order.workTitle,
        workArtist: order.workArtist,
        customerName: order.customerName,
        entitySnapshot: { order: { ...order } },
        daysOverdue: daysSinceDeal,
        overdueAmount: balance
      }));
    }
  });
  return issues;
}

function checkOrphanInquiries(works, inquiries) {
  const validWorkIds = new Set(works.map((w) => w.id));
  const issues = [];
  inquiries.forEach((inq) => {
    if (!validWorkIds.has(inq.workId)) {
      issues.push(createIssue(RULE_ID.ORPHAN_INQUIRY, {
        id: `orphan-inquiry-${inq.id}`,
        title: `询价记录「${inq.customerName} · ${inq.workTitle}」引用了不存在的作品`,
        description: `询价记录「${inq.customerName} · ${inq.workTitle}」关联的作品（ID: ${inq.workId}）不存在。`,
        suggestion: '删除无效询价记录或恢复关联作品',
        inquiryId: inq.id,
        workId: inq.workId,
        entityId: inq.id,
        entityType: 'inquiries',
        workTitle: inq.workTitle,
        customerName: inq.customerName,
        entitySnapshot: { ...inq }
      }));
    }
  });
  return issues;
}

function checkOrphanOrders(works, orders) {
  const validWorkIds = new Set(works.map((w) => w.id));
  const issues = [];
  orders.forEach((order) => {
    if (!validWorkIds.has(order.workId)) {
      issues.push(createIssue(RULE_ID.ORPHAN_ORDER, {
        id: `orphan-order-${order.id}`,
        title: `订单记录「${order.workTitle || order.id}」引用了不存在的作品`,
        description: `订单「${order.customerName} · ${order.workTitle}」关联的作品（ID: ${order.workId}）不存在。${order.cancelledAt ? '（已撤销）' : ''}`,
        suggestion: '删除无效订单或恢复关联作品',
        orderId: order.id,
        workId: order.workId,
        entityId: order.id,
        entityType: 'orders',
        workTitle: order.workTitle,
        customerName: order.customerName,
        entitySnapshot: { ...order }
      }));
    }
  });
  return issues;
}

function checkOrphanLoans(works, loans) {
  const validWorkIds = new Set(works.map((w) => w.id));
  const issues = [];
  loans.forEach((loan) => {
    if (loan.workId && !validWorkIds.has(loan.workId)) {
      issues.push(createIssue(RULE_ID.ORPHAN_LOAN, {
        id: `orphan-loan-${loan.id}`,
        title: `借展记录「${loan.workTitle || loan.id}」引用了不存在的作品`,
        description: `该借展记录关联的作品ID「${loan.workId}」在当前作品列表中不存在，可能是备份恢复后丢失。`,
        suggestion: '删除无效借展记录或恢复关联作品',
        workId: loan.workId,
        entityId: loan.id,
        entityType: 'loans',
        workTitle: loan.workTitle,
        customerName: loan.borrower,
        entitySnapshot: { ...loan }
      }));
    }
  });
  return issues;
}

function checkOrphanInventoryItems(works, inventoryTasks) {
  const validWorkIds = new Set(works.map((w) => w.id));
  const issues = [];
  inventoryTasks.forEach((task) => {
    task.items.forEach((item) => {
      if (item.workId && !validWorkIds.has(item.workId)) {
        issues.push(createIssue(RULE_ID.ORPHAN_INVENTORY, {
          id: `orphan-inventory-${task.id}-${item.id}`,
          title: `盘点任务「${task.name}」中存在引用不存在作品的条目`,
          description: `盘点条目关联的作品ID「${item.workId}」不存在，快照作品名为「${item.workSnapshot?.title || '未知'}」。`,
          suggestion: '标记为异常并人工核实',
          workId: item.workId,
          entityId: item.id,
          entityType: 'inventoryItems',
          relatedEntityId: task.id,
          entitySnapshot: { taskName: task.name, ...item }
        }));
      }
    });
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
        issues.push(createIssue(RULE_ID.LOAN_RETURNED_NOT_REVERTED, {
          id: `loan-returned-not-reverted-${loan.id}`,
          title: `借展已归还但作品「${work.title}」展态仍为借展`,
          description: `借展记录「${loan.borrower} · ${loan.workTitle}」已标记归还，且无其他活跃借展，但作品展态未回库。`,
          suggestion: '将展态改回库房',
          workId: work.id,
          entityId: work.id,
          entityType: 'works',
          relatedEntityId: loan.id,
          workTitle: work.title,
          workArtist: work.artist,
          customerName: loan.borrower,
          entitySnapshot: { ...work }
        }));
      }
    }
  });
  return issues;
}

function checkSettlementWorkInconsistent(works, orders, statements) {
  const issues = [];
  statements.forEach((statement) => {
    if (!statement.confirmed) return;
    statement.items.forEach((item) => {
      const work = works.find((w) => w.id === item.workId);
      if (!work) return;
      if (work.sale !== '已售') {
        issues.push(createIssue(RULE_ID.SETTLEMENT_WORK_NOT_SOLD, {
          id: `settlement-work-not-sold-${statement.id}-${item.workId}`,
          title: `已确认结算单中的作品「${work.title}」不是已售状态`,
          description: `结算单「${statement.artist} · ${statement.startDate}~${statement.endDate}」已确认，但其中作品当前销售状态为「${work.sale}」，与结算单不一致。`,
          suggestion: '将作品设为已售以匹配结算单',
          workId: work.id,
          entityId: work.id,
          entityType: 'works',
          relatedEntityId: statement.id,
          workTitle: work.title,
          workArtist: work.artist,
          entitySnapshot: { ...work }
        }));
      }
      if (work.settlement === '未结算') {
        issues.push(createIssue(RULE_ID.SETTLEMENT_WORK_UNSETTLED, {
          id: `settlement-work-unsettled-${statement.id}-${item.workId}`,
          title: `已确认结算单中的作品「${work.title}」结算状态为未结算`,
          description: `结算单「${statement.artist}」已确认，但作品结算状态仍为「未结算」，应为「已结算」或「待结算」。`,
          suggestion: '将作品设为已结算以匹配结算单',
          workId: work.id,
          entityId: work.id,
          entityType: 'works',
          relatedEntityId: statement.id,
          workTitle: work.title,
          workArtist: work.artist,
          entitySnapshot: { ...work }
        }));
      }
    });
  });
  return issues;
}

function checkPaymentConsistency(statements, now) {
  const issues = [];
  statements.forEach((statement) => {
    if (!statement.confirmed) return;
    const totalPayable = Number(statement.totalPayable || 0);
    const paidAmount = Number(statement.paidAmount || 0);
    const paymentStatus = statement.paymentStatus || '待付款';

    if (paymentStatus === '已付款' && paidAmount < totalPayable) {
      issues.push(createIssue(RULE_ID.PAYMENT_STATUS_PAID_BUT_NOT_FULL, {
        id: `payment-status-paid-but-not-full-${statement.id}`,
        title: `对账单「${statement.artist}」标记为已付款但金额不足`,
        description: `对账单标记为「已付款」，但已付金额 ¥${paidAmount.toLocaleString()} 小于应付金额 ¥${totalPayable.toLocaleString()}。付款状态与金额不一致。`,
        suggestion: '核实付款记录，将付款状态改为部分付款',
        entityId: statement.id,
        entityType: 'statements',
        entitySnapshot: { ...statement }
      }));
    }

    if (paymentStatus === '待付款' && paidAmount > 0) {
      issues.push(createIssue(RULE_ID.PAYMENT_STATUS_PENDING_BUT_PAID, {
        id: `payment-status-pending-but-paid-${statement.id}`,
        title: `对账单「${statement.artist}」标记为待付款但已有付款记录`,
        description: `对账单标记为「待付款」，但已付金额为 ¥${paidAmount.toLocaleString()}。付款状态与金额不一致。`,
        suggestion: '核实付款记录，将付款状态改为部分付款',
        entityId: statement.id,
        entityType: 'statements',
        entitySnapshot: { ...statement }
      }));
    }

    if (paymentStatus === '部分付款' && paidAmount >= totalPayable) {
      issues.push(createIssue(RULE_ID.PAYMENT_STATUS_PARTIAL_BUT_FULLY_PAID, {
        id: `payment-status-partial-but-fully-paid-${statement.id}`,
        title: `对账单「${statement.artist}」标记为部分付款但金额已付清`,
        description: `对账单标记为「部分付款」，但已付金额 ¥${paidAmount.toLocaleString()} 已达到或超过应付金额 ¥${totalPayable.toLocaleString()}。`,
        suggestion: '核实付款记录，将付款状态改为已付款',
        entityId: statement.id,
        entityType: 'statements',
        entitySnapshot: { ...statement }
      }));
    }

    if (paymentStatus === '已付款' && paidAmount > totalPayable) {
      issues.push(createIssue(RULE_ID.PAYMENT_OVERPAID, {
        id: `payment-overpaid-${statement.id}`,
        title: `对账单「${statement.artist}」付款金额超过应付金额`,
        description: `已付金额 ¥${paidAmount.toLocaleString()} 超过应付金额 ¥${totalPayable.toLocaleString()}，超额支付 ¥${(paidAmount - totalPayable).toLocaleString()}。`,
        suggestion: '请人工核实是否为预付款',
        entityId: statement.id,
        entityType: 'statements',
        entitySnapshot: { ...statement }
      }));
    }

    if ((paymentStatus === '部分付款' || paymentStatus === '已付款') && paidAmount > 0 && !statement.paymentDate) {
      issues.push(createIssue(RULE_ID.PAYMENT_MISSING_DATE, {
        id: `payment-missing-date-${statement.id}`,
        title: `对账单「${statement.artist}」有付款记录但缺少付款日期`,
        description: `对账单付款状态为「${paymentStatus}」，已付金额 ¥${paidAmount.toLocaleString()}，但未记录付款日期。`,
        suggestion: '请在编辑付款时补充付款日期',
        entityId: statement.id,
        entityType: 'statements',
        entitySnapshot: { ...statement }
      }));
    }

    if (statement.confirmedAt) {
      const confirmedDate = new Date(statement.confirmedAt);
      const currentDate = now ? new Date(now) : new Date();
      const daysSinceConfirmed = Math.floor((currentDate - confirmedDate) / (1000 * 60 * 60 * 24));
      if (daysSinceConfirmed > 30 && paymentStatus !== '已付款') {
        issues.push(createIssue(RULE_ID.PAYMENT_OVERDUE, {
          id: `payment-overdue-${statement.id}`,
          title: `对账单「${statement.artist}」确认已超过30天仍未付清`,
          description: `对账单于 ${statement.confirmedAt.slice(0, 10)} 确认，距今已 ${daysSinceConfirmed} 天，当前付款状态为「${paymentStatus}」，待付金额 ¥${Math.max(0, totalPayable - paidAmount).toLocaleString()}。`,
          suggestion: '请及时跟进付款进度',
          entityId: statement.id,
          entityType: 'statements',
          entitySnapshot: { ...statement }
        }));
      }
    }
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
        issues.push(createIssue(RULE_ID.CUSTOMER_CONFLICT_ABANDONED, {
          id: `customer-conflict-abandoned-${key}`,
          title: `客户「${profile.name}」所有询价已放弃但存在有效订单`,
          description: `客户有 ${abandonedInquiries.length} 条已放弃询价，但同时存在 ${profile.orders.length} 条有效订单。询价状态可能未正确更新为已成交。`,
          suggestion: '将已放弃的询价状态更新为已成交',
          entityId: key,
          entityType: 'inquiries',
          customerName: profile.name,
          entitySnapshot: { name: profile.name, phone: profile.phone, abandonedCount: abandonedInquiries.length, orderCount: profile.orders.length }
        }));
      }
    }

    if (!hasActiveOrders && dealedInquiries.length > 0) {
      const hasMatchingOrder = profile.orders.some((o) => !o.cancelledAt);
      if (!hasMatchingOrder) {
        issues.push(createIssue(RULE_ID.CUSTOMER_CONFLICT_DEALED_NO_ORDER, {
          id: `customer-conflict-dealed-no-order-${key}`,
          title: `客户「${profile.name}」有已成交询价但无有效订单`,
          description: `客户有 ${dealedInquiries.length} 条询价标记为已成交，但没有对应的未撤销订单。可能是订单被撤销或未创建。`,
          suggestion: '将已成交询价改回跟进中，或补录订单',
          entityId: key,
          entityType: 'inquiries',
          customerName: profile.name,
          entitySnapshot: { name: profile.name, phone: profile.phone, dealedInquiryCount: dealedInquiries.length, orderCount: profile.orders.length }
        }));
      }
    }
  });

  return issues;
}

function checkCustomerDuplicates(inquiries, orders, followUps) {
  const issues = [];
  const customerMap = {};

  const allRecords = [
    ...inquiries.map((i) => ({ name: i.customerName, phone: i.customerPhone })),
    ...orders.filter((o) => !o.cancelledAt).map((o) => ({ name: o.customerName, phone: o.customerPhone })),
    ...(followUps || []).map((f) => ({ name: f.customerName, phone: f.customerPhone }))
  ];

  allRecords.forEach((r) => {
    if (!r.name || !r.phone) return;
    const key = `${r.name.trim()}__${r.phone.trim()}`;
    if (!customerMap[key]) {
      customerMap[key] = { name: r.name.trim(), phone: r.phone.trim() };
    }
  });

  const customers = Object.values(customerMap);
  const processedPairs = new Set();

  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = customers[i];
      const b = customers[j];
      const pairKey = [`${a.name}__${a.phone}`, `${b.name}__${b.phone}`].sort().join('||');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      let score = 0;
      const reasons = [];

      const normPhoneA = a.phone.replace(/[\s\-—–()（）]/g, '').replace(/^\+?86/, '').replace(/^0+/, '');
      const normPhoneB = b.phone.replace(/[\s\-—–()（）]/g, '').replace(/^\+?86/, '').replace(/^0+/, '');

      if (normPhoneA === normPhoneB && normPhoneA.length >= 7) {
        score += 60;
        reasons.push('手机号归一后相同');
      } else if (normPhoneA.length > 0 && normPhoneB.length > 0) {
        if (normPhoneA.endsWith(normPhoneB) || normPhoneB.endsWith(normPhoneA)) {
          const shorter = Math.min(normPhoneA.length, normPhoneB.length);
          const longer = Math.max(normPhoneA.length, normPhoneB.length);
          if (longer - shorter <= 3 && shorter / longer >= 0.7) {
            score += 35;
            reasons.push('手机号高度相似');
          }
        }
      }

      const normNameA = a.name.replace(/[\s·•・]/g, '').toLowerCase();
      const normNameB = b.name.replace(/[\s·•・]/g, '').toLowerCase();

      if (normNameA === normNameB && normNameA.length >= 2) {
        score += 40;
        reasons.push('姓名归一后相同');
      } else if (normNameA.length > 0 && normNameB.length > 0) {
        if (normNameA.includes(normNameB) || normNameB.includes(normNameA)) {
          const shorter = Math.min(normNameA.length, normNameB.length);
          const longer = Math.max(normNameA.length, normNameB.length);
          if (shorter / longer >= 0.7) {
            score += 25;
            reasons.push('姓名高度相似');
          }
        }
      }

      if (score >= 50) {
        issues.push(createIssue(RULE_ID.CUSTOMER_DUPLICATE_SUSPECTED, {
          id: `customer-duplicate-${pairKey}`,
          title: `疑似重复客户「${a.name}」与「${b.name}」`,
          description: `客户「${a.name}」（${a.phone}）与「${b.name}」（${b.phone}）相似度评分 ${Math.min(score, 100)} 分，原因：${reasons.join('、')}。可能为同一客户的不同记录。`,
          suggestion: '点击右侧按钮跳转到客户档案合并去重面板',
          entityType: 'inquiries',
          customerName: `${a.name} / ${b.name}`,
          jumpTarget: 'customerMerge',
          entitySnapshot: {
            customerA: { name: a.name, phone: a.phone },
            customerB: { name: b.name, phone: b.phone },
            score: Math.min(score, 100),
            reasons
          }
        }));
      }
    }
  }

  return issues;
}

function checkInventoryDiscrepancies(inventoryTasks, works) {
  const issues = [];
  const FIELD_LABELS = { exhibit: '展态', sale: '销售状态', price: '价格', existence: '存在性' };
  const DISCREPANCY_FIELDS = ['exhibit', 'sale', 'price'];

  inventoryTasks.forEach((task) => {
    if (task.status !== '进行中') return;
    task.items.forEach((item) => {
      if (item.status !== '异常' && item.status !== '缺失') return;
      if (item.discrepancy && item.discrepancy.resolution !== '未处理') return;

      const currentWork = works.find((w) => w.id === item.workId);
      let diffFields = [];

      if (!currentWork) {
        diffFields = [{ field: 'existence', snapshot: '存在', current: '已删除' }];
      } else {
        DISCREPANCY_FIELDS.forEach((field) => {
          const snapVal = String(item.workSnapshot[field] ?? '');
          const curVal = String(currentWork[field] ?? '');
          if (snapVal !== curVal) {
            diffFields.push({ field, snapshotVal: snapVal, currentVal: curVal });
          }
        });
      }

      if (diffFields.length === 0) return;

      const diffSummary = diffFields.map((d) => FIELD_LABELS[d.field] || d.field).join('、');
      const severity = diffFields.some((d) => d.field === 'existence') ? SEVERITY.CRITICAL : SEVERITY.WARNING;

      issues.push(createIssue(RULE_ID.INVENTORY_DISCREPANCY, {
        id: `inventory-discrepancy-${task.id}-${item.id}`,
        severity,
        title: `盘点任务「${task.name}」中「${item.workSnapshot.title}」存在未处理差异`,
        description: `作品「${item.workSnapshot.artist} — ${item.workSnapshot.title}」标记为${item.status}，差异字段：${diffSummary}。当前值与盘点快照不一致，需决定恢复、备注或保留异常。`,
        suggestion: '恢复快照状态或人工核实后保留',
        workId: item.workId,
        entityId: item.id,
        entityType: 'inventoryItems',
        relatedEntityId: task.id,
        workTitle: item.workSnapshot?.title,
        workArtist: item.workSnapshot?.artist,
        entitySnapshot: { taskName: task.name, ...item }
      }));
    });
  });

  return issues;
}

function runAllDiagnostics(data, now) {
  const { works, orders, inquiries, loans, statements, inventoryTasks, followUps } = data;

  const allIssues = [
    ...checkSoldWithoutOrder(works, orders),
    ...checkCanceledOrderPendingSettlement(works, orders),
    ...checkCancelledOrderStillSold(works, orders),
    ...checkSettledWithoutOrder(works, orders),
    ...checkBookedWithoutInquiry(works, inquiries),
    ...checkDealWithoutDeposit(works, orders),
    ...checkBalanceOverdue(works, orders, now),
    ...checkOrphanInquiries(works, inquiries),
    ...checkOrphanOrders(works, orders),
    ...checkOrphanLoans(works, loans || []),
    ...checkOrphanInventoryItems(works, inventoryTasks || []),
    ...checkLoanReturnedNotReverted(works, loans || []),
    ...checkSettlementWorkInconsistent(works, orders, statements || []),
    ...checkPaymentConsistency(statements || [], now),
    ...checkCustomerStatusConflict(inquiries, orders),
    ...checkCustomerDuplicates(inquiries, orders, followUps || []),
    ...checkInventoryDiscrepancies(inventoryTasks || [], works)
  ];

  const byCategory = {};
  const bySeverity = {};
  const byRuleId = {};
  allIssues.forEach((issue) => {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    byRuleId[issue.ruleId] = (byRuleId[issue.ruleId] || 0) + 1;
  });

  return {
    issues: allIssues,
    totalIssues: allIssues.length,
    criticalCount: bySeverity[SEVERITY.CRITICAL] || 0,
    warningCount: bySeverity[SEVERITY.WARNING] || 0,
    infoCount: bySeverity[SEVERITY.INFO] || 0,
    byCategory,
    bySeverity,
    byRuleId,
    scannedAt: (now ? new Date(now) : new Date()).toISOString()
  };
}

function detectAllAnomalies(works, orders, inquiries, statements, loans, inventoryTasks, followUps, now) {
  const result = runAllDiagnostics({ works, orders, inquiries, loans: loans || [], statements, inventoryTasks: inventoryTasks || [], followUps: followUps || [] }, now);

  const byType = {};
  Object.values(RULE_ID).forEach((ruleId) => {
    byType[ruleId] = result.byRuleId[ruleId] || 0;
  });

  return {
    anomalies: result.issues,
    summary: {
      total: result.totalIssues,
      critical: result.criticalCount,
      warning: result.warningCount,
      info: result.infoCount,
      byType
    }
  };
}

const ANOMALY_TYPES = RULE_ID;
const ANOMALY_SEVERITY = SEVERITY;
const ANOMALY_LABELS = RULE_LABELS;

export {
  SEVERITY,
  CATEGORY,
  CATEGORY_LABELS,
  RULE_ID,
  RULE_LABELS,
  RULE_META,
  ANOMALY_TYPES,
  ANOMALY_SEVERITY,
  ANOMALY_LABELS,
  checkSoldWithoutOrder,
  checkCanceledOrderPendingSettlement,
  checkCancelledOrderStillSold,
  checkSettledWithoutOrder,
  checkBookedWithoutInquiry,
  checkDealWithoutDeposit,
  checkBalanceOverdue,
  checkOrphanInquiries,
  checkOrphanOrders,
  checkOrphanLoans,
  checkOrphanInventoryItems,
  checkLoanReturnedNotReverted,
  checkSettlementWorkInconsistent,
  checkPaymentConsistency,
  checkCustomerStatusConflict,
  checkCustomerDuplicates,
  checkInventoryDiscrepancies,
  runAllDiagnostics,
  detectAllAnomalies
};
