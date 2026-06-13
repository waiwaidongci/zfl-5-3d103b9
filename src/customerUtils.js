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

const MERGE_IGNORE_STORAGE_KEY = 'zfl-5-merge-ignored';

function getCustomerKey(name, phone) {
  return `${name.trim()}__${phone.trim()}`;
}

function formatCustomerDisplay(record, showPhone = true) {
  if (!record) return { namePart: '', phonePart: '', isMerged: false };
  const { customerName, customerPhone, originalCustomerName, originalCustomerPhone } = record;

  const hasOriginalName = originalCustomerName && originalCustomerName !== customerName;
  const hasOriginalPhone = originalCustomerPhone && originalCustomerPhone !== customerPhone;

  return {
    name: customerName || '',
    originalName: hasOriginalName ? originalCustomerName : null,
    phone: showPhone ? (customerPhone || '') : '',
    originalPhone: showPhone && hasOriginalPhone ? originalCustomerPhone : null,
    isMerged: hasOriginalName || hasOriginalPhone
  };
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[\s\-—–()（）]/g, '');
  cleaned = cleaned.replace(/^\+?86/, '');
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned;
}

function normalizeName(name) {
  if (!name) return '';
  return name.trim().replace(/[\s·•・]/g, '').toLowerCase();
}

function getPhoneSimilarity(phone1, phone2) {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  if (norm1 === norm2 && norm1.length > 0) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;
  if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    if (longer - shorter <= 3) return shorter / longer;
  }
  let matchCount = 0;
  for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
    if (norm1[norm1.length - 1 - i] === norm2[norm2.length - 1 - i]) {
      matchCount++;
    } else {
      break;
    }
  }
  return matchCount / Math.max(norm1.length, norm2.length);
}

function getNameSimilarity(name1, name2) {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  if (norm1 === norm2 && norm1.length > 0) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return shorter / longer;
  }
  let commonChars = 0;
  const charSet1 = new Set(norm1);
  for (const char of norm2) {
    if (charSet1.has(char)) commonChars++;
  }
  return commonChars / Math.max(norm1.length, norm2.length);
}

function calculateDuplicateScore(customerA, customerB) {
  const phoneSim = getPhoneSimilarity(customerA.phone, customerB.phone);
  const nameSim = getNameSimilarity(customerA.name, customerB.name);
  const normPhoneA = normalizePhone(customerA.phone);
  const normPhoneB = normalizePhone(customerB.phone);
  const hasSamePhone = normPhoneA === normPhoneB && normPhoneA.length >= 7;
  const hasSameName = normalizeName(customerA.name) === normalizeName(customerB.name) && normalizeName(customerA.name).length >= 2;
  let score = 0;
  let reasons = [];
  if (hasSamePhone) {
    score += 60;
    reasons.push('手机号相同');
  } else if (phoneSim >= 0.7) {
    score += 35;
    reasons.push('手机号高度相似');
  } else if (phoneSim >= 0.5) {
    score += 20;
    reasons.push('手机号部分相似');
  }
  if (hasSameName) {
    score += 40;
    reasons.push('姓名相同');
  } else if (nameSim >= 0.7) {
    score += 25;
    reasons.push('姓名高度相似');
  } else if (nameSim >= 0.5) {
    score += 15;
    reasons.push('姓名部分相似');
  }
  if (customerA.name && customerB.name && customerB.phone && customerA.phone) {
    const namePartA = customerA.name.trim();
    const phonePartB = normalizePhone(customerB.phone);
    const namePartB = customerB.name.trim();
    const phonePartA = normalizePhone(customerA.phone);
    if (phonePartB.includes(namePartA) || phonePartA.includes(namePartB)) {
      score += 5;
      reasons.push('姓名与对方手机号存在关联');
    }
  }
  return {
    score: Math.min(score, 100),
    reasons,
    phoneSimilarity: phoneSim,
    nameSimilarity: nameSim
  };
}

