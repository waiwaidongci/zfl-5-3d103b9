import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeftRight, Banknote, Brush, Building2, Calendar, CheckCircle2, Clock, Coins, Filter, MessageCircle, MessageSquare, Percent, Phone, Plus, Search, Tag, User, XCircle } from 'lucide-react';
import './styles.css';

const iso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const DEFAULT_COMMISSION_RATE = 0.35;

function extractCommissionRate(note) {
  if (!note) return DEFAULT_COMMISSION_RATE;
  const match = note.match(/佣金\s*(\d+(?:\.\d+)?)\s*%/);
  if (match) {
    return Number(match[1]) / 100;
  }
  return DEFAULT_COMMISSION_RATE;
}

function getCommissionRateMap(artists) {
  const map = {};
  artists.forEach((artist) => {
    map[artist.name] = extractCommissionRate(artist.note);
  });
  return map;
}

const seedArtists = [
  { id: 'seed-artist-xieql', name: '谢青岚', phone: '13600001111', style: '纸本水墨', note: '月结，佣金35%' },
  { id: 'seed-artist-zhaoyn', name: '赵以南', phone: '13700002222', style: '综合材料', note: '售后需确认装裱' }
];

const seedWorks = [
  { id: 'seed-work-yhtj', artist: '谢青岚', title: '雨后天井', price: 12800, inDate: iso(-20), exhibit: '展出中', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null },
  { id: 'seed-work-jqcy03', artist: '赵以南', title: '旧墙采样03', price: 8600, inDate: iso(-12), exhibit: '库房', sale: '已售', settlement: '待结算', saleDate: iso(-3), settlementDate: null },
  { id: 'seed-work-zxfs', artist: '谢青岚', title: '窄巷风声', price: 16600, inDate: iso(-5), exhibit: '借展', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null }
];

function useStorage(key, initial) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  });
  const update = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next;
    setValue(resolved);
    localStorage.setItem(key, JSON.stringify(resolved));
  };
  return [value, update];
}

const INQUIRY_STATUS = ['待跟进', '跟进中', '已成交', '已放弃'];

