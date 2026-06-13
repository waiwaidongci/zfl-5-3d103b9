import React, { useMemo, useState, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Info,
  Filter,
  Search,
  MessageSquare,
  Receipt,
  Coins,
  FileText,
  ArrowLeft,
  Clock,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import {
  FUNNEL_STAGE_ORDER,
  FUNNEL_STAGE_LABELS,
  TIME_RANGE_PRESETS,
  TIME_RANGE_LABELS,
  calculateFunnelStats,
  calculateTimeDimensionFunnel
} from './funnelStats.js';
import { SEVERITY, RULE_LABELS } from './diagnosticRules.js';
import AnomalyList from './AnomalyList.jsx';
import WorkFunnelDetail from './WorkFunnelDetail.jsx';

const FUNNEL_VIEW_MODES = {
  CURRENT_STATUS: 'currentStatus',
  TIME_DIMENSION: 'timeDimension'
};

const FUNNEL_VIEW_LABELS = {
  [FUNNEL_VIEW_MODES.CURRENT_STATUS]: '当前状态',
  [FUNNEL_VIEW_MODES.TIME_DIMENSION]: '时间维度'
};

function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SalesFunnel({
  works,
  orders,
  inquiries,
  statements,
  loans,
  inventoryTasks,
  selectedWorkId: propSelectedWorkId,
  onBack,
  onViewWorkDetail,
  onOpenOrderForWork
}) {
  const [selectedStage, setSelectedStage] = useState(null);
  const [internalSelectedWorkId, setInternalSelectedWorkId] = useState(null);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(FUNNEL_VIEW_MODES.CURRENT_STATUS);
  const [timePreset, setTimePreset] = useState(TIME_RANGE_PRESETS.THIS_MONTH);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customDateError, setCustomDateError] = useState(null);

  const validateCustomDateRange = useCallback((start, end) => {
    if (timePreset !== TIME_RANGE_PRESETS.CUSTOM) {
      setCustomDateError(null);
      return true;
    }
    if (!start || !end) {
      setCustomDateError('请选择完整的开始和结束日期');
      return false;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setCustomDateError('日期格式不合法');
      return false;
    }
    if (startDate > endDate) {
      setCustomDateError('开始日期不能晚于结束日期');
      return false;
    }
    setCustomDateError(null);
    return true;
  }, [timePreset]);

  const handleCustomStartChange = useCallback((value) => {
    setCustomStartDate(value);
    validateCustomDateRange(value, customEndDate);
    setSelectedStage(null);
  }, [customEndDate, validateCustomDateRange]);

  const handleCustomEndChange = useCallback((value) => {
    setCustomEndDate(value);
    validateCustomDateRange(customStartDate, value);
    setSelectedStage(null);
  }, [customStartDate, validateCustomDateRange]);

  const handleTimePresetChange = useCallback((preset) => {
    setTimePreset(preset);
    setSelectedStage(null);
    if (preset !== TIME_RANGE_PRESETS.CUSTOM) {
      setCustomDateError(null);
    } else {
      validateCustomDateRange(customStartDate, customEndDate);
    }
  }, [customStartDate, customEndDate, validateCustomDateRange]);

  const selectedWorkId = propSelectedWorkId ?? internalSelectedWorkId;

  const handleSelectWork = useCallback((workId) => {
    if (onViewWorkDetail) {
      onViewWorkDetail(workId);
    } else {
      setInternalSelectedWorkId(workId);
    }
  }, [onViewWorkDetail]);

  const handleBackFromDetail = useCallback(() => {
    if (onViewWorkDetail) {
      onViewWorkDetail(null);
    } else {
      setInternalSelectedWorkId(null);
    }
  }, [onViewWorkDetail]);

  const funnelStats = useMemo(
    () => calculateFunnelStats(works, orders, inquiries, statements),
    [works, orders, inquiries, statements]
  );

  const timeDimensionStats = useMemo(() => {
    if (timePreset === TIME_RANGE_PRESETS.CUSTOM && customDateError) {
      return {
        range: { start: null, end: null, startDate: null, endDate: null },
        preset: timePreset,
        stages: [
          { stage: 'inquiry', label: '询价', count: 0, amount: 0, works: [] },
          { stage: 'booking', label: '预订', count: 0, amount: 0, works: [] },
          { stage: 'deal', label: '成交', count: 0, amount: 0, works: [] },
          { stage: 'settlement', label: '结算', count: 0, amount: 0, works: [] }
        ],
        conversionRates: [
          { stage: 'inquiry', fromPrevious: null, fromFirst: null },
          { stage: 'booking', fromPrevious: 0, fromFirst: 0 },
          { stage: 'deal', fromPrevious: 0, fromFirst: 0 },
          { stage: 'settlement', fromPrevious: 0, fromFirst: 0 }
        ],
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
        },
        _invalidDateRange: true
      };
    }
    return calculateTimeDimensionFunnel(
      works, orders, inquiries, statements,
      timePreset, customStartDate, customEndDate
    );
  }, [works, orders, inquiries, statements, timePreset, customStartDate, customEndDate, customDateError]);

  const activeStats = viewMode === FUNNEL_VIEW_MODES.TIME_DIMENSION
    ? timeDimensionStats
    : funnelStats;

  const filteredStageWorks = useMemo(() => {
    if (!selectedStage) return [];
    const stageData = activeStats.stages.find(
      (s) => s.stage === selectedStage
    );
    if (!stageData) return [];

    const query = workSearchQuery.trim().toLowerCase();
    if (!query) return stageData.works;

    return stageData.works.filter(
      (w) =>
        w.title.toLowerCase().includes(query) ||
        w.artist.toLowerCase().includes(query)
    );
  }, [selectedStage, activeStats.stages, workSearchQuery]);

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'inquiry':
        return <MessageSquare size={20} />;
      case 'booking':
        return <Calendar size={20} />;
      case 'deal':
        return <Receipt size={20} />;
      case 'settlement':
        return <FileText size={20} />;
      default:
        return <TrendingUp size={20} />;
    }
  };

  const getStageColorClass = (stage, index) => {
    const colors = [
      'funnel-stage-inquiry',
      'funnel-stage-booking',
      'funnel-stage-deal',
      'funnel-stage-settlement'
    ];
    return colors[index] || '';
  };

  const renderTimeRangePresetButtons = () => (
    <div className="time-range-presets">
      {Object.entries(TIME_RANGE_PRESETS).map(([key, value]) => (
        <button
          key={value}
          type="button"
          className={`time-preset-btn ${timePreset === value ? 'active' : ''}`}
          onClick={() => handleTimePresetChange(value)}
        >
          {TIME_RANGE_LABELS[value]}
        </button>
      ))}
      {timePreset === TIME_RANGE_PRESETS.CUSTOM && (
        <div className="custom-date-inputs">
          <label>
            <span>开始</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className={customDateError ? 'error' : ''}
            />
          </label>
          <label>
            <span>结束</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className={customDateError ? 'error' : ''}
            />
          </label>
          {customDateError && (
            <span className="custom-date-error">
              <AlertTriangle size={12} /> {customDateError}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const renderTimeDimensionSummary = () => {
    const { summary } = timeDimensionStats;
    const { range } = timeDimensionStats;
    const isInvalidRange = timeDimensionStats._invalidDateRange;
    const rangeLabel = (() => {
      if (isInvalidRange) return '日期范围无效';
      if (timePreset !== TIME_RANGE_PRESETS.CUSTOM) {
        return TIME_RANGE_LABELS[timePreset];
      }
      const start = customStartDate ? new Date(customStartDate).toLocaleDateString('zh-CN') : '';
      const end = customEndDate ? new Date(customEndDate).toLocaleDateString('zh-CN') : '';
      return start && end ? `${start} ~ ${end}` : '请选择日期范围';
    })();

    return (
      <div className="time-funnel-summary">
        <div className="time-funnel-header-info">
          <span className={`time-range-label ${isInvalidRange ? 'invalid' : ''}`}>
            <Calendar size={14} /> {rangeLabel}
          </span>
          {isInvalidRange && (
            <span className="time-stat-chip warning">
              <AlertTriangle size={12} /> 请修正日期范围后查看统计
            </span>
          )}
          {!isInvalidRange && summary.cancelledCount > 0 && (
            <span className="time-stat-chip cancelled">
              <XCircle size={12} /> 撤销订单 {summary.cancelledCount} 单
            </span>
          )}
          {!isInvalidRange && summary.missingLogsCount > 0 && (
            <span className="time-stat-chip warning">
              <AlertTriangle size={12} /> 历史数据缺日志 {summary.missingLogsCount} 条
            </span>
          )}
        </div>

        <div className="time-funnel-stats-grid">
          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <MessageSquare size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">询价数</span>
              <strong className="time-stat-value">{summary.inquiryCount}</strong>
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <Calendar size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">预订数</span>
              <strong className="time-stat-value">{summary.bookingCount}</strong>
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              <Receipt size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">成交数</span>
              <strong className="time-stat-value" style={{ color: '#15803d' }}>{summary.dealCount}</strong>
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>
              <FileText size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">结算数</span>
              <strong className="time-stat-value">{summary.settlementCount}</strong>
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              <Coins size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">成交金额</span>
              <strong className="time-stat-value amount">
                ¥{summary.dealAmount.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>
              <Clock size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">平均成交周期</span>
              <strong className="time-stat-value">
                {summary.averageDealCycle !== null
                  ? `${summary.averageDealCycle}天`
                  : '—'}
              </strong>
              {summary.dealCycleSampleCount > 0 && (
                <span className="time-stat-sub">样本 {summary.dealCycleSampleCount}</span>
              )}
            </div>
          </div>

          <div className="time-stat-card">
            <div className="time-stat-icon" style={{ background: '#fce7f3', color: '#9d174d' }}>
              <RefreshCw size={18} />
            </div>
            <div className="time-stat-info">
              <span className="time-stat-label">尾款回收周期</span>
              <strong className="time-stat-value">
                {summary.averageBalanceCycle !== null
                  ? `${summary.averageBalanceCycle}天`
                  : '—'}
              </strong>
              {summary.balanceCycleSampleCount > 0 && (
                <span className="time-stat-sub">样本 {summary.balanceCycleSampleCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (selectedWorkId) {
    return (
      <WorkFunnelDetail
        workId={selectedWorkId}
        works={works}
        orders={orders}
        inquiries={inquiries}
        statements={statements}
        loans={loans}
        inventoryTasks={inventoryTasks}
        onBack={handleBackFromDetail}
        onOpenOrderForWork={onOpenOrderForWork}
      />
    );
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <h2>
          {onBack && (
            <button
              className="ghost small"
              style={{ marginRight: '8px' }}
              onClick={onBack}
            >
              <ArrowLeft size={14} /> 返回
            </button>
          )}
          <TrendingUp size={18} /> 销售漏斗
        </h2>
        <div></div>
        <div className="toolbar-right">
          <button
            className="ghost"
            onClick={() => setShowAnomalies(!showAnomalies)}
          >
            <AlertTriangle size={14} /> 异常检测
          </button>
        </div>
      </div>

      <div className="funnel-view-switcher">
        <button
          type="button"
          className={`view-mode-btn ${viewMode === FUNNEL_VIEW_MODES.CURRENT_STATUS ? 'active' : ''}`}
          onClick={() => {
            setViewMode(FUNNEL_VIEW_MODES.CURRENT_STATUS);
            setSelectedStage(null);
          }}
        >
          <BarChart3 size={14} /> 当前状态
        </button>
        <button
          type="button"
          className={`view-mode-btn ${viewMode === FUNNEL_VIEW_MODES.TIME_DIMENSION ? 'active' : ''}`}
          onClick={() => {
            setViewMode(FUNNEL_VIEW_MODES.TIME_DIMENSION);
            setSelectedStage(null);
          }}
        >
          <Clock size={14} /> 时间维度
        </button>
      </div>

      {viewMode === FUNNEL_VIEW_MODES.TIME_DIMENSION && (
        <div className="time-filter-section">
          {renderTimeRangePresetButtons()}
        </div>
      )}

      {viewMode === FUNNEL_VIEW_MODES.TIME_DIMENSION ? (
        renderTimeDimensionSummary()
      ) : (
        <div className="funnel-overview-stats">
          <div className="funnel-stat-card">
            <div
              className="funnel-stat-icon"
              style={{ background: '#dbeafe', color: '#1d4ed8' }}
            >
              <Users size={20} />
            </div>
            <div className="funnel-stat-info">
              <span className="funnel-stat-label">总作品数</span>
              <strong className="funnel-stat-value">{works.length}件</strong>
            </div>
          </div>
          <div className="funnel-stat-card">
            <div
              className="funnel-stat-icon"
              style={{ background: '#dcfce7', color: '#15803d' }}
            >
              <Receipt size={20} />
            </div>
            <div className="funnel-stat-info">
              <span className="funnel-stat-label">成交总额</span>
              <strong className="funnel-stat-value" style={{ color: '#15803d' }}>
                ¥{funnelStats.summary.totalDealAmount.toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="funnel-stat-card">
            <div
              className="funnel-stat-icon"
              style={{ background: '#fef3c7', color: '#92400e' }}
            >
              <Coins size={20} />
            </div>
            <div className="funnel-stat-info">
              <span className="funnel-stat-label">已结算</span>
              <strong className="funnel-stat-value" style={{ color: '#92400e' }}>
                ¥{funnelStats.summary.totalSettledAmount.toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="funnel-stat-card">
            <div
              className="funnel-stat-icon"
              style={{ background: '#fee2e2', color: '#991b1b' }}
            >
              <AlertTriangle size={20} />
            </div>
            <div className="funnel-stat-info">
              <span className="funnel-stat-label">待结算</span>
              <strong className="funnel-stat-value" style={{ color: '#991b1b' }}>
                ¥{funnelStats.summary.pendingSettlementAmount.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="funnel-stage-container">
        {activeStats.stages.map((stage, index) => {
          const conversion = activeStats.conversionRates[index];
          const widthPercent =
            index === 0
              ? 100
              : Math.max(
                  30,
                  (stage.count /
                    Math.max(activeStats.stages[0].count, 1)) *
                    100
                );
          return (
            <div
              key={stage.stage}
              className={`funnel-stage-card ${getStageColorClass(
                stage.stage,
                index
              )} ${selectedStage === stage.stage ? 'active' : ''}`}
              onClick={() =>
                setSelectedStage(
                  selectedStage === stage.stage ? null : stage.stage
                )
              }
            >
              <div
                className="funnel-stage-bar"
                style={{ width: `${widthPercent}%` }}
              >
                <div className="funnel-stage-header">
                  <div className="funnel-stage-icon">
                    {getStageIcon(stage.stage)}
                  </div>
                  <div className="funnel-stage-title">
                    <strong>{FUNNEL_STAGE_LABELS[stage.stage]}</strong>
                    <span>
                      {stage.count}件
                      {stage.amount > 0 && ` · ¥${stage.amount.toLocaleString()}`}
                    </span>
                  </div>
                </div>
                {conversion && conversion.fromPrevious !== null && (
                  <div className="funnel-conversion">
                    <ChevronRight size={14} />
                    <span>
                      转化率 {conversion.fromPrevious}%
                      {conversion.fromFirst !== null &&
                        conversion.fromPrevious !== conversion.fromFirst && (
                          <span className="funnel-conversion-sub">
                            （从询价 {conversion.fromFirst}%）
                          </span>
                        )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedStage && (
        <div className="funnel-stage-works">
          <div className="toolbar">
            <h3>
              {FUNNEL_STAGE_LABELS[selectedStage]}阶段作品（
              {filteredStageWorks.length}件）
            </h3>
            <label>
              <Search size={16} />
              <input
                placeholder="搜索作品/艺术家"
                value={workSearchQuery}
                onChange={(e) => setWorkSearchQuery(e.target.value)}
              />
            </label>
            <div></div>
          </div>

          {filteredStageWorks.length === 0 ? (
            <p className="empty-tip">
              {workSearchQuery
                ? '没有匹配的作品'
                : '该阶段暂无作品'}
            </p>
          ) : (
            <div className="funnel-works-grid">
              {filteredStageWorks.map((work) => {
                const hasOrder = orders.some(
                  (o) => o.workId === work.id && !o.cancelledAt
                );
                const workInquiries = inquiries.filter(
                  (i) => i.workId === work.id
                );
                const stageDates = work._stageDates;
                return (
                  <article
                    key={work.id}
                    className="funnel-work-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectWork(work.id);
                    }}
                  >
                    <strong>{work.title}</strong>
                    <span className="funnel-work-artist">
                      {work.artist}
                    </span>
                    <div className="funnel-work-price">
                      ¥
                      {Number(
                        work.dealPrice || work.price || 0
                      ).toLocaleString()}
                    </div>
                    <div className="funnel-work-meta">
                      {workInquiries.length > 0 && (
                        <span className="funnel-meta-tag">
                          <MessageSquare size={12} />
                          {workInquiries.length}次询价
                        </span>
                      )}
                      {hasOrder && (
                        <span className="funnel-meta-tag has-order">
                          <Receipt size={12} />
                          已下单
                        </span>
                      )}
                      {work.sale && (
                        <span className="funnel-meta-tag">
                          {work.sale}
                        </span>
                      )}
                    </div>
                    {viewMode === FUNNEL_VIEW_MODES.TIME_DIMENSION && stageDates && (
                      <div className="work-time-dates">
                        {stageDates.inquiryDate && (
                          <span className="work-date-tag">
                            <MessageSquare size={10} />
                            询价 {new Date(stageDates.inquiryDate).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {stageDates.dealDate && (
                          <span className="work-date-tag">
                            <Receipt size={10} />
                            成交 {new Date(stageDates.dealDate).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {stageDates.settlementDate && (
                          <span className="work-date-tag">
                            <FileText size={10} />
                            结算 {new Date(stageDates.settlementDate).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {stageDates.hasMissingLogs && (
                          <span className="work-date-tag warning">
                            <AlertTriangle size={10} /> 缺日志
                          </span>
                        )}
                      </div>
                    )}
                    <div className="funnel-work-actions">
                      <button
                        className="ghost small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectWork(work.id);
                        }}
                      >
                        查看漏斗详情
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAnomalies && (
        <div className="funnel-anomalies-section">
          <AnomalyList
            works={works}
            orders={orders}
            inquiries={inquiries}
            statements={statements}
            loans={loans}
            inventoryTasks={inventoryTasks}
            onViewWorkDetail={(workId) => {
              setShowAnomalies(false);
              handleSelectWork(workId);
            }}
          />
        </div>
      )}
    </section>
  );
}

export default SalesFunnel;
