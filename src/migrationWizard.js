import { runAllDiagnostics } from './diagnosticRules.js';

const BACKUP_VERSION = 2;

const ENTITY_LABELS = {
  artists: '艺术家',
  works: '作品',
  inquiries: '询价',
  orders: '订单',
  statements: '对账单',
  loans: '借展',
  inventoryTasks: '盘点任务',
  followUps: '跟进计划'
};

const FIELD_DEFAULTS = {
  artists: { id: '', name: '', phone: '', style: '', note: '' },
  works: { id: '', artist: '', title: '', price: 0, inDate: '', exhibit: '展出中', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null },
  inquiries: { id: '', workId: '', workTitle: '', customerName: '', customerPhone: '', intendedPrice: 0, remark: '', status: '待跟进', createdAt: '' },
  orders: { id: '', workId: '', workTitle: '', workArtist: '', customerName: '', customerPhone: '', dealPrice: 0, deposit: 0, balanceStatus: '待支付', dealDate: '', note: '', createdAt: '', cancelledAt: null },
  statements: { id: '', artist: '', startDate: '', endDate: '', items: [], totalDealPrice: 0, totalCommission: 0, totalPayable: 0, commissionRate: 35, confirmed: false, confirmedAt: null, paymentStatus: '待付款', paymentDate: null, paymentNote: '', paidAmount: 0, createdAt: '' },
  loans: { id: '', workId: '', workTitle: '', workArtist: '', borrower: '', loanDate: '', expectedReturnDate: '', contactPerson: '', notes: '', returnedAt: null, createdAt: '' },
  inventoryTasks: { id: '', name: '', note: '', status: '进行中', items: [], totalCount: 0, checkedCount: 0, exceptionCount: 0, missingCount: 0, unresolvedDiscrepancyCount: 0, createdAt: '', completedAt: null },
  followUps: { id: '', customerName: '', customerPhone: '', scheduledDate: '', content: '', responsible: '', result: '', completedAt: null, createdAt: '' }
};

const STRATEGY_OPTIONS = {
  addOnly: { key: 'addOnly', label: '仅新增', description: '只添加新记录，已有记录一律跳过' },
  overwriteAll: { key: 'overwriteAll', label: '全覆盖', description: '新增+覆盖，ID相同的记录用备份替换' },
  skipExisting: { key: 'skipExisting', label: '跳过已存在', description: 'ID或名称重复的全部跳过，仅添加全新记录' },
  smartMerge: { key: 'smartMerge', label: '智能合并（推荐）', description: '新增自动添加，覆盖项逐一确认，冲突高亮提示' }
};

const CONFLICT_TYPES = {
  DUPLICATE_ARTIST_NAME: 'duplicate-artist-name',
  DUPLICATE_WORK: 'duplicate-work',
  WORK_STATUS_CHANGED: 'work-status-changed',
  ORDER_ALREADY_EXISTS: 'order-already-exists',
  INQUIRY_ALREADY_EXISTS: 'inquiry-already-exists',
  LOAN_ALREADY_EXISTS: 'loan-already-exists',
  STATEMENT_ALREADY_EXISTS: 'statement-already-exists',
  CROSS_VERSION_FIELD_MISSING: 'cross-version-field-missing'
};

function normalizeRecord(entityType, record) {
  const defaults = FIELD_DEFAULTS[entityType];
  if (!defaults) return record;
  const normalized = { ...record };
  for (const [key, defaultVal] of Object.entries(defaults)) {
    if (!(key in normalized) || normalized[key] === undefined) {
      normalized[key] = defaultVal;
    }
  }
  return normalized;
}

