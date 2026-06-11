import React, { useMemo, useState } from 'react';
import { User, Phone, Banknote, Search, Filter, Eye, Receipt, MessageSquare } from 'lucide-react';
import { CUSTOMER_STATUS, buildCustomerProfile, filterCustomers } from './customerUtils.js';

function CustomerList({ inquiries, orders }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部状态');

  const allCustomers = useMemo(
    () => buildCustomerProfile(inquiries, orders),
    [inquiries, orders]
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

      {visibleCustomers.length === 0 ? (
        <p className="empty-tip">
          {allCustomers.length === 0
            ? '暂无客户档案，登记询价或销售订单后客户信息将自动汇总。'
            : '没有符合条件的客户。'}
        </p>
      ) : (
        <div className="customer-list">
          {visibleCustomers.map((customer) => (
            <div className="customer-card" key={customer.key}>
              <div className="customer-head">
                <div>
                  <strong className="customer-name">{customer.name}</strong>
                  <span className="customer-contact">
                    <Phone size={12} /> {customer.phone}
                  </span>
                </div>
                <span
                  className={`status-select ${getStatusClass(
                    customer.followStatus
                  )}`}
                >
                  {customer.followStatus}
                </span>
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
                  {customer.lastActiveAt && (
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
