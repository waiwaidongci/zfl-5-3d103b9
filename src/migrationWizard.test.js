import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRecord,
  validateBackupStructure,
  analyzeBackupV2,
  detectConflicts,
  resolveActionsWithStrategy,
  applyImportStrategies,
  runPostImportHealthScan,
  BACKUP_VERSION,
  FIELD_DEFAULTS,
  CONFLICT_TYPES
} from './migrationWizard.js';
import { createMockData } from './testFixtures.js';

describe('migrationWizard - normalizeRecord', () => {
  it('应为缺失字段填充默认值', () => {
    const record = { id: 'w1', title: '作品A' };
    const normalized = normalizeRecord('works', record);
    expect(normalized.artist).toBe('');
    expect(normalized.price).toBe(0);
    expect(normalized.exhibit).toBe('展出中');
    expect(normalized.sale).toBe('待售');
    expect(normalized.title).toBe('作品A');
  });

  it('不应覆盖已有字段', () => {
    const record = { id: 'w1', title: '作品A', artist: '齐白石', price: 50000 };
    const normalized = normalizeRecord('works', record);
    expect(normalized.artist).toBe('齐白石');
    expect(normalized.price).toBe(50000);
  });

  it('未知实体类型应原样返回', () => {
    const record = { foo: 'bar' };
    expect(normalizeRecord('unknown', record)).toEqual(record);
  });
});

describe('migrationWizard - validateBackupStructure', () => {
  it('应通过有效的备份文件', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: { works: [], orders: [], inquiries: [], artists: [], statements: [], loans: [], inventoryTasks: [], followUps: [] },
      exportedAt: '2026-01-01T00:00:00.000Z'
    };

    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('应拒绝空对象', () => {
    const result = validateBackupStructure(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('应拒绝非本应用的备份', () => {
    const backup = { app: 'other-app', data: {} };
    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('画廊寄售'))).toBe(true);
  });

  it('应拒绝缺少 data 字段的备份', () => {
    const backup = { app: 'zfl-5-gallery-consignment' };
    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('data'))).toBe(true);
  });

  it('低版本备份应产生警告', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: 0,
      data: { works: [], orders: [], inquiries: [], artists: [], statements: [], loans: [], inventoryTasks: [], followUps: [] }
    };

    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('低于当前版本'))).toBe(true);
  });

  it('高版本备份应产生警告', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: 999,
      data: { works: [], orders: [], inquiries: [], artists: [], statements: [], loans: [], inventoryTasks: [], followUps: [] }
    };

    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('高于当前版本'))).toBe(true);
  });

  it('数据字段非数组应报错', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: { works: 'not-an-array', orders: [], inquiries: [], artists: [], statements: [], loans: [], inventoryTasks: [], followUps: [] }
    };

    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('格式异常'))).toBe(true);
  });

  it('缺少实体类型数据应产生警告', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: { works: [] }
    };

    const result = validateBackupStructure(backup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('缺少'))).toBe(true);
  });
});