function validateBackupStructure(backup) {
  const errors = [];
  const warnings = [];

  if (!backup || typeof backup !== 'object') {
    errors.push('无效的备份文件格式');
    return { valid: false, errors, warnings };
  }

  if (!backup.app || backup.app !== 'zfl-5-gallery-consignment') {
    errors.push('不是有效的画廊寄售管理备份文件');
    return { valid: false, errors, warnings };
  }

  if (!backup.data || typeof backup.data !== 'object') {
    errors.push('备份文件格式异常：缺少 data 字段');
    return { valid: false, errors, warnings };
  }

  const backupVersion = backup.version || 0;
  if (backupVersion < BACKUP_VERSION) {
    warnings.push(`备份版本 v${backupVersion} 低于当前版本 v${BACKUP_VERSION}，缺失字段将自动填充默认值`);
  }
  if (backupVersion > BACKUP_VERSION) {
    warnings.push(`备份版本 v${backupVersion} 高于当前版本 v${BACKUP_VERSION}，部分新字段可能被忽略`);
  }

  for (const entityType of Object.keys(FIELD_DEFAULTS)) {
    const records = backup.data[entityType];
    if (!records) {
      warnings.push(`备份中缺少「${ENTITY_LABELS[entityType]}」数据，将视为空`);
      continue;
    }
    if (!Array.isArray(records)) {
      errors.push(`「${ENTITY_LABELS[entityType]}」数据格式异常，应为数组`);
      continue;
    }
    if (records.length > 0) {
      const sample = records[0];
      const missingFields = [];
      for (const key of Object.keys(FIELD_DEFAULTS[entityType])) {
        if (!(key in sample)) {
          missingFields.push(key);
        }
      }
      if (missingFields.length > 0) {
        warnings.push(`「${ENTITY_LABELS[entityType]}」缺少字段：${missingFields.join('、')}，将填充默认值`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    backupVersion,
    exportedAt: backup.exportedAt,
    totalEntities: Object.keys(backup.data).filter((k) => Array.isArray(backup.data[k])).length,
    totalRecords: Object.values(backup.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  };
}

function analyzeBackupV2(backup, currentData) {
  const currentIdSets = {};
  const currentNameSets = {};
  for (const entityType of Object.keys(FIELD_DEFAULTS)) {
    currentIdSets[entityType] = new Set((currentData[entityType] || []).map((r) => r.id));
  }
  currentNameSets.artists = new Set((currentData.artists || []).map((a) => a.name));
  currentNameSets.works = new Set((currentData.works || []).map((w) => `${w.artist}||${w.title}`));
  currentNameSets.orders = new Set((currentData.orders || []).filter((o) => !o.cancelledAt).map((o) => `${o.workId}||${o.customerName}||${o.customerPhone}`));
  currentNameSets.inquiries = new Set((currentData.inquiries || []).map((i) => `${i.workId}||${i.customerName}||${i.customerPhone}`));
  currentNameSets.loans = new Set((currentData.loans || []).filter((l) => !l.returnedAt).map((l) => `${l.workId}||${l.borrower}||${l.loanDate}`));
  currentNameSets.statements = new Set((currentData.statements || []).map((s) => `${s.artist}||${s.startDate}||${s.endDate}`));
  currentNameSets.inventoryTasks = new Set((currentData.inventoryTasks || []).map((t) => t.name));

  const result = {};
  let totalAdd = 0;
  let totalOverwrite = 0;
  let totalSkip = 0;
  let totalConflict = 0;
  const allWarnings = [];

  const backupVersion = backup.version || 0;

  for (const entityType of Object.keys(FIELD_DEFAULTS)) {
    const backupRecords = (backup.data && backup.data[entityType]) || [];
    const analyzed = [];

    for (const rawRecord of backupRecords) {
      const record = normalizeRecord(entityType, rawRecord);
      const currentIdSet = currentIdSets[entityType];

      if (currentIdSet.has(record.id)) {
        const currentRecord = (currentData[entityType] || []).find((r) => r.id === record.id);
        const isSame = JSON.stringify(record) === JSON.stringify(currentRecord);
        const conflicts = detectConflicts(entityType, record, currentRecord);

        if (conflicts.length > 0) {
          analyzed.push({
            action: 'conflict',
            record,
            currentRecord,
            reason: conflicts.map((c) => c.description).join('；'),
            conflicts,
            resolution: null
          });
          totalConflict++;
        } else if (isSame) {
          analyzed.push({
            action: 'overwrite',
            record,
            currentRecord,
            reason: '内容一致，覆盖无变化',
            conflicts: [],
            resolution: null
          });
          totalOverwrite++;
        } else {
          analyzed.push({
            action: 'overwrite',
            record,
            currentRecord,
            reason: 'ID已存在，将覆盖现有记录',
            conflicts: [],
            resolution: null
          });
          totalOverwrite++;
        }
      } else if (entityType === 'artists' && record.name && currentNameSets.artists.has(record.name)) {
        const existingRecord = (currentData.artists || []).find((a) => a.name === record.name);
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: existingRecord,
          reason: `艺术家「${record.name}」已存在（ID不同）`,
          conflicts: [{ type: CONFLICT_TYPES.DUPLICATE_ARTIST_NAME, description: `艺术家「${record.name}」已存在（ID不同）`, fields: ['name'] }],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'works' && record.artist && record.title && currentNameSets.works.has(`${record.artist}||${record.title}`)) {
        const existingWork = (currentData.works || []).find((w) => w.artist === record.artist && w.title === record.title);
        const conflicts = [];
        if (existingWork) {
          if (existingWork.sale !== record.sale) {
            conflicts.push({ type: CONFLICT_TYPES.WORK_STATUS_CHANGED, description: `销售状态不同：当前「${existingWork.sale}」→ 备份「${record.sale}」`, fields: ['sale'] });
          }
          if (existingWork.exhibit !== record.exhibit) {
            conflicts.push({ type: CONFLICT_TYPES.WORK_STATUS_CHANGED, description: `展态不同：当前「${existingWork.exhibit}」→ 备份「${record.exhibit}」`, fields: ['exhibit'] });
          }
          if (existingWork.settlement !== record.settlement) {
            conflicts.push({ type: CONFLICT_TYPES.WORK_STATUS_CHANGED, description: `结算状态不同：当前「${existingWork.settlement}」→ 备份「${record.settlement}」`, fields: ['settlement'] });
          }
        }
        const baseConflict = { type: CONFLICT_TYPES.DUPLICATE_WORK, description: `作品「${record.artist} — ${record.title}」已存在（ID不同）`, fields: ['artist', 'title'] };

        analyzed.push({
          action: conflicts.length > 0 ? 'conflict' : 'conflict',
          record,
          currentRecord: existingWork,
          reason: `作品「${record.artist} — ${record.title}」已存在（ID不同）` + (conflicts.length > 0 ? `，且${conflicts.map((c) => c.description).join('，')}` : ''),
          conflicts: [baseConflict, ...conflicts],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'orders' && record.workId && record.customerName && record.customerPhone && currentNameSets.orders.has(`${record.workId}||${record.customerName}||${record.customerPhone}`)) {
        const existingRecord = (currentData.orders || []).find((o) => !o.cancelledAt && o.workId === record.workId && o.customerName === record.customerName && o.customerPhone === record.customerPhone);
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: existingRecord,
          reason: `订单「${record.workTitle} · ${record.customerName}」可能重复`,
          conflicts: [{ type: CONFLICT_TYPES.ORDER_ALREADY_EXISTS, description: `同一客户对同一作品已有订单`, fields: ['workId', 'customerName'] }],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'inquiries' && record.workId && record.customerName && record.customerPhone && currentNameSets.inquiries.has(`${record.workId}||${record.customerName}||${record.customerPhone}`)) {
        const existingRecord = (currentData.inquiries || []).find((i) => i.workId === record.workId && i.customerName === record.customerName && i.customerPhone === record.customerPhone);
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: existingRecord,
          reason: `询价「${record.workTitle} · ${record.customerName}」可能重复`,
          conflicts: [{ type: CONFLICT_TYPES.INQUIRY_ALREADY_EXISTS, description: `同一客户对同一作品已有询价`, fields: ['workId', 'customerName'] }],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'loans' && record.workId && record.borrower && record.loanDate && currentNameSets.loans.has(`${record.workId}||${record.borrower}||${record.loanDate}`)) {
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: null,
          reason: `借展「${record.workTitle} · ${record.borrower}」可能重复`,
          conflicts: [{ type: CONFLICT_TYPES.LOAN_ALREADY_EXISTS, description: `同一借展记录已存在`, fields: ['workId', 'borrower', 'loanDate'] }],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'statements' && record.artist && record.startDate && record.endDate && currentNameSets.statements.has(`${record.artist}||${record.startDate}||${record.endDate}`)) {
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: (currentData.statements || []).find((s) => s.artist === record.artist && s.startDate === record.startDate && s.endDate === record.endDate),
          reason: `对账单「${record.artist} · ${record.startDate}~${record.endDate}」已存在`,
          conflicts: [{ type: CONFLICT_TYPES.STATEMENT_ALREADY_EXISTS, description: `同周期对账单已存在`, fields: ['artist', 'startDate', 'endDate'] }],
          resolution: null
        });
        totalConflict++;
      } else if (entityType === 'inventoryTasks' && record.name && currentNameSets.inventoryTasks.has(record.name)) {
        analyzed.push({
          action: 'conflict',
          record,
          currentRecord: (currentData.inventoryTasks || []).find((t) => t.name === record.name),
          reason: `盘点任务「${record.name}」已存在`,
          conflicts: [{ type: CONFLICT_TYPES.DUPLICATE_ARTIST_NAME, description: `同名盘点任务已存在`, fields: ['name'] }],
          resolution: null
        });
        totalConflict++;
      } else {
        analyzed.push({
          action: 'add',
          record,
          currentRecord: null,
          reason: '新记录，将添加',
          conflicts: [],
          resolution: null
        });
        totalAdd++;
      }
    }

    const missingFields = [];
    if (backupRecords.length > 0) {
      const defaults = FIELD_DEFAULTS[entityType];
      const sampleRaw = backupRecords[0];
      for (const key of Object.keys(defaults)) {
        if (!(key in sampleRaw)) {
          missingFields.push(key);
        }
      }
    }

    result[entityType] = {
      records: analyzed,
      addCount: analyzed.filter((a) => a.action === 'add').length,
      overwriteCount: analyzed.filter((a) => a.action === 'overwrite').length,
      skipCount: analyzed.filter((a) => a.action === 'skip').length,
      conflictCount: analyzed.filter((a) => a.action === 'conflict').length,
      totalCount: analyzed.length,
      missingFields,
      strategy: 'smartMerge'
    };
  }

  return {
    entities: result,
    totalAdd,
    totalOverwrite,
    totalSkip,
    totalConflict,
    totalRecords: totalAdd + totalOverwrite + totalSkip + totalConflict,
    warnings: allWarnings,
    backupVersion,
    exportedAt: backup.exportedAt,
    snapshot: JSON.parse(JSON.stringify(currentData))
  };
}

function detectConflicts(entityType, backupRecord, currentRecord) {
  if (!currentRecord) return [];
  const conflicts = [];

  if (entityType === 'works') {
    const statusFields = ['sale', 'exhibit', 'settlement'];
    for (const field of statusFields) {
      if (backupRecord[field] !== currentRecord[field]) {
        const fieldLabels = { sale: '销售状态', exhibit: '展态', settlement: '结算状态' };
        conflicts.push({
          type: CONFLICT_TYPES.WORK_STATUS_CHANGED,
          description: `${fieldLabels[field]}不同：当前「${currentRecord[field]}」→ 备份「${backupRecord[field]}」`,
          fields: [field]
        });
      }
    }
    if (backupRecord.price !== currentRecord.price) {
      conflicts.push({
        type: CONFLICT_TYPES.WORK_STATUS_CHANGED,
        description: `价格不同：当前 ¥${Number(currentRecord.price).toLocaleString()} → 备份 ¥${Number(backupRecord.price).toLocaleString()}`,
        fields: ['price']
      });
    }
  }

  if (entityType === 'orders') {
    if (currentRecord.cancelledAt && !backupRecord.cancelledAt) {
      conflicts.push({
        type: CONFLICT_TYPES.ORDER_ALREADY_EXISTS,
        description: '当前订单已撤销，但备份中订单仍有效',
        fields: ['cancelledAt']
      });
    }
    if (backupRecord.dealPrice !== currentRecord.dealPrice) {
      conflicts.push({
        type: CONFLICT_TYPES.ORDER_ALREADY_EXISTS,
        description: `成交价不同：当前 ¥${Number(currentRecord.dealPrice).toLocaleString()} → 备份 ¥${Number(backupRecord.dealPrice).toLocaleString()}`,
        fields: ['dealPrice']
      });
    }
  }

  if (entityType === 'statements') {
    if (currentRecord.confirmed && !backupRecord.confirmed) {
      conflicts.push({
        type: CONFLICT_TYPES.STATEMENT_ALREADY_EXISTS,
        description: '当前对账单已确认，但备份中未确认',
        fields: ['confirmed']
      });
    }
    if (currentRecord.paymentStatus !== backupRecord.paymentStatus) {
      conflicts.push({
        type: CONFLICT_TYPES.STATEMENT_ALREADY_EXISTS,
        description: `付款状态不同：当前「${currentRecord.paymentStatus}」→ 备份「${backupRecord.paymentStatus}」`,
        fields: ['paymentStatus']
      });
    }
  }

  return conflicts;
}

function resolveActionsWithStrategy(analysis, strategy) {
  return analysis.records.map((item) => {
    if (item.action === 'add') return { ...item, finalAction: 'add' };

    if (item.action === 'overwrite') {
      switch (strategy) {
        case 'addOnly':
          return { ...item, finalAction: 'skip', skipReason: '仅新增策略，跳过覆盖' };
        case 'skipExisting':
          return { ...item, finalAction: 'skip', skipReason: '跳过已存在策略' };
        case 'overwriteAll':
          return { ...item, finalAction: 'overwrite' };
        case 'smartMerge':
          return { ...item, finalAction: 'overwrite' };
        default:
          return { ...item, finalAction: 'overwrite' };
      }
    }

    if (item.action === 'conflict') {
      const resolution = item.resolution;
      switch (strategy) {
        case 'addOnly':
          return { ...item, finalAction: 'skip', skipReason: '仅新增策略，冲突记录跳过' };
        case 'skipExisting':
          return { ...item, finalAction: 'skip', skipReason: '跳过已存在策略，冲突记录跳过' };
        case 'overwriteAll':
          return { ...item, finalAction: 'overwrite' };
        case 'smartMerge':
          if (resolution === 'overwrite') return { ...item, finalAction: 'overwrite' };
          if (resolution === 'add') return { ...item, finalAction: 'add' };
          if (resolution === 'skip') return { ...item, finalAction: 'skip', skipReason: '用户选择跳过' };
          return { ...item, finalAction: 'skip', skipReason: '冲突未解决，默认跳过' };
        default:
          return { ...item, finalAction: 'skip', skipReason: '冲突未解决' };
      }
    }

    if (item.action === 'skip') {
      return { ...item, finalAction: 'skip', skipReason: item.reason };
    }

    return { ...item, finalAction: 'skip', skipReason: '未知操作类型' };
  });
}

function applyImportStrategies(migrationPreview) {
  const restoredData = {};
  const currentData = migrationPreview.snapshot;
  const importSummary = { added: 0, overwritten: 0, skipped: 0, conflicts: 0, skipReasons: [] };

  for (const [entityType, analysis] of Object.entries(migrationPreview.entities)) {
    const resolved = resolveActionsWithStrategy(analysis, analysis.strategy);
    const currentRecords = [...(currentData[entityType] || [])];
    const overwrittenIds = new Set();
    const newRecords = [];

    for (const item of resolved) {
      if (item.finalAction === 'add') {
        newRecords.push(item.record);
        importSummary.added++;
      } else if (item.finalAction === 'overwrite') {
        overwrittenIds.add(item.record.id);
        importSummary.overwritten++;
      } else {
        importSummary.skipped++;
        importSummary.skipReasons.push({
          entityType,
          entityLabel: ENTITY_LABELS[entityType],
          record: item.record,
          reason: item.skipReason || item.reason,
          action: item.action
        });
      }
    }

    restoredData[entityType] = [
      ...currentRecords.map((r) => {
        if (overwrittenIds.has(r.id)) {
          const overwriteItem = resolved.find((a) => a.finalAction === 'overwrite' && a.record.id === r.id);
          return overwriteItem ? overwriteItem.record : r;
        }
        return r;
      }),
      ...newRecords
    ];
  }

  return { restoredData, importSummary };
}

function runPostImportHealthScan(data) {
  const diagnosisResult = runAllDiagnostics(data);
  const fixSuggestions = [];

  diagnosisResult.issues.forEach((issue) => {
    const suggestion = {
      ruleId: issue.ruleId,
      title: issue.title,
      severity: issue.severity,
      autoFixable: issue.autoFixable,
      suggestion: issue.autoFixable ? (issue.fixLabel || '可自动修复') : (issue.suggestion || '需手动处理'),
      entitySnapshot: issue.entitySnapshot || null
    };
    fixSuggestions.push(suggestion);
  });

  return {
    scannedAt: new Date().toISOString(),
    totalIssues: diagnosisResult.totalIssues,
    criticalCount: diagnosisResult.criticalCount,
    warningCount: diagnosisResult.warningCount,
    infoCount: diagnosisResult.infoCount,
    fixSuggestions,
    isHealthy: diagnosisResult.totalIssues === 0
  };
}

export {
  BACKUP_VERSION,
  ENTITY_LABELS,
  FIELD_DEFAULTS,
  STRATEGY_OPTIONS,
  CONFLICT_TYPES,
  normalizeRecord,
  validateBackupStructure,
  analyzeBackupV2,
  resolveActionsWithStrategy,
  applyImportStrategies,
  runPostImportHealthScan,
  detectConflicts
};
