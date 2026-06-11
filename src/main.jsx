import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, ArrowLeftRight, Banknote, Brush, Building2, Calendar, CheckCircle2, CheckSquare, Clock, Coins, Database, Download, FileText, FileUp, Filter, Info, MessageCircle, MessageSquare, Pencil, Percent, Phone, Plus, Receipt, RotateCcw, Search, TrendingUp, Upload, User, XCircle, ClipboardList, Eye, AlertTriangle, Package } from 'lucide-react';
import './styles.css';
import CustomerList from './CustomerList.jsx';
import { buildCustomerProfile } from './customerUtils.js';

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
const BALANCE_STATUS = ['待支付', '已支付', '部分支付'];
const INVENTORY_STATUS = ['未核对', '已核对', '异常', '缺失'];
const INVENTORY_TASK_STATUS = ['进行中', '已完成'];

const seedOrders = [
  { id: 'seed-order-jqcy03', workId: 'seed-work-jqcy03', workTitle: '旧墙采样03', workArtist: '赵以南', customerName: '张经理', customerPhone: '13800008888', dealPrice: 8600, deposit: 2580, balanceStatus: '待支付', dealDate: iso(-3), note: '老客户介绍', createdAt: iso(-3), cancelledAt: null }
];

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

function repairSplitThousandSeparator(cells, expectedFields, priceIndex) {
  if (cells.length <= expectedFields) return cells;
  if (priceIndex < 0 || priceIndex >= cells.length) return cells;

  const extraCells = cells.length - expectedFields;
  const priceParts = cells.slice(priceIndex, priceIndex + extraCells + 1);
  if (priceParts.length !== extraCells + 1) return cells;

  const normalizePricePart = (s) => s.trim().replace(/[￥¥$€\s]/g, '');
  const firstPart = normalizePricePart(priceParts[0]);
  const restParts = priceParts.slice(1).map((part) => part.trim());
  const validThousandParts = (
    /^\d{1,3}$/.test(firstPart) &&
    restParts.length > 0 &&
    restParts.every((part, idx) => idx === restParts.length - 1
      ? /^\d{3}(\.\d+)?$/.test(part)
      : /^\d{3}$/.test(part))
  );

  if (!validThousandParts) {
    return cells;
  }

  const repaired = [
    ...cells.slice(0, priceIndex),
    priceParts.map((part) => part.trim()).join(','),
    ...cells.slice(priceIndex + extraCells + 1)
  ];

  return repaired.length === expectedFields ? repaired : cells;
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
    const priceIndex = headerMap ? headerMap['价格'] : 2;
    cells = repairSplitThousandSeparator(cells, CSV_COLUMNS.length, priceIndex);
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
  const normalizedSale = VALID_SALE.includes(sale) ? sale : '待售';
  const safeSale = normalizedSale === '已售' ? '待售' : normalizedSale;

  return {
    valid: errors.length === 0,
    errors,
    warnings: normalizedSale === '已售' ? ['「已售」状态需通过订单登记，导入后为「待售」'] : [],
    cleaned: {
      artist: artistName,
      title,
      price: price ?? 0,
      inDate: inDate || iso(0),
      exhibit: VALID_EXHIBIT.includes(exhibit) ? exhibit : '展出中',
      sale: safeSale
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
  const [orders, setOrders] = useStorage('zfl-5-orders', seedOrders);
  const [orderForm, setOrderForm] = useState({ workId: '', customerName: '', customerPhone: '', dealPrice: '', deposit: '', balanceStatus: '待支付', dealDate: iso(0), note: '' });
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderFormErrors, setOrderFormErrors] = useState([]);
  const [orderFilterRaw, setOrderFilterRaw] = useStorage('zfl-5-order-filter', '全部订单');
  const [statements, setStatements] = useStorage('zfl-5-statements', []);
  const [showStatementForm, setShowStatementForm] = useState(false);
  const [statementForm, setStatementForm] = useState({ artist: '', startDate: '', endDate: '' });
  const [statementPreview, setStatementPreview] = useState(null);
  const [statementFilter, setStatementFilter] = useState('全部');
  const [inventoryTasks, setInventoryTasks] = useStorage('zfl-5-inventory-tasks', []);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({ name: '', note: '' });
  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [inventoryFilter, setInventoryFilter] = useState('全部任务');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryItemFilter, setInventoryItemFilter] = useState('全部状态');
  const [showMigration, setShowMigration] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [migrationStep, setMigrationStep] = useState('idle');
  const [migrationError, setMigrationError] = useState('');

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

    const activeOrders = orders.filter((o) => !o.cancelledAt);

    const soldThisMonthOrders = activeOrders.filter((o) => isThisMonth(o.dealDate));
    const settledThisMonthWorks = works.filter((w) => w.sale === '已售' && w.settlement === '已结算' && isThisMonth(w.settlementDate));
    const pendingThisMonthWorks = works.filter((w) => w.sale === '已售' && w.settlement === '待结算' && isThisMonth(w.saleDate));

    const getDealPriceForWork = (workId) => {
      const order = activeOrders.find((o) => o.workId === workId);
      return order ? Number(order.dealPrice || 0) : 0;
    };

    const soldAmount = soldThisMonthOrders.reduce((sum, o) => sum + Number(o.dealPrice || 0), 0);
    const pendingAmount = pendingThisMonthWorks.reduce((sum, w) => sum + getDealPriceForWork(w.id), 0);
    const settledAmount = settledThisMonthWorks.reduce((sum, w) => sum + getDealPriceForWork(w.id), 0);

    const estimatedCommission = pendingThisMonthWorks.reduce((sum, w) => {
      const rate = commissionRateMap[w.artist] ?? DEFAULT_COMMISSION_RATE;
      return sum + getDealPriceForWork(w.id) * rate;
    }, 0);

    const settledCommission = settledThisMonthWorks.reduce((sum, w) => {
      const rate = commissionRateMap[w.artist] ?? DEFAULT_COMMISSION_RATE;
      return sum + getDealPriceForWork(w.id) * rate;
    }, 0);

    return {
      pendingCount: pendingThisMonthWorks.length,
      pendingAmount,
      settledCount: settledThisMonthWorks.length,
      settledAmount,
      soldCount: soldThisMonthOrders.length,
      soldAmount,
      estimatedCommission,
      settledCommission,
      currentMonthLabel: `${currentYear}年${currentMonth + 1}月`
    };
  }, [works, orders, commissionRateMap]);

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

  const orderFilter = (orderFilterRaw === '全部订单' || orderFilterRaw === '有效订单' || orderFilterRaw === '已撤销' || validWorkIds.has(orderFilterRaw))
    ? orderFilterRaw
    : '全部订单';

  const activeOrderMap = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      if (!order.cancelledAt) {
        map[order.workId] = order;
      }
    });
    return map;
  }, [orders]);

  const soldWithoutOrderIds = useMemo(() => {
    const set = new Set();
    works.forEach((work) => {
      if (work.sale === '已售' && !activeOrderMap[work.id]) {
        set.add(work.id);
      }
    });
    return set;
  }, [works, activeOrderMap]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (orderFilter === '全部订单') return true;
        if (orderFilter === '有效订单') return !order.cancelledAt;
        if (orderFilter === '已撤销') return order.cancelledAt;
        return order.workId === orderFilter;
      })
      .sort((a, b) => new Date(b.dealDate) - new Date(a.dealDate));
  }, [orders, orderFilter]);

  const orderStats = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.cancelledAt);
    const totalDealAmount = activeOrders.reduce((sum, o) => sum + Number(o.dealPrice || 0), 0);
    const totalDeposit = activeOrders.reduce((sum, o) => sum + Number(o.deposit || 0), 0);
    const pendingBalance = activeOrders
      .filter((o) => o.balanceStatus !== '已支付')
      .reduce((sum, o) => sum + (Number(o.dealPrice || 0) - Number(o.deposit || 0)), 0);
    return {
      totalCount: activeOrders.length,
      totalDealAmount,
      totalDeposit,
      pendingBalance,
      cancelledCount: orders.filter((o) => o.cancelledAt).length
    };
  }, [orders]);

  const customerStats = useMemo(() => {
    const list = buildCustomerProfile(inquiries, orders);
    return {
      totalCount: list.length,
      dealedCount: list.filter((c) => c.orderCount > 0).length
    };
  }, [inquiries, orders]);

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
    const safeSale = workForm.sale === '已售' ? '待售' : workForm.sale;
    setWorks([{
      id: crypto.randomUUID(),
      ...workForm,
      sale: safeSale,
      price: Number(workForm.price || 0),
      saleDate: safeSale === '已售' ? iso(0) : null,
      settlement: '未结算',
      settlementDate: null
    }, ...works]);
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

  function openOrderForWork(workId) {
    const selectedWork = works.find((w) => w.id === workId);
    setEditingOrderId(null);
    setOrderFormErrors([]);
    setOrderForm({
      workId,
      customerName: '',
      customerPhone: '',
      dealPrice: selectedWork ? String(selectedWork.price) : '',
      deposit: '',
      balanceStatus: '待支付',
      dealDate: iso(0),
      note: ''
    });
    setShowOrderForm(true);
  }

  function openEditOrder(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    setEditingOrderId(orderId);
    setOrderFormErrors([]);
    setOrderForm({
      workId: order.workId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      dealPrice: String(order.dealPrice),
      deposit: String(order.deposit),
      balanceStatus: order.balanceStatus,
      dealDate: order.dealDate,
      note: order.note || ''
    });
    setShowOrderForm(true);
  }

  function validateOrderForm() {
    const errors = [];
    const dealPrice = Number(orderForm.dealPrice || 0);
    const deposit = Number(orderForm.deposit || 0);

    if (!orderForm.workId) {
      errors.push('请选择作品');
    }
    if (!orderForm.customerName.trim()) {
      errors.push('请填写客户姓名');
    }
    if (!orderForm.customerPhone.trim()) {
      errors.push('请填写联系方式');
    }
    if (!orderForm.dealPrice || dealPrice <= 0) {
      errors.push('成交价必须大于 0');
    }
    if (deposit < 0) {
      errors.push('订金不能为负数');
    }
    if (deposit > dealPrice && dealPrice > 0) {
      errors.push('订金不能大于成交价');
    }
    if (!orderForm.dealDate) {
      errors.push('请选择成交日期');
    }
    setOrderFormErrors(errors);
    return errors.length === 0;
  }

  function addOrder(event) {
    event.preventDefault();
    if (!validateOrderForm()) return;

    const selectedWork = works.find((w) => w.id === orderForm.workId);
    const dealPrice = Number(orderForm.dealPrice || 0);
    const deposit = Number(orderForm.deposit || 0);

    if (editingOrderId) {
      setOrders(orders.map((o) => o.id === editingOrderId ? {
        ...o,
        customerName: orderForm.customerName.trim(),
        customerPhone: orderForm.customerPhone.trim(),
        dealPrice,
        deposit,
        balanceStatus: orderForm.balanceStatus,
        dealDate: orderForm.dealDate,
        note: orderForm.note.trim(),
        updatedAt: new Date().toISOString()
      } : o));

      if (orderForm.dealDate) {
        updateWork(orderForm.workId, { saleDate: orderForm.dealDate });
      }
    } else {
      const newOrder = {
        id: crypto.randomUUID(),
        workId: orderForm.workId,
        workTitle: selectedWork ? selectedWork.title : '',
        workArtist: selectedWork ? selectedWork.artist : '',
        customerName: orderForm.customerName.trim(),
        customerPhone: orderForm.customerPhone.trim(),
        dealPrice,
        deposit,
        balanceStatus: orderForm.balanceStatus,
        dealDate: orderForm.dealDate,
        note: orderForm.note.trim(),
        createdAt: new Date().toISOString(),
        cancelledAt: null
      };

      setOrders([newOrder, ...orders]);
      updateWork(orderForm.workId, {
        sale: '已售',
        settlement: '待结算',
        saleDate: orderForm.dealDate
      });
    }

    setOrderForm({ workId: '', customerName: '', customerPhone: '', dealPrice: '', deposit: '', balanceStatus: '待支付', dealDate: iso(0), note: '' });
    setOrderFormErrors([]);
    setEditingOrderId(null);
    setShowOrderForm(false);
  }

  function cancelOrder(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    setOrders(orders.map((o) => o.id === orderId ? { ...o, cancelledAt: new Date().toISOString() } : o));

    const otherActiveOrders = orders.filter((o) => o.workId === order.workId && o.id !== orderId && !o.cancelledAt);
    if (otherActiveOrders.length === 0) {
      updateWork(order.workId, {
        sale: '待售',
        settlement: '未结算',
        saleDate: null,
        settlementDate: null
      });
    }
  }

  function updateOrderBalanceStatus(orderId, nextStatus) {
    setOrders(orders.map((o) => o.id === orderId ? { ...o, balanceStatus: nextStatus } : o));
  }

  function previewStatement() {
    if (!statementForm.artist || !statementForm.startDate || !statementForm.endDate) {
      return;
    }

    const activeOrders = orders.filter((o) => !o.cancelledAt);
    const workOrderMap = {};
    activeOrders.forEach((o) => {
      workOrderMap[o.workId] = o;
    });

    const soldWorks = works.filter((w) => {
      if (w.artist !== statementForm.artist) return false;
      if (w.sale !== '已售') return false;
      const saleDate = w.saleDate || (workOrderMap[w.id] ? workOrderMap[w.id].dealDate : null);
      if (!saleDate) return false;
      return saleDate >= statementForm.startDate && saleDate <= statementForm.endDate;
    });

    const commissionRate = commissionRateMap[statementForm.artist] ?? DEFAULT_COMMISSION_RATE;

    const items = soldWorks.map((w) => {
      const order = workOrderMap[w.id];
      const dealPrice = order ? Number(order.dealPrice || 0) : Number(w.price || 0);
      const commission = Math.round(dealPrice * commissionRate);
      const payable = dealPrice - commission;
      return {
        workId: w.id,
        workTitle: w.title,
        artist: w.artist,
        dealPrice,
        commissionRate: Math.round(commissionRate * 100),
        commission,
        payable,
        saleDate: w.saleDate || (order ? order.dealDate : ''),
        settlementStatus: w.settlement,
        customerName: order ? order.customerName : '',
        orderId: order ? order.id : null
      };
    });

    const totalDealPrice = items.reduce((sum, it) => sum + it.dealPrice, 0);
    const totalCommission = items.reduce((sum, it) => sum + it.commission, 0);
    const totalPayable = items.reduce((sum, it) => sum + it.payable, 0);

    setStatementPreview({
      artist: statementForm.artist,
      startDate: statementForm.startDate,
      endDate: statementForm.endDate,
      items,
      totalDealPrice,
      totalCommission,
      totalPayable,
      commissionRate: Math.round(commissionRate * 100)
    });
  }

  function saveStatement() {
    if (!statementPreview || statementPreview.items.length === 0) return;

    const newStatement = {
      id: crypto.randomUUID(),
      artist: statementPreview.artist,
      startDate: statementPreview.startDate,
      endDate: statementPreview.endDate,
      items: JSON.parse(JSON.stringify(statementPreview.items)),
      totalDealPrice: statementPreview.totalDealPrice,
      totalCommission: statementPreview.totalCommission,
      totalPayable: statementPreview.totalPayable,
      commissionRate: statementPreview.commissionRate,
      confirmed: false,
      confirmedAt: null,
      createdAt: new Date().toISOString()
    };

    setStatements([newStatement, ...statements]);
    setStatementPreview(null);
    setStatementForm({ artist: '', startDate: '', endDate: '' });
    setShowStatementForm(false);
  }

  function confirmStatement(statementId) {
    setStatements(statements.map((s) =>
      s.id === statementId
        ? { ...s, confirmed: true, confirmedAt: new Date().toISOString() }
        : s
    ));
  }

  function clearStatementForm() {
    setStatementForm({ artist: '', startDate: '', endDate: '' });
    setStatementPreview(null);
  }

  function createInventoryTask(event) {
    event.preventDefault();
    if (!inventoryForm.name.trim()) return;
    const snapshot = works.map((work) => ({
      id: crypto.randomUUID(),
      workId: work.id,
      workSnapshot: JSON.parse(JSON.stringify(work)),
      status: '未核对',
      note: '',
      checkedAt: null
    }));
    const newTask = {
      id: crypto.randomUUID(),
      name: inventoryForm.name.trim(),
      note: inventoryForm.note.trim(),
      status: '进行中',
      items: snapshot,
      totalCount: snapshot.length,
      checkedCount: 0,
      exceptionCount: 0,
      missingCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    setInventoryTasks([newTask, ...inventoryTasks]);
    setInventoryForm({ name: '', note: '' });
    setShowInventoryForm(false);
  }

  function updateInventoryItem(taskId, itemId, patch) {
    setInventoryTasks(inventoryTasks.map((task) => {
      if (task.id !== taskId) return task;
      const updatedItems = task.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              checkedAt: patch.status && patch.status !== '未核对'
                ? (patch.checkedAt || new Date().toISOString())
                : item.checkedAt
            }
          : item
      );
      const checkedCount = updatedItems.filter((i) => i.status === '已核对').length;
      const exceptionCount = updatedItems.filter((i) => i.status === '异常').length;
      const missingCount = updatedItems.filter((i) => i.status === '缺失').length;
      return {
        ...task,
        items: updatedItems,
        checkedCount,
        exceptionCount,
        missingCount
      };
    }));
  }

  function completeInventoryTask(taskId) {
    setInventoryTasks(inventoryTasks.map((task) =>
      task.id === taskId
        ? { ...task, status: '已完成', completedAt: new Date().toISOString() }
        : task
    ));
  }

  function reopenInventoryTask(taskId) {
    setInventoryTasks(inventoryTasks.map((task) =>
      task.id === taskId
        ? { ...task, status: '进行中', completedAt: null }
        : task
    ));
  }

  const selectedInventoryTask = useMemo(() =>
    inventoryTasks.find((t) => t.id === selectedInventoryId) || null,
  [inventoryTasks, selectedInventoryId]);

  const filteredInventoryTasks = useMemo(() => {
    return inventoryTasks
      .filter((task) => {
        if (inventoryFilter === '全部任务') return true;
        return task.status === inventoryFilter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [inventoryTasks, inventoryFilter]);

  const filteredInventoryItems = useMemo(() => {
    if (!selectedInventoryTask) return [];
    return selectedInventoryTask.items.filter((item) => {
      const text = `${item.workSnapshot.artist}${item.workSnapshot.title}${item.workSnapshot.exhibit}`;
      const matchQuery = text.includes(inventoryQuery.trim());
      const matchStatus = inventoryItemFilter === '全部状态' || item.status === inventoryItemFilter;
      return matchQuery && matchStatus;
    });
  }, [selectedInventoryTask, inventoryQuery, inventoryItemFilter]);

  const inventoryStats = useMemo(() => {
    const activeTasks = inventoryTasks.filter((t) => t.status === '进行中').length;
    const completedTasks = inventoryTasks.filter((t) => t.status === '已完成').length;
    return {
      total: inventoryTasks.length,
      active: activeTasks,
      completed: completedTasks
    };
  }, [inventoryTasks]);

  const filteredStatements = useMemo(() => {
    return statements
      .filter((s) => {
        if (statementFilter === '全部') return true;
        if (statementFilter === '已确认') return s.confirmed;
        if (statementFilter === '待确认') return !s.confirmed;
        return s.artist === statementFilter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [statements, statementFilter]);

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
    const warningRows = [];

    parsed.rows.forEach((row) => {
      const result = validateRow(row, existingTitles, existingArtists, batchTitles);
      if (result.valid) {
        batchTitles.add(result.cleaned.title);
        validRows.push({ ...row, cleaned: result.cleaned, warnings: result.warnings || [] });
        if (result.warnings && result.warnings.length > 0) {
          warningRows.push({ ...row, warnings: result.warnings });
        }
      } else {
        errorRows.push({ ...row, errors: result.errors });
      }
    });

    setBatchPreview({
      validRows,
      errorRows,
      warningRows,
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

  const BACKUP_VERSION = 1;
  const STORAGE_KEYS = {
    artists: 'zfl-5-artists',
    works: 'zfl-5-works',
    inquiries: 'zfl-5-inquiries',
    orders: 'zfl-5-orders',
    statements: 'zfl-5-statements',
    loans: 'zfl-5-loans',
    inventoryTasks: 'zfl-5-inventory-tasks'
  };

  const FIELD_DEFAULTS = {
    artists: { id: '', name: '', phone: '', style: '', note: '' },
    works: { id: '', artist: '', title: '', price: 0, inDate: '', exhibit: '展出中', sale: '待售', settlement: '未结算', saleDate: null, settlementDate: null },
    inquiries: { id: '', workId: '', workTitle: '', customerName: '', customerPhone: '', intendedPrice: 0, remark: '', status: '待跟进', createdAt: '' },
    orders: { id: '', workId: '', workTitle: '', workArtist: '', customerName: '', customerPhone: '', dealPrice: 0, deposit: 0, balanceStatus: '待支付', dealDate: '', note: '', createdAt: '', cancelledAt: null },
    statements: { id: '', artist: '', startDate: '', endDate: '', items: [], totalDealPrice: 0, totalCommission: 0, totalPayable: 0, commissionRate: 35, confirmed: false, confirmedAt: null, createdAt: '' },
    loans: { id: '', workId: '', workTitle: '', workArtist: '', borrower: '', loanDate: '', expectedReturnDate: '', contactPerson: '', notes: '', returnedAt: null, createdAt: '' },
    inventoryTasks: { id: '', name: '', note: '', status: '进行中', items: [], totalCount: 0, checkedCount: 0, exceptionCount: 0, missingCount: 0, createdAt: '', completedAt: null }
  };

  function normalizeRecord(entityType, record) {
    const defaults = FIELD_DEFAULTS[entityType];
    if (!defaults) return record;
    const normalized = { ...record };
    for (const [key, defaultVal] of Object.entries(defaults)) {
      if (!(key in normalized) || normalized[key] === undefined) {
        normalized[key] = defaultVal;
      }
    }
    return normalized;
  }

  function exportBackup() {
    const data = getCurrentDataFromState();
    const backup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'zfl-5-gallery-consignment',
      data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `画廊寄售备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getCurrentDataFromState() {
    return {
      artists: JSON.parse(JSON.stringify(artists)),
      works: JSON.parse(JSON.stringify(works)),
      inquiries: JSON.parse(JSON.stringify(inquiries)),
      orders: JSON.parse(JSON.stringify(orders)),
      statements: JSON.parse(JSON.stringify(statements)),
      loans: JSON.parse(JSON.stringify(loans)),
      inventoryTasks: JSON.parse(JSON.stringify(inventoryTasks))
    };
  }

  function analyzeBackup(backup, currentData) {
    const currentIdSets = {};
    for (const entityType of Object.keys(STORAGE_KEYS)) {
      currentIdSets[entityType] = new Set(currentData[entityType].map((r) => r.id));
    }

    const currentNameSets = {};
    currentNameSets.artists = new Set(currentData.artists.map((a) => a.name));
    currentNameSets.works = new Set(currentData.works.map((w) => `${w.artist}||${w.title}`));

    const result = {};
    let totalAdd = 0;
    let totalOverwrite = 0;
    let totalSkip = 0;
    const warnings = [];

    const backupVersion = backup.version || 0;
    if (backupVersion < BACKUP_VERSION) {
      warnings.push(`备份版本 v${backupVersion} 低于当前版本 v${BACKUP_VERSION}，缺失字段将自动填充默认值`);
    }

    for (const entityType of Object.keys(STORAGE_KEYS)) {
      const backupRecords = (backup.data && backup.data[entityType]) || [];
      const analyzed = [];

      for (const rawRecord of backupRecords) {
        const record = normalizeRecord(entityType, rawRecord);
        const currentIdSet = currentIdSets[entityType];

        if (currentIdSet.has(record.id)) {
          const currentRecord = currentData[entityType].find((r) => r.id === record.id);
          const isSame = JSON.stringify(record) === JSON.stringify(currentRecord);
          analyzed.push({
            action: 'overwrite',
            record,
            currentRecord,
            reason: isSame ? '内容一致，覆盖无变化' : 'ID已存在，将覆盖现有记录'
          });
          totalOverwrite++;
        } else if (entityType === 'artists' && record.name && currentNameSets.artists.has(record.name)) {
          const existingArtist = currentData.artists.find((a) => a.name === record.name);
          analyzed.push({
            action: 'skip',
            record,
            currentRecord: existingArtist,
            reason: `艺术家「${record.name}」已存在（ID不同），将跳过`
          });
          totalSkip++;
        } else if (entityType === 'works' && record.artist && record.title && currentNameSets.works.has(`${record.artist}||${record.title}`)) {
          const existingWork = currentData.works.find((w) => w.artist === record.artist && w.title === record.title);
          analyzed.push({
            action: 'skip',
            record,
            currentRecord: existingWork,
            reason: `作品「${record.artist} - ${record.title}」已存在（ID不同），将跳过`
          });
          totalSkip++;
        } else {
          analyzed.push({
            action: 'add',
            record,
            currentRecord: null,
            reason: '新记录，将添加'
          });
          totalAdd++;
        }
      }

      const missingFields = [];
      if (backupRecords.length > 0) {
        const defaults = FIELD_DEFAULTS[entityType];
        const sampleRaw = backupRecords[0];
        for (const key of Object.keys(defaults)) {
          if (!(key in sampleRaw)) {
            missingFields.push(key);
          }
        }
      }
      if (missingFields.length > 0) {
        warnings.push(`「${entityType}」缺少字段：${missingFields.join('、')}，将填充默认值`);
      }

      result[entityType] = {
        records: analyzed,
        addCount: analyzed.filter((a) => a.action === 'add').length,
        overwriteCount: analyzed.filter((a) => a.action === 'overwrite').length,
        skipCount: analyzed.filter((a) => a.action === 'skip').length,
        totalCount: analyzed.length,
        missingFields
      };
    }

    return { entities: result, totalAdd, totalOverwrite, totalSkip, totalRecords: totalAdd + totalOverwrite + totalSkip, warnings, backupVersion, exportedAt: backup.exportedAt, snapshot: currentData };
  }

  function handleImportFile(file) {
    setMigrationError('');
    setMigrationPreview(null);
    setMigrationStep('loading');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup.app || backup.app !== 'zfl-5-gallery-consignment') {
          throw new Error('不是有效的画廊寄售管理备份文件');
        }
        if (!backup.data || typeof backup.data !== 'object') {
          throw new Error('备份文件格式异常：缺少 data 字段');
        }
        const preview = analyzeBackup(backup, getCurrentDataFromState());
        setMigrationPreview(preview);
        setMigrationStep('preview');
      } catch (err) {
        setMigrationError(err.message || '文件解析失败');
        setMigrationStep('error');
      }
    };
    reader.onerror = () => {
      setMigrationError('文件读取失败');
      setMigrationStep('error');
    };
    reader.readAsText(file);
  }

  function confirmRestore() {
    if (!migrationPreview) return;

    const currentData = migrationPreview.snapshot || getCurrentDataFromState();

    const restoredData = {};
    for (const [entityType, analysis] of Object.entries(migrationPreview.entities)) {
      const currentRecords = [...currentData[entityType]];
      const overwrittenIds = new Set();

      for (const item of analysis.records) {
        if (item.action === 'add') {
          currentRecords.push(item.record);
        } else if (item.action === 'overwrite') {
          overwrittenIds.add(item.record.id);
        }
      }

      restoredData[entityType] = currentRecords.map((r) => {
        if (overwrittenIds.has(r.id)) {
          const overwriteItem = analysis.records.find((a) => a.action === 'overwrite' && a.record.id === r.id);
          return overwriteItem ? overwriteItem.record : r;
        }
        return r;
      });
    }

    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      localStorage.setItem(storageKey, JSON.stringify(restoredData[key]));
    }

    setArtists(restoredData.artists);
    setWorks(restoredData.works);
    setInquiries(restoredData.inquiries);
    setOrders(restoredData.orders);
    setStatements(restoredData.statements);
    setLoans(restoredData.loans);
    setInventoryTasks(restoredData.inventoryTasks);

    setMigrationStep('done');
  }

  function resetMigration() {
    setMigrationPreview(null);
    setMigrationStep('idle');
    setMigrationError('');
  }

  const ENTITY_LABELS = {
    artists: '艺术家',
    works: '作品',
    inquiries: '询价',
    orders: '订单',
    statements: '对账单',
    loans: '借展',
    inventoryTasks: '盘点任务'
  };

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
          <span><User size={18} />{customerStats.totalCount}位客户</span>
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
            <select
              value={workForm.sale === '已售' ? '待售' : workForm.sale}
              onChange={(e) => setWorkForm({ ...workForm, sale: e.target.value })}
              title="已售状态需通过「登记销售」创建订单后自动设置"
            >
              <option>待售</option><option>已预订</option>
            </select>
          </div>
          <p className="form-hint"><Info size={12} /> 作品售出需点击「登记销售」创建订单，系统自动标记为已售</p>
          <button>保存作品</button>
        </form>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>作品列表</h2>
          <label><Search size={16} /><input placeholder="搜索艺术家/作品/状态" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="toolbar-right">
            <label><Filter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>全部展态</option><option>展出中</option><option>库房</option><option>借展</option><option>退回</option></select></label>
            <button className="ghost" onClick={() => setShowStatementForm(true)}><FileText size={14} /> 生成对账单</button>
            <button className="ghost" onClick={() => setShowOrderForm(true)}><Plus size={14} /> 登记销售</button>
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
            const soldWithoutOrder = soldWithoutOrderIds.has(work.id);
            return (
              <article key={work.id} className={`${activeLoan ? 'work-on-loan' : ''} ${soldWithoutOrder ? 'work-sold-orphan' : ''}`}>
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
                {activeOrderMap[work.id] && (
                  <div className="order-badge">
                    <Receipt size={12} />
                    <span>订单：{activeOrderMap[work.id].customerName} · 尾款{activeOrderMap[work.id].balanceStatus}</span>
                  </div>
                )}
                {soldWithoutOrder && (
                  <div className="order-badge order-orphan">
                    <AlertCircle size={12} />
                    <span>缺少订单记录（旧数据）</span>
                  </div>
                )}
                <div className="actions">
                  {activeOrderMap[work.id] ? (
                    <button onClick={() => cancelOrder(activeOrderMap[work.id].id)}>
                      <XCircle size={14} /> 撤回销售
                    </button>
                  ) : soldWithoutOrder ? (
                    <button onClick={() => openOrderForWork(work.id)}>
                      <Receipt size={14} /> 补录订单
                    </button>
                  ) : (
                    <button onClick={() => openOrderForWork(work.id)}>
                      <Receipt size={14} /> 登记销售
                    </button>
                  )}
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
                  {batchPreview.warningRows && batchPreview.warningRows.length > 0 && (
                    <span className="batch-summary-item warning">
                      <AlertCircle size={16} /> 提示 {batchPreview.warningRows.length} 行
                    </span>
                  )}
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
                            <th>说明</th>
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
                              <td className="batch-warning-cell">
                                {row.warnings && row.warnings.map((w, i) => (
                                  <span key={i} className="batch-warning-tag"><AlertCircle size={12} /> {w}</span>
                                ))}
                              </td>
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

      {showOrderForm && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><Receipt size={18} />{editingOrderId ? '编辑销售订单' : '登记销售订单'}</h2>
            <button className="ghost small" onClick={() => { setShowOrderForm(false); setEditingOrderId(null); }}>收起</button>
          </div>
          <form className="inquiry-form" onSubmit={addOrder}>
            <div className="form-row">
              <label><span className="label-icon"><Tag size={14} /></span>
                <select
                  value={orderForm.workId}
                  disabled={!!editingOrderId}
                  onChange={(e) => {
                    const work = works.find((w) => w.id === e.target.value);
                    setOrderForm({ ...orderForm, workId: e.target.value, dealPrice: work ? String(work.price) : '' });
                  }}
                >
                  <option value="">请选择作品 *</option>
                  {editingOrderId
                    ? works.filter((w) => w.id === orderForm.workId).map((work) => (
                        <option key={work.id} value={work.id}>{work.title} — {work.artist} · ¥{Number(work.price).toLocaleString()}</option>
                      ))
                    : works.filter((w) => w.sale !== '已售' || !activeOrderMap[w.id]).map((work) => (
                        <option key={work.id} value={work.id}>{work.title} — {work.artist} · ¥{Number(work.price).toLocaleString()}</option>
                      ))
                  }
                </select>
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><User size={14} /></span>
                <input placeholder="客户姓名 *" value={orderForm.customerName} onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })} />
              </label>
              <label><span className="label-icon"><Phone size={14} /></span>
                <input placeholder="联系方式 *" value={orderForm.customerPhone} onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })} />
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><TrendingUp size={14} /></span>
                <input type="number" placeholder="成交价 (元) *" value={orderForm.dealPrice} onChange={(e) => setOrderForm({ ...orderForm, dealPrice: e.target.value })} />
              </label>
              <label><span className="label-icon"><Banknote size={14} /></span>
                <input type="number" placeholder="已收订金 (元)" value={orderForm.deposit} onChange={(e) => setOrderForm({ ...orderForm, deposit: e.target.value })} />
              </label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><Coins size={14} /></span>
                <select value={orderForm.balanceStatus} onChange={(e) => setOrderForm({ ...orderForm, balanceStatus: e.target.value })}>
                  {BALANCE_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label><span className="label-icon"><Calendar size={14} /></span>
                <input type="date" value={orderForm.dealDate} onChange={(e) => setOrderForm({ ...orderForm, dealDate: e.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label><span className="label-icon"><MessageCircle size={14} /></span>
                <input placeholder="备注 (选填)" value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} />
              </label>
            </div>
            {orderFormErrors.length > 0 && (
              <div className="form-errors">
                {orderFormErrors.map((err, idx) => (
                  <span key={idx} className="form-error-tag"><AlertCircle size={12} /> {err}</span>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="ghost" onClick={() => { setShowOrderForm(false); setEditingOrderId(null); setOrderFormErrors([]); }}>取消</button>
              <button type="submit">{editingOrderId ? '保存修改' : '确认成交'}</button>
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

      <section className="panel">
        <div className="toolbar">
          <h2><Receipt size={18} />销售订单记录 ({filteredOrders.length})</h2>
          <label><Filter size={16} />
            <select value={orderFilter} onChange={(e) => setOrderFilterRaw(e.target.value)}>
              <option value="全部订单">全部订单</option>
              <option value="有效订单">有效订单</option>
              <option value="已撤销">已撤销</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}
            </select>
          </label>
          <div></div>
        </div>
        {filteredOrders.length === 0 ? (
          <p className="empty-tip">暂无销售订单，点击上方"登记销售"开始记录。</p>
        ) : (
          <>
            <div className="order-stats">
              <div className="order-stat-item">
                <span className="order-stat-label">有效订单</span>
                <strong className="order-stat-value">{orderStats.totalCount}件</strong>
              </div>
              <div className="order-stat-item">
                <span className="order-stat-label">成交总额</span>
                <strong className="order-stat-value amount">¥{orderStats.totalDealAmount.toLocaleString()}</strong>
              </div>
              <div className="order-stat-item">
                <span className="order-stat-label">已收订金</span>
                <strong className="order-stat-value deposit">¥{orderStats.totalDeposit.toLocaleString()}</strong>
              </div>
              <div className="order-stat-item">
                <span className="order-stat-label">待收尾款</span>
                <strong className="order-stat-value balance">¥{orderStats.pendingBalance.toLocaleString()}</strong>
              </div>
              {orderStats.cancelledCount > 0 && (
                <div className="order-stat-item">
                  <span className="order-stat-label">已撤销</span>
                  <strong className="order-stat-value cancelled">{orderStats.cancelledCount}件</strong>
                </div>
              )}
            </div>
            <div className="order-list">
              {filteredOrders.map((order) => {
                const isCancelled = !!order.cancelledAt;
                const balance = Number(order.dealPrice || 0) - Number(order.deposit || 0);
                return (
                  <div className={`order-item ${isCancelled ? 'order-cancelled' : ''}`} key={order.id}>
                    <div className="inquiry-head">
                      <div>
                        <strong className="inquiry-work">{order.workTitle}</strong>
                        <span className="inquiry-customer">{order.workArtist} · <User size={12} />{order.customerName} · <Phone size={12} />{order.customerPhone}</span>
                      </div>
                      <div className="status-dropdown">
                        {isCancelled ? (
                          <span className="status-select status-已放弃">
                            <XCircle size={14} />已撤销
                          </span>
                        ) : (
                          <select
                            value={order.balanceStatus}
                            onChange={(e) => updateOrderBalanceStatus(order.id, e.target.value)}
                            className={`status-select status-balance-${order.balanceStatus}`}
                          >
                            {BALANCE_STATUS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="inquiry-body">
                      <span><TrendingUp size={12} />成交价 ¥{Number(order.dealPrice).toLocaleString()}</span>
                      <span><Banknote size={12} />订金 ¥{Number(order.deposit).toLocaleString()}</span>
                      <span className={balance > 0 ? 'inquiry-price' : ''}><Coins size={12} />尾款 ¥{balance.toLocaleString()}</span>
                      <span><Calendar size={12} />成交：{order.dealDate}</span>
                      {order.note && <span className="inquiry-remark"><MessageCircle size={12} />{order.note}</span>}
                      {order.cancelledAt && (
                        <span className="inquiry-date">撤销于 {new Date(order.cancelledAt).toLocaleString('zh-CN')}</span>
                      )}
                    </div>
                    {!isCancelled && (
                      <div className="order-actions">
                        <button className="outline small" onClick={() => openEditOrder(order.id)}>
                          <Pencil size={12} /> 编辑订单
                        </button>
                        <button className="ghost small" onClick={() => cancelOrder(order.id)}>
                          <XCircle size={12} /> 撤销订单
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <CustomerList inquiries={inquiries} orders={orders} />

      {showStatementForm && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><FileText size={18} />生成艺术家对账单</h2>
            <button className="ghost small" onClick={() => { setShowStatementForm(false); clearStatementForm(); }}>收起</button>
          </div>
          <div className="inquiry-form">
            <div className="form-row split">
              <label><span className="label-icon"><User size={14} /></span>
                <select value={statementForm.artist} onChange={(e) => { setStatementForm({ ...statementForm, artist: e.target.value }); setStatementPreview(null); }}>
                  <option value="">请选择艺术家 *</option>
                  {artists.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </label>
              <label></label>
            </div>
            <div className="form-row split">
              <label><span className="label-icon"><Calendar size={14} /></span>
                <input type="date" value={statementForm.startDate} onChange={(e) => { setStatementForm({ ...statementForm, startDate: e.target.value }); setStatementPreview(null); }} />
                <span className="label-hint">起始日期</span>
              </label>
              <label><span className="label-icon"><Calendar size={14} /></span>
                <input type="date" value={statementForm.endDate} onChange={(e) => { setStatementForm({ ...statementForm, endDate: e.target.value }); setStatementPreview(null); }} />
                <span className="label-hint">结束日期</span>
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="ghost" onClick={clearStatementForm}>清空</button>
              <button type="button" onClick={previewStatement}>预览对账单</button>
            </div>

            {statementPreview && (
              <div className="statement-preview">
                <div className="statement-summary-bar">
                  <div className="statement-summary-info">
                    <strong>{statementPreview.artist}</strong>
                    <span>{statementPreview.startDate} 至 {statementPreview.endDate}</span>
                    <span>佣金比例 {statementPreview.commissionRate}%</span>
                  </div>
                  <div className="statement-summary-stats">
                    <div><span>成交总额</span><strong>¥{statementPreview.totalDealPrice.toLocaleString()}</strong></div>
                    <div><span>佣金合计</span><strong className="text-purple">¥{statementPreview.totalCommission.toLocaleString()}</strong></div>
                    <div><span>应付艺术家</span><strong className="text-green">¥{statementPreview.totalPayable.toLocaleString()}</strong></div>
                  </div>
                </div>

                {statementPreview.items.length === 0 ? (
                  <p className="empty-tip">该时间段内没有已售作品记录</p>
                ) : (
                  <>
                    <div className="statement-table-container">
                      <table className="statement-table">
                        <thead>
                          <tr>
                            <th>作品名称</th>
                            <th>成交日期</th>
                            <th>客户</th>
                            <th>成交价</th>
                            <th>佣金</th>
                            <th>应付金额</th>
                            <th>结算状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statementPreview.items.map((it, idx) => (
                            <tr key={idx}>
                              <td>{it.workTitle}</td>
                              <td>{it.saleDate}</td>
                              <td>{it.customerName || '-'}</td>
                              <td>¥{it.dealPrice.toLocaleString()}</td>
                              <td className="text-purple">¥{it.commission.toLocaleString()}</td>
                              <td className="text-green">¥{it.payable.toLocaleString()}</td>
                              <td><span className={`settlement-tag settlement-${it.settlementStatus}`}>{it.settlementStatus}</span></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}><strong>合计（{statementPreview.items.length}件作品）</strong></td>
                            <td><strong>¥{statementPreview.totalDealPrice.toLocaleString()}</strong></td>
                            <td className="text-purple"><strong>¥{statementPreview.totalCommission.toLocaleString()}</strong></td>
                            <td className="text-green"><strong>¥{statementPreview.totalPayable.toLocaleString()}</strong></td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="ghost" onClick={() => setStatementPreview(null)}>取消</button>
                      <button type="button" onClick={saveStatement}>
                        <CheckCircle2 size={14} /> 保存对账单
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <h2><FileText size={18} />艺术家对账单记录 ({filteredStatements.length})</h2>
          <label><Filter size={16} />
            <select value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)}>
              <option value="全部">全部</option>
              <option value="待确认">待确认</option>
              <option value="已确认">已确认</option>
              {artists.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </label>
          <div></div>
        </div>
        {filteredStatements.length === 0 ? (
          <p className="empty-tip">暂无对账单记录，点击上方"生成对账单"开始创建。</p>
        ) : (
          <div className="statement-list">
            {filteredStatements.map((s) => (
              <div className={`statement-card ${s.confirmed ? 'statement-confirmed' : 'statement-pending'}`} key={s.id}>
                <div className="statement-card-header">
                  <div>
                    <strong className="statement-artist">{s.artist}</strong>
                    <span className="statement-period">{s.startDate} 至 {s.endDate}</span>
                  </div>
                  <div className="statement-status">
                    {s.confirmed ? (
                      <span className="status-tag status-confirmed">
                        <CheckCircle2 size={14} /> 已确认
                        {s.confirmedAt && <em> · {new Date(s.confirmedAt).toLocaleDateString('zh-CN')}</em>}
                      </span>
                    ) : (
                      <span className="status-tag status-unconfirmed">
                        <Clock size={14} /> 待确认
                      </span>
                    )}
                  </div>
                </div>
                <div className="statement-card-stats">
                  <div><span>成交</span><strong>{s.items.length}件 · ¥{s.totalDealPrice.toLocaleString()}</strong></div>
                  <div><span>佣金({s.commissionRate}%)</span><strong className="text-purple">¥{s.totalCommission.toLocaleString()}</strong></div>
                  <div><span>应付</span><strong className="text-green">¥{s.totalPayable.toLocaleString()}</strong></div>
                  <div className="statement-created"><span>创建</span><em>{new Date(s.createdAt).toLocaleDateString('zh-CN')}</em></div>
                </div>
                <div className="statement-items-collapse">
                  <details>
                    <summary>查看明细（{s.items.length}件作品）</summary>
                    <div className="statement-table-container">
                      <table className="statement-table">
                        <thead>
                          <tr>
                            <th>作品名称</th>
                            <th>成交日期</th>
                            <th>客户</th>
                            <th>成交价</th>
                            <th>佣金</th>
                            <th>应付金额</th>
                            <th>结算状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((it, idx) => (
                            <tr key={idx}>
                              <td>{it.workTitle}</td>
                              <td>{it.saleDate}</td>
                              <td>{it.customerName || '-'}</td>
                              <td>¥{it.dealPrice.toLocaleString()}</td>
                              <td className="text-purple">¥{it.commission.toLocaleString()}</td>
                              <td className="text-green">¥{it.payable.toLocaleString()}</td>
                              <td><span className={`settlement-tag settlement-${it.settlementStatus}`}>{it.settlementStatus}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
                {!s.confirmed && (
                  <div className="statement-card-actions">
                    <button onClick={() => confirmStatement(s.id)}>
                      <CheckCircle2 size={14} /> 确认本次对账单
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showInventoryForm && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><ClipboardList size={18} />创建库存盘点任务</h2>
            <button className="ghost small" onClick={() => setShowInventoryForm(false)}>收起</button>
          </div>
          <form className="inquiry-form" onSubmit={createInventoryTask}>
            <div className="form-row">
              <label><span className="label-icon"><Tag size={14} /></span>
                <input
                  placeholder="盘点任务名称 *"
                  value={inventoryForm.name}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label><span className="label-icon"><MessageCircle size={14} /></span>
                <input
                  placeholder="备注说明 (选填)"
                  value={inventoryForm.note}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, note: e.target.value })}
                />
              </label>
            </div>
            <div className="form-hint">
              <Info size={12} /> 创建时将自动抓取当前所有作品的状态快照，盘点过程中不受后续作品编辑影响
            </div>
            <div className="form-actions">
              <button type="button" className="ghost" onClick={() => setShowInventoryForm(false)}>取消</button>
              <button type="submit">创建盘点任务</button>
            </div>
          </form>
        </section>
      )}

      {selectedInventoryTask ? (
        <section className="panel">
          <div className="toolbar">
            <h2>
              <button className="ghost small" onClick={() => { setSelectedInventoryId(null); setInventoryQuery(''); setInventoryItemFilter('全部状态'); }}>
                ← 返回盘点列表
              </button>
              <span style={{ marginLeft: '8px' }}>{selectedInventoryTask.name}</span>
            </h2>
            <label><Search size={16} />
              <input
                placeholder="搜索作品/艺术家"
                value={inventoryQuery}
                onChange={(e) => setInventoryQuery(e.target.value)}
              />
            </label>
            <div className="toolbar-right">
              <label><Filter size={16} />
                <select value={inventoryItemFilter} onChange={(e) => setInventoryItemFilter(e.target.value)}>
                  <option value="全部状态">全部状态</option>
                  {INVENTORY_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              {selectedInventoryTask.status === '进行中' ? (
                <button onClick={() => completeInventoryTask(selectedInventoryTask.id)}>
                  <CheckSquare size={14} /> 完成盘点
                </button>
              ) : (
                <button className="ghost" onClick={() => reopenInventoryTask(selectedInventoryTask.id)}>
                  <Pencil size={14} /> 重新打开
                </button>
              )}
            </div>
          </div>

          <div className="inventory-summary">
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                <Package size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">作品总数</span>
                <strong className="stat-value">{selectedInventoryTask.totalCount}件</strong>
              </div>
            </div>
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">已核对</span>
                <strong className="stat-value" style={{ color: '#15803d' }}>{selectedInventoryTask.checkedCount}件</strong>
              </div>
            </div>
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>
                <AlertTriangle size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">异常</span>
                <strong className="stat-value" style={{ color: '#92400e' }}>{selectedInventoryTask.exceptionCount}件</strong>
              </div>
            </div>
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>
                <XCircle size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">缺失</span>
                <strong className="stat-value" style={{ color: '#991b1b' }}>{selectedInventoryTask.missingCount}件</strong>
              </div>
            </div>
          </div>

          {(selectedInventoryTask.exceptionCount > 0 || selectedInventoryTask.missingCount > 0) && (
            <div className="inventory-alert-summary">
              <h3><AlertTriangle size={16} /> 异常摘要</h3>
              <div className="inventory-alert-list">
                {selectedInventoryTask.items.filter((i) => i.status === '异常' || i.status === '缺失').map((item) => (
                  <div key={item.id} className={`inventory-alert-item alert-${item.status}`}>
                    <span className="alert-tag">{item.status}</span>
                    <strong>{item.workSnapshot.title}</strong>
                    <span className="alert-artist">{item.workSnapshot.artist}</span>
                    <span className="alert-exhibit">原状态：{item.workSnapshot.exhibit}</span>
                    {item.note && <span className="alert-note">备注：{item.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="inventory-progress-bar">
            <div
              className="inventory-progress-fill"
              style={{
                width: `${selectedInventoryTask.totalCount > 0
                  ? ((selectedInventoryTask.checkedCount + selectedInventoryTask.exceptionCount + selectedInventoryTask.missingCount) / selectedInventoryTask.totalCount) * 100
                  : 0}%`
              }}
            />
          </div>
          <p className="inventory-progress-text">
            盘点进度：{selectedInventoryTask.totalCount > 0
              ? Math.round(((selectedInventoryTask.checkedCount + selectedInventoryTask.exceptionCount + selectedInventoryTask.missingCount) / selectedInventoryTask.totalCount) * 100)
              : 0}%
          </p>

          {filteredInventoryItems.length === 0 ? (
            <p className="empty-tip">没有匹配的作品</p>
          ) : (
            <div className="inventory-items">
              {filteredInventoryItems.map((item) => (
                <div key={item.id} className={`inventory-item inventory-status-${item.status}`}>
                  <div className="inventory-item-head">
                    <strong>{item.workSnapshot.title}</strong>
                    <select
                      value={item.status}
                      onChange={(e) => updateInventoryItem(selectedInventoryTask.id, item.id, { status: e.target.value })}
                      disabled={selectedInventoryTask.status === '已完成'}
                      className={`status-select status-inv-${item.status}`}
                    >
                      {INVENTORY_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <span className="inventory-item-artist">{item.workSnapshot.artist} · ¥{Number(item.workSnapshot.price).toLocaleString()}</span>
                  <p className="inventory-item-meta">
                    {item.workSnapshot.inDate}入库 · {item.workSnapshot.exhibit} · {item.workSnapshot.sale}
                  </p>
                  {item.note && <p className="inventory-item-note">备注：{item.note}</p>}
                  {selectedInventoryTask.status === '进行中' && (
                    <div className="inventory-item-actions">
                      <input
                        type="text"
                        placeholder="添加盘点备注..."
                        className="inventory-note-input"
                        value={item.note}
                        onChange={(e) => updateInventoryItem(selectedInventoryTask.id, item.id, { note: e.target.value })}
                      />
                    </div>
                  )}
                  {item.checkedAt && (
                    <span className="inventory-checked-time">
                      {item.status === '未核对' ? '' : `于 ${new Date(item.checkedAt).toLocaleString('zh-CN')}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <div className="toolbar">
            <h2><ClipboardList size={18} />库存盘点任务 ({filteredInventoryTasks.length})</h2>
            <label><Filter size={16} />
              <select value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)}>
                <option value="全部任务">全部任务</option>
                {INVENTORY_TASK_STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <div className="toolbar-right">
              <button onClick={() => setShowInventoryForm(true)}>
                <Plus size={14} /> 新建盘点
              </button>
            </div>
          </div>

          <div className="inventory-task-stats">
            <span className="inv-stat-item">共 {inventoryStats.total} 次盘点</span>
            <span className="inv-stat-item active">进行中 {inventoryStats.active}</span>
            <span className="inv-stat-item done">已完成 {inventoryStats.completed}</span>
          </div>

          {filteredInventoryTasks.length === 0 ? (
            <p className="empty-tip">暂无盘点任务，点击"新建盘点"开始第一次盘点。</p>
          ) : (
            <div className="inventory-task-list">
              {filteredInventoryTasks.map((task) => (
                <div key={task.id} className={`inventory-task-card ${task.status === '已完成' ? 'task-completed' : 'task-active'}`}>
                  <div className="inventory-task-head">
                    <div>
                      <strong className="inventory-task-name">{task.name}</strong>
                      <span className="inventory-task-date">
                        创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <span className={`status-tag ${task.status === '已完成' ? 'status-confirmed' : 'status-unconfirmed'}`}>
                      {task.status === '已完成' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      {task.status}
                    </span>
                  </div>
                  {task.note && <p className="inventory-task-note">{task.note}</p>}
                  <div className="inventory-task-stats-row">
                    <span>共 {task.totalCount} 件</span>
                    <span style={{ color: '#15803d' }}>已核对 {task.checkedCount}</span>
                    <span style={{ color: '#92400e' }}>异常 {task.exceptionCount}</span>
                    <span style={{ color: '#991b1b' }}>缺失 {task.missingCount}</span>
                  </div>
                  <div className="inventory-task-progress">
                    <div
                      className="progress-bar-inner"
                      style={{
                        width: `${task.totalCount > 0
                          ? ((task.checkedCount + task.exceptionCount + task.missingCount) / task.totalCount) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <div className="inventory-task-actions">
                    <button onClick={() => setSelectedInventoryId(task.id)}>
                      <Eye size={14} /> 查看详情
                    </button>
                    {task.completedAt && (
                      <span className="inventory-completed-time">
                        完成于 {new Date(task.completedAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <h2><Database size={18} />数据迁移与恢复</h2>
          <div></div>
          <div className="toolbar-right">
            <button className="ghost" onClick={exportBackup}><Download size={14} /> 导出备份</button>
            <button className="ghost" onClick={() => setShowMigration(!showMigration)}><Upload size={14} /> 导入恢复</button>
          </div>
        </div>
        <div className="migration-info">
          <p><Info size={14} /> 将当前所有数据（艺术家、作品、询价、订单、对账单、借展、盘点）导出为JSON备份文件，或从备份文件恢复数据。恢复前会展示预览，说明新增、覆盖、跳过的记录。</p>
        </div>
      </section>

      {showMigration && (
        <section className="panel inquiry-form-panel">
          <div className="panel-header">
            <h2><Upload size={18} />从备份文件恢复数据</h2>
            <button className="ghost small" onClick={() => { setShowMigration(false); resetMigration(); }}>收起</button>
          </div>

          {migrationStep === 'idle' && (
            <div className="migration-upload-area">
              <label className="migration-file-label">
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImportFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <div className="migration-dropzone">
                  <Upload size={32} />
                  <span>点击选择备份文件（.json）</span>
                  <span className="migration-hint">支持从导出功能生成的 JSON 备份文件</span>
                </div>
              </label>
            </div>
          )}

          {migrationStep === 'error' && (
            <div className="form-errors">
              <span className="form-error-tag"><AlertCircle size={12} /> {migrationError}</span>
              <button className="ghost small" onClick={resetMigration}>重试</button>
            </div>
          )}

          {migrationStep === 'done' && (
            <div className="migration-success">
              <CheckCircle2 size={24} />
              <strong>数据恢复完成</strong>
              <span>已新增 {migrationPreview.totalAdd} 条、覆盖 {migrationPreview.totalOverwrite} 条、跳过 {migrationPreview.totalSkip} 条记录</span>
              <button className="ghost small" onClick={resetMigration}>继续操作</button>
            </div>
          )}

          {migrationStep === 'preview' && migrationPreview && (
            <div className="migration-preview">
              <div className="migration-preview-header">
                <div className="migration-preview-info">
                  <span className="migration-meta"><Calendar size={14} /> 备份时间：{migrationPreview.exportedAt ? new Date(migrationPreview.exportedAt).toLocaleString('zh-CN') : '未知'}</span>
                  <span className="migration-meta"><Database size={14} /> 备份版本：v{migrationPreview.backupVersion || 0}</span>
                </div>
              </div>

              <div className="migration-summary">
                <span className="migration-summary-item add"><Plus size={16} /> 新增 {migrationPreview.totalAdd} 条</span>
                <span className="migration-summary-item overwrite"><RotateCcw size={16} /> 覆盖 {migrationPreview.totalOverwrite} 条</span>
                <span className="migration-summary-item skip"><XCircle size={16} /> 跳过 {migrationPreview.totalSkip} 条</span>
                <span className="migration-summary-item total">共 {migrationPreview.totalRecords} 条</span>
              </div>

              {migrationPreview.warnings.length > 0 && (
                <div className="migration-warnings">
                  <h3><AlertTriangle size={16} /> 注意事项</h3>
                  <ul>
                    {migrationPreview.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Object.entries(migrationPreview.entities).map(([entityType, analysis]) => {
                if (analysis.totalCount === 0) return null;
                return (
                  <div key={entityType} className="migration-entity-section">
                    <h3 className="migration-entity-title">{ENTITY_LABELS[entityType]}（{analysis.totalCount}条）</h3>
                    <div className="migration-entity-summary">
                      <span className="mig-add">新增 {analysis.addCount}</span>
                      <span className="mig-overwrite">覆盖 {analysis.overwriteCount}</span>
                      <span className="mig-skip">跳过 {analysis.skipCount}</span>
                    </div>
                    {analysis.records.length > 0 && (
                      <details className="migration-details">
                        <summary>查看明细</summary>
                        <div className="migration-table-container">
                          <table className="migration-table">
                            <thead>
                              <tr>
                                <th>操作</th>
                                <th>记录摘要</th>
                                <th>说明</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.records.map((item, idx) => (
                                <tr key={idx} className={`migration-row-${item.action}`}>
                                  <td>
                                    <span className={`migration-action-tag migration-action-${item.action}`}>
                                      {item.action === 'add' && <Plus size={12} />}
                                      {item.action === 'overwrite' && <RotateCcw size={12} />}
                                      {item.action === 'skip' && <XCircle size={12} />}
                                      {item.action === 'add' ? '新增' : item.action === 'overwrite' ? '覆盖' : '跳过'}
                                    </span>
                                  </td>
                                  <td className="migration-record-summary">
                                    {entityType === 'artists' && <>{item.record.name}{item.record.phone ? ` · ${item.record.phone}` : ''}</>}
                                    {entityType === 'works' && <>{item.record.artist} — {item.record.title} · ¥{Number(item.record.price || 0).toLocaleString()}</>}
                                    {entityType === 'inquiries' && <>{item.record.workTitle} · {item.record.customerName}</>}
                                    {entityType === 'orders' && <>{item.record.workTitle} · {item.record.customerName} · ¥{Number(item.record.dealPrice || 0).toLocaleString()}</>}
                                    {entityType === 'statements' && <>{item.record.artist} · {item.record.startDate}~{item.record.endDate}</>}
                                    {entityType === 'loans' && <>{item.record.workTitle} · {item.record.borrower}</>}
                                    {entityType === 'inventoryTasks' && <>{item.record.name}</>}
                                  </td>
                                  <td className="migration-reason">{item.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}

              <div className="migration-confirm-area">
                <div className="form-hint migration-confirm-warning">
                  <AlertTriangle size={12} /> 恢复操作将直接修改当前数据：新增的记录会加入列表，ID相同的记录会被覆盖，艺术家重名和作品重复的记录会被跳过。建议先导出一份当前数据的备份。
                </div>
                <div className="form-actions">
                  <button type="button" className="ghost" onClick={resetMigration}>取消</button>
                  <button type="button" onClick={exportBackup} className="outline"><Download size={14} /> 先备份当前数据</button>
                  <button type="button" onClick={confirmRestore} disabled={migrationPreview.totalRecords === 0}>
                    <RotateCcw size={14} /> 确认恢复
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

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
              settlementWorks.map((work) => {
                const order = activeOrderMap[work.id];
                const dealPrice = order ? Number(order.dealPrice || 0) : Number(work.price || 0);
                const commissionRate = commissionRateMap[work.artist] ?? DEFAULT_COMMISSION_RATE;
                const commission = Math.round(dealPrice * commissionRate);
                return (
                  <div className="artist settlement-item" key={work.id}>
                    <div>
                      <strong>{work.title}</strong>
                      <span>{work.artist}</span>
                      {order && <span className="settlement-customer"><User size={12} />{order.customerName}</span>}
                    </div>
                    <div className="settlement-amounts">
                      <span>成交价 ¥{dealPrice.toLocaleString()}</span>
                      <span className="settlement-commission">佣金 ¥{commission.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
