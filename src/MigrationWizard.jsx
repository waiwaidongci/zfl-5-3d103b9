import React, { useState, useCallback, useMemo } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowRight, Calendar, CheckCircle2, ChevronDown, ChevronUp,
  Database, Download, Eye, Info, Plus, RotateCcw,
  Settings, Shield, Upload, XCircle, Zap
} from 'lucide-react';
import {
  ENTITY_LABELS, STRATEGY_OPTIONS,
  validateBackupStructure, analyzeBackupV2, applyImportStrategies, runPostImportHealthScan
} from './migrationWizard.js';

const WIZARD_STEPS = [
  { key: 'upload', label: '选择文件', icon: Upload },
  { key: 'validate', label: '校验备份', icon: Shield },
  { key: 'diff', label: '数据对比', icon: Eye },
  { key: 'strategy', label: '导入策略', icon: Settings },
  { key: 'result', label: '导入结果', icon: CheckCircle2 }
];

const SEVERITY_LABELS = { critical: '严重', warning: '警告', info: '提示' };
const SEVERITY_ICONS = { critical: XCircle, warning: AlertTriangle, info: Info };

function MigrationWizard({ currentData, onImport, onExportBackup, onCancel }) {
  const [step, setStep] = useState('upload');
  const [backupRaw, setBackupRaw] = useState(null);
  const [validation, setValidation] = useState(null);
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [healthScan, setHealthScan] = useState(null);
  const [error, setError] = useState('');
  const [expandedEntities, setExpandedEntities] = useState({});

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  const handleFileUpload = useCallback((file) => {
    setError('');
    setValidation(null);
    setMigrationPreview(null);
    setImportResult(null);
    setHealthScan(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        setBackupRaw(backup);

        const validationResult = validateBackupStructure(backup);
        setValidation(validationResult);

        if (validationResult.valid) {
          setStep('validate');
        } else {
          setError(validationResult.errors.join('；'));
          setStep('upload');
        }
      } catch (err) {
        setError(err.message || '文件解析失败');
      }
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsText(file);
  }, []);

  const handleProceedToDiff = useCallback(() => {
    if (!backupRaw) return;
    const preview = analyzeBackupV2(backupRaw, currentData);
    setMigrationPreview(preview);
    setStep('diff');
  }, [backupRaw, currentData]);

  const handleProceedToStrategy = useCallback(() => {
    setStep('strategy');
  }, []);

  const handleStrategyChange = useCallback((entityType, strategyKey) => {
    setMigrationPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entities: {
          ...prev.entities,
          [entityType]: {
            ...prev.entities[entityType],
            strategy: strategyKey
          }
        }
      };
    });
  }, []);

  const handleConflictResolution = useCallback((entityType, recordIndex, resolution) => {
    setMigrationPreview((prev) => {
      if (!prev) return prev;
      const entity = prev.entities[entityType];
      const records = [...entity.records];
      records[recordIndex] = { ...records[recordIndex], resolution };
      return {
        ...prev,
        entities: {
          ...prev.entities,
          [entityType]: { ...entity, records }
        }
      };
    });
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!migrationPreview) return;

    const { restoredData, importSummary } = applyImportStrategies(migrationPreview);
    const healthResult = runPostImportHealthScan(restoredData);

    setImportResult({ restoredData, importSummary });
    setHealthScan(healthResult);
    setStep('result');

    if (onImport) {
      onImport(restoredData, importSummary);
    }
  }, [migrationPreview, onImport]);

  const toggleEntity = useCallback((entityType) => {
    setExpandedEntities((prev) => ({ ...prev, [entityType]: !prev[entityType] }));
  }, []);

  const unresolvedConflicts = useMemo(() => {
    if (!migrationPreview) return 0;
    let count = 0;
    for (const [, entity] of Object.entries(migrationPreview.entities)) {
      if (entity.strategy !== 'smartMerge') continue;
      for (const item of entity.records) {
        if (item.action === 'conflict' && !item.resolution) {
          count++;
        }
      }
    }
    return count;
  }, [migrationPreview]);

  const renderStepIndicator = () => (
    <div className="mw-steps">
      {WIZARD_STEPS.map((s, idx) => {
        const StepIcon = s.icon;
        const isActive = s.key === step;
        const isDone = idx < stepIndex;
        const isFuture = idx > stepIndex;
        return (
          <React.Fragment key={s.key}>
            {idx > 0 && <div className={`mw-step-divider ${isDone ? 'done' : ''}`} />}
            <div className={`mw-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isFuture ? 'future' : ''}`}>
              <div className="mw-step-icon">
                {isDone ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
              </div>
              <span>{s.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderUpload = () => (
    <div className="mw-upload-area">
      <label className="mw-file-label">
        <input
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <div className="mw-dropzone">
          <Upload size={32} />
          <span>点击选择备份文件（.json）</span>
          <span className="mw-hint">支持从导出功能生成的 JSON 备份文件</span>
        </div>
      </label>
      {error && (
        <div className="mw-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  const renderValidate = () => {
    if (!validation) return null;
    return (
      <div className="mw-validate">
        <div className="mw-validate-header">
          <h3><Shield size={16} /> 备份校验结果</h3>
        </div>
        <div className="mw-validate-meta">
          <span className="mw-meta-item"><Calendar size={14} /> 备份时间：{validation.exportedAt ? new Date(validation.exportedAt).toLocaleString('zh-CN') : '未知'}</span>
          <span className="mw-meta-item"><Database size={14} /> 备份版本：v{validation.backupVersion || 0}</span>
          <span className="mw-meta-item"><FileText size={14} /> 包含 {validation.totalEntities} 类数据、{validation.totalRecords} 条记录</span>
        </div>

        <div className={`mw-validate-status ${validation.valid ? 'valid' : 'invalid'}`}>
          {validation.valid ? (
            <><CheckCircle2 size={18} /><span>备份文件校验通过，可以继续</span></>
          ) : (
            <><XCircle size={18} /><span>备份文件校验失败</span></>
          )}
        </div>

        {validation.warnings.length > 0 && (
          <div className="mw-validate-warnings">
            <h4><AlertTriangle size={14} /> 注意事项</h4>
            <ul>
              {validation.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </div>
        )}

        {validation.errors.length > 0 && (
          <div className="mw-validate-errors">
            <h4><XCircle size={14} /> 错误</h4>
            <ul>
              {validation.errors.map((e, idx) => <li key={idx}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="mw-actions">
          <button type="button" className="ghost" onClick={() => { setStep('upload'); setBackupRaw(null); setValidation(null); }}>重新选择</button>
          {validation.valid && (
            <button type="button" onClick={handleProceedToDiff}>
              下一步：数据对比 <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDiff = () => {
    if (!migrationPreview) return null;
    return (
      <div className="mw-diff">
        <div className="mw-diff-header">
          <div className="mw-diff-summary">
            <span className="mw-summary-chip add"><Plus size={14} /> 新增 {migrationPreview.totalAdd}</span>
            <span className="mw-summary-chip overwrite"><RotateCcw size={14} /> 覆盖 {migrationPreview.totalOverwrite}</span>
            <span className="mw-summary-chip conflict"><AlertTriangle size={14} /> 冲突 {migrationPreview.totalConflict}</span>
            <span className="mw-summary-chip skip"><XCircle size={14} /> 跳过 {migrationPreview.totalSkip}</span>
            <span className="mw-summary-chip total">共 {migrationPreview.totalRecords} 条</span>
          </div>
        </div>

        {migrationPreview.warnings.length > 0 && (
          <div className="mw-diff-warnings">
            <AlertTriangle size={14} />
            <ul>{migrationPreview.warnings.map((w, idx) => <li key={idx}>{w}</li>)}</ul>
          </div>
        )}

        <div className="mw-entity-list">
          {Object.entries(migrationPreview.entities).map(([entityType, analysis]) => {
            if (analysis.totalCount === 0) return null;
            const isExpanded = expandedEntities[entityType];
            return (
              <div key={entityType} className={`mw-entity-card mw-entity-${entityType}`}>
                <div className="mw-entity-head" onClick={() => toggleEntity(entityType)}>
                  <h4>{ENTITY_LABELS[entityType]}（{analysis.totalCount}条）</h4>
                  <div className="mw-entity-stats">
                    {analysis.addCount > 0 && <span className="mw-stat add">新增 {analysis.addCount}</span>}
                    {analysis.overwriteCount > 0 && <span className="mw-stat overwrite">覆盖 {analysis.overwriteCount}</span>}
                    {analysis.conflictCount > 0 && <span className="mw-stat conflict">冲突 {analysis.conflictCount}</span>}
                    {analysis.skipCount > 0 && <span className="mw-stat skip">跳过 {analysis.skipCount}</span>}
                    {analysis.missingFields.length > 0 && <span className="mw-stat warn">缺字段 {analysis.missingFields.length}</span>}
                  </div>
                  <button className="ghost small mw-expand-btn">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="mw-entity-body">
                    <table className="mw-record-table">
                      <thead>
                        <tr>
                          <th>操作</th>
                          <th>记录摘要</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.records.map((item, idx) => (
                          <tr key={idx} className={`mw-row mw-row-${item.action}`}>
                            <td>
                              <span className={`mw-action-tag mw-action-${item.action}`}>
                                {item.action === 'add' && <Plus size={12} />}
                                {item.action === 'overwrite' && <RotateCcw size={12} />}
                                {item.action === 'conflict' && <AlertTriangle size={12} />}
                                {item.action === 'skip' && <XCircle size={12} />}
                                {item.action === 'add' ? '新增' : item.action === 'overwrite' ? '覆盖' : item.action === 'conflict' ? '冲突' : '跳过'}
                              </span>
                            </td>
                            <td className="mw-record-label">
                              {renderRecordLabel(entityType, item.record)}
                            </td>
                            <td className="mw-record-reason">
                              {item.reason}
                              {item.conflicts.length > 0 && (
                                <div className="mw-conflict-list">
                                  {item.conflicts.map((c, ci) => (
                                    <span key={ci} className="mw-conflict-tag">
                                      {c.description}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mw-actions">
          <button type="button" className="ghost" onClick={() => setStep('validate')}>上一步</button>
          <button type="button" onClick={handleProceedToStrategy}>
            下一步：选择导入策略 <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderStrategy = () => {
    if (!migrationPreview) return null;
    return (
      <div className="mw-strategy">
        <div className="mw-strategy-header">
          <h3><Settings size={16} /> 按实体类型选择导入策略</h3>
          <p className="mw-strategy-desc">为每种数据类型选择导入策略，控制新增、覆盖和冲突记录的处理方式。</p>
        </div>

        <div className="mw-strategy-list">
          {Object.entries(migrationPreview.entities).map(([entityType, analysis]) => {
            if (analysis.totalCount === 0) return null;
            const currentStrategy = analysis.strategy;
            return (
              <div key={entityType} className="mw-strategy-card">
                <div className="mw-strategy-card-head">
                  <h4>{ENTITY_LABELS[entityType]}</h4>
                  <div className="mw-strategy-card-stats">
                    <span className="mw-stat add">{analysis.addCount}新增</span>
                    <span className="mw-stat overwrite">{analysis.overwriteCount}覆盖</span>
                    <span className="mw-stat conflict">{analysis.conflictCount}冲突</span>
                  </div>
                </div>

                <div className="mw-strategy-options">
                  {Object.values(STRATEGY_OPTIONS).map((opt) => (
                    <label
                      key={opt.key}
                      className={`mw-strategy-option ${currentStrategy === opt.key ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`strategy-${entityType}`}
                        value={opt.key}
                        checked={currentStrategy === opt.key}
                        onChange={() => handleStrategyChange(entityType, opt.key)}
                      />
                      <div className="mw-strategy-option-content">
                        <strong>{opt.label}</strong>
                        <span>{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {currentStrategy === 'smartMerge' && analysis.conflictCount > 0 && (
                  <div className="mw-conflict-resolution">
                    <h5><AlertTriangle size={14} /> 冲突记录逐条处理</h5>
                    {analysis.records.map((item, idx) => {
                      if (item.action !== 'conflict') return null;
                      return (
                        <div key={idx} className="mw-conflict-item">
                          <div className="mw-conflict-item-head">
                            <span className="mw-action-tag mw-action-conflict"><AlertTriangle size={12} /> 冲突</span>
                            <span className="mw-conflict-label">{renderRecordLabel(entityType, item.record)}</span>
                          </div>
                          <div className="mw-conflict-item-reason">{item.reason}</div>
                          {item.currentRecord && (
                            <div className="mw-conflict-compare">
                              <div className="mw-compare-col mw-compare-current">
                                <span className="mw-compare-label">当前数据</span>
                                {renderRecordDetail(entityType, item.currentRecord)}
                              </div>
                              <div className="mw-compare-arrow">→</div>
                              <div className="mw-compare-col mw-compare-backup">
                                <span className="mw-compare-label">备份数据</span>
                                {renderRecordDetail(entityType, item.record)}
                              </div>
                            </div>
                          )}
                          <div className="mw-conflict-choices">
                            <button
                              className={`mw-choice-btn ${item.resolution === 'overwrite' ? 'selected' : ''}`}
                              onClick={() => handleConflictResolution(entityType, idx, 'overwrite')}
                            >
                              <RotateCcw size={12} /> 用备份覆盖
                            </button>
                            <button
                              className={`mw-choice-btn ${item.resolution === 'add' ? 'selected' : ''}`}
                              onClick={() => handleConflictResolution(entityType, idx, 'add')}
                            >
                              <Plus size={12} /> 作为新记录添加
                            </button>
                            <button
                              className={`mw-choice-btn mw-choice-skip ${item.resolution === 'skip' ? 'selected' : ''}`}
                              onClick={() => handleConflictResolution(entityType, idx, 'skip')}
                            >
                              <XCircle size={12} /> 跳过
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {unresolvedConflicts > 0 && (
          <div className="mw-strategy-warning">
            <AlertTriangle size={14} />
            <span>还有 {unresolvedConflicts} 条冲突记录未选择处理方式，未处理的冲突将默认跳过</span>
          </div>
        )}

        <div className="mw-actions">
          <button type="button" className="ghost" onClick={() => setStep('diff')}>上一步</button>
          <button type="button" className="outline" onClick={onExportBackup}><Download size={14} /> 先备份当前数据</button>
          <button type="button" onClick={handleConfirmImport} disabled={migrationPreview.totalRecords === 0}>
            <Zap size={14} /> 确认导入
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!importResult || !healthScan) return null;
    const { importSummary } = importResult;
    return (
      <div className="mw-result">
        <div className="mw-result-success">
          <CheckCircle2 size={28} />
          <strong>数据导入完成</strong>
          <span>已新增 {importSummary.added} 条、覆盖 {importSummary.overwritten} 条、跳过 {importSummary.skipped} 条记录</span>
        </div>

        {importSummary.skipReasons.length > 0 && (
          <div className="mw-result-skipped">
            <h4><XCircle size={14} /> 跳过记录明细（{importSummary.skipReasons.length}条）</h4>
            <div className="mw-skip-list">
              {importSummary.skipReasons.slice(0, 20).map((item, idx) => (
                <div key={idx} className="mw-skip-item">
                  <span className="mw-skip-entity">{item.entityLabel}</span>
                  <span className="mw-skip-label">{renderRecordLabel(item.entityType, item.record)}</span>
                  <span className="mw-skip-reason">{item.reason}</span>
                </div>
              ))}
              {importSummary.skipReasons.length > 20 && (
                <p className="mw-skip-more">...还有 {importSummary.skipReasons.length - 20} 条跳过记录</p>
              )}
            </div>
          </div>
        )}

        <div className="mw-result-health">
          <div className="mw-health-header">
            <h4><Shield size={14} /> 导入后数据健康扫描</h4>
            <span className="mw-health-time">扫描于 {new Date(healthScan.scannedAt).toLocaleString('zh-CN')}</span>
          </div>

          {healthScan.isHealthy ? (
            <div className="mw-health-clean">
              <CheckCircle2 size={20} />
              <strong>所有数据检查通过</strong>
              <span>未发现数据一致性问题</span>
            </div>
          ) : (
            <>
              <div className="mw-health-summary">
                <span className="mw-health-chip critical"><XCircle size={14} /> 严重 {healthScan.criticalCount}</span>
                <span className="mw-health-chip warning"><AlertTriangle size={14} /> 警告 {healthScan.warningCount}</span>
                <span className="mw-health-chip info"><Info size={14} /> 提示 {healthScan.infoCount}</span>
                <span className="mw-health-chip total">共 {healthScan.totalIssues} 项</span>
              </div>

              <div className="mw-health-suggestions">
                {healthScan.fixSuggestions.map((suggestion, idx) => {
                  const SeverityIcon = SEVERITY_ICONS[suggestion.severity] || Info;
                  return (
                    <div key={idx} className={`mw-suggestion mw-suggestion-${suggestion.severity}`}>
                      <div className="mw-suggestion-head">
                        <SeverityIcon size={14} />
                        <span className="mw-suggestion-severity">{SEVERITY_LABELS[suggestion.severity]}</span>
                        <strong className="mw-suggestion-title">{suggestion.title}</strong>
                        {suggestion.autoFixable && <span className="mw-suggestion-auto"><Zap size={12} /> 可自动修复</span>}
                      </div>
                      <span className="mw-suggestion-fix">建议：{suggestion.suggestion}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mw-actions">
          <button type="button" onClick={onCancel}>完成</button>
        </div>
      </div>
    );
  };

  const renderRecordLabel = (entityType, record) => {
    if (!record) return '—';
    switch (entityType) {
      case 'artists': return <>{record.name}{record.phone ? ` · ${record.phone}` : ''}</>;
      case 'works': return <>{record.artist} — {record.title} · ¥{Number(record.price || 0).toLocaleString()}</>;
      case 'inquiries': return <>{record.workTitle} · {record.customerName}</>;
      case 'orders': return <>{record.workTitle} · {record.customerName} · ¥{Number(record.dealPrice || 0).toLocaleString()}</>;
      case 'statements': return <>{record.artist} · {record.startDate}~{record.endDate}</>;
      case 'loans': return <>{record.workTitle} · {record.borrower}</>;
      case 'inventoryTasks': return <>{record.name}</>;
      default: return record.id || '—';
    }
  };

  const renderRecordDetail = (entityType, record) => {
    if (!record) return <span>—</span>;
    switch (entityType) {
      case 'artists':
        return <span>{record.name} · {record.phone || '无电话'} · {record.style || '无方向'}</span>;
      case 'works':
        return <span>{record.artist} — {record.title} · ¥{Number(record.price || 0).toLocaleString()} · {record.exhibit} · {record.sale} · {record.settlement}</span>;
      case 'orders':
        return <span>{record.workTitle} · {record.customerName} · ¥{Number(record.dealPrice || 0).toLocaleString()} · {record.balanceStatus}{record.cancelledAt ? ' (已撤销)' : ''}</span>;
      case 'statements':
        return <span>{record.artist} · {record.startDate}~{record.endDate} · {record.confirmed ? '已确认' : '待确认'} · {record.paymentStatus}</span>;
      case 'inquiries':
        return <span>{record.workTitle} · {record.customerName} · {record.status}</span>;
      case 'loans':
        return <span>{record.workTitle} · {record.borrower} · {record.loanDate}{record.returnedAt ? ' (已归还)' : ''}</span>;
      case 'inventoryTasks':
        return <span>{record.name} · {record.status} · {record.totalCount}件</span>;
      default:
        return <span>{record.id}</span>;
    }
  };

  return (
    <section className="panel mw-panel">
      <div className="mw-header">
        <h2><Upload size={18} /> 分阶段数据迁移向导</h2>
        <button className="ghost small" onClick={onCancel}>收起</button>
      </div>

      {renderStepIndicator()}

      <div className="mw-body">
        {step === 'upload' && renderUpload()}
        {step === 'validate' && renderValidate()}
        {step === 'diff' && renderDiff()}
        {step === 'strategy' && renderStrategy()}
        {step === 'result' && renderResult()}
      </div>
    </section>
  );
}

export default MigrationWizard;
