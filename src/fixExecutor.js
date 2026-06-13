const STORAGE_KEYS = {
  artists: 'zfl-5-artists',
  works: 'zfl-5-works',
  inquiries: 'zfl-5-inquiries',
  orders: 'zfl-5-orders',
  statements: 'zfl-5-statements',
  loans: 'zfl-5-loans',
  inventoryTasks: 'zfl-5-inventory-tasks',
  followUps: 'zfl-5-follow-ups'
};

function generateFixPreview(issues, data) {
  const patches = [];

  issues.filter((issue) => issue.autoFixable).forEach((issue) => {
    switch (issue.fixType) {
      case 'reset-work-sale': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { sale: work.sale, settlement: work.settlement, saleDate: work.saleDate, settlementDate: work.settlementDate },
            after: { sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null },
            description: `将作品「${work.title}」从「已售」恢复为「待售」，清空结算状态`
          });
        }
        break;
      }
      case 'create-order-or-reset-sale': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          patches.push({
            issueId: issue.id,
            fixType: 'reset-work-sale',
            fixLabel: '将作品恢复为待售',
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { sale: work.sale, settlement: work.settlement, saleDate: work.saleDate, settlementDate: work.settlementDate },
            after: { sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null },
            description: `将作品「${work.title}」从「已售」恢复为「待售」，清空结算状态（补录订单需在作品列表中手动操作）`
          });
        }
        break;
      }
      case 'reset-work-settlement-unsettled': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { settlement: work.settlement, settlementDate: work.settlementDate },
            after: { settlement: '未结算', settlementDate: null },
            description: `将作品「${work.title}」结算状态从「${work.settlement}」改为「未结算」`
          });
        }
        break;
      }
      case 'revert-exhibit-to-storage': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { exhibit: work.exhibit },
            after: { exhibit: '库房' },
            description: `将作品「${work.title}」展态从「借展」改回「库房」`
          });
        }
        break;
      }
      case 'delete-orphan-inquiry': {
        const inq = data.inquiries.find((i) => i.id === issue.entityId);
        if (inq) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'inquiries',
            entityId: inq.id,
            entityLabel: `${inq.workTitle || inq.id} · ${inq.customerName}`,
            before: { exists: true },
            after: { exists: false },
            description: `删除引用不存在作品的询价记录「${inq.workTitle || inq.id} · ${inq.customerName}」`
          });
        }
        break;
      }
      case 'delete-orphan-order': {
        const order = data.orders.find((o) => o.id === issue.entityId);
        if (order) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'orders',
            entityId: order.id,
            entityLabel: `${order.workTitle || order.id} · ${order.customerName}`,
            before: { exists: true },
            after: { exists: false },
            description: `删除引用不存在作品的订单记录「${order.workTitle || order.id} · ${order.customerName}」`
          });
        }
        break;
      }
      case 'delete-orphan-loan': {
        const loan = data.loans.find((l) => l.id === issue.entityId);
        if (loan) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'loans',
            entityId: loan.id,
            entityLabel: `${loan.workTitle || loan.id} · ${loan.borrower}`,
            before: { exists: true },
            after: { exists: false },
            description: `删除引用不存在作品的借展记录「${loan.workTitle || loan.id} · ${loan.borrower}」`
          });
        }
        break;
      }
      case 'fix-payment-status-to-partial': {
        const statement = data.statements.find((s) => s.id === issue.entityId);
        if (statement) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'statements',
            entityId: statement.id,
            entityLabel: `${statement.artist} · ${statement.startDate}~${statement.endDate}`,
            before: { paymentStatus: statement.paymentStatus },
            after: { paymentStatus: '部分付款' },
            description: `将对账单「${statement.artist}」付款状态从「${statement.paymentStatus || '待付款'}」改为「部分付款」`
          });
        }
        break;
      }
      case 'fix-payment-status-to-paid': {
        const statement = data.statements.find((s) => s.id === issue.entityId);
        if (statement) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'statements',
            entityId: statement.id,
            entityLabel: `${statement.artist} · ${statement.startDate}~${statement.endDate}`,
            before: { paymentStatus: statement.paymentStatus },
            after: { paymentStatus: '已付款' },
            description: `将对账单「${statement.artist}」付款状态从「${statement.paymentStatus || '待付款'}」改为「已付款」`
          });
        }
        break;
      }
      default:
        break;
    }
  });

  const affectedEntities = {};
  patches.forEach((p) => {
    const key = `${p.entityType}:${p.entityId}`;
    if (!affectedEntities[key]) {
      affectedEntities[key] = { entityType: p.entityType, entityId: p.entityId, entityLabel: p.entityLabel, patchCount: 0 };
    }
    affectedEntities[key].patchCount++;
  });

  return {
    patches,
    totalPatches: patches.length,
    affectedEntities: Object.values(affectedEntities),
    totalAffectedEntities: Object.keys(affectedEntities).length
  };
}

function applyFixes(patches, data) {
  const updatedData = {
    works: [...(data.works || [])],
    inquiries: [...(data.inquiries || [])],
    orders: [...(data.orders || [])],
    loans: [...(data.loans || [])],
    inventoryTasks: (data.inventoryTasks || []).map((t) => ({ ...t, items: [...(t.items || [])] })),
    statements: [...(data.statements || [])],
    artists: [...(data.artists || [])],
    followUps: [...(data.followUps || [])]
  };

  patches.forEach((patch) => {
    switch (patch.fixType) {
      case 'reset-work-sale':
      case 'reset-work-settlement-unsettled':
      case 'revert-exhibit-to-storage':
        updatedData.works = updatedData.works.map((w) =>
          w.id === patch.entityId ? { ...w, ...patch.after } : w
        );
        break;

      case 'delete-orphan-inquiry':
        updatedData.inquiries = updatedData.inquiries.filter((inq) => inq.id !== patch.entityId);
        break;

      case 'delete-orphan-order':
        updatedData.orders = updatedData.orders.filter((o) => o.id !== patch.entityId);
        break;

      case 'delete-orphan-loan':
        updatedData.loans = updatedData.loans.filter((l) => l.id !== patch.entityId);
        break;

      case 'fix-payment-status-to-partial':
      case 'fix-payment-status-to-paid':
        updatedData.statements = updatedData.statements.map((s) =>
          s.id === patch.entityId ? { ...s, ...patch.after } : s
        );
        break;

      default:
        break;
    }
  });

  return updatedData;
}

function persistFixedData(updatedData, patches) {
  const patchEntityTypes = new Set();
  (patches || []).forEach((p) => {
    if (p.entityType === 'inventoryItems') {
      patchEntityTypes.add('inventoryTasks');
    } else {
      patchEntityTypes.add(p.entityType);
    }
  });

  Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
    if (updatedData[key] === undefined) return;
    if (patchEntityTypes.size > 0 && !patchEntityTypes.has(key)) return;
    const value = updatedData[key];
    if (Array.isArray(value)) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  });
}

export {
  generateFixPreview,
  applyFixes,
  persistFixedData,
  STORAGE_KEYS
};
