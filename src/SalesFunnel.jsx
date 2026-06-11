import React, { useMemo, useState } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import {
  FUNNEL_STAGE_ORDER,
  FUNNEL_STAGE_LABELS,
  calculateFunnelStats
} from './funnelStats.js';
import { ANOMALY_SEVERITY, ANOMALY_LABELS } from './funnelAnomalies.js';
import AnomalyList from './AnomalyList.jsx';
import WorkFunnelDetail from './WorkFunnelDetail.jsx';

function SalesFunnel({
  works,
  orders,
  inquiries,
  statements,
  onBack,
  onViewWorkDetail,
  onOpenOrderForWork
}) {
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [workSearchQuery, setWorkSearchQuery] = useState('');

  const funnelStats = useMemo(
    () => calculateFunnelStats(works, orders, inquiries, statements),
    [works, orders, inquiries, statements]
  );

  const filteredStageWorks = useMemo(() => {
    if (!selectedStage) return [];
    const stageData = funnelStats.stages.find(
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
  }, [selectedStage, funnelStats.stages, workSearchQuery]);

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

  if (selectedWorkId) {
    return (
      <WorkFunnelDetail
        workId={selectedWorkId}
        works={works}
        orders={orders}
        inquiries={inquiries}
        statements={statements}
        onBack={() => setSelectedWorkId(null)}
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

      <div className="funnel-stage-container">
        {funnelStats.stages.map((stage, index) => {
          const conversion = funnelStats.conversionRates[index];
          const widthPercent =
            index === 0
              ? 100
              : Math.max(
                  30,
                  (stage.count /
                    Math.max(funnelStats.stages[0].count, 1)) *
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
                      {stage.count}件 · ¥{stage.amount.toLocaleString()}
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
                return (
                  <article
                    key={work.id}
                    className="funnel-work-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewWorkDetail) {
                        onViewWorkDetail(work.id);
                      } else {
                        setSelectedWorkId(work.id);
                      }
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
                    <div className="funnel-work-actions">
                      <button
                        className="ghost small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewWorkDetail) {
                            onViewWorkDetail(work.id);
                          } else {
                            setSelectedWorkId(work.id);
                          }
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
            onViewWorkDetail={(workId) => {
              setShowAnomalies(false);
              if (onViewWorkDetail) {
                onViewWorkDetail(workId);
              } else {
                setSelectedWorkId(workId);
              }
            }}
          />
        </div>
      )}
    </section>
  );
}

export default SalesFunnel;
