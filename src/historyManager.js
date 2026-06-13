const HISTORY_STORAGE_KEY = 'zfl-5-operation-history';
const SESSION_MARKER_KEY = 'zfl-5-session-marker';
const MAX_HISTORY_ITEMS = 50;
const MAX_UNDO_COUNT = 20;

const OPERATION_TYPES = {
  ADD_ARTIST: 'add-artist',
  ADD_WORK: 'add-work',
  BATCH_IMPORT_WORKS: 'batch-import-works',
  ADD_INQUIRY: 'add-inquiry',
  UPDATE_INQUIRY_STATUS: 'update-inquiry-status',
  ADD_LOAN: 'add-loan',
  MARK_LOAN_RETURNED: 'mark-loan-returned',
  UPDATE_WORK: 'update-work',
  ADD_ORDER: 'add-order',
  EDIT_ORDER: 'edit-order',
  CANCEL_ORDER: 'cancel-order',
  UPDATE_ORDER_BALANCE: 'update-order-balance',
  SETTLE_WORK: 'settle-work',
  CONFIRM_STATEMENT: 'confirm-statement',
  UPDATE_STATEMENT_PAYMENT: 'update-statement-payment',
  CREATE_STATEMENT: 'create-statement',
  INVENTORY_ITEM_UPDATE: 'inventory-item-update',
  INVENTORY_DISCREPANCY_RESOLVE: 'inventory-discrepancy-resolve',
  INVENTORY_TASK_COMPLETE: 'inventory-task-complete',
  INVENTORY_FORCE_COMPLETE: 'inventory-force-complete',
  INVENTORY_TASK_REOPEN: 'inventory-task-reopen',
  INVENTORY_CREATE_TASK: 'inventory-create-task',
  HEALTH_CENTER_FIX: 'health-center-fix',
  BACKUP_IMPORT: 'backup-import',
  ADD_FOLLOW_UP: 'add-follow-up',
  COMPLETE_FOLLOW_UP: 'complete-follow-up',
  POSTPONE_FOLLOW_UP: 'postpone-follow-up',
  UPDATE_FOLLOW_UP: 'update-follow-up',
  DELETE_FOLLOW_UP: 'delete-follow-up',
  MERGE_CUSTOMERS: 'merge-customers'
};

const OPERATION_LABELS = {
  [OPERATION_TYPES.ADD_ARTIST]: '新增艺术家',
  [OPERATION_TYPES.ADD_WORK]: '新增作品',
  [OPERATION_TYPES.BATCH_IMPORT_WORKS]: '批量导入作品',
  [OPERATION_TYPES.ADD_INQUIRY]: '新增询价',
  [OPERATION_TYPES.UPDATE_INQUIRY_STATUS]: '更新询价状态',
  [OPERATION_TYPES.ADD_LOAN]: '新增借展',
  [OPERATION_TYPES.MARK_LOAN_RETURNED]: '归还借展',
  [OPERATION_TYPES.UPDATE_WORK]: '修改作品',
  [OPERATION_TYPES.ADD_ORDER]: '登记订单',
  [OPERATION_TYPES.EDIT_ORDER]: '编辑订单',
  [OPERATION_TYPES.CANCEL_ORDER]: '撤销订单',
  [OPERATION_TYPES.UPDATE_ORDER_BALANCE]: '更新订单尾款',
  [OPERATION_TYPES.SETTLE_WORK]: '结算确认',
  [OPERATION_TYPES.CONFIRM_STATEMENT]: '确认对账单',
  [OPERATION_TYPES.UPDATE_STATEMENT_PAYMENT]: '更新付款状态',
  [OPERATION_TYPES.CREATE_STATEMENT]: '创建对账单',
  [OPERATION_TYPES.INVENTORY_ITEM_UPDATE]: '盘点状态修改',
  [OPERATION_TYPES.INVENTORY_DISCREPANCY_RESOLVE]: '盘点差异处理',
  [OPERATION_TYPES.INVENTORY_TASK_COMPLETE]: '完成盘点任务',
  [OPERATION_TYPES.INVENTORY_FORCE_COMPLETE]: '强制完成盘点',
  [OPERATION_TYPES.INVENTORY_TASK_REOPEN]: '重新开启盘点',
  [OPERATION_TYPES.INVENTORY_CREATE_TASK]: '创建盘点任务',
  [OPERATION_TYPES.HEALTH_CENTER_FIX]: '数据健康修复',
  [OPERATION_TYPES.BACKUP_IMPORT]: '备份导入',
  [OPERATION_TYPES.ADD_FOLLOW_UP]: '新增跟进计划',
  [OPERATION_TYPES.COMPLETE_FOLLOW_UP]: '完成跟进计划',
  [OPERATION_TYPES.POSTPONE_FOLLOW_UP]: '延期跟进计划',
  [OPERATION_TYPES.UPDATE_FOLLOW_UP]: '修改跟进计划',
  [OPERATION_TYPES.DELETE_FOLLOW_UP]: '删除跟进计划',
  [OPERATION_TYPES.MERGE_CUSTOMERS]: '合并客户'
};

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

