const FUNNEL_STAGES = {
  INQUIRY: 'inquiry',
  BOOKING: 'booking',
  DEAL: 'deal',
  SETTLEMENT: 'settlement'
};

const FUNNEL_STAGE_LABELS = {
  [FUNNEL_STAGES.INQUIRY]: '询价',
  [FUNNEL_STAGES.BOOKING]: '预订',
  [FUNNEL_STAGES.DEAL]: '成交',
  [FUNNEL_STAGES.SETTLEMENT]: '结算'
};

const FUNNEL_STAGE_ORDER = [
  FUNNEL_STAGES.INQUIRY,
  FUNNEL_STAGES.BOOKING,
  FUNNEL_STAGES.DEAL,
  FUNNEL_STAGES.SETTLEMENT
];

function getWorkDealPrice(work, orders) {
  const activeOrder = orders.find((o) => o.workId === work.id && !o.cancelledAt);
  return activeOrder ? Number(activeOrder.dealPrice || 0) : Number(work.price || 0);
}

function getWorksInInquiryStage(works, inquiries) {
  const workIdsWithInquiries = new Set(inquiries.map((inq) => inq.workId));
  return works.filter((work) => workIdsWithInquiries.has(work.id));
}

function getWorksInBookingStage(works) {
  return works.filter((work) => work.sale === '已预订');
}

function getWorksInDealStage(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  return works.filter(
    (work) => work.sale === '已售' && activeOrderWorkIds.has(work.id)
  );
}

function getWorksInSettlementStage(works, orders) {
  const activeOrderWorkIds = new Set(
    orders.filter((o) => !o.cancelledAt).map((o) => o.workId)
  );
  return works.filter(
    (work) =>
      work.sale === '已售' &&
      work.settlement === '已结算' &&
      activeOrderWorkIds.has(work.id)
  );
}

function calculateStageStats(works, orders, inquiries, stage) {
  let stageWorks = [];

  switch (stage) {
    case FUNNEL_STAGES.INQUIRY:
      stageWorks = getWorksInInquiryStage(works, inquiries);
      break;
    case FUNNEL_STAGES.BOOKING:
      stageWorks = getWorksInBookingStage(works);
      break;
    case FUNNEL_STAGES.DEAL:
      stageWorks = getWorksInDealStage(works, orders);
      break;
    case FUNNEL_STAGES.SETTLEMENT:
      stageWorks = getWorksInSettlementStage(works, orders);
      break;
    default:
      stageWorks = [];
  }

  const count = stageWorks.length;
  const amount = stageWorks.reduce(
    (sum, work) => sum + getWorkDealPrice(work, orders),
    0
  );

  return {
    stage,
    label: FUNNEL_STAGE_LABELS[stage],
    count,
    amount,
    works: stageWorks.map((work) => ({
      ...work,
      dealPrice: getWorkDealPrice(work, orders)
    }))
  };
}

function calculateFunnelStats(works, orders, inquiries, statements) {
  const stages = FUNNEL_STAGE_ORDER.map((stage) =>
    calculateStageStats(works, orders, inquiries, stage)
  );

  const conversionRates = stages.map((stage, index) => {
    if (index === 0) {
      return {
        stage: stage.stage,
        fromPrevious: null,
        fromFirst: null
      };
    }
    const previousStage = stages[index - 1];
    const firstStage = stages[0];
    return {
      stage: stage.stage,
      fromPrevious:
        previousStage.count > 0
          ? Math.round((stage.count / previousStage.count) * 100)
          : 0,
      fromFirst:
        firstStage.count > 0
          ? Math.round((stage.count / firstStage.count) * 100)
          : 0
    };
  });

  const totalDealAmount = stages[2].amount;
  const totalSettledAmount = stages[3].amount;
  const pendingSettlementAmount = totalDealAmount - totalSettledAmount;

  return {
    stages,
    conversionRates,
    summary: {
      totalInquiryCount: stages[0].count,
      totalBookingCount: stages[1].count,
      totalDealCount: stages[2].count,
      totalSettledCount: stages[3].count,
      totalDealAmount,
      totalSettledAmount,
      pendingSettlementAmount
    }
  };
}

