import React, { useMemo, useState, useEffect } from 'react';
import { User, Phone, Banknote, Search, Filter, Eye, Receipt, MessageSquare, ChevronRight, AlertTriangle, Clock, ArrowRightLeft } from 'lucide-react';
import { CUSTOMER_STATUS, buildCustomerProfile, filterCustomers, findDuplicateCustomers } from './customerUtils.js';
import CustomerMergePanel from './CustomerMergePanel.jsx';

function CustomerList({ inquiries, orders, followUps = [], onSelectCustomer, onMerge, forceOpenMergePanel }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [ignoredPairIds, setIgnoredPairIds] = useState(new Set());

  useEffect(() => {
    if (forceOpenMergePanel) {
      setShowMergePanel(true);
    }
  }, [forceOpenMergePanel]);

  const allCustomers = useMemo(
    () => buildCustomerProfile(inquiries, orders, followUps),
    [inquiries, orders, followUps]
  );

  const searchedCustomers = useMemo(
    () => filterCustomers(allCustomers, searchQuery),
    [allCustomers, searchQuery]
  );

  const visibleCustomers = useMemo(() => {
    if (statusFilter === '全部状态') return searchedCustomers;
    return searchedCustomers.filter((c) => c.followStatus === statusFilter);
  }, [searchedCustomers, statusFilter]);

  const customerStats = useMemo(() => {
    const total = allCustomers.length;
    const dealed = allCustomers.filter(
      (c) => c.followStatus === CUSTOMER_STATUS.DEALED
    ).length;
    const following = allCustomers.filter(
      (c) => c.followStatus === CUSTOMER_STATUS.FOLLOWING
    ).length;
    const totalAmount = allCustomers.reduce(
      (sum, c) => sum + c.totalDealAmount,
      0
    );
    return { total, dealed, following, totalAmount };
  }, [allCustomers]);

  const duplicateCount = useMemo(
    () => findDuplicateCustomers(allCustomers).length,
    [allCustomers, ignoredPairIds]
  );

  function handleIgnorePair(pairId) {
    setIgnoredPairIds((prev) => new Set([...prev, pairId]));
  }

  function getStatusClass(status) {
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
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <h2>
          <User size={18} /> 客户档案 ({visibleCustomers.length})
        </h2>
        <label>
          <Search size={16} />
          <input
            placeholder="按姓名或电话搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="toolbar-right">
          {duplicateCount > 0 && (
            <button
              className={showMergePanel ? '' : 'ghost'}
              onClick={() => setShowMergePanel(!showMergePanel)}
            >
              <ArrowRightLeft size={14} /> 合并去重 ({duplicateCount})
            </button>
          )}
          <label>
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="全部状态">全部状态</option>
              {Object.values(CUSTOMER_STATUS).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="customer-stats">
        <div className="customer-stat-item">
          <span className="customer-stat-label">客户总数</span>
          <strong className="customer-stat-value">{customerStats.total}位</strong>
        </div>
        <div className="customer-stat-item">
          <span className="customer-stat-label">已成交</span>
          <strong className="customer-stat-value status-dealed">
            {customerStats.dealed}位
          </strong>
        </div>
        <div className="customer-stat-item">
          <span className="customer-stat-label">跟进中</span>
          <strong className="customer-stat-value status-following">
            {customerStats.following}位
          </strong>
        </div>
        <div className="customer-stat-item">
          <span className="customer-stat-label">累计成交</span>
          <strong className="customer-stat-value amount">
            ¥{customerStats.totalAmount.toLocaleString()}
          </strong>
        </div>
      </div>

      {showMergePanel && (
        <CustomerMergePanel
          customers={allCustomers}
          onMerge={onMerge}
          onIgnore={handleIgnorePair}
          onClose={() => setShowMergePanel(false)}
        />
      )}

      {visibleCustomers.length === 0 ? (
        <p className="empty-tip">
          {allCustomers.length === 0
            ? '暂无客户档案，登记询价或销售订单后客户信息将自动汇总。'
            : '没有符合条件的客户。'}
        </p>
      ) : (
        <div className="customer-list">
          {visibleCustomers.map((customer) => (
            <div
              className={`customer-card ${onSelectCustomer ? 'customer-card-clickable' : ''}`}
              key={customer.key}
              onClick={() => onSelectCustomer && onSelectCustomer(customer.key)}
            >
              <div className="customer-head">
                <div>
                  <strong className="customer-name">{customer.name}</strong>
                  <span className="customer-contact">
                    <Phone size={12} /> {customer.phone}
                  </span>
                </div>
                <div className="customer-head-right">
                  {customer.hasOverdue && (
                    <span className="follow-up-badge follow-up-overdue">
                      <AlertTriangle size={12} /> 已逾期
                    </span>
                  )}
                  {!customer.hasOverdue && customer.hasTodayFollowUp && (
                    <span className="follow-up-badge follow-up-today">
                      <Clock size={12} /> 今日跟进
                    </span>
                  )}
                  <span
                    className={`status-select ${getStatusClass(
                      customer.followStatus
                    )}`}
                  >
                    {customer.followStatus}
                  </span>
                  {onSelectCustomer && (
                    <ChevronRight size={16} className="customer-card-arrow" />
                  )}
                </div>
              </div>

              <div className="customer-body">
                <div className="customer-info-row">
                  <span className="customer-info-label">
                    <Eye size={12} /> 最近询价作品
                  </span>
                  <span className="customer-info-value">
                    {customer.lastInquiryWork || '—'}
                  </span>
                </div>

                <div className="customer-info-row">
                  <span className="customer-info-label">
                    <Banknote size={12} /> 累计成交金额
                  </span>
                  <span
                    className={`customer-info-value ${
                      customer.totalDealAmount > 0 ? 'customer-amount' : ''
                    }`}
                  >
                    ¥{customer.totalDealAmount.toLocaleString()}
                  </span>
                </div>

                <div className="customer-meta">
                  <span className="customer-tag">
                    <MessageSquare size={12} /> 询价 {customer.inquiryCount}次
                  </span>
                  <span className="customer-tag">
                    <Receipt size={12} /> 订单 {customer.orderCount}次
                  </span>
                  {customer.pendingFollowUpCount > 0 && (
                    <span className="customer-tag follow-up-pending-tag">
                      <Clock size={12} /> 待跟进 {customer.pendingFollowUpCount}项
                    </span>
                  )}
                  {customer.nextFollowUpAt && (
                    <span className={`customer-date ${customer.hasOverdue ? 'follow-up-overdue-text' : ''}`}>
                      {customer.hasOverdue ? '下次跟进（已逾期）：' : '下次跟进：'}
                      {new Date(customer.nextFollowUpAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                  {!customer.nextFollowUpAt && customer.lastActiveAt && (
                    <span className="customer-date">
                      最近活跃{' '}
                      {new Date(customer.lastActiveAt).toLocaleDateString(
                        'zh-CN'
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default CustomerList;
