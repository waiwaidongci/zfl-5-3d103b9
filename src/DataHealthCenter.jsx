import React, { useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, Eye,
  Filter, Search, ChevronDown, ChevronUp, Shield,
  AlertCircle, Info, Wrench
} from 'lucide-react';
import { runAllDiagnostics, SEVERITY, CATEGORY, CATEGORY_LABELS } from './diagnosticRules.js';
import { generateFixPreview, applyFixes } from './fixExecutor.js';

function DataHealthCenter({ artists, works, orders, inquiries, loans, statements, inventoryTasks, onFixApplied }) {
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fixPreview, setFixPreview] = useState(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState(new Set());
  const [fixConfirmStep, setFixConfirmStep] = useState('idle');
  const [expandedIssueId, setExpandedIssueId] = useState(null);

  const data = useMemo(() => ({
    artists, works, orders, inquiries, loans, statements, inventoryTasks
  }), [artists, works, orders, inquiries, loans, statements, inventoryTasks]);

  const runScan = useCallback(() => {
    const result = runAllDiagnostics(data);
    setDiagnosisResult(result);
    setFixPreview(null);
    setFixConfirmStep('idle');
    setSelectedIssueIds(new Set());
    setExpandedIssueId(null);
  }, [data]);

  const filteredIssues = useMemo(() => {
    if (!diagnosisResult) return [];
    return diagnosisResult.issues.filter((issue) => {
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${issue.title} ${issue.description} ${issue.fixLabel}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [diagnosisResult, selectedCategory, selectedSeverity, searchQuery]);

  const handleSelectIssue = useCallback((issueId) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!filteredIssues.length) return;
    const allIds = new Set(filteredIssues.map((i) => i.id));
    const allSelected = filteredIssues.every((i) => selectedIssueIds.has(i.id));
    if (allSelected) {
      setSelectedIssueIds(new Set());
    } else {
      setSelectedIssueIds(allIds);
    }
  }, [filteredIssues, selectedIssueIds]);

  const handlePreviewFix = useCallback(() => {
    if (selectedIssueIds.size === 0) return;
    const selectedIssues = diagnosisResult.issues.filter((i) => selectedIssueIds.has(i.id));
    const preview = generateFixPreview(selectedIssues, data);
    setFixPreview(preview);
    setFixConfirmStep('preview');
  }, [selectedIssueIds, diagnosisResult, data]);

  const handleConfirmFix = useCallback(() => {
    if (!fixPreview) return;
    const updatedData = applyFixes(fixPreview.patches, data);
    setFixConfirmStep('done');
    if (onFixApplied) {
      onFixApplied(updatedData, fixPreview.patches);
    }
  }, [fixPreview, data, onFixApplied]);

  const handleCancelFix = useCallback(() => {
    setFixPreview(null);
    setFixConfirmStep('idle');
  }, []);

  const handleRescan = useCallback(() => {
    runScan();
  }, [runScan]);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL: return <XCircle size={14} />;
      case SEVERITY.WARNING: return <AlertTriangle size={14} />;
      case SEVERITY.INFO: return <Info size={14} />;
      default: return null;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL: return 'health-severity-critical';
      case SEVERITY.WARNING: return 'health-severity-warning';
      case SEVERITY.INFO: return 'health-severity-info';
      default: return '';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL: return '严重';
      case SEVERITY.WARNING: return '警告';
      case SEVERITY.INFO: return '提示';
      default: return severity;
    }
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <h2><Shield size={18} />数据健康中心</h2>
        <label><Search size={16} />
          <input
            placeholder="搜索异常描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="toolbar-right">
          <button onClick={runScan}>
            <RefreshCw size={14} /> 运行诊断
          </button>
        </div>
      </div>

      {!diagnosisResult && (
        <div className="health-empty">
          <Shield size={48} />
          <strong>数据健康中心</strong>
          <span>持续检查作品、订单、询价、借展、结算、盘点和客户档案之间的数据一致性</span>
          <button onClick={runScan}>
            <RefreshCw size={14} /> 开始扫描
          </button>
        </div>
      )}

      {diagnosisResult && (
        <>
          <div className="health-summary">
            <div className="health-summary-total">
              <span className="health-summary-label">异常总数</span>
              <strong className="health-summary-value">{diagnosisResult.totalIssues}</strong>
            </div>
            <div className="health-summary-critical">
              <XCircle size={16} />
              <span className="health-summary-label">严重</span>
              <strong>{diagnosisResult.criticalCount}</strong>
            </div>
            <div className="health-summary-warning">
              <AlertTriangle size={16} />
              <span className="health-summary-label">警告</span>
              <strong>{diagnosisResult.warningCount}</strong>
            </div>
            <div className="health-summary-clean">
              {diagnosisResult.totalIssues === 0 ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>数据完全健康</span>
                </>
              ) : (
                <>
                  <Info size={14} />
                  <span>扫描于 {new Date(diagnosisResult.scannedAt).toLocaleString('zh-CN')}</span>
                </>
              )}
            </div>
          </div>

          {Object.keys(diagnosisResult.byCategory).length > 0 && (
            <div className="health-category-bar">
              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const count = diagnosisResult.byCategory[cat] || 0;
                if (count === 0) return null;
                return (
                  <span
                    key={cat}
                    className={`health-category-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                  >
                    {label} ({count})
                  </span>
                );
              })}
              {selectedCategory !== 'all' && (
                <span className="health-category-chip reset" onClick={() => setSelectedCategory('all')}>
                  清除筛选
                </span>
              )}
            </div>
          )}

          <div className="health-filter-bar">
            <label><Filter size={14} />
              <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)}>
                <option value="all">全部严重级别</option>
                <option value={SEVERITY.CRITICAL}>严重</option>
                <option value={SEVERITY.WARNING}>警告</option>
                <option value={SEVERITY.INFO}>提示</option>
              </select>
            </label>
            <label><Filter size={14} />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="all">全部类别</option>
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <option key={cat} value={cat}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredIssues.length > 0 && (
            <div className="health-actions-bar">
              <label className="health-select-all">
                <input
                  type="checkbox"
                  checked={filteredIssues.length > 0 && filteredIssues.every((i) => selectedIssueIds.has(i.id))}
                  onChange={handleSelectAll}
                />
                <span>全选 ({selectedIssueIds.size}/{filteredIssues.length})</span>
              </label>
              {selectedIssueIds.size > 0 && (
                <button className="health-fix-btn" onClick={handlePreviewFix}>
                  <Wrench size={14} /> 预览修复 ({selectedIssueIds.size}项)
                </button>
              )}
            </div>
          )}

          {filteredIssues.length === 0 && diagnosisResult.totalIssues > 0 && (
            <p className="empty-tip">当前筛选条件下没有异常</p>
          )}

          {filteredIssues.length === 0 && diagnosisResult.totalIssues === 0 && (
            <div className="health-all-clean">
              <CheckCircle2 size={32} />
              <strong>所有数据检查通过</strong>
              <span>未发现数据一致性问题</span>
            </div>
          )}

          <div className="health-issues-list">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`health-issue-card ${getSeverityClass(issue.severity)} ${selectedIssueIds.has(issue.id) ? 'selected' : ''}`}
              >
                <div className="health-issue-head">
                  <label className="health-issue-check">
                    <input
                      type="checkbox"
                      checked={selectedIssueIds.has(issue.id)}
                      onChange={() => handleSelectIssue(issue.id)}
                    />
                  </label>
                  <span className={`health-severity-badge ${getSeverityClass(issue.severity)}`}>
                    {getSeverityIcon(issue.severity)}
                    {getSeverityLabel(issue.severity)}
                  </span>
                  <span className="health-category-badge">{CATEGORY_LABELS[issue.category]}</span>
                  <strong className="health-issue-title">{issue.title}</strong>
                  <button
                    className="ghost small health-expand-btn"
                    onClick={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
                  >
                    {expandedIssueId === issue.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {expandedIssueId === issue.id && (
                  <div className="health-issue-detail">
                    <p className="health-issue-desc">{issue.description}</p>
                    <div className="health-issue-fix-info">
                      <span className="health-fix-label"><Wrench size={12} /> 建议修复：{issue.fixLabel}</span>
                    </div>
                    {issue.entitySnapshot && (
                      <div className="health-issue-snapshot">
                        <span className="health-snapshot-title">关联数据快照：</span>
                        {issue.entityType === 'works' && (
                          <span>{issue.entitySnapshot.artist} — {issue.entitySnapshot.title} · ¥{Number(issue.entitySnapshot.price || 0).toLocaleString()} · {issue.entitySnapshot.exhibit} · {issue.entitySnapshot.sale} · {issue.entitySnapshot.settlement}</span>
                        )}
                        {issue.entityType === 'inquiries' && (
                          <span>{issue.entitySnapshot.name || issue.entitySnapshot.customerName} · {issue.entitySnapshot.phone || ''}</span>
                        )}
                        {issue.entityType === 'orders' && (
                          <span>{issue.entitySnapshot.workTitle} · {issue.entitySnapshot.customerName} · ¥{Number(issue.entitySnapshot.dealPrice || 0).toLocaleString()}</span>
                        )}
                        {issue.entityType === 'loans' && (
                          <span>{issue.entitySnapshot.workTitle} · {issue.entitySnapshot.borrower}</span>
                        )}
                        {issue.entityType === 'inventoryItems' && (
                          <span>任务: {issue.entitySnapshot.taskName} · {issue.entitySnapshot.workSnapshot?.title || '未知'}</span>
                        )}
                        {issue.entityType === 'statements' && (
                          <span>{issue.entitySnapshot.artist} · {issue.entitySnapshot.startDate}~{issue.entitySnapshot.endDate} · 应付¥{Number(issue.entitySnapshot.totalPayable || 0).toLocaleString()} · 已付¥{Number(issue.entitySnapshot.paidAmount || 0).toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {fixConfirmStep === 'preview' && fixPreview && (
            <div className="health-fix-preview">
              <div className="health-fix-preview-header">
                <h3><Eye size={16} /> 修复预览</h3>
                <span className="health-fix-summary">
                  将执行 {fixPreview.totalPatches} 项修改，影响 {fixPreview.totalAffectedEntities} 条记录
                </span>
              </div>

              <div className="health-fix-affected">
                <h4>影响范围</h4>
                <div className="health-fix-affected-list">
                  {fixPreview.affectedEntities.map((entity) => (
                    <span key={`${entity.entityType}-${entity.entityId}`} className="health-affected-chip">
                      {entity.entityLabel} ({entity.patchCount}项修改)
                    </span>
                  ))}
                </div>
              </div>

              <div className="health-fix-patches">
                <h4>修改明细</h4>
                <div className="health-fix-table-container">
                  <table className="health-fix-table">
                    <thead>
                      <tr>
                        <th>操作</th>
                        <th>对象</th>
                        <th>修改前</th>
                        <th>修改后</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixPreview.patches.map((patch, idx) => (
                        <tr key={idx}>
                          <td><span className={`health-fix-type-tag health-fix-type-${patch.fixType}`}>{patch.fixLabel}</span></td>
                          <td>{patch.entityLabel}</td>
                          <td className="health-before-cell">
                            {patch.before.exists === false ? '—' : Object.entries(patch.before).map(([k, v]) => (
                              <span key={k} className="health-field-pair">{k}: {v === null ? '空' : String(v)}</span>
                            ))}
                          </td>
                          <td className="health-after-cell">
                            {patch.after.exists === false ? '删除' : Object.entries(patch.after).map(([k, v]) => (
                              <span key={k} className="health-field-pair">{k}: {v === null ? '空' : String(v)}</span>
                            ))}
                          </td>
                          <td className="health-desc-cell">{patch.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="health-fix-confirm-area">
                <div className="form-hint">
                  <AlertTriangle size={12} /> 修复操作将直接写入 localStorage 并更新页面状态，建议先导出备份。
                </div>
                <div className="form-actions">
                  <button type="button" className="ghost" onClick={handleCancelFix}>取消</button>
                  <button type="button" onClick={handleConfirmFix}>
                    <CheckCircle2 size={14} /> 确认执行修复
                  </button>
                </div>
              </div>
            </div>
          )}

          {fixConfirmStep === 'done' && (
            <div className="health-fix-done">
              <CheckCircle2 size={24} />
              <strong>修复已完成</strong>
              <span>已执行 {fixPreview.totalPatches} 项修改，影响 {fixPreview.totalAffectedEntities} 条记录。数据已写回 localStorage。</span>
              <button className="ghost small" onClick={handleRescan}>
                <RefreshCw size={14} /> 重新扫描
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default DataHealthCenter;