function getWorkFunnelDetail(workId, works, orders, inquiries, statements) {
  const work = works.find((w) => w.id === workId);
  if (!work) return null;

  const workInquiries = inquiries
    .filter((inq) => inq.workId === workId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const workOrders = orders
    .filter((o) => o.workId === workId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const activeOrder = workOrders.find((o) => !o.cancelledAt);
  const cancelledOrders = workOrders.filter((o) => !!o.cancelledAt);

  const workStatements = statements
    .filter((s) => s.items.some((item) => item.workId === workId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const dealPrice = activeOrder
    ? Number(activeOrder.dealPrice || 0)
    : Number(work.price || 0);
  const deposit = activeOrder ? Number(activeOrder.deposit || 0) : 0;
  const balance = dealPrice - deposit;

  let currentStage = null;
  if (work.settlement === '已结算' && activeOrder) {
    currentStage = FUNNEL_STAGES.SETTLEMENT;
  } else if (work.sale === '已售' && activeOrder) {
    currentStage = FUNNEL_STAGES.DEAL;
  } else if (work.sale === '已预订') {
    currentStage = FUNNEL_STAGES.BOOKING;
  } else if (workInquiries.length > 0) {
    currentStage = FUNNEL_STAGES.INQUIRY;
  }

  return {
    work,
    currentStage,
    currentStageLabel: currentStage ? FUNNEL_STAGE_LABELS[currentStage] : '待询价',
    inquiries: workInquiries,
    activeOrder,
    cancelledOrders,
    statements: workStatements,
    dealPrice,
    deposit,
    balance,
    balanceStatus: activeOrder ? activeOrder.balanceStatus : null,
    stageHistory: buildStageHistory(work, workInquiries, workOrders, workStatements)
  };
}

function buildStageHistory(work, inquiries, orders, statements) {
  const history = [];

  if (inquiries.length > 0) {
    const firstInquiry = inquiries[inquiries.length - 1];
    history.push({
      stage: FUNNEL_STAGES.INQUIRY,
      label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.INQUIRY],
      date: firstInquiry.createdAt,
      description: `首次询价：${firstInquiry.customerName}`
    });
  }

  if (work.sale === '已预订' || work.sale === '已售') {
    const bookingOrder = orders.find(
      (o) => !o.cancelledAt
    );
    if (bookingOrder) {
      history.push({
        stage: FUNNEL_STAGES.BOOKING,
        label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.BOOKING],
        date: bookingOrder.createdAt,
        description: `客户：${bookingOrder.customerName}`
      });
    }
  }

  if (work.sale === '已售') {
    const dealOrder = orders.find(
      (o) => !o.cancelledAt
    );
    if (dealOrder) {
      history.push({
        stage: FUNNEL_STAGES.DEAL,
        label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.DEAL],
        date: dealOrder.dealDate || dealOrder.createdAt,
        description: `成交价：¥${Number(dealOrder.dealPrice || 0).toLocaleString()}`
      });
    }
  }

  if (work.settlement === '已结算') {
    const settledStatement = statements.find((s) =>
      s.items.some((item) => item.workId === work.id && s.confirmed)
    );
    if (settledStatement) {
      history.push({
        stage: FUNNEL_STAGES.SETTLEMENT,
        label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.SETTLEMENT],
        date: settledStatement.confirmedAt || settledStatement.createdAt,
        description: `对账单：${settledStatement.startDate} ~ ${settledStatement.endDate}`
      });
    } else if (work.settlementDate) {
      history.push({
        stage: FUNNEL_STAGES.SETTLEMENT,
        label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.SETTLEMENT],
        date: work.settlementDate,
        description: '已完成结算'
      });
    }
  }

  return history.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGE_ORDER,
  calculateFunnelStats,
  calculateStageStats,
  getWorkFunnelDetail,
  getWorkDealPrice
};