describe('migrationWizard - detectConflicts', () => {
  it('作品状态不同时应检测到冲突', () => {
    const backupRecord = { id: 'w1', sale: '待售', exhibit: '库房', settlement: '未结算', price: 50000 };
    const currentRecord = { id: 'w1', sale: '已售', exhibit: '展出中', settlement: '已结算', price: 60000 };

    const conflicts = detectConflicts('works', backupRecord, currentRecord);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('完全相同的记录不应产生冲突', () => {
    const record = { id: 'w1', sale: '待售', exhibit: '展出中', settlement: '未结算', price: 50000 };
    const conflicts = detectConflicts('works', record, { ...record });
    expect(conflicts.length).toBe(0);
  });

  it('订单价格不同时应检测到冲突', () => {
    const backupRecord = { dealPrice: 50000, cancelledAt: null };
    const currentRecord = { dealPrice: 60000, cancelledAt: null };
    const conflicts = detectConflicts('orders', backupRecord, currentRecord);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('对账单确认状态不一致应检测到冲突', () => {
    const backupRecord = { confirmed: false, paymentStatus: '待付款' };
    const currentRecord = { confirmed: true, paymentStatus: '部分付款' };
    const conflicts = detectConflicts('statements', backupRecord, currentRecord);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('currentRecord 为 null 时不应报错', () => {
    const conflicts = detectConflicts('works', { id: 'w1' }, null);
    expect(conflicts).toEqual([]);
  });
});

describe('migrationWizard - analyzeBackupV2', () => {
  const currentData = {
    artists: [{ id: 'a1', name: '齐白石', phone: '', style: '', note: '' }],
    works: [{ id: 'w1', artist: '齐白石', title: '墨虾图', price: 80000, inDate: '2026-01-01', exhibit: '展出中', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null }],
    inquiries: [],
    orders: [],
    statements: [],
    loans: [],
    inventoryTasks: [],
    followUps: []
  };

  it('应将全新记录标记为 add', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: {
        artists: [{ id: 'a2', name: '徐悲鸿', phone: '', style: '', note: '' }],
        works: currentData.works,
        inquiries: [],
        orders: [],
        statements: [],
        loans: [],
        inventoryTasks: [],
        followUps: []
      }
    };

    const result = analyzeBackupV2(backup, currentData);
    expect(result.totalAdd).toBe(1);
    expect(result.entities.artists.records[0].action).toBe('add');
  });

  it('应将已存在记录标记为 overwrite', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: {
        artists: currentData.artists,
        works: [{ ...currentData.works[0], price: 90000 }],
        inquiries: [],
        orders: [],
        statements: [],
        loans: [],
        inventoryTasks: [],
        followUps: []
      }
    };

    const result = analyzeBackupV2(backup, currentData);
    expect(result.totalOverwrite).toBeGreaterThan(0);
  });

  it('应将同名不同ID的艺术家标记为 conflict', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: {
        artists: [{ id: 'a-different', name: '齐白石', phone: '', style: '', note: '' }],
        works: currentData.works,
        inquiries: [],
        orders: [],
        statements: [],
        loans: [],
        inventoryTasks: [],
        followUps: []
      }
    };

    const result = analyzeBackupV2(backup, currentData);
    expect(result.totalConflict).toBeGreaterThan(0);
  });

  it('应保留当前数据的快照用于回滚', () => {
    const backup = {
      app: 'zfl-5-gallery-consignment',
      version: BACKUP_VERSION,
      data: {
        artists: [],
        works: [],
        inquiries: [],
        orders: [],
        statements: [],
        loans: [],
        inventoryTasks: [],
        followUps: []
      }
    };

    const result = analyzeBackupV2(backup, currentData);
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.artists.length).toBe(1);
  });
});

describe('migrationWizard - resolveActionsWithStrategy', () => {
  const addRecord = { action: 'add', record: { id: 'new' }, reason: '新记录', conflicts: [], resolution: null };
  const overwriteRecord = { action: 'overwrite', record: { id: 'existing' }, reason: 'ID已存在', conflicts: [], resolution: null };
  const conflictRecord = { action: 'conflict', record: { id: 'conflict' }, reason: '冲突', conflicts: [{ type: 'test' }], resolution: null };

  it('addOnly 策略应保留新增，跳过覆盖和冲突', () => {
    const resolved = resolveActionsWithStrategy({ records: [addRecord, overwriteRecord, conflictRecord] }, 'addOnly');
    expect(resolved[0].finalAction).toBe('add');
    expect(resolved[1].finalAction).toBe('skip');
    expect(resolved[2].finalAction).toBe('skip');
  });

  it('overwriteAll 策略应保留新增和覆盖，冲突也覆盖', () => {
    const resolved = resolveActionsWithStrategy({ records: [addRecord, overwriteRecord, conflictRecord] }, 'overwriteAll');
    expect(resolved[0].finalAction).toBe('add');
    expect(resolved[1].finalAction).toBe('overwrite');
    expect(resolved[2].finalAction).toBe('overwrite');
  });

  it('skipExisting 策略应只保留新增，其余跳过', () => {
    const resolved = resolveActionsWithStrategy({ records: [addRecord, overwriteRecord, conflictRecord] }, 'skipExisting');
    expect(resolved[0].finalAction).toBe('add');
    expect(resolved[1].finalAction).toBe('skip');
    expect(resolved[2].finalAction).toBe('skip');
  });

  it('smartMerge 策略下冲突未解决应默认跳过', () => {
    const resolved = resolveActionsWithStrategy({ records: [conflictRecord] }, 'smartMerge');
    expect(resolved[0].finalAction).toBe('skip');
  });

  it('smartMerge 策略下冲突已标记为 overwrite 应覆盖', () => {
    const resolvedConflict = { ...conflictRecord, resolution: 'overwrite' };
    const resolved = resolveActionsWithStrategy({ records: [resolvedConflict] }, 'smartMerge');
    expect(resolved[0].finalAction).toBe('overwrite');
  });

  it('smartMerge 策略下冲突已标记为 add 应新增', () => {
    const resolvedConflict = { ...conflictRecord, resolution: 'add' };
    const resolved = resolveActionsWithStrategy({ records: [resolvedConflict] }, 'smartMerge');
    expect(resolved[0].finalAction).toBe('add');
  });
});

