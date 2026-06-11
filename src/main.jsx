import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, ArrowLeftRight, Banknote, Brush, Building2, Calendar, CheckCircle2, Clock, Coins, FileUp, Filter, MessageCircle, MessageSquare, Percent, Phone, Plus, Search, Tag, User, XCircle } from 'lucide-react';
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
const VALID_EXHIBIT = ['展出中', '库房', '借展', '退回'];
const VALID_SALE = ['待售', '已预订', '已售'];
const CSV_COLUMNS = ['艺术家', '作品名', '价格', '入库日期', '展态', '销售状态'];

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function countDelimitersOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        i++;
      } else if (char === '"') {
        inQuotes = false;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        count++;
      }
    }
  }
  return count;
}

function repairSplitThousandSeparator(cells, expectedFields) {
  if (cells.length <= expectedFields) return cells;

  const looksLikePricePart = (s) => {
    const trimmed = s.trim().replace(/[￥¥$€\s]/g, '');
    return /^\d{1,3}$/.test(trimmed) || /^\d{1,3}(\.\d+)?$/.test(trimmed);
  };

  const looksLikeDecimal = (s) => {
    const trimmed = s.trim();
    return /^\d+$/.test(trimmed) || /^\d+\.\d+$/.test(trimmed);
  };

  const result = [];
  let i = 0;
  while (i < cells.length) {
    if (i < cells.length - 1 && looksLikePricePart(cells[i]) && looksLikeDecimal(cells[i + 1])) {
      const merged = cells[i].trim() + ',' + cells[i + 1].trim();
      result.push(merged);
      i += 2;
    } else {
      result.push(cells[i]);
      i++;
    }
  }
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { header: null, rows: [] };

  const detectDelimiter = (line) => {
    const candidates = [',', '\t', ';', '，'];
    let best = ',';
    let maxCount = -1;
    for (const d of candidates) {
      const count = countDelimitersOutsideQuotes(line, d);
      if (count > maxCount) {
        maxCount = count;
        best = d;
      }
    }
    return best;
  };

  const delimiter = detectDelimiter(lines[0]);
  const parseLine = (line) => parseCSVLine(line, delimiter);

  const firstLine = parseLine(lines[0]);
  const hasHeader = firstLine.some(cell => CSV_COLUMNS.includes(cell));

  let headerMap = null;
  let dataStart = 0;

  if (hasHeader) {
    headerMap = {};
    firstLine.forEach((cell, idx) => {
      const normalized = cell.trim();
      if (CSV_COLUMNS.includes(normalized)) {
        headerMap[normalized] = idx;
      }
    });
    dataStart = 1;
  }

  const rows = [];
  for (let i = dataStart; i < lines.length; i++) {
    let cells = parseLine(lines[i]);
    cells = repairSplitThousandSeparator(cells, 6);
    if (cells.every(c => c === '')) continue;

    let row;
    if (headerMap) {
      row = {
        artist: cells[headerMap['艺术家']] ?? '',
        title: cells[headerMap['作品名']] ?? '',
        price: cells[headerMap['价格']] ?? '',
        inDate: cells[headerMap['入库日期']] ?? '',
        exhibit: cells[headerMap['展态']] ?? '',
        sale: cells[headerMap['销售状态']] ?? '',
        rawLine: lines[i],
        lineNumber: i + 1
      };
    } else {
      row = {
        artist: cells[0] ?? '',
        title: cells[1] ?? '',
        price: cells[2] ?? '',
        inDate: cells[3] ?? '',
        exhibit: cells[4] ?? '',
        sale: cells[5] ?? '',
        rawLine: lines[i],
        lineNumber: i + 1
      };
    }
    rows.push(row);
  }

  return { header: hasHeader ? firstLine : null, rows, headerMap };
}

