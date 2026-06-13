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

const TIME_RANGE_PRESETS = {
  THIS_MONTH: 'thisMonth',
  LAST_30_DAYS: 'last30Days',
  LAST_90_DAYS: 'last90Days',
  CUSTOM: 'custom'
};

const TIME_RANGE_LABELS = {
  [TIME_RANGE_PRESETS.THIS_MONTH]: '本月',
  [TIME_RANGE_PRESETS.LAST_30_DAYS]: '近30天',
  [TIME_RANGE_PRESETS.LAST_90_DAYS]: '近90天',
  [TIME_RANGE_PRESETS.CUSTOM]: '自定义'
};

function getTimeRangeBounds(preset, customStart, customEnd) {
  const now = new Date();
  let start, end;

  switch (preset) {
    case TIME_RANGE_PRESETS.THIS_MONTH:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case TIME_RANGE_PRESETS.LAST_30_DAYS:
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case TIME_RANGE_PRESETS.LAST_90_DAYS:
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      start = new Date(now);
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case TIME_RANGE_PRESETS.CUSTOM:
      start = customStart ? new Date(customStart) : null;
      end = customEnd ? new Date(customEnd) : null;
      if (end) end.setHours(23, 59, 59, 999);
      if (start) start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return {
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
    startDate: start,
    endDate: end
  };
}

function isDateInRange(dateStr, rangeStart, rangeEnd) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  if (rangeStart && date < new Date(rangeStart)) return false;
  if (rangeEnd && date > new Date(rangeEnd)) return false;
  return true;
}