function loadMergeIgnoredPairs() {
  try {
    const raw = localStorage.getItem(MERGE_IGNORE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMergeIgnoredPair(keyA, keyB) {
  const ignored = loadMergeIgnoredPairs();
  const pairKey = [keyA, keyB].sort().join('||');
  if (!ignored.includes(pairKey)) {
    ignored.push(pairKey);
    localStorage.setItem(MERGE_IGNORE_STORAGE_KEY, JSON.stringify(ignored));
  }
}

function isPairIgnored(keyA, keyB) {
  const ignored = loadMergeIgnoredPairs();
  const pairKey = [keyA, keyB].sort().join('||');
  return ignored.includes(pairKey);
}

function clearMergeIgnoredPairs() {
  localStorage.removeItem(MERGE_IGNORE_STORAGE_KEY);
}

function findDuplicateCustomers(customers, minScore = 50) {
  const duplicates = [];
  const processedPairs = new Set();
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const custA = customers[i];
      const custB = customers[j];
      const pairId = [custA.key, custB.key].sort().join('||');
      if (processedPairs.has(pairId)) continue;
      if (isPairIgnored(custA.key, custB.key)) continue;
      const result = calculateDuplicateScore(custA, custB);
      if (result.score >= minScore) {
        duplicates.push({
          id: pairId,
          customerA: custA,
          customerB: custB,
          score: result.score,
          reasons: result.reasons,
          phoneSimilarity: result.phoneSimilarity,
          nameSimilarity: result.nameSimilarity
        });
      }
      processedPairs.add(pairId);
    }
  }
  duplicates.sort((a, b) => b.score - a.score);
  return duplicates;
}

function buildMergedCustomerPreview(customerA, customerB, primaryKey = null) {
  const primary = primaryKey === customerB.key ? customerB : customerA;
  const secondary = primaryKey === customerB.key ? customerA : customerB;
  const allInquiries = [...customerA.inquiries, ...customerB.inquiries];
  const allOrders = [...customerA.orders, ...customerB.orders];
  const allFollowUps = [...(customerA.followUps || []), ...(customerB.followUps || [])];
  const totalDealAmount = allOrders.reduce(
    (sum, order) => sum + Number(order.dealPrice || 0),
    0
  );
  const inquiryCount = allInquiries.length;
  const orderCount = allOrders.length;
  const followUpCount = allFollowUps.length;
  const allActivityTimes = [
    ...allInquiries.map(i => new Date(i.createdAt).getTime()),
    ...allOrders.map(o => new Date(o.dealDate || o.createdAt).getTime()),
    ...allFollowUps.map(f => new Date(f.completedAt || f.scheduledDate || f.createdAt).getTime())
  ];
  const lastActiveAt = allActivityTimes.length > 0 ? Math.max(...allActivityTimes) : null;
  const pendingFollowUps = allFollowUps.filter(f => !f.completedAt);
  let status = CUSTOMER_STATUS.NEW;
  if (orderCount > 0) {
    status = CUSTOMER_STATUS.DEALED;
  } else if (inquiryCount > 0) {
    const hasDealed = allInquiries.some(i => i.status === INQUIRY_DEALED);
    const hasAbandoned = allInquiries.every(i => i.status === INQUIRY_ABANDONED);
    if (hasDealed) {
      status = CUSTOMER_STATUS.DEALED;
    } else if (hasAbandoned) {
      status = CUSTOMER_STATUS.INACTIVE;
    } else {
      status = CUSTOMER_STATUS.FOLLOWING;
    }
  } else if (followUpCount > 0) {
    status = CUSTOMER_STATUS.FOLLOWING;
  }
  return {
    primaryName: primary.name,
    primaryPhone: primary.phone,
    secondaryName: secondary.name,
    secondaryPhone: secondary.phone,
    primaryKey: primary.key,
    secondaryKey: secondary.key,
    totalInquiries: inquiryCount,
    totalOrders: orderCount,
    totalFollowUps: followUpCount,
    totalDealAmount,
    lastActiveAt,
    pendingFollowUpCount: pendingFollowUps.length,
    mergedStatus: status,
    inquiries: allInquiries,
    orders: allOrders,
    followUps: allFollowUps
  };
}

function executeCustomerMerge(inquiries, orders, followUps, targetName, targetPhone, sourceKeys) {
  const trimmedName = targetName.trim();
  const trimmedPhone = targetPhone.trim();
  const sourceKeySet = new Set(sourceKeys);
  const updatedInquiries = inquiries.map(inq => {
    const inqKey = getCustomerKey(inq.customerName, inq.customerPhone);
    if (sourceKeySet.has(inqKey)) {
      return {
        ...inq,
        originalCustomerName: inq.originalCustomerName || inq.customerName,
        originalCustomerPhone: inq.originalCustomerPhone || inq.customerPhone,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        mergedFrom: inq.mergedFrom || inqKey,
        mergedAt: new Date().toISOString()
      };
    }
    return inq;
  });
  const updatedOrders = orders.map(order => {
    const orderKey = getCustomerKey(order.customerName, order.customerPhone);
    if (sourceKeySet.has(orderKey)) {
      return {
        ...order,
        originalCustomerName: order.originalCustomerName || order.customerName,
        originalCustomerPhone: order.originalCustomerPhone || order.customerPhone,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        mergedFrom: order.mergedFrom || orderKey,
        mergedAt: new Date().toISOString()
      };
    }
    return order;
  });
  const updatedFollowUps = followUps.map(fu => {
    const fuKey = getCustomerKey(fu.customerName, fu.customerPhone);
    if (sourceKeySet.has(fuKey)) {
      return {
        ...fu,
        originalCustomerName: fu.originalCustomerName || fu.customerName,
        originalCustomerPhone: fu.originalCustomerPhone || fu.customerPhone,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        mergedFrom: fu.mergedFrom || fuKey,
        mergedAt: new Date().toISOString()
      };
    }
    return fu;
  });
  return {
    inquiries: updatedInquiries,
    orders: updatedOrders,
    followUps: updatedFollowUps
  };
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
  getCustomerKey,
  formatCustomerDisplay,
  normalizePhone,
  normalizeName,
  findDuplicateCustomers,
  buildMergedCustomerPreview,
  executeCustomerMerge,
  loadMergeIgnoredPairs,
  saveMergeIgnoredPair,
  isPairIgnored,
  clearMergeIgnoredPairs,
  calculateDuplicateScore,
  getPhoneSimilarity,
  getNameSimilarity
};
