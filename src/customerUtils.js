const CUSTOMER_STATUS = {
  NEW: '新客户',
  FOLLOWING: '跟进中',
  DEALED: '已成交',
  INACTIVE: '未成交'
};

const CUSTOMER_STATUS_ORDER = [
  CUSTOMER_STATUS.NEW,
  CUSTOMER_STATUS.FOLLOWING,
  CUSTOMER_STATUS.DEALED,
  CUSTOMER_STATUS.INACTIVE
];

const INQUIRY_DEALED = '已成交';
const INQUIRY_ABANDONED = '已放弃';

function getCustomerKey(name, phone) {
  return `${name.trim()}__${phone.trim()}`;
}

function buildCustomerProfile(inquiries, orders, followUps = []) {
  const customerMap = new Map();
  const today = new Date().toISOString().slice(0, 10);

  inquiries.forEach((inq) => {
    if (!inq.customerName || !inq.customerPhone) return;
    const key = getCustomerKey(inq.customerName, inq.customerPhone);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: inq.customerName.trim(),
        phone: inq.customerPhone.trim(),
        inquiries: [],
        orders: [],
        followUps: [],
        lastActiveAt: null
      });
    }
    const profile = customerMap.get(key);
    profile.inquiries.push(inq);
    const inqTime = new Date(inq.createdAt).getTime();
    if (!profile.lastActiveAt || inqTime > profile.lastActiveAt) {
      profile.lastActiveAt = inqTime;
    }
  });

  orders.forEach((order) => {
    if (order.cancelledAt) return;
    if (!order.customerName || !order.customerPhone) return;
    const key = getCustomerKey(order.customerName, order.customerPhone);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: order.customerName.trim(),
        phone: order.customerPhone.trim(),
        inquiries: [],
        orders: [],
        followUps: [],
        lastActiveAt: null
      });
    }
    const profile = customerMap.get(key);
    profile.orders.push(order);
    const orderTime = new Date(order.dealDate || order.createdAt).getTime();
    if (!profile.lastActiveAt || orderTime > profile.lastActiveAt) {
      profile.lastActiveAt = orderTime;
    }
  });

  followUps.forEach((fu) => {
    if (!fu.customerName || !fu.customerPhone) return;
    const key = getCustomerKey(fu.customerName, fu.customerPhone);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: fu.customerName.trim(),
        phone: fu.customerPhone.trim(),
        inquiries: [],
        orders: [],
        followUps: [],
        lastActiveAt: null
      });
    }
    const profile = customerMap.get(key);
    profile.followUps.push(fu);
    const fuTime = new Date(fu.completedAt || fu.createdAt).getTime();
    if (!profile.lastActiveAt || fuTime > profile.lastActiveAt) {
      profile.lastActiveAt = fuTime;
    }
  });

  const customerList = [];
  customerMap.forEach((profile, key) => {
    const totalDealAmount = profile.orders.reduce(
      (sum, order) => sum + Number(order.dealPrice || 0),
      0
    );
    const inquiryCount = profile.inquiries.length;
    const orderCount = profile.orders.length;

    let followStatus;
    if (orderCount > 0) {
      followStatus = CUSTOMER_STATUS.DEALED;
    } else if (inquiryCount > 0) {
      const lastInquiry = profile.inquiries.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];
      if (lastInquiry.status === INQUIRY_DEALED) {
        followStatus = CUSTOMER_STATUS.DEALED;
      } else if (lastInquiry.status === INQUIRY_ABANDONED) {
        followStatus = CUSTOMER_STATUS.INACTIVE;
      } else {
        followStatus = CUSTOMER_STATUS.FOLLOWING;
      }
    } else if (profile.followUps && profile.followUps.length > 0) {
      followStatus = CUSTOMER_STATUS.FOLLOWING;
    } else {
      followStatus = CUSTOMER_STATUS.NEW;
    }

    const allActivities = [
      ...profile.inquiries.map((inq) => ({
        workTitle: inq.workTitle,
        time: new Date(inq.createdAt).getTime()
      })),
      ...profile.orders.map((order) => ({
        workTitle: order.workTitle,
        time: new Date(order.dealDate || order.createdAt).getTime()
      }))
    ];

    let displayWork = null;
    if (allActivities.length > 0) {
      allActivities.sort((a, b) => b.time - a.time);
      displayWork = allActivities[0].workTitle || null;
    }

    const pendingFollowUps = (profile.followUps || []).filter((fu) => !fu.completedAt);
    const pendingFollowUpCount = pendingFollowUps.length;

    let nextFollowUpAt = null;
    let hasOverdue = false;
    let hasTodayFollowUp = false;
    let lastFollowUpAt = null;

    if (pendingFollowUps.length > 0) {
      const sortedPending = [...pendingFollowUps].sort(
        (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)
      );
      nextFollowUpAt = sortedPending[0].scheduledDate;

      sortedPending.forEach((fu) => {
        const scheduled = fu.scheduledDate.slice(0, 10);
        if (scheduled < today) {
          hasOverdue = true;
        }
        if (scheduled === today) {
          hasTodayFollowUp = true;
        }
      });
    }

    const completedFollowUps = (profile.followUps || []).filter((fu) => fu.completedAt);
    if (completedFollowUps.length > 0) {
      const lastCompleted = [...completedFollowUps].sort(
        (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
      )[0];
      lastFollowUpAt = lastCompleted.completedAt;
    }

    customerList.push({
      key,
      name: profile.name,
      phone: profile.phone,
      inquiries: profile.inquiries,
      orders: profile.orders,
      followUps: profile.followUps || [],
      totalDealAmount,
      lastInquiryWork: displayWork,
      followStatus,
      inquiryCount,
      orderCount,
      lastActiveAt: profile.lastActiveAt,
      pendingFollowUpCount,
      nextFollowUpAt,
      hasOverdue,
      hasTodayFollowUp,
      lastFollowUpAt
    });
  });

  customerList.sort((a, b) => {
    if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
    if (a.hasTodayFollowUp !== b.hasTodayFollowUp) return a.hasTodayFollowUp ? -1 : 1;
    if (a.followStatus !== b.followStatus) {
      return (
        CUSTOMER_STATUS_ORDER.indexOf(a.followStatus) -
        CUSTOMER_STATUS_ORDER.indexOf(b.followStatus)
      );
    }
    return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
  });

  return customerList;
}

function filterCustomers(customers, searchText) {
  const trimmed = searchText.trim();
  if (!trimmed) return customers;
  const lower = trimmed.toLowerCase();
  return customers.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.phone.toLowerCase().includes(lower)
  );
}

export {
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_ORDER,
  buildCustomerProfile,
  filterCustomers,
  getCustomerKey
};