function validateRow(row, existingTitles, existingArtists, batchTitles) {
  const errors = [];

  if (!row.artist || row.artist.trim() === '') {
    errors.push('缺少艺术家');
  }

  const artistName = row.artist.trim();
  const artistExists = existingArtists.has(artistName);
  if (artistName && !artistExists) {
    errors.push(`艺术家"${artistName}"未在系统中登记`);
  }

  if (!row.title || row.title.trim() === '') {
    errors.push('缺少作品名');
  }

  const title = row.title.trim();
  if (title) {
    if (existingTitles.has(title)) {
      errors.push(`作品名"${title}"已存在`);
    }
    if (batchTitles.has(title)) {
      errors.push(`作品名"${title}"在导入列表中重复`);
    }
  }

  const priceRaw = row.price.trim();
  let price = null;
  if (priceRaw === '') {
    errors.push('缺少价格');
  } else {
    const cleaned = priceRaw.replace(/[￥¥,，\s]/g, '');
    price = Number(cleaned);
    if (isNaN(price) || price <= 0 || !isFinite(price)) {
      errors.push(`价格"${row.price}"格式非法`);
    }
  }

  let inDate = row.inDate.trim();
  if (inDate && !/^\d{4}-\d{2}-\d{2}$/.test(inDate)) {
    const parsed = new Date(inDate);
    if (isNaN(parsed.getTime())) {
      errors.push(`入库日期"${row.inDate}"格式非法，应为YYYY-MM-DD`);
    } else {
      inDate = parsed.toISOString().slice(0, 10);
    }
  }

  const exhibit = row.exhibit.trim() || '展出中';
  if (exhibit && !VALID_EXHIBIT.includes(exhibit)) {
    errors.push(`展态"${row.exhibit}"无效，应为：${VALID_EXHIBIT.join('、')}`);
  }

  const sale = row.sale.trim() || '待售';
  if (sale && !VALID_SALE.includes(sale)) {
    errors.push(`销售状态"${row.sale}"无效，应为：${VALID_SALE.join('、')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned: {
      artist: artistName,
      title,
      price: price ?? 0,
      inDate: inDate || iso(0),
      exhibit: VALID_EXHIBIT.includes(exhibit) ? exhibit : '展出中',
      sale: VALID_SALE.includes(sale) ? sale : '待售'
    }
  };
}

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
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchCsvText, setBatchCsvText] = useState('');
  const [batchPreview, setBatchPreview] = useState(null);

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

  function previewBatchImport() {
    if (!batchCsvText.trim()) {
      setBatchPreview(null);
      return;
    }

    const parsed = parseCSV(batchCsvText);
    const existingTitles = new Set(works.map((w) => w.title));
    const existingArtists = new Set(artists.map((a) => a.name));
    const batchTitles = new Set();
    const validRows = [];
    const errorRows = [];

    parsed.rows.forEach((row) => {
      const result = validateRow(row, existingTitles, existingArtists, batchTitles);
      if (result.valid) {
        batchTitles.add(result.cleaned.title);
        validRows.push({ ...row, cleaned: result.cleaned });
      } else {
        errorRows.push({ ...row, errors: result.errors });
      }
    });

    setBatchPreview({
      validRows,
      errorRows,
      totalRows: parsed.rows.length,
      header: parsed.header,
      headerMap: parsed.headerMap
    });
  }

  function confirmBatchImport() {
    if (!batchPreview || batchPreview.validRows.length === 0) return;

    const newWorks = batchPreview.validRows.map((row) => ({
      id: crypto.randomUUID(),
      artist: row.cleaned.artist,
      title: row.cleaned.title,
      price: row.cleaned.price,
      inDate: row.cleaned.inDate,
      exhibit: row.cleaned.exhibit,
      sale: row.cleaned.sale,
      settlement: '未结算',
      saleDate: null,
      settlementDate: null
    }));

    setWorks([...newWorks, ...works]);
    setBatchCsvText('');
    setBatchPreview(null);
    setShowBatchImport(false);
  }

  function clearBatchImport() {
    setBatchCsvText('');
    setBatchPreview(null);
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
            <button className="ghost" onClick={() => setShowBatchImport(!showBatchImport)}><FileUp size={14} /> 批量导入</button>
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

      {showBatchImport && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><FileUp size={18} />作品批量导入预览</h2>
            <button className="ghost small" onClick={() => { setShowBatchImport(false); clearBatchImport(); }}>收起</button>
          </div>
          <div className="batch-import">
            <div className="form-row">
              <label><span className="label-icon"><FileUp size={14} /></span>
                <textarea
                  className="batch-textarea"
                  placeholder={'粘贴CSV格式数据，支持以下列顺序：&#10;艺术家,作品名,价格,入库日期,展态,销售状态&#10;示例：&#10;谢青岚,山水之间,12800,2026-01-15,展出中,待售&#10;赵以南,静物写生,8600,2026-01-10,库房,已预订'}
                  value={batchCsvText}
                  onChange={(e) => setBatchCsvText(e.target.value)}
                  rows={6}
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost" onClick={clearBatchImport}>清空</button>
              <button type="button" onClick={previewBatchImport}>解析预览</button>
            </div>

            {batchPreview && (
              <div className="batch-preview">
                <div className="batch-summary">
                  <span className="batch-summary-item valid">
                    <CheckCircle2 size={16} /> 可导入 {batchPreview.validRows.length} 行
                  </span>
                  <span className="batch-summary-item error">
                    <XCircle size={16} /> 错误行 {batchPreview.errorRows.length} 行
                  </span>
                  <span className="batch-summary-item total">
                    共解析 {batchPreview.totalRows} 行
                  </span>
                </div>

                {batchPreview.header && (
                  <div className="batch-header-info">
                    <span className="batch-header-detected">
                      已检测到表头：{batchPreview.header.join(' | ')}
                    </span>
                  </div>
                )}

                {batchPreview.validRows.length > 0 && (
                  <div className="batch-section">
                    <h3 className="batch-section-title valid-title"><CheckCircle2 size={16} /> 可导入作品</h3>
                    <div className="batch-table-container">
                      <table className="batch-table">
                        <thead>
                          <tr>
                            <th>艺术家</th>
                            <th>作品名</th>
                            <th>价格</th>
                            <th>入库日期</th>
                            <th>展态</th>
                            <th>销售状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchPreview.validRows.map((row, idx) => (
                            <tr key={idx} className="batch-row-valid">
                              <td>{row.cleaned.artist}</td>
                              <td>{row.cleaned.title}</td>
                              <td>¥{Number(row.cleaned.price).toLocaleString()}</td>
                              <td>{row.cleaned.inDate}</td>
                              <td>{row.cleaned.exhibit}</td>
                              <td>{row.cleaned.sale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {batchPreview.errorRows.length > 0 && (
                  <div className="batch-section">
                    <h3 className="batch-section-title error-title"><XCircle size={16} /> 错误行（将被跳过）</h3>
                    <div className="batch-table-container">
                      <table className="batch-table">
                        <thead>
                          <tr>
                            <th style={{width: '60px'}}>行号</th>
                            <th>原始内容</th>
                            <th>错误原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchPreview.errorRows.map((row, idx) => (
                            <tr key={idx} className="batch-row-error">
                              <td>{row.lineNumber}</td>
                              <td className="batch-raw-cell">{row.rawLine}</td>
                              <td className="batch-error-cell">
                                {row.errors.map((err, i) => (
                                  <span key={i} className="batch-error-tag"><AlertCircle size={12} /> {err}</span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {batchPreview.validRows.length > 0 && (
                  <div className="form-actions">
                    <button type="button" className="ghost" onClick={() => setBatchPreview(null)}>取消</button>
                    <button type="button" onClick={confirmBatchImport}>
                      确认导入 {batchPreview.validRows.length} 条作品
                    </button>
                  </div>
                )}

                {batchPreview.totalRows > 0 && batchPreview.validRows.length === 0 && (
                  <p className="empty-tip">没有可导入的作品，请检查数据格式后重试。</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

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
