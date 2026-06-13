import React, { useMemo, useState, useCallback } from 'react';
import {
  Users,
  User,
  Phone,
  MessageSquare,
  Receipt,
  Banknote,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Filter
} from 'lucide-react';
import {
  findDuplicateCustomers,
  buildMergedCustomerPreview,
  saveMergeIgnoredPair
} from './customerUtils.js';

function CustomerMergePanel({ customers, onMerge, onIgnore, onClose }) {
  const [minScore, setMinScore] = useState(50);
  const [expandedPairId, setExpandedPairId] = useState(null);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [mergeConfirmStep, setMergeConfirmStep] = useState('idle');
  const [mergePreview, setMergePreview] = useState(null);
  const [mergingPairId, setMergingPairId] = useState(null);
  const [ignoredVersion, setIgnoredVersion] = useState(0);

  const duplicates = useMemo(
    () => findDuplicateCustomers(customers, minScore),
    [customers, minScore, ignoredVersion]
  );

  const handleExpandPair = useCallback((pairId) => {
    if (expandedPairId === pairId) {
      setExpandedPairId(null);
      setPrimaryKey(null);
      setMergePreview(null);
      setMergeConfirmStep('idle');
    } else {
      setExpandedPairId(pairId);
      setPrimaryKey(null);
      setMergePreview(null);
      setMergeConfirmStep('idle');
    }
  }, [expandedPairId]);

  const handleSelectPrimary = useCallback((pair, key) => {
    if (primaryKey === key) {
      setPrimaryKey(null);
      setMergePreview(null);
      setMergeConfirmStep('idle');
    } else {
      setPrimaryKey(key);
      const preview = buildMergedCustomerPreview(pair.customerA, pair.customerB, key);
      setMergePreview(preview);
      setMergeConfirmStep('preview');
    }
  }, [primaryKey]);

  const handleConfirmMerge = useCallback(() => {
    if (!mergePreview || !mergingPairId) return;
    setMergeConfirmStep('confirming');
  }, [mergePreview, mergingPairId]);

  const handleExecuteMerge = useCallback(() => {
    if (!mergePreview) return;
    onMerge(
      mergePreview.primaryName,
      mergePreview.primaryPhone,
      [mergePreview.primaryKey, mergePreview.secondaryKey]
    );
    setMergeConfirmStep('done');
    setMergingPairId(null);
    setExpandedPairId(null);
    setPrimaryKey(null);
    setMergePreview(null);
  }, [mergePreview, onMerge]);

  const handleIgnore = useCallback((pair) => {
    saveMergeIgnoredPair(pair.customerA.key, pair.customerB.key);
    setIgnoredVersion((v) => v + 1);
    onIgnore(pair.id);
  }, [onIgnore]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'merge-score-high';
    if (score >= 60) return 'merge-score-medium';
    return 'merge-score-low';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return '高度疑似';
    if (score >= 60) return '中度疑似';
    return '轻度疑似';
  };

  return (
    <div className="customer-merge-panel">
      <div className="customer-merge-header">
        <div className="customer-merge-title">
          <ArrowRightLeft size={18} />
          <h3>客户合并与去重</h3>
          <span className="customer-merge-count">{duplicates.length} 组疑似重复</span>
        </div>
        <div className="customer-merge-actions">
          <label className="merge-score-filter">
            <Filter size={14} />
            <span>相似度阈值</span>
            <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
              <option value={30}>30分（宽松）</option>
              <option value={50}>50分（默认）</option>
              <option value={60}>60分（严格）</option>
              <option value={80}>80分（极严格）</option>
            </select>
          </label>
          <button className="ghost small" onClick={onClose}>
            <XCircle size={14} /> 关闭
          </button>
        </div>
      </div>

      <div className="customer-merge-hint">
        <AlertTriangle size={14} />
        <span>系统根据姓名相似度和手机号相似度自动检测疑似重复客户。合并后询价、订单和跟进记录将统一归入主客户，原始姓名和电话保留在记录中。</span>
      </div>

      {duplicates.length === 0 ? (
        <div className="customer-merge-empty">
          <CheckCircle2 size={32} />
          <strong>未发现疑似重复客户</strong>
          <span>当前相似度阈值下所有客户均可区分</span>
        </div>
      ) : (
        <div className="customer-merge-list">
          {duplicates.map((pair) => {
            const isExpanded = expandedPairId === pair.id;
            return (
              <div key={pair.id} className={`customer-merge-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="customer-merge-card-head" onClick={() => handleExpandPair(pair.id)}>
                  <div className="customer-merge-pair-info">
                    <span className={`customer-merge-score ${getScoreColor(pair.score)}`}>
                      {pair.score}分
                    </span>
                    <span className="customer-merge-score-label">{getScoreLabel(pair.score)}</span>
                    <span className="customer-merge-reasons">
                      {pair.reasons.map((r, i) => (
                        <span key={i} className="customer-merge-reason-tag">{r}</span>
                      ))}
                    </span>
                  </div>
                  <div className="customer-merge-pair-names">
                    <span className="merge-customer-name">
                      <User size={12} /> {pair.customerA.name}
                      <span className="merge-customer-phone"><Phone size={10} /> {pair.customerA.phone}</span>
                    </span>
                    <ArrowRightLeft size={14} className="merge-arrow-icon" />
                    <span className="merge-customer-name">
                      <User size={12} /> {pair.customerB.name}
                      <span className="merge-customer-phone"><Phone size={10} /> {pair.customerB.phone}</span>
                    </span>
                  </div>
                  <button className="ghost small merge-expand-btn">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="customer-merge-card-body">
                    <div className="customer-merge-comparison">
                      <div className="merge-customer-detail">
                        <h5>
                          <User size={14} /> {pair.customerA.name}
                          <button
                            className={`merge-primary-btn ${primaryKey === pair.customerA.key ? 'selected' : ''}`}
                            onClick={() => {
                              setMergingPairId(pair.id);
                              handleSelectPrimary(pair, pair.customerA.key);
                            }}
                          >
                            {primaryKey === pair.customerA.key ? '✓ 已选为主客户' : '选为主客户'}
                          </button>
                        </h5>
                        <div className="merge-detail-row"><Phone size={12} /> {pair.customerA.phone}</div>
                        <div className="merge-detail-row"><MessageSquare size={12} /> 询价 {pair.customerA.inquiries.length} 次</div>
                        <div className="merge-detail-row"><Receipt size={12} /> 订单 {pair.customerA.orders.length} 个</div>
                        <div className="merge-detail-row"><Banknote size={12} /> 成交 ¥{pair.customerA.totalDealAmount.toLocaleString()}</div>
                        {pair.customerA.lastActiveAt && (
                          <div className="merge-detail-row"><Clock size={12} /> {new Date(pair.customerA.lastActiveAt).toLocaleDateString('zh-CN')}</div>
                        )}
                      </div>

                      <div className="merge-customer-detail">
                        <h5>
                          <User size={14} /> {pair.customerB.name}
                          <button
                            className={`merge-primary-btn ${primaryKey === pair.customerB.key ? 'selected' : ''}`}
                            onClick={() => {
                              setMergingPairId(pair.id);
                              handleSelectPrimary(pair, pair.customerB.key);
                            }}
                          >
                            {primaryKey === pair.customerB.key ? '✓ 已选为主客户' : '选为主客户'}
                          </button>
                        </h5>
                        <div className="merge-detail-row"><Phone size={12} /> {pair.customerB.phone}</div>
                        <div className="merge-detail-row"><MessageSquare size={12} /> 询价 {pair.customerB.inquiries.length} 次</div>
                        <div className="merge-detail-row"><Receipt size={12} /> 订单 {pair.customerB.orders.length} 个</div>
                        <div className="merge-detail-row"><Banknote size={12} /> 成交 ¥{pair.customerB.totalDealAmount.toLocaleString()}</div>
                        {pair.customerB.lastActiveAt && (
                          <div className="merge-detail-row"><Clock size={12} /> {new Date(pair.customerB.lastActiveAt).toLocaleDateString('zh-CN')}</div>
                        )}
                      </div>
                    </div>

                    {mergePreview && mergingPairId === pair.id && (
                      <div className="customer-merge-preview">
                        <h4><Eye size={16} /> 合并后预览</h4>
                        <div className="merge-preview-grid">
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">客户姓名</span>
                            <strong className="merge-preview-value">{mergePreview.primaryName}</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">联系电话</span>
                            <strong className="merge-preview-value">{mergePreview.primaryPhone}</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">询价次数</span>
                            <strong className="merge-preview-value">{mergePreview.totalInquiries} 次</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">成交订单</span>
                            <strong className="merge-preview-value">{mergePreview.totalOrders} 个</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">累计成交</span>
                            <strong className="merge-preview-value amount">¥{mergePreview.totalDealAmount.toLocaleString()}</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">客户状态</span>
                            <strong className="merge-preview-value">{mergePreview.mergedStatus}</strong>
                          </div>
                          <div className="merge-preview-item">
                            <span className="merge-preview-label">待跟进计划</span>
                            <strong className="merge-preview-value">{mergePreview.pendingFollowUpCount} 项</strong>
                          </div>
                          {mergePreview.lastActiveAt && (
                            <div className="merge-preview-item">
                              <span className="merge-preview-label">最近活跃</span>
                              <strong className="merge-preview-value">
                                {new Date(mergePreview.lastActiveAt).toLocaleDateString('zh-CN')}
                              </strong>
                            </div>
                          )}
                        </div>
                        <div className="merge-preview-note">
                          <AlertTriangle size={12} />
                          合并后，{mergePreview.secondaryName}（{mergePreview.secondaryPhone}）的所有询价、订单和跟进记录将归入 {mergePreview.primaryName}（{mergePreview.primaryPhone}），原始姓名和电话保留在各记录的 originalCustomerName/originalCustomerPhone 字段中。
                        </div>
                      </div>
                    )}

                    <div className="customer-merge-card-actions">
                      <button
                        className="ghost"
                        onClick={() => handleIgnore(pair)}
                      >
                        <XCircle size={14} /> 忽略此对（不再提示）
                      </button>
                      {primaryKey && mergePreview && mergingPairId === pair.id && (
                        <>
                          {mergeConfirmStep === 'preview' && (
                            <button className="primary" onClick={handleConfirmMerge}>
                              <ArrowRightLeft size={14} /> 确认合并
                            </button>
                          )}
                          {mergeConfirmStep === 'confirming' && (
                            <button className="warning" onClick={handleExecuteMerge}>
                              <AlertTriangle size={14} /> 二次确认：执行合并
                            </button>
                          )}
                          {mergeConfirmStep === 'done' && (
                            <span className="merge-done-badge">
                              <CheckCircle2 size={14} /> 合并已完成
                            </span>
                          )}
                        </>
                      )}
                      {!primaryKey && (
                        <span className="merge-hint">请先选择主客户</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomerMergePanel;
