const STORAGE_KEYS = {
  artists: 'zfl-5-artists',
  works: 'zfl-5-works',
  inquiries: 'zfl-5-inquiries',
  orders: 'zfl-5-orders',
  statements: 'zfl-5-statements',
  loans: 'zfl-5-loans',
  inventoryTasks: 'zfl-5-inventory-tasks'
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
      case 'set-work-sold': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { sale: work.sale },
            after: { sale: '已售' },
            description: `将作品「${work.title}」销售状态设为「已售」`
          });
        }
        break;
      }
      case 'set-work-settled': {
        const work = data.works.find((w) => w.id === issue.entityId);
        if (work) {
          const iso = () => new Date().toISOString().slice(0, 10);
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'works',
            entityId: work.id,
            entityLabel: `${work.artist} — ${work.title}`,
            before: { settlement: work.settlement, settlementDate: work.settlementDate },
            after: { settlement: '已结算', settlementDate: iso() },
            description: `将作品「${work.title}」结算状态设为「已结算」`
          });
        }
        break;
      }
      case 'mark-inquiries-dealed': {
        const relatedInquiries = data.inquiries.filter(
          (inq) => inq.customerName && inq.customerPhone &&
            `${inq.customerName.trim()}__${inq.customerPhone.trim()}` === issue.entityId &&
            inq.status === '已放弃'
        );
        relatedInquiries.forEach((inq) => {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'inquiries',
            entityId: inq.id,
            entityLabel: `${inq.workTitle} · ${inq.customerName}`,
            before: { status: inq.status },
            after: { status: '已成交' },
            description: `将询价「${inq.workTitle} · ${inq.customerName}」状态从「已放弃」改为「已成交」`
          });
        });
        break;
      }
      case 'reset-inquiries-to-following': {
        const relatedInquiries = data.inquiries.filter(
          (inq) => inq.customerName && inq.customerPhone &&
            `${inq.customerName.trim()}__${inq.customerPhone.trim()}` === issue.entityId &&
            inq.status === '已成交'
        );
        relatedInquiries.forEach((inq) => {
          patches.push({
            issueId: issue.id,
            fixType: issue.fixType,
            fixLabel: issue.fixLabel,
            entityType: 'inquiries',
            entityId: inq.id,
            entityLabel: `${inq.workTitle} · ${inq.customerName}`,
            before: { status: inq.status },
            after: { status: '跟进中' },
            description: `将询价「${inq.workTitle} · ${inq.customerName}」状态从「已成交」改为「跟进中」`
          });
        });
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
      case 'flag-orphan-inventory': {
        const task = data.inventoryTasks.find((t) => t.id === issue.relatedEntityId);
        if (task) {
          const item = task.items.find((i) => i.id === issue.entityId);
          if (item) {
            patches.push({
              issueId: issue.id,
              fixType: issue.fixType,
              fixLabel: issue.fixLabel,
              entityType: 'inventoryItems',
              entityId: item.id,
              entityLabel: `${item.workSnapshot?.title || item.id} (任务: ${task.name})`,
              before: { status: item.status },
              after: { status: '异常' },
              description: `将盘点条目「${item.workSnapshot?.title || item.id}」标记为异常`
            });
          }
        }
        break;
      }
      case 'resolve-inventory-discrepancy-restore': {
        const task = data.inventoryTasks.find((t) => t.id === issue.relatedEntityId);
        if (task) {
          const item = task.items.find((i) => i.id === issue.entityId);
          if (item) {
            const currentWork = data.works.find((w) => w.id === item.workId);
            const DISCREPANCY_FIELDS = ['exhibit', 'sale', 'price'];
            const restorePatch = {};
            let diffSummary = '';
            if (currentWork) {
              DISCREPANCY_FIELDS.forEach((field) => {
                const snapVal = String(item.workSnapshot[field] ?? '');
                const curVal = String(currentWork[field] ?? '');
                if (snapVal !== curVal) {
                  restorePatch[field] = item.workSnapshot[field];
                  diffSummary += `${field}: ${curVal} → ${snapVal}; `;
                }
              });
            }
            if (Object.keys(restorePatch).length > 0) {
              patches.push({
                issueId: issue.id,
                fixType: 'restore-work-from-snapshot',
                fixLabel: '恢复作品快照状态',
                entityType: 'works',
                entityId: item.workId,
                entityLabel: `${item.workSnapshot?.artist || ''} — ${item.workSnapshot?.title || item.id}`,
                before: { ...restorePatch },
                after: restorePatch,
                description: `将作品「${item.workSnapshot?.title}」恢复为盘点快照状态：${diffSummary.trim()}`
              });
            }
            patches.push({
              issueId: issue.id,
              fixType: 'resolve-inventory-item',
              fixLabel: '标记差异已恢复',
              entityType: 'inventoryItems',
              entityId: item.id,
              entityLabel: `${item.workSnapshot?.title || item.id} (任务: ${task.name})`,
              before: { discrepancyResolution: '未处理' },
              after: { discrepancyResolution: '已恢复', discrepancyNote: '通过数据健康中心自动恢复' },
              description: `将盘点条目「${item.workSnapshot?.title || item.id}」差异标记为已恢复`
            });
          }
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
    artists: [...(data.artists || [])]
  };

  const iso = () => new Date().toISOString().slice(0, 10);

  patches.forEach((patch) => {
    switch (patch.fixType) {
      case 'reset-work-sale':
      case 'reset-work-settlement-unsettled':
      case 'revert-exhibit-to-storage':
      case 'set-work-sold':
      case 'set-work-settled':
        updatedData.works = updatedData.works.map((w) =>
          w.id === patch.entityId ? { ...w, ...patch.after } : w
        );
        break;

      case 'mark-inquiries-dealed':
      case 'reset-inquiries-to-following':
        updatedData.inquiries = updatedData.inquiries.map((inq) =>
          inq.id === patch.entityId ? { ...inq, ...patch.after } : inq
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

      case 'flag-orphan-inventory':
        updatedData.inventoryTasks = updatedData.inventoryTasks.map((task) => ({
          ...task,
          items: task.items.map((item) =>
            item.id === patch.entityId ? { ...item, ...patch.after, checkedAt: new Date().toISOString() } : item
          )
        }));
        break;

      case 'restore-work-from-snapshot':
        updatedData.works = updatedData.works.map((w) =>
          w.id === patch.entityId ? { ...w, ...patch.after } : w
        );
        break;

      case 'resolve-inventory-item':
        updatedData.inventoryTasks = updatedData.inventoryTasks.map((task) => ({
          ...task,
          items: task.items.map((item) => {
            if (item.id !== patch.entityId) return item;
            return {
              ...item,
              discrepancy: {
                ...item.discrepancy,
                resolution: patch.after.discrepancyResolution,
                resolutionNote: patch.after.discrepancyNote || '',
                resolvedAt: new Date().toISOString()
              }
            };
          })
        }));
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
