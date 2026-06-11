const ANOMALY_TYPES = {
  SOLD_WITHOUT_ORDER: 'sold-without-order',
  CANCELED_ORDER_PENDING_SETTLEMENT: 'canceled-order-pending-settlement',
  SETTLED_WITHOUT_ORDER: 'settled-without-order',
  BOOKED_WITHOUT_INQUIRY: 'booked-without-inquiry',
  DEAL_WITHOUT_DEPOSIT: 'deal-without-deposit',
  BALANCE_OVERDUE: 'balance-overdue',
  ORPHAN_INQUIRY: 'orphan-inquiry',
  ORPHAN_ORDER: 'orphan-order'
};

const ANOMALY_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

const ANOMALY_LABELS = {
  [ANOMALY_TYPES.SOLD_WITHOUT_ORDER]: '已售但缺订单',
  [ANOMALY_TYPES.CANCELED_ORDER_PENDING_SETTLEMENT]: '订单已撤销但作品仍待结算',
  [ANOMALY_TYPES.SETTLED_WITHOUT_ORDER]: '已结算但无有效订单',
  [ANOMALY_TYPES.BOOKED_WITHOUT_INQUIRY]: '已预订但无询价记录',
  [ANOMALY_TYPES.DEAL_WITHOUT_DEPOSIT]: '已成交但未收订金',
  [ANOMALY_TYPES.BALANCE_OVERDUE]: '尾款逾期未付',
  [ANOMALY_TYPES.ORPHAN_INQUIRY]: '询价记录关联作品不存在',
  [ANOMALY_TYPES.ORPHAN_ORDER]: '订单关联作品不存在'
};

function checkSoldWithoutOrder(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );

  const anomalies = [];
  works.forEach((work) => {
    if (work.sale === '已售' && !activeOrderWorkIds.has(work.id)) {
      anomalies.push({
        id: `sold-no-order-${work.id}`,
        type: ANOMALY_TYPES.SOLD_WITHOUT_ORDER,
        severity: ANOMALY_SEVERITY.CRITICAL,
        workId: work.id,
        workTitle: work.title,
        workArtist: work.artist,
        description: `作品「${work.title}」标记为已售，但不存在对应的未撤销订单。可能是订单被删除或数据迁移后丢失。`,
        suggestion: '补录订单或将作品恢复为待售状态',
        entitySnapshot: { ...work }
      });
    }
  });
  return anomalies;
}

function checkCanceledOrderPendingSettlement(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );

  const anomalies = [];
  orders.forEach((order) => {
    if (order.cancelledAt) {
      const work = works.find((w) => w.id === order.workId);
      if (
        work &&
        work.settlement === '待结算' &&
        !activeOrderWorkIds.has(work.id)
      ) {
        anomalies.push({
          id: `canceled-pending-settlement-${order.id}`,
          type: ANOMALY_TYPES.CANCELED_ORDER_PENDING_SETTLEMENT,
          severity: ANOMALY_SEVERITY.CRITICAL,
          workId: work.id,
          orderId: order.id,
          workTitle: work.title,
          workArtist: work.artist,
          customerName: order.customerName,
          description: `订单「${order.customerName} · ${order.workTitle}」已撤销，但对应作品「${work.title}」仍标记为待结算，且无其他有效订单。`,
          suggestion: '将作品结算状态改为未结算',
          entitySnapshot: { work: { ...work }, order: { ...order } }
        });
      }
    }
  });
  return anomalies;
}

function checkSettledWithoutOrder(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );

  const anomalies = [];
  works.forEach((work) => {
    if (work.settlement === '已结算' && !activeOrderWorkIds.has(work.id)) {
      anomalies.push({
        id: `settled-no-order-${work.id}`,
        type: ANOMALY_TYPES.SETTLED_WITHOUT_ORDER,
        severity: ANOMALY_SEVERITY.WARNING,
        workId: work.id,
        workTitle: work.title,
        workArtist: work.artist,
        description: `作品「${work.title}」标记为已结算，但不存在对应的有效订单。`,
        suggestion: '检查结算记录是否正确，或补录关联订单',
        entitySnapshot: { ...work }
      });
    }
  });
  return anomalies;
}

function checkBookedWithoutInquiry(works, inquiries) {
  const workIdsWithInquiries = new Set(inquiries.map((inq) => inq.workId));

  const anomalies = [];
  works.forEach((work) => {
    if (work.sale === '已预订' && !workIdsWithInquiries.has(work.id)) {
      anomalies.push({
        id: `booked-no-inquiry-${work.id}`,
        type: ANOMALY_TYPES.BOOKED_WITHOUT_INQUIRY,
        severity: ANOMALY_SEVERITY.INFO,
        workId: work.id,
        workTitle: work.title,
        workArtist: work.artist,
        description: `作品「${work.title}」已预订，但没有对应的询价记录。`,
        suggestion: '如需完整追踪销售流程，建议补充询价记录',
        entitySnapshot: { ...work }
      });
    }
  });
  return anomalies;
}

