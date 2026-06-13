import React, { useMemo, useState } from 'react';
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
  History,
  AlertTriangle,
  CheckSquare,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { CUSTOMER_STATUS, formatCustomerDisplay } from './customerUtils.js';

const iso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

function CustomerDetail({
  customer,
  works,
  followUps = [],
  onBack,
  onViewWorkFunnel,
  onOpenOrderForWork,
  onOpenInquiryForWork,
  onAddFollowUp,
  onCompleteFollowUp,
  onPostponeFollowUp,
  onUpdateFollowUp,
  onDeleteFollowUp
}) {
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    scheduledDate: iso(1),
    content: '',
    responsible: ''
  });
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  const [completingFollowUpId, setCompletingFollowUpId] = useState(null);
  const [completeResult, setCompleteResult] = useState('');
  const [postponingFollowUpId, setPostponingFollowUpId] = useState(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeNote, setPostponeNote] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
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

  const customerFollowUps = useMemo(() => {
    return followUps.filter(
      (fu) => fu.customerName === customer.name && fu.customerPhone === customer.phone
    );
  }, [followUps, customer.name, customer.phone]);

  const sortedFollowUps = useMemo(() => {
    return [...customerFollowUps].sort(
      (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)
    );
  }, [customerFollowUps]);

  const pendingFollowUps = useMemo(() => {
    return sortedFollowUps.filter((fu) => !fu.completedAt);
  }, [sortedFollowUps]);

  const completedFollowUps = useMemo(() => {
    return sortedFollowUps.filter((fu) => fu.completedAt).sort(
      (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
    );
  }, [sortedFollowUps]);

  const today = new Date().toISOString().slice(0, 10);

  const customerMergeInfo = useMemo(() => {
    const allRecords = [
      ...(customer?.inquiries || []),
      ...(customer?.orders || []),
      ...(customerFollowUps || [])
    ];
    const originalNames = new Set();
    const originalPhones = new Set();
    allRecords.forEach((r) => {
      const d = formatCustomerDisplay(r);
      if (d.originalName) originalNames.add(d.originalName);
      if (d.originalPhone) originalPhones.add(d.originalPhone);
    });
    return {
      hasMerged: originalNames.size > 0 || originalPhones.size > 0,
      originalNames: Array.from(originalNames).filter((n) => n !== customer?.name),
      originalPhones: Array.from(originalPhones).filter((p) => p !== customer?.phone)
    };
  }, [customer, customerFollowUps]);

  function getFollowUpStatus(fu) {
    if (fu.completedAt) return 'completed';
    const scheduled = fu.scheduledDate.slice(0, 10);
    if (scheduled < today) return 'overdue';
    if (scheduled === today) return 'today';
    return 'upcoming';
  }

  function handleAddFollowUp(e) {
    e.preventDefault();
    if (!followUpForm.scheduledDate || !followUpForm.content.trim()) return;
    onAddFollowUp(
      customer.name,
      customer.phone,
      followUpForm.scheduledDate,
      followUpForm.content,
      followUpForm.responsible
    );
    setFollowUpForm({ scheduledDate: iso(1), content: '', responsible: '' });
    setShowFollowUpForm(false);
  }

  function handleCompleteFollowUp() {
    if (!completingFollowUpId) return;
    onCompleteFollowUp(completingFollowUpId, completeResult);
    setCompletingFollowUpId(null);
    setCompleteResult('');
  }

  function handlePostponeFollowUp() {
    if (!postponingFollowUpId || !postponeDate) return;
    onPostponeFollowUp(postponingFollowUpId, postponeDate, postponeNote);
    setPostponingFollowUpId(null);
    setPostponeDate('');
    setPostponeNote('');
  }

  function openEditFollowUp(fu) {
    setEditingFollowUpId(fu.id);
    setFollowUpForm({
      scheduledDate: fu.scheduledDate.slice(0, 10),
      content: fu.content,
      responsible: fu.responsible || ''
    });
    setShowFollowUpForm(true);
  }

  function handleUpdateFollowUp(e) {
    e.preventDefault();
    if (!editingFollowUpId || !followUpForm.scheduledDate || !followUpForm.content.trim()) return;
    onUpdateFollowUp(editingFollowUpId, {
      scheduledDate: followUpForm.scheduledDate,
      content: followUpForm.content.trim(),
      responsible: followUpForm.responsible.trim()
    });
    setEditingFollowUpId(null);
    setFollowUpForm({ scheduledDate: iso(1), content: '', responsible: '' });
    setShowFollowUpForm(false);
  }

  function openCompleteDialog(fu) {
    setCompletingFollowUpId(fu.id);
    setCompleteResult('');
  }

  function openPostponeDialog(fu) {
    setPostponingFollowUpId(fu.id);
    const scheduled = new Date(fu.scheduledDate);
    scheduled.setDate(scheduled.getDate() + 7);
    setPostponeDate(scheduled.toISOString().slice(0, 10));
    setPostponeNote('');
  }

  const dealedWorks = useMemo(() => {
    return sortedOrders.map((order) => {
      const work = works.find((w) => w.id === order.workId);
      return { order, work };
    });
  }, [sortedOrders, works]);

  const recentActivity = useMemo(() => {
    const activities = [];
    customer.inquiries.forEach((inq) => {
      const d = formatCustomerDisplay(inq);
      activities.push({
        type: 'inquiry',
        time: new Date(inq.createdAt).getTime(),
        date: inq.createdAt,
        workTitle: inq.workTitle,
        workId: inq.workId,
        description: '客户询价',
        status: inq.status,
        intendedPrice: inq.intendedPrice,
        remark: inq.remark,
        originalName: d.originalName,
        originalPhone: d.originalPhone,
        isMerged: d.isMerged
      });
    });
    customer.orders.forEach((order) => {
      const d = formatCustomerDisplay(order);
      activities.push({
        type: 'order',
        time: new Date(order.dealDate || order.createdAt).getTime(),
        date: order.dealDate || order.createdAt,
        workTitle: order.workTitle,
        workId: order.workId,
        description: '完成成交',
        dealPrice: order.dealPrice,
        balanceStatus: order.balanceStatus,
        originalName: d.originalName,
        originalPhone: d.originalPhone,
        isMerged: d.isMerged
      });
    });
    return activities.sort((a, b) => b.time - a.time).slice(0, 10);
  }, [customer.inquiries, customer.orders]);

  const pendingInquiryFollowUps = useMemo(() => {
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
          <h3 className="customer-detail-name">
            {customer.name}
            {customerMergeInfo.originalNames.length > 0 && (
              <>
                {customerMergeInfo.originalNames.map((n, i) => (
                  <span key={i} className="customer-detail-original">原：{n}</span>
                ))}
              </>
            )}
          </h3>
          <span className="customer-detail-contact">
            <Phone size={14} /> {customer.phone}
            {customerMergeInfo.originalPhones.length > 0 && (
              <>
                {customerMergeInfo.originalPhones.map((p, i) => (
                  <span key={i} className="customer-detail-original phone">原：{p}</span>
                ))}
              </>
            )}
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
              <strong>{pendingInquiryFollowUps.length}</strong>
              <span>待跟进询价</span>
            </div>
          </div>
          <div className="customer-detail-stat">
            <CheckSquare size={18} />
            <div>
              <strong>{pendingFollowUps.length}</strong>
              <span>待跟进计划</span>
            </div>
          </div>
        </div>
      </div>

      {pendingInquiryFollowUps.length > 0 && (
        <div className="customer-detail-section">
          <h4 className="customer-section-title">
            <AlertCircle size={16} /> 待跟进询价（{pendingInquiryFollowUps.length}）
          </h4>
          <div className="customer-followup-list">
            {pendingInquiryFollowUps.map((inq) => {
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
                    {(() => {
                      const d = formatCustomerDisplay(inq);
                      if (!d.isMerged) return null;
                      return (
                        <span className="customer-activity-original">
                          原客户：{d.originalName || inq.customerName}
                          {d.originalPhone && ` · ${d.originalPhone}`}
                        </span>
                      );
                    })()}
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

      <div className="customer-detail-section">
        <div className="section-header-with-action">
          <h4 className="customer-section-title">
            <CheckSquare size={16} /> 跟进计划（{pendingFollowUps.length}待跟进 / {completedFollowUps.length}已完成）
          </h4>
          <button
            className="small"
            onClick={() => {
              setEditingFollowUpId(null);
              setFollowUpForm({ scheduledDate: iso(1), content: '', responsible: '' });
              setShowFollowUpForm(true);
            }}
          >
            <Plus size={14} /> 新增跟进
          </button>
        </div>

        {showFollowUpForm && (
          <div className="follow-up-form-panel">
            <div className="follow-up-form-header">
              <strong>{editingFollowUpId ? '编辑跟进计划' : '新增跟进计划'}</strong>
              <button
                className="small ghost"
                onClick={() => {
                  setShowFollowUpForm(false);
                  setEditingFollowUpId(null);
                }}
              >
                <X size={14} /> 取消
              </button>
            </div>
            <form onSubmit={editingFollowUpId ? handleUpdateFollowUp : handleAddFollowUp}>
              <div className="follow-up-form-row">
                <label>
                  <Calendar size={12} /> 跟进日期
                  <input
                    type="date"
                    value={followUpForm.scheduledDate}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, scheduledDate: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <User size={12} /> 负责人
                  <input
                    type="text"
                    placeholder="负责人姓名"
                    value={followUpForm.responsible}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, responsible: e.target.value })}
                  />
                </label>
              </div>
              <label className="follow-up-form-full">
                <MessageSquare size={12} /> 跟进内容
                <textarea
                  placeholder="请输入跟进内容和备注..."
                  value={followUpForm.content}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, content: e.target.value })}
                  required
                  rows={3}
                />
              </label>
              <div className="follow-up-form-actions">
                <button type="submit" className="primary">
                  {editingFollowUpId ? '保存修改' : '创建跟进'}
                </button>
              </div>
            </form>
          </div>
        )}

        {pendingFollowUps.length === 0 && completedFollowUps.length === 0 ? (
          <p className="empty-tip small-empty">暂无跟进计划，点击"新增跟进"创建第一条</p>
        ) : (
          <>
            {pendingFollowUps.length > 0 && (
              <div className="follow-up-list">
                {pendingFollowUps.map((fu) => {
                  const status = getFollowUpStatus(fu);
                  return (
                    <div
                      key={fu.id}
                      className={`follow-up-item follow-up-${status}`}
                    >
                      <div className="follow-up-item-head">
                        <div className="follow-up-item-date">
                          <Calendar size={14} />
                          <span>{new Date(fu.scheduledDate).toLocaleDateString('zh-CN')}</span>
                          {status === 'overdue' && (
                            <span className="follow-up-status-badge follow-up-status-overdue">
                              <AlertTriangle size={12} /> 已逾期
                            </span>
                          )}
                          {status === 'today' && (
                            <span className="follow-up-status-badge follow-up-status-today">
                              <Clock size={12} /> 今日
                            </span>
                          )}
                          {status === 'upcoming' && (
                            <span className="follow-up-status-badge follow-up-status-upcoming">
                              <Clock size={12} /> 待跟进
                            </span>
                          )}
                        </div>
                        {fu.responsible && (
                          <span className="follow-up-responsible">
                            <User size={12} /> {fu.responsible}
                          </span>
                        )}
                      </div>
                      <div className="follow-up-item-content">
                        {fu.content.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                      <div className="follow-up-item-actions">
                        <button
                          className="small primary"
                          onClick={() => openCompleteDialog(fu)}
                        >
                          <CheckCircle2 size={12} /> 完成
                        </button>
                        <button
                          className="small"
                          onClick={() => openPostponeDialog(fu)}
                        >
                          <Clock size={12} /> 延期
                        </button>
                        <button
                          className="small ghost"
                          onClick={() => openEditFollowUp(fu)}
                        >
                          <Pencil size={12} /> 编辑
                        </button>
                        <button
                          className="small ghost danger"
                          onClick={() => onDeleteFollowUp(fu.id)}
                        >
                          <Trash2 size={12} /> 删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {completedFollowUps.length > 0 && (
              <div className="follow-up-completed-section">
                <button
                  className="follow-up-toggle-completed"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  {showCompleted ? '收起' : '展开'}已完成跟进（{completedFollowUps.length}）
                </button>
                {showCompleted && (
                  <div className="follow-up-list follow-up-completed-list">
                    {completedFollowUps.map((fu) => (
                      <div key={fu.id} className="follow-up-item follow-up-completed">
                        <div className="follow-up-item-head">
                          <div className="follow-up-item-date">
                            <CheckCircle2 size={14} />
                            <span>完成于 {new Date(fu.completedAt).toLocaleDateString('zh-CN')}</span>
                            <span className="follow-up-status-badge follow-up-status-completed">
                              原计划：{new Date(fu.scheduledDate).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          {fu.responsible && (
                            <span className="follow-up-responsible">
                              <User size={12} /> {fu.responsible}
                            </span>
                          )}
                        </div>
                        <div className="follow-up-item-content">
                          {fu.content.split('\n').map((line, idx) => (
                            <p key={idx}>{line}</p>
                          ))}
                        </div>
                        {fu.result && (
                          <div className="follow-up-item-result">
                            <strong>跟进结果：</strong>
                            {fu.result.split('\n').map((line, idx) => (
                              <span key={idx}>{line}</span>
                            ))}
                          </div>
                        )}
                        <div className="follow-up-item-actions">
                          <button
                            className="small ghost danger"
                            onClick={() => onDeleteFollowUp(fu.id)}
                          >
                            <Trash2 size={12} /> 删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {completingFollowUpId && (
        <div className="modal-overlay" onClick={() => setCompletingFollowUpId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4 className="modal-title">完成跟进计划</h4>
            <label className="follow-up-form-full">
              <MessageSquare size={12} /> 跟进结果
              <textarea
                placeholder="请输入跟进结果..."
                value={completeResult}
                onChange={(e) => setCompleteResult(e.target.value)}
                rows={4}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setCompletingFollowUpId(null)}>
                取消
              </button>
              <button className="primary" onClick={handleCompleteFollowUp}>
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}

      {postponingFollowUpId && (
        <div className="modal-overlay" onClick={() => setPostponingFollowUpId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4 className="modal-title">延期跟进计划</h4>
            <label>
              <Calendar size={12} /> 新的跟进日期
              <input
                type="date"
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                required
              />
            </label>
            <label className="follow-up-form-full">
              <MessageSquare size={12} /> 延期备注（可选）
              <textarea
                placeholder="请输入延期原因..."
                value={postponeNote}
                onChange={(e) => setPostponeNote(e.target.value)}
                rows={3}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setPostponingFollowUpId(null)}>
                取消
              </button>
              <button className="primary" onClick={handlePostponeFollowUp}>
                确认延期
              </button>
            </div>
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
                        {(() => {
                          const d = formatCustomerDisplay(inq);
                          if (!d.isMerged) return null;
                          return (
                            <span className="customer-activity-original">
                              原客户：{d.originalName || inq.customerName}
                              {d.originalPhone && ` · ${d.originalPhone}`}
                            </span>
                          );
                        })()}
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
                      {(() => {
                        const d = formatCustomerDisplay(order);
                        if (!d.isMerged) return null;
                        return (
                          <span className="customer-activity-original">
                            原客户：{d.originalName || order.customerName}
                            {d.originalPhone && ` · ${d.originalPhone}`}
                          </span>
                        );
                      })()}
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
                      {activity.isMerged && (
                        <span className="customer-activity-original">
                          原：{activity.originalName || customer.name}
                          {activity.originalPhone && ` · ${activity.originalPhone}`}
                        </span>
                      )}
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