const ENTITY_ORDER = ['artists', 'works', 'inquiries', 'orders', 'statements', 'loans', 'inventoryTasks', 'followUps'];

class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.toastListeners = new Set();
    this.currentSessionId = this._generateSessionId();
    this._loadFromStorage();
    this._checkSessionBoundary();
  }

  _generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  _checkSessionBoundary() {
    const lastSession = sessionStorage.getItem(SESSION_MARKER_KEY);
    if (!lastSession) {
      this.undoStack.forEach(item => {
        if (item.sessionId !== this.currentSessionId) {
          item.isCrossSession = true;
        }
      });
      this.redoStack = [];
      this._saveToStorage();
    }
    sessionStorage.setItem(SESSION_MARKER_KEY, this.currentSessionId);
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.undoStack = data.undoStack || [];
        this.redoStack = data.redoStack || [];
      }
    } catch (e) {
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  _saveToStorage() {
    try {
      const trimmedUndo = this.undoStack.slice(-MAX_HISTORY_ITEMS);
      const data = {
        undoStack: trimmedUndo,
        redoStack: this.redoStack
      };
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save history to storage:', e);
      this.undoStack = this.undoStack.slice(-10);
      try {
        const data = {
          undoStack: this.undoStack,
          redoStack: []
        };
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
        this.redoStack = [];
      } catch (e2) {
        console.error('Failed to save trimmed history:', e2);
      }
    }
  }

  _notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  _emitToast(toast) {
    this.toastListeners.forEach(fn => fn(toast));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToast(listener) {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  getState() {
    const undoableInSession = this.undoStack.filter(op => !op.isCrossSession);
    return {
      canUndo: undoableInSession.length > 0,
      canRedo: this.redoStack.length > 0,
      canUndoCrossSession: this.undoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastOperation: this.undoStack[this.undoStack.length - 1] || null,
      nextRedo: this.redoStack[this.redoStack.length - 1] || null,
      history: [...this.undoStack].reverse(),
      currentSessionId: this.currentSessionId
    };
  }

  _getAllEntityData() {
    const data = {};
    for (const [entityType, storageKey] of Object.entries(STORAGE_KEYS)) {
      try {
        const raw = localStorage.getItem(storageKey);
        data[entityType] = raw ? JSON.parse(raw) : [];
      } catch (e) {
        data[entityType] = [];
      }
    }
    return data;
  }

  _restoreEntityData(data, affectedEntityTypes = null) {
    for (const entityType of ENTITY_ORDER) {
      if (affectedEntityTypes && !affectedEntityTypes.includes(entityType)) {
        continue;
      }
      const storageKey = STORAGE_KEYS[entityType];
      if (data[entityType] !== undefined) {
        localStorage.setItem(storageKey, JSON.stringify(data[entityType]));
      }
    }
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  recordOperation(operationType, summary, affectedEntities, customData = {}) {
    const beforeData = this._getAllEntityData();

    const operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: operationType,
      typeLabel: OPERATION_LABELS[operationType] || operationType,
      summary,
      timestamp: new Date().toISOString(),
      affectedEntities,
      beforeData: this._deepClone(beforeData),
      afterData: null,
      sessionId: this.currentSessionId,
      isCrossSession: false,
      ...customData
    };

    return {
      commit: () => {
        operation.afterData = this._deepClone(this._getAllEntityData());
        this.undoStack.push(operation);

        if (this.undoStack.length > MAX_HISTORY_ITEMS) {
          this.undoStack = this.undoStack.slice(-MAX_HISTORY_ITEMS);
        }

        this.redoStack = [];
        this._saveToStorage();
        this._notifyListeners();

        this._emitToast({
          id: operation.id,
          type: 'operation',
          message: `${operation.typeLabel}：${operation.summary}`,
          operationType: operation.type,
          canUndo: true
        });

        return operation;
      },
      getOperation: () => operation
    };
  }

  recordAtomicOperation(operationType, summary, affectedEntities, executeFn) {
    const beforeData = this._getAllEntityData();

    const operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: operationType,
      typeLabel: OPERATION_LABELS[operationType] || operationType,
      summary,
      timestamp: new Date().toISOString(),
      affectedEntities,
      beforeData: this._deepClone(beforeData),
      afterData: null,
      sessionId: this.currentSessionId,
      isCrossSession: false
    };

    const result = executeFn();

    operation.afterData = this._deepClone(this._getAllEntityData());

    this.undoStack.push(operation);
    if (this.undoStack.length > MAX_HISTORY_ITEMS) {
      this.undoStack = this.undoStack.slice(-MAX_HISTORY_ITEMS);
    }
    this.redoStack = [];
    this._saveToStorage();
    this._notifyListeners();

    this._emitToast({
      id: operation.id,
      type: 'operation',
      message: `${operation.typeLabel}：${operation.summary}`,
      operationType: operation.type,
      canUndo: true
    });

    return { operation, result };
  }

  undo() {
    if (this.undoStack.length === 0) return null;

    const idx = this.undoStack.length - 1;
    const operation = this.undoStack[idx];

    if (operation.isCrossSession && this._countSessionUndo() >= MAX_UNDO_COUNT) {
      this._emitToast({
        id: `warn-${Date.now()}`,
        type: 'warning',
        message: '已达到本次会话最大撤销次数，更早的操作无法撤销',
        canUndo: false
      });
      return null;
    }

    const affectedTypes = this._extractEntityTypes(operation.affectedEntities);

    this.undoStack.splice(idx, 1);
    this._restoreEntityData(operation.beforeData, affectedTypes);
    this.redoStack.push(operation);
    this._saveToStorage();
    this._notifyListeners();

    this._emitToast({
      id: `undo-${Date.now()}`,
      type: 'undo',
      message: `已撤销：${operation.typeLabel} — ${operation.summary}`,
      canUndo: false
    });

    return {
      operation,
      restoredData: operation.beforeData,
      affectedTypes
    };
  }

  redo() {
    if (this.redoStack.length === 0) return null;

    const operation = this.redoStack.pop();
    const affectedTypes = this._extractEntityTypes(operation.affectedEntities);

    this._restoreEntityData(operation.afterData, affectedTypes);
    this.undoStack.push(operation);
    this._saveToStorage();
    this._notifyListeners();

    this._emitToast({
      id: `redo-${Date.now()}`,
      type: 'redo',
      message: `已恢复：${operation.typeLabel} — ${operation.summary}`,
      canUndo: true
    });

    return {
      operation,
      restoredData: operation.afterData,
      affectedTypes
    };
  }

  _extractEntityTypes(affectedEntities) {
    if (!affectedEntities || affectedEntities.length === 0) return null;
    const types = new Set();
    affectedEntities.forEach((e) => {
      if (e && e.entityType) types.add(e.entityType);
    });
    return types.size > 0 ? [...types] : null;
  }

  _countSessionUndo() {
    let count = 0;
    for (let i = this.undoStack.length - 1; i >= 0; i--) {
      if (!this.undoStack[i].isCrossSession) break;
      count++;
    }
    return count;
  }

  peekUndo() {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1]
      : null;
  }

  peekRedo() {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1]
      : null;
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this._saveToStorage();
    this._notifyListeners();
  }

  clearRedo() {
    this.redoStack = [];
    this._saveToStorage();
    this._notifyListeners();
  }

  getHistoryList() {
    return [...this.undoStack].reverse();
  }

  getRedoList() {
    return [...this.redoStack].reverse();
  }
}

const historyManager = new HistoryManager();

export {
  historyManager,
  OPERATION_TYPES,
  OPERATION_LABELS,
  STORAGE_KEYS,
  ENTITY_ORDER,
  MAX_HISTORY_ITEMS,
  MAX_UNDO_COUNT
};
