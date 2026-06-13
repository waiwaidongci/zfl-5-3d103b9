const mockWorks = [
  {
    id: 'w1',
    title: '春日山水图',
    artist: '齐白石',
    sale: '已售',
    settlement: '未结算',
    exhibit: '库房',
    price: 50000
  },
  {
    id: 'w2',
    title: '墨虾图',
    artist: '齐白石',
    sale: '已售',
    settlement: '待结算',
    exhibit: '库房',
    price: 80000
  },
  {
    id: 'w3',
    title: '竹石图',
    artist: '郑板桥',
    sale: '待售',
    settlement: '未结算',
    exhibit: '库房',
    price: 30000
  },
  {
    id: 'w4',
    title: '奔马图',
    artist: '徐悲鸿',
    sale: '已售',
    settlement: '已结算',
    exhibit: '借展',
    price: 120000
  }
];

const mockOrders = [
  {
    id: 'o1',
    workId: 'w2',
    workTitle: '墨虾图',
    workArtist: '齐白石',
    customerName: '张三',
    customerPhone: '13800138000',
    dealPrice: 80000,
    deposit: 20000,
    dealDate: '2026-01-15',
    balanceStatus: '未支付'
  },
  {
    id: 'o2',
    workId: 'w4',
    workTitle: '奔马图',
    workArtist: '徐悲鸿',
    customerName: '李四',
    customerPhone: '13900139000',
    dealPrice: 120000,
    deposit: 30000,
    dealDate: '2026-02-20',
    cancelledAt: '2026-03-01',
    balanceStatus: '未支付'
  }
];

const mockInquiries = [
  {
    id: 'inq1',
    workId: 'w3',
    workTitle: '竹石图',
    customerName: '王五',
    customerPhone: '13700137000',
    status: '跟进中'
  },
  {
    id: 'inq2',
    workId: 'non-existent-work',
    workTitle: '失踪作品',
    customerName: '赵六',
    customerPhone: '13600136000',
    status: '已放弃'
  }
];

const mockLoans = [
  {
    id: 'l1',
    workId: 'w4',
    workTitle: '奔马图',
    borrower: '省博物馆',
    startDate: '2026-01-01',
    endDate: '2026-06-01',
    returnedAt: '2026-05-28'
  },
  {
    id: 'l2',
    workId: 'non-existent-work-2',
    workTitle: '失踪借展作品',
    borrower: '市美术馆',
    startDate: '2026-02-01',
    endDate: '2026-07-01'
  }
];

const mockStatements = [
  {
    id: 's1',
    artist: '齐白石',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    confirmed: true,
    confirmedAt: '2026-04-01',
    totalPayable: 80000,
    paidAmount: 80000,
    paymentStatus: '部分付款',
    items: [{ workId: 'w2' }]
  },
  {
    id: 's2',
    artist: '徐悲鸿',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    confirmed: true,
    confirmedAt: '2026-03-15',
    totalPayable: 120000,
    paidAmount: 50000,
    paymentStatus: '已付款',
    items: [{ workId: 'w4' }]
  },
  {
    id: 's3',
    artist: '郑板桥',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    confirmed: true,
    confirmedAt: '2026-05-01',
    totalPayable: 30000,
    paidAmount: 10000,
    paymentStatus: '待付款',
    items: []
  }
];

const mockInventoryTasks = [];
const mockFollowUps = [];

function createMockData(overrides = {}) {
  return {
    works: [...mockWorks],
    orders: [...mockOrders],
    inquiries: [...mockInquiries],
    loans: [...mockLoans],
    statements: [...mockStatements],
    inventoryTasks: [...mockInventoryTasks],
    followUps: [...mockFollowUps],
    ...overrides
  };
}

export {
  mockWorks,
  mockOrders,
  mockInquiries,
  mockLoans,
  mockStatements,
  mockInventoryTasks,
  mockFollowUps,
  createMockData
};
