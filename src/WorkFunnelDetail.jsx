import React, { useMemo } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
  Receipt,
  FileText,
  User,
  Phone,
  Banknote,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Info,
  ChevronRight,
  Pencil
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGE_ORDER,
  getWorkFunnelDetail
} from './funnelStats.js';
import { detectAllAnomalies, SEVERITY, RULE_LABELS } from './diagnosticRules.js';

function WorkFunnelDetail({
  workId,
  works,
  orders,
  inquiries,
  statements,
  loans,
  inventoryTasks,
  onBack,
  onOpenOrderForWork
}) {
  const funnelDetail = useMemo(
    () => getWorkFunnelDetail(workId, works, orders, inquiries, statements),
    [workId, works, orders, inquiries, statements]
  );

  const workAnomalies = useMemo(() => {
    if (!funnelDetail) return [];
    const result = detectAllAnomalies(works, orders, inquiries, statements, loans, inventoryTasks);
    return result.anomalies.filter(
      (a) => a.workId === workId || a.orderId === funnelDetail.activeOrder?.id
    );
  }, [funnelDetail, works, orders, inquiries, statements, loans, inventoryTasks, workId]);

  if (!funnelDetail) {
    return (
      <section className="panel">
        <div className="toolbar">
          <h2>
            <button className="ghost small" style={{ marginRight: '8px' }} onClick={onBack}>
              <ArrowLeft size={14} /> 返回
            </button>
            作品漏斗详情
          </h2>
          <div></div>
          <div></div>
        </div>
        <p className="empty-tip">未找到该作品</p>
      </section>
    );
  }

  const { work, currentStage, currentStageLabel, inquiries: workInquiries, activeOrder, cancelledOrders, statements: workStatements, dealPrice, deposit, balance, balanceStatus, stageHistory } = funnelDetail;

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return <XCircle size={14} />;
      case SEVERITY.WARNING:
        return <AlertCircle size={14} />;
      case SEVERITY.INFO:
        return <Info size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return 'funnel-anomaly-critical';
      case SEVERITY.WARNING:
        return 'funnel-anomaly-warning';
      case SEVERITY.INFO:
        return 'funnel-anomaly-info';
      default:
        return '';
    }
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <h2>
          <button className="ghost small" style={{ marginRight: '8px' }} onClick={onBack}>
            <ArrowLeft size={14} /> 返回
          </button>
          作品漏斗详情
        </h2>
        <div></div>
        <div className="toolbar-right">
          {!activeOrder && (
            <button onClick={() => onOpenOrderForWork && onOpenOrderForWork(work.id)}>
              <Receipt size={14} /> 登记销售
            </button>
          )}
        </div>
      </div>

      <div className="work-funnel-header">
        <div className="work-funnel-basic">
          <h3 className="work-funnel-title">{work.title}</h3>
          <p className="work-funnel-artist">{work.artist} · 入库 {work.inDate}</p>
          <div className="work-funnel-status-row">
            <span className={`status-tag work-funnel-stage-tag stage-${currentStage || 'none'}`}>
              {currentStage === FUNNEL_STAGES.INQUIRY && <MessageSquare size={14} />}
              {currentStage === FUNNEL_STAGES.BOOKING && <Calendar size={14} />}
              {currentStage === FUNNEL_STAGES.DEAL && <Receipt size={14} />}
              {currentStage === FUNNEL_STAGES.SETTLEMENT && <FileText size={14} />}
              当前阶段：{currentStageLabel}
            </span>
            <span className="work-funnel-price">
              成交价：<strong>¥{dealPrice.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {workAnomalies.length > 0 && (
          <div className="work-funnel-anomalies">
            <h4><AlertCircle size={14} /> 检测到 {workAnomalies.length} 个异常</h4>
            <div className="work-anomaly-list">
              {workAnomalies.map((anomaly) => (
                <div key={anomaly.id} className={`work-anomaly-item ${getSeverityClass(anomaly.severity)}`}>
                  {getSeverityIcon(anomaly.severity)}
                  <div>
                    <strong>{anomaly.label || anomaly.ruleId}</strong>
                    <p>{anomaly.description}</p>
                    <span className="work-anomaly-suggestion">建议：{anomaly.suggestion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="funnel-stage-timeline">
        <h4 className="funnel-section-title">阶段历程</h4>
        <div className="stage-timeline">
          {FUNNEL_STAGE_ORDER.map((stage, index) => {
            const stageLabel = FUNNEL_STAGE_LABELS[stage];
            const historyItem = stageHistory.find((h) => h.stage === stage);
            const isCompleted = !!historyItem;
            const isCurrent = currentStage === stage;

            return (
              <div key={stage} className={`timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="timeline-node">
                  {isCompleted ? (
                    <CheckCircle2 size={18} />
                  ) : isCurrent ? (
                    <Clock size={18} />
                  ) : (
                    <div className="timeline-node-pending" />
                  )}
                </div>
                <div className="timeline-content">
                  <div className="timeline-stage">
                    <strong>{stageLabel}</strong>
                    {isCurrent && <span className="timeline-current-tag">当前阶段</span>}
                  </div>
                  {historyItem ? (
                    <>
                      <p className="timeline-desc">{historyItem.description}</p>
                      <span className="timeline-date">
                        {new Date(historyItem.date).toLocaleString('zh-CN')}
                      </span>
                    </>
                  ) : (
                    <p className="timeline-pending">尚未进入此阶段</p>
                  )}
                </div>
                {index < FUNNEL_STAGE_ORDER.length - 1 && (
                  <div className={`timeline-connector ${isCompleted ? 'completed' : ''}`}>
                    <ChevronRight size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeOrder && (
        <div className="funnel-order-section">
          <h4 className="funnel-section-title">
            <Receipt size={16} /> 订单信息
          </h4>
          <div className="funnel-order-card">
            <div className="funnel-order-header">
              <div>
                <strong className="funnel-order-customer">
                  <User size={14} /> {activeOrder.customerName}
                </strong>
                <span className="funnel-order-contact">
                  <Phone size={12} /> {activeOrder.customerPhone}
                </span>
              </div>
              <span className={`status-select status-balance-${balanceStatus}`}>
                {balanceStatus}
              </span>
            </div>
            <div className="funnel-order-amounts">
              <div className="amount-item">
                <span className="amount-label">成交价</span>
                <strong className="amount-value">¥{dealPrice.toLocaleString()}</strong>
              </div>
              <div className="amount-item">
                <span className="amount-label">已收订金</span>
                <strong className="amount-value" style={{ color: '#15803d' }}>¥{deposit.toLocaleString()}</strong>
              </div>
              <div className="amount-item">
                <span className="amount-label">待收尾款</span>
                <strong className={`amount-value ${balance > 0 ? 'amount-pending' : 'amount-paid'}`}>
                  ¥{balance.toLocaleString()}
                </strong>
              </div>
            </div>
            <div className="funnel-order-meta">
              <span><Calendar size={12} /> 成交日期：{activeOrder.dealDate}</span>
              {activeOrder.note && <span><Info size={12} /> 备注：{activeOrder.note}</span>}
            </div>
          </div>
        </div>
      )}

      {workInquiries.length > 0 && (
        <div className="funnel-inquiries-section">
          <h4 className="funnel-section-title">
            <MessageSquare size={16} /> 询价记录（{workInquiries.length}条）
          </h4>
          <div className="funnel-inquiries-list">
            {workInquiries.map((inq) => (
              <div key={inq.id} className="funnel-inquiry-item">
                <div className="funnel-inquiry-head">
                  <div>
                    <strong>{inq.customerName}</strong>
                    <span className="funnel-inquiry-contact">
                      <Phone size={12} /> {inq.customerPhone}
                    </span>
                  </div>
                  <span className={`status-select status-${inq.status}`}>
                    {inq.status}
                  </span>
                </div>
                <div className="funnel-inquiry-body">
                  {inq.intendedPrice > 0 && (
                    <span className="inquiry-price">
                      <Banknote size={12} /> 意向价 ¥{inq.intendedPrice.toLocaleString()}
                    </span>
                  )}
                  {inq.remark && (
                    <span className="inquiry-remark">
                      <MessageSquare size={12} /> {inq.remark}
                    </span>
                  )}
                  <span className="inquiry-date">
                    {new Date(inq.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelledOrders.length > 0 && (
        <div className="funnel-cancelled-section">
          <h4 className="funnel-section-title">
            <XCircle size={16} /> 已撤销订单（{cancelledOrders.length}条）
          </h4>
          <div className="funnel-inquiries-list">
            {cancelledOrders.map((order) => (
              <div key={order.id} className="funnel-inquiry-item order-cancelled">
                <div className="funnel-inquiry-head">
                  <div>
                    <strong>{order.customerName}</strong>
                    <span className="funnel-inquiry-contact">
                      <Phone size={12} /> {order.customerPhone}
                    </span>
                  </div>
                  <span className="status-select status-已放弃">
                    <XCircle size={12} /> 已撤销
                  </span>
                </div>
                <div className="funnel-inquiry-body">
                  <span>
                    <Banknote size={12} /> 成交价 ¥{Number(order.dealPrice || 0).toLocaleString()}
                  </span>
                  <span>
                    <Coins size={12} /> 订金 ¥{Number(order.deposit || 0).toLocaleString()}
                  </span>
                  <span className="inquiry-date">
                    撤销于 {new Date(order.cancelledAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workStatements.length > 0 && (
        <div className="funnel-statements-section">
          <h4 className="funnel-section-title">
            <FileText size={16} /> 对账单记录（{workStatements.length}条）
          </h4>
          <div className="funnel-statements-list">
            {workStatements.map((stmt) => {
              const item = stmt.items.find((i) => i.workId === work.id);
              return (
                <div key={stmt.id} className={`funnel-statement-card ${stmt.confirmed ? 'confirmed' : 'pending'}`}>
                  <div className="funnel-statement-head">
                    <div>
                      <strong>{stmt.artist}</strong>
                      <span className="funnel-statement-period">
                        {stmt.startDate} 至 {stmt.endDate}
                      </span>
                    </div>
                    <span className={`status-tag ${stmt.confirmed ? 'status-confirmed' : 'status-unconfirmed'}`}>
                      {stmt.confirmed ? (
                        <><CheckCircle2 size={12} /> 已确认</>
                      ) : (
                        <><Clock size={12} /> 待确认</>
                      )}
                    </span>
                  </div>
                  {item && (
                    <div className="funnel-statement-amounts">
                      <span>成交价：¥{item.dealPrice.toLocaleString()}</span>
                      <span className="text-purple">佣金：¥{item.commission.toLocaleString()}</span>
                      <span className="text-green">应付：¥{item.payable.toLocaleString()}</span>
                    </div>
                  )}
                  <span className="funnel-statement-date">
                    创建于 {new Date(stmt.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="funnel-work-meta-section">
        <h4 className="funnel-section-title">作品信息</h4>
        <div className="funnel-work-meta-grid">
          <div className="meta-item">
            <span className="meta-label">展态</span>
            <span className="meta-value">{work.exhibit}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">销售状态</span>
            <span className="meta-value">{work.sale}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">结算状态</span>
            <span className={`meta-value settlement-${work.settlement}`}>{work.settlement}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">寄售价格</span>
            <span className="meta-value">¥{Number(work.price || 0).toLocaleString()}</span>
          </div>
          {work.saleDate && (
            <div className="meta-item">
              <span className="meta-label">售出日期</span>
              <span className="meta-value">{work.saleDate}</span>
            </div>
          )}
          {work.settlementDate && (
            <div className="meta-item">
              <span className="meta-label">结算日期</span>
              <span className="meta-value">{work.settlementDate}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default WorkFunnelDetail;