describe('migrationWizard - applyImportStrategies', () => {
  it('应将新增记录追加到当前数据之后', () => {
    const migrationPreview = {
      snapshot: {
        artists: [{ id: 'a1', name: '齐白石', phone: '', style: '', note: '' }],
        works: [], inquiries: [], orders: [], statements: [], loans: [], inventoryTasks: [], followUps: []
      },
      entities: {
        artists: {
          records: [{ action: 'add', record: { id: 'a2', name: '徐悲鸿', phone: '', style: '', note: '' }, reason: '新记录', conflicts: [], resolution: null }],
          addCount: 1, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 1, missingFields: [], strategy: 'addOnly'
        },
        works: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        inquiries: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        orders: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        statements: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        loans: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        inventoryTasks: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' },
        followUps: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'addOnly' }
      },
      totalAdd: 1, totalOverwrite: 0, totalSkip: 0, totalConflict: 0, totalRecords: 1, warnings: [], backupVersion: BACKUP_VERSION
    };

    const result = applyImportStrategies(migrationPreview);
    expect(result.restoredData.artists.length).toBe(2);
    expect(result.restoredData.artists[1].name).toBe('徐悲鸿');
    expect(result.importSummary.added).toBe(1);
  });

  it('应将覆盖记录替换当前数据中的对应项', () => {
    const originalWork = { id: 'w1', artist: '齐白石', title: '墨虾图', price: 80000, inDate: '2026-01-01', exhibit: '展出中', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null };
    const backupWork = { id: 'w1', artist: '齐白石', title: '墨虾图', price: 90000, inDate: '2026-01-01', exhibit: '库房', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null };

    const migrationPreview = {
      snapshot: { artists: [], works: [originalWork], inquiries: [], orders: [], statements: [], loans: [], inventoryTasks: [], followUps: [] },
      entities: {
        artists: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        works: {
          records: [{ action: 'overwrite', record: backupWork, currentRecord: originalWork, reason: '覆盖', conflicts: [], resolution: null }],
          addCount: 0, overwriteCount: 1, skipCount: 0, conflictCount: 0, totalCount: 1, missingFields: [], strategy: 'overwriteAll'
        },
        inquiries: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        orders: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        statements: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        loans: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        inventoryTasks: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' },
        followUps: { records: [], addCount: 0, overwriteCount: 0, skipCount: 0, conflictCount: 0, totalCount: 0, missingFields: [], strategy: 'overwriteAll' }
      },
      totalAdd: 0, totalOverwrite: 1, totalSkip: 0, totalConflict: 0, totalRecords: 1, warnings: [], backupVersion: BACKUP_VERSION
    };

    const result = applyImportStrategies(migrationPreview);
    expect(result.restoredData.works[0].price).toBe(90000);
    expect(result.restoredData.works[0].exhibit).toBe('库房');
    expect(result.importSummary.overwritten).toBe(1);
  });
});

describe('migrationWizard - runPostImportHealthScan', () => {
  it('应在健康数据上返回 isHealthy = true', () => {
    const data = {
      works: [{ id: 'w1', title: '作品A', artist: 'A', sale: '待售', settlement: '未结算', exhibit: '展出中' }],
      orders: [],
      inquiries: [],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    const result = runPostImportHealthScan(data);
    expect(result.isHealthy).toBe(true);
    expect(result.totalIssues).toBe(0);
  });

  it('应在有问题的数据上返回具体问题', () => {
    const data = {
      works: [{ id: 'w1', title: '作品A', artist: 'A', sale: '已售', settlement: '未结算', exhibit: '展出中' }],
      orders: [],
      inquiries: [{ id: 'inq1', workId: 'w-nonexistent', workTitle: '丢失作品', customerName: 'X', customerPhone: '13800000000', status: '跟进中', createdAt: '2026-01-01' }],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    const result = runPostImportHealthScan(data);
    expect(result.isHealthy).toBe(false);
    expect(result.totalIssues).toBeGreaterThan(0);
    expect(result.fixSuggestions.length).toBeGreaterThan(0);
  });

  it('应正确分类问题严重程度', () => {
    const data = {
      works: [{ id: 'w1', title: '作品A', artist: 'A', sale: '已售', settlement: '未结算', exhibit: '展出中' }],
      orders: [],
      inquiries: [{ id: 'inq1', workId: 'w-nonexistent', workTitle: '丢失', customerName: 'X', customerPhone: '13800000000', status: '跟进中', createdAt: '2026-01-01' }],
      loans: [],
      statements: [],
      inventoryTasks: [],
      followUps: []
    };

    const result = runPostImportHealthScan(data);
    expect(result.criticalCount).toBeGreaterThan(0);
  });
});