function App() {
  const [artists, setArtists] = useStorage('zfl-5-artists', seedArtists);
  const [works, setWorks] = useStorage('zfl-5-works', seedWorks);
  const [inquiries, setInquiries] = useStorage('zfl-5-inquiries', []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部展态');
  const [artistForm, setArtistForm] = useState({ name: '', phone: '', style: '', note: '' });
  const [workForm, setWorkForm] = useState({ artist: '谢青岚', title: '', price: '', inDate: iso(0), exhibit: '展出中', sale: '待售', settlement: '未结算' });
  const [inquiryForm, setInquiryForm] = useState({ workId: '', customerName: '', customerPhone: '', intendedPrice: '', remark: '' });
  const [inquiryFilterRaw, setInquiryFilterRaw] = useStorage('zfl-5-inquiry-filter', '全部作品');
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [loans, setLoans] = useStorage('zfl-5-loans', []);
  const [loanForm, setLoanForm] = useState({ workId: '', borrower: '', loanDate: iso(0), expectedReturnDate: iso(7), contactPerson: '', notes: '' });
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanFilterRaw, setLoanFilterRaw] = useStorage('zfl-5-loan-filter', '全部作品');

  const validWorkIds = useMemo(() => new Set(works.map((w) => w.id)), [works]);
  const inquiryFilter = (inquiryFilterRaw === '全部作品' || validWorkIds.has(inquiryFilterRaw))
    ? inquiryFilterRaw
    : '全部作品';

  const filteredWorks = works.filter((work) => {
    const text = `${work.artist}${work.title}${work.exhibit}${work.sale}${work.settlement}`;
    return text.includes(query.trim()) && (status === '全部展态' || work.exhibit === status);
  });
  const settlementWorks = works.filter((work) => work.settlement === '待结算');
  const totalValue = works.reduce((sum, work) => sum + Number(work.price || 0), 0);
  const artistStats = useMemo(() => artists.map((artist) => ({
    ...artist,
    works: works.filter((work) => work.artist === artist.name)
  })), [artists, works]);

  const commissionRateMap = useMemo(() => getCommissionRateMap(artists), [artists]);

  const monthlySettlement = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isThisMonth = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    };

    const soldThisMonth = works.filter((w) => w.sale === '已售' && isThisMonth(w.saleDate));
    const settledThisMonth = works.filter((w) => w.sale === '已售' && w.settlement === '已结算' && isThisMonth(w.settlementDate));
    const pendingThisMonth = works.filter((w) => w.sale === '已售' && w.settlement === '待结算' && isThisMonth(w.saleDate));

    const soldAmount = soldThisMonth.reduce((sum, w) => sum + Number(w.price || 0), 0);
    const pendingAmount = pendingThisMonth.reduce((sum, w) => sum + Number(w.price || 0), 0);
    const settledAmount = settledThisMonth.reduce((sum, w) => sum + Number(w.price || 0), 0);

    const estimatedCommission = pendingThisMonth.reduce((sum, w) => {
      const rate = commissionRateMap[w.artist] ?? DEFAULT_COMMISSION_RATE;
      return sum + Number(w.price || 0) * rate;
    }, 0);

    const settledCommission = settledThisMonth.reduce((sum, w) => {
      const rate = commissionRateMap[w.artist] ?? DEFAULT_COMMISSION_RATE;
      return sum + Number(w.price || 0) * rate;
    }, 0);

    return {
      pendingCount: pendingThisMonth.length,
      pendingAmount,
      settledCount: settledThisMonth.length,
      settledAmount,
      soldCount: soldThisMonth.length,
      soldAmount,
      estimatedCommission,
      settledCommission,
      currentMonthLabel: `${currentYear}年${currentMonth + 1}月`
    };
  }, [works, commissionRateMap]);

  const filteredInquiries = useMemo(() => {
    return inquiries
      .filter((inq) => inquiryFilter === '全部作品' || inq.workId === inquiryFilter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [inquiries, inquiryFilter]);

  const workInquiryCount = useMemo(() => {
    const map = {};
    inquiries.forEach((inq) => {
      map[inq.workId] = (map[inq.workId] || 0) + 1;
    });
    return map;
  }, [inquiries]);

  const isWorkOnLoan = useMemo(() => {
    const map = {};
    loans.forEach((loan) => {
      if (!loan.returnedAt) {
        map[loan.workId] = loan;
      }
    });
    return map;
  }, [loans]);

  const loanFilter = (loanFilterRaw === '全部作品' || validWorkIds.has(loanFilterRaw))
    ? loanFilterRaw
    : '全部作品';

  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => loanFilter === '全部作品' || loan.workId === loanFilter)
      .sort((a, b) => new Date(b.loanDate) - new Date(a.loanDate));
  }, [loans, loanFilter]);

  const onLoanCount = Object.keys(isWorkOnLoan).length;

  function addArtist(event) {
    event.preventDefault();
    if (!artistForm.name.trim()) return;
    setArtists([{ id: crypto.randomUUID(), ...artistForm }, ...artists]);
    setArtistForm({ name: '', phone: '', style: '', note: '' });
    setWorkForm({ ...workForm, artist: artistForm.name });
  }

  function addWork(event) {
    event.preventDefault();
    if (!workForm.title.trim() || !workForm.artist) return;
    setWorks([{ id: crypto.randomUUID(), ...workForm, price: Number(workForm.price || 0), saleDate: null, settlementDate: null }, ...works]);
    setWorkForm({ ...workForm, title: '', price: '', inDate: iso(0), exhibit: '展出中', sale: '待售', settlement: '未结算' });
  }

  function updateWork(id, patch) {
    setWorks(works.map((work) => work.id === id ? { ...work, ...patch } : work));
  }

  function addInquiry(event) {
    event.preventDefault();
    if (!inquiryForm.workId || !inquiryForm.customerName.trim() || !inquiryForm.customerPhone.trim()) return;
    const selectedWork = works.find((w) => w.id === inquiryForm.workId);
    setInquiries([{
      id: crypto.randomUUID(),
      workId: inquiryForm.workId,
      workTitle: selectedWork ? selectedWork.title : '',
      customerName: inquiryForm.customerName.trim(),
      customerPhone: inquiryForm.customerPhone.trim(),
      intendedPrice: Number(inquiryForm.intendedPrice || 0),
      remark: inquiryForm.remark.trim(),
      status: '待跟进',
      createdAt: new Date().toISOString()
    }, ...inquiries]);
    setInquiryForm({ workId: '', customerName: '', customerPhone: '', intendedPrice: '', remark: '' });
    setShowInquiryForm(false);
  }

  function openInquiryForWork(workId) {
    setInquiryForm({ ...inquiryForm, workId });
    setShowInquiryForm(true);
  }

  function updateInquiryStatus(id, nextStatus) {
    setInquiries(inquiries.map((inq) => inq.id === id ? { ...inq, status: nextStatus } : inq));
  }

  function addLoan(event) {
    event.preventDefault();
    if (!loanForm.workId || !loanForm.borrower.trim()) return;
    const selectedWork = works.find((w) => w.id === loanForm.workId);
    setLoans([{
      id: crypto.randomUUID(),
      workId: loanForm.workId,
      workTitle: selectedWork ? selectedWork.title : '',
      workArtist: selectedWork ? selectedWork.artist : '',
      borrower: loanForm.borrower.trim(),
      loanDate: loanForm.loanDate,
      expectedReturnDate: loanForm.expectedReturnDate,
      contactPerson: loanForm.contactPerson.trim(),
      notes: loanForm.notes.trim(),
      returnedAt: null,
      createdAt: new Date().toISOString()
    }, ...loans]);
    if (selectedWork && selectedWork.exhibit !== '借展') {
      updateWork(loanForm.workId, { exhibit: '借展' });
    }
    setLoanForm({ workId: '', borrower: '', loanDate: iso(0), expectedReturnDate: iso(7), contactPerson: '', notes: '' });
    setShowLoanForm(false);
  }

  function openLoanForWork(workId) {
    setLoanForm({ ...loanForm, workId });
    setShowLoanForm(true);
  }

  function markLoanReturned(id) {
    setLoans(loans.map((loan) => loan.id === id ? { ...loan, returnedAt: new Date().toISOString() } : loan));
    const loan = loans.find((l) => l.id === id);
    if (loan) {
      const otherActiveLoans = loans.filter((l) => l.workId === loan.workId && l.id !== id && !l.returnedAt);
      if (otherActiveLoans.length === 0) {
        const work = works.find((w) => w.id === loan.workId);
        if (work && work.exhibit === '借展') {
          updateWork(loan.workId, { exhibit: '库房' });
        }
      }
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p>独立画廊</p>
          <h1>作品寄售管理</h1>
        </div>
        <div className="stats">
          <span><Brush size={18} />{works.length}件作品</span>
          <span><Banknote size={18} />¥{totalValue.toLocaleString()}</span>
          <span><Calendar size={18} />{settlementWorks.length}件待结算</span>
          <span><ArrowLeftRight size={18} />{onLoanCount}件借展中</span>
        </div>
      </header>

      <section className="forms">
        <form className="panel" onSubmit={addArtist}>
          <h2><Plus size={18} />录入艺术家</h2>
          <input placeholder="艺术家姓名" value={artistForm.name} onChange={(e) => setArtistForm({ ...artistForm, name: e.target.value })} />
          <input placeholder="联系方式" value={artistForm.phone} onChange={(e) => setArtistForm({ ...artistForm, phone: e.target.value })} />
          <input placeholder="创作方向" value={artistForm.style} onChange={(e) => setArtistForm({ ...artistForm, style: e.target.value })} />
          <input placeholder="结算备注" value={artistForm.note} onChange={(e) => setArtistForm({ ...artistForm, note: e.target.value })} />
          <button>保存艺术家</button>
        </form>

        <form className="panel" onSubmit={addWork}>
          <h2><Plus size={18} />录入作品</h2>
          <select value={workForm.artist} onChange={(e) => setWorkForm({ ...workForm, artist: e.target.value })}>
            {artists.map((artist) => <option key={artist.id}>{artist.name}</option>)}
          </select>
          <input placeholder="作品名称" value={workForm.title} onChange={(e) => setWorkForm({ ...workForm, title: e.target.value })} />
          <div className="split">
            <input type="number" placeholder="寄售价格" value={workForm.price} onChange={(e) => setWorkForm({ ...workForm, price: e.target.value })} />
            <input type="date" value={workForm.inDate} onChange={(e) => setWorkForm({ ...workForm, inDate: e.target.value })} />
          </div>
          <div className="split">
            <select value={workForm.exhibit} onChange={(e) => setWorkForm({ ...workForm, exhibit: e.target.value })}>
              <option>展出中</option><option>库房</option><option>借展</option><option>退回</option>
            </select>
            <select value={workForm.sale} onChange={(e) => setWorkForm({ ...workForm, sale: e.target.value })}>
              <option>待售</option><option>已预订</option><option>已售</option>
            </select>
          </div>
          <button>保存作品</button>
        </form>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>作品列表</h2>
          <label><Search size={16} /><input placeholder="搜索艺术家/作品/状态" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="toolbar-right">
            <label><Filter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>全部展态</option><option>展出中</option><option>库房</option><option>借展</option><option>退回</option></select></label>
            <button className="ghost" onClick={() => setShowLoanForm(true)}><Plus size={14} /> 登记借展</button>
            <button className="ghost" onClick={() => setShowInquiryForm(true)}><Plus size={14} /> 登记询价</button>
          </div>
        </div>
        <div className="works">
          {filteredWorks.map((work) => {
            const activeLoan = isWorkOnLoan[work.id];
            const today = new Date().toISOString().slice(0, 10);
            const isOverdue = activeLoan && activeLoan.expectedReturnDate < today;
            return (
              <article key={work.id} className={activeLoan ? 'work-on-loan' : ''}>
                <strong>{work.title}</strong>
                <span>{work.artist} · ¥{Number(work.price).toLocaleString()}</span>
                <p>{work.inDate}入库 · {work.exhibit} · {work.sale} · {work.settlement}</p>
                {activeLoan && (
                  <div className={`loan-badge ${isOverdue ? 'loan-overdue' : ''}`}>
                    <ArrowLeftRight size={12} />
                    <span>
                      借展中：{activeLoan.borrower}
                      {isOverdue && '（已逾期）'}
                    </span>
                  </div>
                )}
                <div className="actions">
                  <button onClick={() => {
                    const isSold = work.sale === '已售';
                    const patch = isSold
                      ? { sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null }
                      : { sale: '已售', settlement: '待结算', saleDate: iso(0) };
                    updateWork(work.id, patch);
                  }}>{work.sale === '已售' ? '撤回销售' : '标记已售'}</button>
                  <button className="ghost" onClick={() => updateWork(work.id, { settlement: '已结算', settlementDate: iso(0) })}>完成结算</button>
                  <button className="outline" onClick={() => openLoanForWork(work.id)}>
                    <ArrowLeftRight size={14} /> 登记借展
                  </button>
                  <button className="outline" onClick={() => openInquiryForWork(work.id)}>
                    <MessageSquare size={14} /> 登记询价{workInquiryCount[work.id] ? ` (${workInquiryCount[work.id]})` : ''}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showInquiryForm && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><MessageSquare size={18} />登记客户询价</h2>
            <button className="ghost small" onClick={() => setShowInquiryForm(false)}>收起</button>
          </div>
          <form className="inquiry-form" onSubmit={addInquiry}>
            <div className="form-row">
              <label><span className="label-icon"><Tag size={14} /></span>
                <select value={inquiryForm.workId} onChange={(e) => setInquiryForm({ ...inquiryForm, workId: e.target.value })}>
                  <option value="">请选择作品</option>
                  {works.map((work) => <option key={work.id} value={work.id}>{work.title} — {work.artist}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><User size={14} /></span>
                <input placeholder="客户姓名" value={inquiryForm.customerName} onChange={(e) => setInquiryForm({ ...inquiryForm, customerName: e.target.value })} />
              </label>
              <label><span className="label-icon"><Phone size={14} /></span>
                <input placeholder="联系方式" value={inquiryForm.customerPhone} onChange={(e) => setInquiryForm({ ...inquiryForm, customerPhone: e.target.value })} />
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><Banknote size={14} /></span>
                <input type="number" placeholder="意向价格 (元)" value={inquiryForm.intendedPrice} onChange={(e) => setInquiryForm({ ...inquiryForm, intendedPrice: e.target.value })} />
              </label>
              <label><span className="label-icon"><MessageCircle size={14} /></span>
                <input placeholder="备注 (选填)" value={inquiryForm.remark} onChange={(e) => setInquiryForm({ ...inquiryForm, remark: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost" onClick={() => setShowInquiryForm(false)}>取消</button>
              <button type="submit">保存询价</button>
            </div>
          </form>
        </section>
      )}

      {showLoanForm && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><ArrowLeftRight size={18} />登记作品借展</h2>
            <button className="ghost small" onClick={() => setShowLoanForm(false)}>收起</button>
          </div>
          <form className="inquiry-form" onSubmit={addLoan}>
            <div className="form-row">
              <label><span className="label-icon"><Tag size={14} /></span>
                <select value={loanForm.workId} onChange={(e) => setLoanForm({ ...loanForm, workId: e.target.value })}>
                  <option value="">请选择作品</option>
                  {works.map((work) => <option key={work.id} value={work.id}>{work.title} — {work.artist}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><Building2 size={14} /></span>
                <input placeholder="借展方/机构名称 *" value={loanForm.borrower} onChange={(e) => setLoanForm({ ...loanForm, borrower: e.target.value })} />
              </label>
              <label><span className="label-icon"><User size={14} /></span>
                <input placeholder="借展联系人 (选填)" value={loanForm.contactPerson} onChange={(e) => setLoanForm({ ...loanForm, contactPerson: e.target.value })} />
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><Calendar size={14} /></span>
                <input type="date" value={loanForm.loanDate} onChange={(e) => setLoanForm({ ...loanForm, loanDate: e.target.value })} />
              </label>
              <label><span className="label-icon"><Clock size={14} /></span>
                <input type="date" value={loanForm.expectedReturnDate} onChange={(e) => setLoanForm({ ...loanForm, expectedReturnDate: e.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label><span className="label-icon"><MessageCircle size={14} /></span>
                <input placeholder="备注 (选填)" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost" onClick={() => setShowLoanForm(false)}>取消</button>
              <button type="submit">确认借展</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <h2><MessageSquare size={18} />客户询价记录 ({filteredInquiries.length})</h2>
          <label><Filter size={16} />
            <select value={inquiryFilter} onChange={(e) => setInquiryFilterRaw(e.target.value)}>
              <option value="全部作品">全部作品</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}
            </select>
          </label>
          <div></div>
        </div>
        {filteredInquiries.length === 0 ? (
          <p className="empty-tip">暂无询价记录，点击上方"登记询价"开始记录。</p>
        ) : (
          <div className="inquiry-list">
            {filteredInquiries.map((inq) => (
              <div className="inquiry-item" key={inq.id}>
                <div className="inquiry-head">
                  <div>
                    <strong className="inquiry-work">{inq.workTitle}</strong>
                    <span className="inquiry-customer"><User size={12} />{inq.customerName} · <Phone size={12} />{inq.customerPhone}</span>
                  </div>
                  <div className="status-dropdown">
                    <select
                      value={inq.status}
                      onChange={(e) => updateInquiryStatus(inq.id, e.target.value)}
                      className={`status-select status-${inq.status}`}
                    >
                      {INQUIRY_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="inquiry-body">
                  {inq.intendedPrice > 0 && <span className="inquiry-price"><Banknote size={12} />意向价 ¥{inq.intendedPrice.toLocaleString()}</span>}
                  {inq.remark && <span className="inquiry-remark"><MessageCircle size={12} />{inq.remark}</span>}
                  <span className="inquiry-date">{new Date(inq.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2><ArrowLeftRight size={18} />作品借展记录 ({filteredLoans.length})</h2>
          <label><Filter size={16} />
            <select value={loanFilter} onChange={(e) => setLoanFilterRaw(e.target.value)}>
              <option value="全部作品">全部作品</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}
            </select>
          </label>
          <div></div>
        </div>
        {filteredLoans.length === 0 ? (
          <p className="empty-tip">暂无借展记录，点击上方"登记借展"开始记录。</p>
        ) : (
          <div className="inquiry-list">
            {filteredLoans.map((loan) => {
              const today = new Date().toISOString().slice(0, 10);
              const isActive = !loan.returnedAt;
              const isOverdue = isActive && loan.expectedReturnDate < today;
              const loanStatusClass = !isActive ? 'status-returned' : (isOverdue ? 'status-overdue' : 'status-active');
              return (
                <div className={`loan-item ${loanStatusClass}`} key={loan.id}>
                  <div className="inquiry-head">
                    <div>
                      <strong className="inquiry-work">{loan.workTitle}</strong>
                      <span className="inquiry-customer">{loan.workArtist} · <Building2 size={12} />{loan.borrower}</span>
                    </div>
                    <div className="status-dropdown">
                      {isActive ? (
                        <button
                          className={`status-select ${isOverdue ? 'status-overdue' : 'status-active'}`}
                          onClick={() => markLoanReturned(loan.id)}
                        >
                          {isOverdue ? <XCircle size={14} /> : <ArrowLeftRight size={14} />}
                          {isOverdue ? '已逾期·点我归还' : '借展中·点我归还'}
                        </button>
                      ) : (
                        <span className="status-select status-returned">
                          <CheckCircle2 size={14} />已归还
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="inquiry-body">
                    <span><Calendar size={12} />借出：{loan.loanDate}</span>
                    <span><Clock size={12} />预计归还：{loan.expectedReturnDate}</span>
                    {loan.contactPerson && <span><User size={12} />联系人：{loan.contactPerson}</span>}
                    {loan.notes && <span className="inquiry-remark"><MessageCircle size={12} />{loan.notes}</span>}
                    {loan.returnedAt && <span className="inquiry-date">归还于 {new Date(loan.returnedAt).toLocaleDateString('zh-CN')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bottom">
        <div className="panel">
          <h2>艺术家详情</h2>
          {artistStats.map((artist) => <p className="artist" key={artist.id}><strong>{artist.name}</strong><span>{artist.style} · {artist.works.length}件 · {artist.note}</span></p>)}
        </div>
        <div className="settlement-column">
          <div className="panel settlement-overview">
            <div className="panel-header">
              <h2><Coins size={18} />月度结算概览</h2>
              <span className="month-label">{monthlySettlement.currentMonthLabel}</span>
            </div>
            <div className="settlement-stats">
              <div className="stat-card stat-pending">
                <div className="stat-icon"><Clock size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">待结算</span>
                  <strong className="stat-value">{monthlySettlement.pendingCount}件</strong>
                  <span className="stat-amount">¥{monthlySettlement.pendingAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card stat-settled">
                <div className="stat-icon"><CheckCircle2 size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">已结算</span>
                  <strong className="stat-value">{monthlySettlement.settledCount}件</strong>
                  <span className="stat-amount">¥{monthlySettlement.settledAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card stat-sold">
                <div className="stat-icon"><Banknote size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">销售金额</span>
                  <strong className="stat-value">{monthlySettlement.soldCount}件已售</strong>
                  <span className="stat-amount">¥{monthlySettlement.soldAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-card stat-commission">
                <div className="stat-icon"><Percent size={20} /></div>
                <div className="stat-info">
                  <span className="stat-label">预计佣金</span>
                  <strong className="stat-value">待结算部分</strong>
                  <span className="stat-amount">¥{Math.round(monthlySettlement.estimatedCommission).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="panel">
            <h2>待结算列表</h2>
            {settlementWorks.length === 0 ? (
              <p className="empty-tip">暂无待结算作品</p>
            ) : (
              settlementWorks.map((work) => <p className="artist" key={work.id}><strong>{work.title}</strong><span>{work.artist} · ¥{Number(work.price).toLocaleString()}</span></p>)
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
