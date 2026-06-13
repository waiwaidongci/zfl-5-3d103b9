import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  XCircle,
  Info,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertCircle
} from 'lucide-react';
import {
  detectAllAnomalies,
  RULE_ID,
  SEVERITY,
  RULE_LABELS
} from './diagnosticRules.js';

function AnomalyList({
  works,
  orders,
  inquiries,
  statements,
  loans,
  inventoryTasks,
  followUps,
  onViewWorkDetail
}) {
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAnomalyId, setExpandedAnomalyId] = useState(null);

  const anomalyResult = useMemo(
    () => detectAllAnomalies(works, orders, inquiries, statements, loans, inventoryTasks, followUps),
    [works, orders, inquiries, statements, loans, inventoryTasks, followUps]
  );

  const filteredAnomalies = useMemo(() => {
    return anomalyResult.anomalies.filter((anomaly) => {
      if (selectedSeverity !== 'all' && anomaly.severity !== selectedSeverity) {
        return false;
      }
      if (selectedType !== 'all' && anomaly.ruleId !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${anomaly.workTitle || ''} ${anomaly.workArtist || ''} ${anomaly.customerName || ''} ${anomaly.description} ${anomaly.label || ''}`.toLowerCase();
        if (!text.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [anomalyResult.anomalies, selectedSeverity, selectedType, searchQuery]);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return <XCircle size={14} />;
      case SEVERITY.WARNING:
        return <AlertTriangle size={14} />;
      case SEVERITY.INFO:
        return <Info size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return 'anomaly-severity-critical';
      case SEVERITY.WARNING:
        return 'anomaly-severity-warning';
      case SEVERITY.INFO:
        return 'anomaly-severity-info';
      default:
        return '';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return '严重';
      case SEVERITY.WARNING:
        return '警告';
      case SEVERITY.INFO:
        return '提示';
      default:
        return severity;
    }
  };

  const getTypeCount = (type) => {
    return anomalyResult.summary.byType[type] || 0;
  };

  const availableTypes = Object.values(RULE_ID).filter(
    (type) => getTypeCount(type) > 0
  );

  return (
    <div className="anomaly-list-container">
      <div className="anomaly-list-header">
        <h3><AlertTriangle size={16} /> 异常检测结果</h3>
        <label>
          <Search size={16} />
          <input
            placeholder="搜索作品/客户/描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="anomaly-summary">
        <div className="anomaly-summary-item total">
          <span className="anomaly-summary-label">异常总数</span>
          <strong className="anomaly-summary-value">
            {anomalyResult.summary.total}
          </strong>
        </div>
        <div
          className={`anomaly-summary-item ${
            anomalyResult.summary.critical > 0 ? 'has-issues' : ''
          } critical`}
        >
          <XCircle size={14} />
          <span className="anomaly-summary-label">严重</span>
          <strong>{anomalyResult.summary.critical}</strong>
        </div>
        <div
          className={`anomaly-summary-item ${
            anomalyResult.summary.warning > 0 ? 'has-issues' : ''
          } warning`}
        >
          <AlertTriangle size={14} />
          <span className="anomaly-summary-label">警告</span>
          <strong>{anomalyResult.summary.warning}</strong>
        </div>
        <div
          className={`anomaly-summary-item ${
            anomalyResult.summary.info > 0 ? 'has-issues' : ''
          } info`}
        >
          <Info size={14} />
          <span className="anomaly-summary-label">提示</span>
          <strong>{anomalyResult.summary.info}</strong>
        </div>
        {anomalyResult.summary.total === 0 && (
          <div className="anomaly-summary-clean">
            <AlertCircle size={14} />
            <span>数据状态良好，未发现异常</span>
          </div>
        )}
      </div>

      {(availableTypes.length > 0 || selectedType !== 'all' || selectedSeverity !== 'all') && (
        <div className="anomaly-filter-bar">
          <label>
            <Filter size={14} />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="all">全部严重级别</option>
              <option value={SEVERITY.CRITICAL}>严重</option>
              <option value={SEVERITY.WARNING}>警告</option>
              <option value={SEVERITY.INFO}>提示</option>
            </select>
          </label>
          <label>
            <Filter size={14} />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">全部类型</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {RULE_LABELS[type] || type} ({getTypeCount(type)})
                </option>
              ))}
            </select>
          </label>
          {(selectedType !== 'all' || selectedSeverity !== 'all') && (
            <button
              className="ghost small"
              onClick={() => {
                setSelectedType('all');
                setSelectedSeverity('all');
              }}
            >
              清除筛选
            </button>
          )}
        </div>
      )}

      {filteredAnomalies.length === 0 ? (
        <p className="empty-tip">
          {anomalyResult.summary.total === 0
            ? '恭喜！当前数据没有发现异常'
            : '当前筛选条件下没有异常'}
        </p>
      ) : (
        <div className="anomaly-issues-list">
          {filteredAnomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`anomaly-issue-card ${getSeverityClass(
                anomaly.severity
              )}`}
            >
              <div className="anomaly-issue-head">
                <span
                  className={`anomaly-severity-badge ${getSeverityClass(
                    anomaly.severity
                  )}`}
                >
                  {getSeverityIcon(anomaly.severity)}
                  {getSeverityLabel(anomaly.severity)}
                </span>
                <span className="anomaly-type-badge">
                  {anomaly.label || anomaly.ruleId}
                </span>
                <strong className="anomaly-issue-title">
                  {anomaly.workTitle
                    ? `「${anomaly.workTitle}」`
                    : anomaly.workArtist
                    ? `「${anomaly.workArtist}」`
                    : ''}
                  {anomaly.label || anomaly.ruleId}
                </strong>
                <button
                  className="ghost small anomaly-expand-btn"
                  onClick={() =>
                    setExpandedAnomalyId(
                      expandedAnomalyId === anomaly.id ? null : anomaly.id
                    )
                  }
                >
                  {expandedAnomalyId === anomaly.id ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
              </div>

              {expandedAnomalyId === anomaly.id && (
                <div className="anomaly-issue-detail">
                  <p className="anomaly-issue-desc">{anomaly.description}</p>
                  <div className="anomaly-issue-fix">
                    <span className="anomaly-fix-label">
                      建议：{anomaly.suggestion}
                    </span>
                  </div>

                  {anomaly.daysOverdue && (
                    <div className="anomaly-overdue-info">
                      <span className="anomaly-overdue-days">
                        逾期 {anomaly.daysOverdue} 天
                      </span>
                      {anomaly.overdueAmount && (
                        <span className="anomaly-overdue-amount">
                          涉及金额：¥{anomaly.overdueAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="anomaly-issue-actions">
                    {anomaly.workId && onViewWorkDetail && (
                      <button
                        className="small"
                        onClick={() => onViewWorkDetail(anomaly.workId)}
                      >
                        <Eye size={12} /> 查看作品漏斗
                      </button>
                    )}
                    {anomaly.workId && anomaly.ruleId === RULE_ID.SOLD_WITHOUT_ORDER && (
                      <span className="anomaly-hint">
                        提示：可在作品详情中补录订单
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {anomalyResult.summary.total > 0 && (
        <div className="anomaly-footer-hint">
          <Info size={12} /> 异常数据会影响销售漏斗统计的准确性，建议及时处理
        </div>
      )}
    </div>
  );
}

export default AnomalyList;
