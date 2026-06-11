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

function buildCustomerProfile(inquiries, orders) {
  const customerMap = new Map();

  inquiries.forEach((inq) => {
    if (!inq.customerName || !inq.customerPhone) return;
    const key = getCustomerKey(inq.customerName, inq.customerPhone);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: inq.customerName.trim(),
        phone: inq.customerPhone.trim(),
        inquiries: [],
        orders: [],
        lastActiveAt: null,
        lastInquiryWork: null
      });
    }
    const profile = customerMap.get(key);
    profile.inquiries.push(inq);
    const inqTime = new Date(inq.createdAt).getTime();
    if (!profile.lastActiveAt || inqTime > profile.lastActiveAt) {
      profile.lastActiveAt = inqTime;
      profile.lastInquiryWork = inq.workTitle || null;
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
        lastActiveAt: null,
        lastInquiryWork: null
      });
    }
    const profile = customerMap.get(key);
    profile.orders.push(order);
    const orderTime = new Date(order.dealDate || order.createdAt).getTime();
    if (!profile.lastActiveAt || orderTime > profile.lastActiveAt) {
      profile.lastActiveAt = orderTime;
      if (!profile.lastInquiryWork) {
        profile.lastInquiryWork = order.workTitle || null;
      }
    }
  });

  const customerList = [];
  customerMap.forEach((profile) => {
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
        followStatus = CUSTOMER_STATUS.FOLLOWING;
      } else if (lastInquiry.status === INQUIRY_ABANDONED) {
        followStatus = CUSTOMER_STATUS.INACTIVE;
      } else {
        followStatus = CUSTOMER_STATUS.FOLLOWING;
      }
    } else {
      followStatus = CUSTOMER_STATUS.NEW;
    }

    let displayWork = profile.lastInquiryWork;
    if (!displayWork && profile.orders.length > 0) {
      const lastOrder = profile.orders.sort(
        (a, b) => new Date(b.dealDate || b.createdAt) - new Date(a.dealDate || a.createdAt)
      )[0];
      displayWork = lastOrder.workTitle || null;
    }

    customerList.push({
      key: profile.key || getCustomerKey(profile.name, profile.phone),
      name: profile.name,
      phone: profile.phone,
      totalDealAmount,
      lastInquiryWork: displayWork,
      followStatus,
      inquiryCount,
      orderCount,
      lastActiveAt: profile.lastActiveAt
    });
  });

  customerList.sort((a, b) => {
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