function checkDealWithoutDeposit(works, orders) {
  const anomalies = [];
  orders.forEach((order) => {
    if (!order.cancelledAt) {
      const deposit = Number(order.deposit || 0);
      if (deposit <= 0) {
        const work = works.find((w) => w.id === order.workId);
        if (work && work.sale === '已售') {
          anomalies.push({
            id: `deal-no-deposit-${order.id}`,
            type: ANOMALY_TYPES.DEAL_WITHOUT_DEPOSIT,
            severity: ANOMALY_SEVERITY.WARNING,
            workId: order.workId,
            orderId: order.id,
            workTitle: order.workTitle,
            workArtist: order.workArtist,
            customerName: order.customerName,
            description: `订单「${order.customerName} · ${order.workTitle}」已成交，但未收取订金。`,
            suggestion: '确认订金收取情况，及时跟进回款',
            entitySnapshot: { order: { ...order }, work: work ? { ...work } : null }
          });
        }
      }
    }
  });
  return anomalies;
}

function checkBalanceOverdue(works, orders) {
  const anomalies = [];
  const today = new Date().toISOString().slice(0, 10);

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
      anomalies.push({
        id: `balance-overdue-${order.id}`,
        type: ANOMALY_TYPES.BALANCE_OVERDUE,
        severity: ANOMALY_SEVERITY.WARNING,
        workId: order.workId,
        orderId: order.id,
        workTitle: order.workTitle,
        workArtist: order.workArtist,
        customerName: order.customerName,
        description: `订单「${order.customerName} · ${order.workTitle}」成交已超过 30 天，尾款 ¥${balance.toLocaleString()} 仍未结清。`,
        suggestion: '及时跟进客户，催收尾款',
        entitySnapshot: { order: { ...order } },
        daysOverdue: daysSinceDeal,
        overdueAmount: balance
      });
    }
  });
  return anomalies;
}

function checkOrphanInquiries(works, inquiries) {
  const validWorkIds = new Set(works.map((w) => w.id));

  const anomalies = [];
  inquiries.forEach((inq) => {
    if (!validWorkIds.has(inq.workId)) {
      anomalies.push({
        id: `orphan-inquiry-${inq.id}`,
        type: ANOMALY_TYPES.ORPHAN_INQUIRY,
        severity: ANOMALY_SEVERITY.INFO,
        inquiryId: inq.id,
        workId: inq.workId,
        workTitle: inq.workTitle,
        customerName: inq.customerName,
        description: `询价记录「${inq.customerName} · ${inq.workTitle}」关联的作品（ID: ${inq.workId}）不存在。`,
        suggestion: '删除无效询价记录或恢复关联作品',
        entitySnapshot: { ...inq }
      });
    }
  });
  return anomalies;
}

function checkOrphanOrders(works, orders) {
  const validWorkIds = new Set(works.map((w) => w.id));

  const anomalies = [];
  orders.forEach((order) => {
    if (!validWorkIds.has(order.workId)) {
      anomalies.push({
        id: `orphan-order-${order.id}`,
        type: ANOMALY_TYPES.ORPHAN_ORDER,
        severity: ANOMALY_SEVERITY.CRITICAL,
        orderId: order.id,
        workId: order.workId,
        workTitle: order.workTitle,
        customerName: order.customerName,
        description: `订单「${order.customerName} · ${order.workTitle}」关联的作品（ID: ${order.workId}）不存在。${order.cancelledAt ? '（已撤销）' : ''}`,
        suggestion: '删除无效订单或恢复关联作品',
        entitySnapshot: { ...order }
      });
    }
  });
  return anomalies;
}

function detectAllAnomalies(works, orders, inquiries, statements) {
  const allAnomalies = [
    ...checkSoldWithoutOrder(works, orders),
    ...checkCanceledOrderPendingSettlement(works, orders),
    ...checkSettledWithoutOrder(works, orders),
    ...checkBookedWithoutInquiry(works, inquiries),
    ...checkDealWithoutDeposit(works, orders),
    ...checkBalanceOverdue(works, orders),
    ...checkOrphanInquiries(works, inquiries),
    ...checkOrphanOrders(works, orders)
  ];

  const criticalCount = allAnomalies.filter(
    (a) => a.severity === ANOMALY_SEVERITY.CRITICAL
  ).length;
  const warningCount = allAnomalies.filter(
    (a) => a.severity === ANOMALY_SEVERITY.WARNING
  ).length;
  const infoCount = allAnomalies.filter(
    (a) => a.severity === ANOMALY_SEVERITY.INFO
  ).length;

  const byType = {};
  Object.values(ANOMALY_TYPES).forEach((type) => {
    byType[type] = allAnomalies.filter((a) => a.type === type).length;
  });

  return {
    anomalies: allAnomalies,
    summary: {
      total: allAnomalies.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      byType
    }
  };
}

export {
  ANOMALY_TYPES,
  ANOMALY_SEVERITY,
  ANOMALY_LABELS,
  detectAllAnomalies,
  checkSoldWithoutOrder,
  checkCanceledOrderPendingSettlement,
  checkSettledWithoutOrder,
  checkBookedWithoutInquiry,
  checkDealWithoutDeposit,
  checkBalanceOverdue,
  checkOrphanInquiries,
  checkOrphanOrders
};