function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(date1, date2) {
  const d1 = parseDateSafe(date1);
  const d2 = parseDateSafe(date2);
  if (!d1 || !d2) return null;
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function deriveWorkStageDates(work, workInquiries, workOrders, workStatements) {
  const activeOrder = workOrders.find((o) => !o.cancelledAt);
  const cancelledOrders = workOrders.filter((o) => !!o.cancelledAt);
  const allOrders = [...workOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const lastCancelledOrder = cancelledOrders.length > 0
    ? cancelledOrders.reduce((latest, o) => {
        const oDate = parseDateSafe(o.cancelledAt);
        const lDate = parseDateSafe(latest.cancelledAt);
        return oDate && lDate && oDate > lDate ? o : latest;
      }, cancelledOrders[0])
    : null;

  const cancelledAt = lastCancelledOrder ? lastCancelledOrder.cancelledAt : null;
  const isCancelled = !!cancelledAt && !activeOrder;

  const firstInquiry = workInquiries.length > 0
    ? workInquiries.reduce((earliest, inq) => {
        const inqDate = parseDateSafe(inq.createdAt);
        const earliestDate = parseDateSafe(earliest.createdAt);
        return inqDate && earliestDate && inqDate < earliestDate ? inq : earliest;
      }, workInquiries[0])
    : null;

  let inquiryDate = firstInquiry ? firstInquiry.createdAt : null;

  let bookingDate = null;
  let bookingSource = null;
  let dealDate = null;
  let dealSource = null;
  let settlementDate = null;
  let settlementSource = null;
  let balancePaidDate = null;
  let balancePaidSource = null;

  if (activeOrder) {
    bookingDate = activeOrder.createdAt;
    bookingSource = 'order_created';
    dealDate = activeOrder.dealDate || activeOrder.createdAt;
    dealSource = activeOrder.dealDate ? 'order_dealDate' : 'order_created';
    if (activeOrder.balanceStatus === '已支付') {
      balancePaidDate = activeOrder.updatedAt || activeOrder.dealDate || activeOrder.createdAt;
      balancePaidSource = activeOrder.updatedAt ? 'order_updatedAt' : (activeOrder.dealDate ? 'order_dealDate' : 'order_created');
    }
  } else if (cancelledOrders.length > 0) {
    const lastOrder = allOrders[allOrders.length - 1];
    if (lastOrder) {
      bookingDate = lastOrder.createdAt;
      bookingSource = 'cancelled_order_created';
      if (lastOrder.dealDate && lastOrder.cancelledAt &&
          new Date(lastOrder.dealDate) <= new Date(lastOrder.cancelledAt)) {
        dealDate = lastOrder.dealDate;
        dealSource = 'cancelled_order_dealDate';
      }
    }
  }

  if (work.sale === '已预订' && !bookingDate && !isCancelled) {
    bookingDate = work.saleDate || work.inDate || work.createdAt || null;
    bookingSource = work.saleDate ? 'work_saleDate' : (work.inDate ? 'work_inDate' : (work.createdAt ? 'work_createdAt' : 'derived'));
  }
  if (work.sale === '已售' && !bookingDate && !isCancelled) {
    bookingDate = work.saleDate || work.inDate || work.createdAt || null;
    bookingSource = work.saleDate ? 'work_saleDate_booking' : (work.inDate ? 'work_inDate' : (work.createdAt ? 'work_createdAt' : 'derived'));
  }

  if (work.sale === '已售' && !dealDate && !isCancelled) {
    dealDate = work.saleDate || work.inDate || work.createdAt || null;
    dealSource = work.saleDate ? 'work_saleDate' : (work.inDate ? 'work_inDate' : (work.createdAt ? 'work_createdAt' : 'derived'));
  }

  const confirmedStatement = workStatements
    .filter((s) => s.confirmed)
    .sort((a, b) => new Date(b.confirmedAt || b.createdAt) - new Date(a.confirmedAt || a.createdAt))[0];

  if (confirmedStatement && !isCancelled) {
    settlementDate = confirmedStatement.confirmedAt || confirmedStatement.createdAt;
    settlementSource = confirmedStatement.confirmedAt ? 'statement_confirmedAt' : 'statement_createdAt';
  } else if (work.settlement === '已结算' && !isCancelled) {
    settlementDate = work.settlementDate || work.saleDate || work.inDate || work.createdAt || null;
    settlementSource = work.settlementDate ? 'work_settlementDate' : (work.saleDate ? 'work_saleDate' : (work.inDate ? 'work_inDate' : (work.createdAt ? 'work_createdAt' : 'derived')));
  }

  if (confirmedStatement && !isCancelled) {
    const stmtDate = confirmedStatement.paymentDate || confirmedStatement.confirmedAt;
    if (!balancePaidDate || (stmtDate && new Date(stmtDate) > new Date(balancePaidDate))) {
      balancePaidDate = stmtDate;
      balancePaidSource = confirmedStatement.paymentDate ? 'statement_paymentDate' : 'statement_confirmedAt_settle';
    }
  }

  const hasMissingLogs = !isCancelled && !!(
    (inquiryDate === null && (work.sale === '已预订' || work.sale === '已售' || work.settlement === '已结算')) ||
    (bookingDate === null && work.sale === '已售') ||
    (bookingDate === null && work.sale === '已预订') ||
    (dealDate === null && work.sale === '已售') ||
    (settlementDate === null && work.settlement === '已结算')
  );

  const missingLogFields = [];
  if (!isCancelled && inquiryDate === null && (work.sale === '已预订' || work.sale === '已售' || work.settlement === '已结算')) {
    missingLogFields.push('询价记录');
  }
  if (!isCancelled && bookingDate === null && (work.sale === '已预订' || work.sale === '已售')) {
    missingLogFields.push('预订记录');
  }
  if (!isCancelled && dealDate === null && work.sale === '已售') {
    missingLogFields.push('成交记录');
  }
  if (!isCancelled && settlementDate === null && work.settlement === '已结算') {
    missingLogFields.push('结算记录');
  }

  return {
    workId: work.id,
    work,
    activeOrder,
    cancelledOrders,
    lastCancelledOrder,
    allOrders,
    isCancelled,
    cancelledAt,
    inquiryDate,
    bookingDate,
    dealDate,
    settlementDate,
    balancePaidDate,
    bookingSource,
    dealSource,
    settlementSource,
    balancePaidSource,
    dealPrice: activeOrder
      ? Number(activeOrder.dealPrice || 0)
      : (lastCancelledOrder
          ? Number(lastCancelledOrder.dealPrice || 0)
          : Number(work.price || 0)),
    deposit: activeOrder ? Number(activeOrder.deposit || 0) : 0,
    hasMissingLogs,
    missingLogFields
  };
}

function buildAllWorkStageDates(works, orders, inquiries, statements) {
  const workInquiryMap = {};
  inquiries.forEach((inq) => {
    if (!workInquiryMap[inq.workId]) workInquiryMap[inq.workId] = [];
    workInquiryMap[inq.workId].push(inq);
  });

  const workOrderMap = {};
  orders.forEach((order) => {
    if (!workOrderMap[order.workId]) workOrderMap[order.workId] = [];
    workOrderMap[order.workId].push(order);
  });

  const workStatementMap = {};
  statements.forEach((stmt) => {
    if (!stmt.items) return;
    stmt.items.forEach((item) => {
      if (!workStatementMap[item.workId]) workStatementMap[item.workId] = [];
      workStatementMap[item.workId].push(stmt);
    });
  });

  return works.map((work) =>
    deriveWorkStageDates(
      work,
      workInquiryMap[work.id] || [],
      workOrderMap[work.id] || [],
      workStatementMap[work.id] || []
    )
  );
}

function calculateTimeDimensionFunnel(works, orders, inquiries, statements, preset, customStart, customEnd) {
  const range = getTimeRangeBounds(preset, customStart, customEnd);

  if (preset === TIME_RANGE_PRESETS.CUSTOM && (!range.startDate || !range.endDate)) {
    return {
      range,
      preset,
      isValid: false,
      validationError: '请选择完整的自定义日期范围',
      stages: FUNNEL_STAGE_ORDER.map((stage) => ({
        stage,
        label: FUNNEL_STAGE_LABELS[stage],
        count: 0,
        amount: 0,
        works: []
      })),
      conversionRates: FUNNEL_STAGE_ORDER.map((stage) => ({
        stage,
        fromPrevious: null,
        fromFirst: null
      })),
      summary: {
        inquiryCount: 0,
        bookingCount: 0,
        dealCount: 0,
        settlementCount: 0,
        dealAmount: 0,
        settlementAmount: 0,
        averageDealCycle: null,
        averageBalanceCycle: null,
        cancelledCount: 0,
        missingLogsCount: 0,
        dealCycleSampleCount: 0,
        balanceCycleSampleCount: 0
      }
    };
  }

  if (range.startDate && range.endDate && range.startDate > range.endDate) {
    return {
      range,
      preset,
      isValid: false,
      validationError: '开始日期不能晚于结束日期',
      stages: FUNNEL_STAGE_ORDER.map((stage) => ({
        stage,
        label: FUNNEL_STAGE_LABELS[stage],
        count: 0,
        amount: 0,
        works: []
      })),
      conversionRates: FUNNEL_STAGE_ORDER.map((stage) => ({
        stage,
        fromPrevious: null,
        fromFirst: null
      })),
      summary: {
        inquiryCount: 0,
        bookingCount: 0,
        dealCount: 0,
        settlementCount: 0,
        dealAmount: 0,
        settlementAmount: 0,
        averageDealCycle: null,
        averageBalanceCycle: null,
        cancelledCount: 0,
        missingLogsCount: 0,
        dealCycleSampleCount: 0,
        balanceCycleSampleCount: 0
      }
    };
  }

  const allStageDates = buildAllWorkStageDates(works, orders, inquiries, statements);

  const inquiryStageWorks = allStageDates.filter((wd) =>
    isDateInRange(wd.inquiryDate, range.start, range.end)
  );

  const bookingStageWorks = allStageDates.filter(
    (wd) =>
      isDateInRange(wd.bookingDate, range.start, range.end) &&
      wd.bookingDate !== null
  );

  const dealStageWorks = allStageDates.filter(
    (wd) =>
      isDateInRange(wd.dealDate, range.start, range.end) &&
      wd.activeOrder &&
      !wd.isCancelled
  );

  const settlementStageWorks = allStageDates.filter(
    (wd) =>
      isDateInRange(wd.settlementDate, range.start, range.end) &&
      wd.work.settlement === '已结算' &&
      wd.settlementDate !== null &&
      wd.activeOrder &&
      !wd.isCancelled
  );

  const inquiryCount = inquiryStageWorks.length;
  const bookingCount = bookingStageWorks.length;
  const dealCount = dealStageWorks.length;
  const settlementCount = settlementStageWorks.length;

  const dealAmount = dealStageWorks.reduce((sum, wd) => sum + wd.dealPrice, 0);
  const settlementAmount = settlementStageWorks.reduce((sum, wd) => sum + wd.dealPrice, 0);

  const dealCycles = [];
  dealStageWorks.forEach((wd) => {
    const cycle = daysBetween(wd.inquiryDate || wd.bookingDate, wd.dealDate);
    if (cycle !== null) {
      dealCycles.push(cycle);
    }
  });
  const averageDealCycle = dealCycles.length > 0
    ? Math.round(dealCycles.reduce((a, b) => a + b, 0) / dealCycles.length)
    : null;

  const balanceCycles = [];
  dealStageWorks
    .filter((wd) => wd.balancePaidDate)
    .forEach((wd) => {
      const cycle = daysBetween(wd.dealDate, wd.balancePaidDate);
      if (cycle !== null) {
        balanceCycles.push(cycle);
      }
    });
  const averageBalanceCycle = balanceCycles.length > 0
    ? Math.round(balanceCycles.reduce((a, b) => a + b, 0) / balanceCycles.length)
    : null;

  const cancelledCount = allStageDates.filter((wd) =>
    wd.cancelledOrders.some((o) => isDateInRange(o.cancelledAt, range.start, range.end))
  ).length;

  const worksWithActivityInPeriod = [
    ...inquiryStageWorks,
    ...bookingStageWorks,
    ...dealStageWorks,
    ...settlementStageWorks
  ].filter((wd, index, self) =>
    index === self.findIndex((w) => w.workId === wd.workId)
  );

  const missingLogsCount = worksWithActivityInPeriod.filter((wd) => wd.hasMissingLogs).length;

  const conversionRates = [
    { stage: FUNNEL_STAGES.INQUIRY, fromPrevious: null, fromFirst: null },
    {
      stage: FUNNEL_STAGES.BOOKING,
      fromPrevious: inquiryCount > 0 ? Math.round((bookingCount / inquiryCount) * 100) : 0,
      fromFirst: inquiryCount > 0 ? Math.round((bookingCount / inquiryCount) * 100) : 0
    },
    {
      stage: FUNNEL_STAGES.DEAL,
      fromPrevious: bookingCount > 0 ? Math.round((dealCount / bookingCount) * 100) : 0,
      fromFirst: inquiryCount > 0 ? Math.round((dealCount / inquiryCount) * 100) : 0
    },
    {
      stage: FUNNEL_STAGES.SETTLEMENT,
      fromPrevious: dealCount > 0 ? Math.round((settlementCount / dealCount) * 100) : 0,
      fromFirst: inquiryCount > 0 ? Math.round((settlementCount / inquiryCount) * 100) : 0
    }
  ];

  const stages = [
    {
      stage: FUNNEL_STAGES.INQUIRY,
      label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.INQUIRY],
      count: inquiryCount,
      amount: 0,
      works: inquiryStageWorks.map((wd) => ({ ...wd.work, dealPrice: wd.dealPrice, _stageDates: wd }))
    },
    {
      stage: FUNNEL_STAGES.BOOKING,
      label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.BOOKING],
      count: bookingCount,
      amount: bookingStageWorks.reduce((sum, wd) => sum + wd.dealPrice, 0),
      works: bookingStageWorks.map((wd) => ({ ...wd.work, dealPrice: wd.dealPrice, _stageDates: wd }))
    },
    {
      stage: FUNNEL_STAGES.DEAL,
      label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.DEAL],
      count: dealCount,
      amount: dealAmount,
      works: dealStageWorks.map((wd) => ({ ...wd.work, dealPrice: wd.dealPrice, _stageDates: wd }))
    },
    {
      stage: FUNNEL_STAGES.SETTLEMENT,
      label: FUNNEL_STAGE_LABELS[FUNNEL_STAGES.SETTLEMENT],
      count: settlementCount,
      amount: settlementAmount,
      works: settlementStageWorks.map((wd) => ({ ...wd.work, dealPrice: wd.dealPrice, _stageDates: wd }))
    }
  ];

  return {
    range,
    preset,
    isValid: true,
    stages,
    conversionRates,
    summary: {
      inquiryCount,
      bookingCount,
      dealCount,
      settlementCount,
      dealAmount,
      settlementAmount,
      averageDealCycle,
      averageBalanceCycle,
      cancelledCount,
      missingLogsCount,
      dealCycleSampleCount: dealCycles.length,
      balanceCycleSampleCount: balanceCycles.length
    }
  };
}

export {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGE_ORDER,
  TIME_RANGE_PRESETS,
  TIME_RANGE_LABELS,
  calculateFunnelStats,
  calculateStageStats,
  getWorkFunnelDetail,
  getWorkDealPrice,
  calculateTimeDimensionFunnel,
  getTimeRangeBounds,
  isDateInRange,
  daysBetween,
  buildAllWorkStageDates,
  deriveWorkStageDates
};
