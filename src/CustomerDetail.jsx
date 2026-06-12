import React, { useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  MessageSquare,
  Receipt,
  Banknote,
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  Plus,
  CheckCircle2,
  XCircle,
  Package,
  History
} from 'lucide-react';
import { CUSTOMER_STATUS } from './customerUtils.js';

function CustomerDetail({
  customer,
  works,
  onBack,
  onViewWorkFunnel,
  onOpenOrderForWork,
  onOpenInquiryForWork
}) {
  const sortedInquiries = useMemo(() => {
    return [...customer.inquiries].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [customer.inquiries]);

  const sortedOrders = useMemo(() => {
    return [...customer.orders].sort(
      (a, b) => new Date(b.dealDate || b.createdAt) - new Date(a.dealDate || a.createdAt)
    );
  }, [customer.orders]);

  const dealedWorks = useMemo(() => {
    return sortedOrders.map((order) => {
      const work = works.find((w) => w.id === order.workId);
      return { order, work };
    });
  }, [sortedOrders, works]);

  const recentActivity = useMemo(() => {
    const activities = [];
    customer.inquiries.forEach((inq) => {
      activities.push({
        type: 'inquiry',
        time: new Date(inq.createdAt).getTime(),
        date: inq.createdAt,
        workTitle: inq.workTitle,
        workId: inq.workId,
        description: '客户询价',
        status: inq.status,
        intendedPrice: inq.intendedPrice,
        remark: inq.remark
      });
    });
    customer.orders.forEach((order) => {
      activities.push({
        type: 'order',
        time: new Date(order.dealDate || order.createdAt).getTime(),
        date: order.dealDate || order.createdAt,
        workTitle: order.workTitle,
        workId: order.workId,
        description: '完成成交',
        dealPrice: order.dealPrice,
        balanceStatus: order.balanceStatus
      });
    });
    return activities.sort((a, b) => b.time - a.time).slice(0, 10);
  }, [customer.inquiries, customer.orders]);

  const pendingFollowUps = useMemo(() => {
    return sortedInquiries.filter(
      (inq) => inq.status === '待跟进' || inq.status === '跟进中'
    );
  }, [sortedInquiries]);

  const getStatusClass = (status) => {
    switch (status) {
      case CUSTOMER_STATUS.DEALED:
        return 'status-已成交';
      case CUSTOMER_STATUS.FOLLOWING:
        return 'status-跟进中';
      case CUSTOMER_STATUS.NEW:
        return 'status-待跟进';
      case CUSTOMER_STATUS.INACTIVE:
        return 'status-已放弃';
      default:
        return '';
    }
  };

  const getWorkForInquiry = (inquiry) => {
    return works.find((w) => w.id === inquiry.workId);
  };

  const getInquiryStatusClass = (status) => {
    switch (status) {
      case '待跟进':
        return 'status-待跟进';
      case '跟进中':
        return 'status-跟进中';
      case '已成交':
        return 'status-已成交';
      case '已放弃':
        return 'status-已放弃';
      default:
        return '';
    }
  };

  if (!customer) {
    return (
      <section className="panel">
        <p className="empty-tip">未找到客户信息</p>
      </section>
    );
  }

  return (
    <section className="panel customer-detail-panel">
      <div className="toolbar">
        <h2>
          <button
            className="ghost small"
            style={{ marginRight: '8px' }}
            onClick={onBack}
          >
            <ArrowLeft size={14} /> 返回
          </button>
          <User size={18} /> 客户详情
        </h2>
        <div></div>
        <div className="toolbar-right">
          <button onClick={() => onOpenInquiryForWork && onOpenInquiryForWork(null, customer.name, customer.phone)}>
            <Plus size={14} /> 登记询价
          </button>
        </div>
      </div>

      <div className="customer-detail-header">
        <div className="customer-detail-basic">
          <h3 className="customer-detail-name">{customer.name}</h3>
          <span className="customer-detail-contact">
            <Phone size={14} /> {customer.phone}
          </span>
          <div className="customer-detail-status-row">
            <span className={`status-select ${getStatusClass(customer.followStatus)}`}>
              {customer.followStatus}
            </span>
            <span className="customer-detail-amount">
              <Banknote size={14} /> 累计成交{' '}
              <strong>¥{customer.totalDealAmount.toLocaleString()}</strong>
            </span>
            {customer.lastActiveAt && (
              <span className="customer-detail-last-active">
                <Clock size={14} /> 最近活跃{' '}
                {new Date(customer.lastActiveAt).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
        </div>
        <div className="customer-detail-stats">
          <div className="customer-detail-stat">
            <MessageSquare size={18} />
            <div>
              <strong>{customer.inquiryCount}</strong>
              <span>询价次数</span>
            </div>
          </div>
          <div className="customer-detail-stat">
            <Receipt size={18} />
            <div>
              <strong>{customer.orderCount}</strong>
              <span>成交订单</span>
            </div>
          </div>
          <div className="customer-detail-stat">
            <Eye size={18} />
            <div>
              <strong>{pendingFollowUps.length}</strong>
              <span>待跟进</span>
            </div>
          </div>
        </div>
      </div>

      {pendingFollowUps.length > 0 && (
        <div className="customer-detail-section">
          <h4 className="customer-section-title">
            <AlertCircle size={16} /> 待跟进事项（{pendingFollowUps.length}）
          </h4>
          <div className="customer-followup-list">
            {pendingFollowUps.map((inq) => {
              const work = getWorkForInquiry(inq);
              const isWorkSold = work && work.sale === '已售';
              return (
                <div key={inq.id} className="customer-followup-item">
                  <div className="customer-followup-head">
                    <strong>{inq.workTitle}</strong>
                    <span className={`status-select ${getInquiryStatusClass(inq.status)}`}>
                      {inq.status}
                    </span>
                  </div>
                  <div className="customer-followup-body">
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
                      <Calendar size={12} />{' '}
                      {new Date(inq.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="customer-followup-actions">
                    {!isWorkSold ? (
                      <button
                        className="small"
                        onClick={() => onOpenOrderForWork && onOpenOrderForWork(inq.workId, customer.name, customer.phone)}
                      >
                        <Receipt size={12} /> 登记销售
                      </button>
                    ) : (
                      <button
                        className="small ghost"
                        onClick={() => onViewWorkFunnel && onViewWorkFunnel(inq.workId)}
                      >
                        <TrendingUp size={12} /> 查看漏斗
                      </button>
                    )}
                    <button
                      className="small ghost"
                      onClick={() => onViewWorkFunnel && onViewWorkFunnel(inq.workId)}
                    >
                      <Eye size={12} /> 销售漏斗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="customer-detail-grid">
        <div className="customer-detail-column">
          <div className="customer-detail-section">
            <h4 className="customer-section-title">
              <MessageSquare size={16} /> 询价记录（{sortedInquiries.length}）
            </h4>
            {sortedInquiries.length === 0 ? (
              <p className="empty-tip small-empty">暂无询价记录</p>
            ) : (
              <div className="customer-inquiry-list">
                {sortedInquiries.map((inq) => {
                  const work = getWorkForInquiry(inq);
                  const isWorkSold = work && work.sale === '已售';
                  return (
                    <div key={inq.id} className="customer-inquiry-item">
                      <div className="customer-inquiry-head">
                        <strong className="customer-inquiry-title">{inq.workTitle}</strong>
                        <span className={`status-select ${getInquiryStatusClass(inq.status)}`}>
                          {inq.status}
                        </span>
                      </div>
                      <div className="customer-inquiry-body">
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
                          <Calendar size={12} />{' '}
                          {new Date(inq.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div className="customer-inquiry-actions">
                        <button
                          className="small ghost"
                          onClick={() => onViewWorkFunnel && onViewWorkFunnel(inq.workId)}
                        >
                          <TrendingUp size={12} /> 销售漏斗
                        </button>
                        {!isWorkSold && work && (
                          <button
                            className="small"
                            onClick={() => onOpenOrderForWork && onOpenOrderForWork(inq.workId, customer.name, customer.phone)}
                          >
                            <Receipt size={12} /> 登记销售
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="customer-detail-column">
          <div className="customer-detail-section">
            <h4 className="customer-section-title">
              <Receipt size={16} /> 成交作品（{dealedWorks.length}）
            </h4>
            {dealedWorks.length === 0 ? (
              <p className="empty-tip small-empty">暂无成交作品</p>
            ) : (
              <div className="customer-order-list">
                {dealedWorks.map(({ order, work }) => (
                  <div key={order.id} className="customer-order-item">
                    <div className="customer-order-head">
                      <strong className="customer-order-title">{order.workTitle}</strong>
                      <span className="customer-order-artist">{work?.artist || '-'}</span>
                    </div>
                    <div className="customer-order-body">
                      <span className="order-price">
                        <Banknote size={12} /> 成交价 ¥{Number(order.dealPrice || 0).toLocaleString()}
                      </span>
                      <span className="order-date">
                        <Calendar size={12} /> {order.dealDate || '-'}
                      </span>
                      <span className={`order-balance status-select status-${order.balanceStatus}`}>
                        {order.balanceStatus}
                      </span>
                    </div>
                    <div className="customer-order-actions">
                      <button
                        className="small ghost"
                        onClick={() => onViewWorkFunnel && onViewWorkFunnel(order.workId)}
                      >
                        <TrendingUp size={12} /> 销售漏斗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="customer-detail-section">
        <h4 className="customer-section-title">
          <History size={16} /> 最近活跃（{recentActivity.length}）
        </h4>
        {recentActivity.length === 0 ? (
          <p className="empty-tip small-empty">暂无活跃记录</p>
        ) : (
            <div className="customer-activity-list">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="customer-activity-item">
                  <div className={`customer-activity-dot activity-${activity.type}`}></div>
                  <div className="customer-activity-content">
                    <div className="customer-activity-head">
                      <span className="customer-activity-type">
                        {activity.type === 'inquiry' ? (
                          <><MessageSquare size={12} /> 客户询价</>
                        ) : (
                          <><CheckCircle2 size={12} /> 完成成交</>
                        )}
                      </span>
                      <span className="customer-activity-time">
                        <Clock size={12} /> {new Date(activity.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="customer-activity-work">{activity.workTitle}</div>
                    {activity.type === 'inquiry' && activity.intendedPrice > 0 && (
                      <div className="customer-activity-meta">
                        意向价 ¥{activity.intendedPrice.toLocaleString()}
                      </div>
                    )}
                    {activity.type === 'order' && activity.dealPrice && (
                      <div className="customer-activity-meta">
                        成交价 ¥{Number(activity.dealPrice || 0).toLocaleString()}
                      </div>
                    )}
                    {activity.type === 'inquiry' && activity.remark && (
                      <div className="customer-activity-remark">{activity.remark}</div>
                    )}
                    <button
                      className="small ghost customer-activity-action"
                      onClick={() => onViewWorkFunnel && onViewWorkFunnel(activity.workId)}
                    >
                      <Eye size={12} /> 查看漏斗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </section>
  );
}

export default CustomerDetail;
