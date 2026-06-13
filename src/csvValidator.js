import { VALID_EXHIBIT, VALID_SALE } from './csvHeaders.js';
import { parseCSV } from './csvParser.js';

const iso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

function parseDateToISO(dateStr) {
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})[-/年](\d{1,2})(?:[-月/](\d{1,2}))?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = (match[3] || '01').padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function validateRow(row, existingTitles, existingArtists, batchTitles, autoCreateArtists = false) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (!row.artist || row.artist.trim() === '') {
    errors.push('缺少艺术家');
  }

  const artistName = row.artist.trim();
  const artistExists = existingArtists.has(artistName);
  let artistStatus = 'existing';
  if (artistName && !artistExists) {
    if (autoCreateArtists) {
      warnings.push(`艺术家"${artistName}"将自动创建`);
      artistStatus = 'new';
    } else {
      errors.push(`艺术家"${artistName}"未在系统中登记`);
    }
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
    const converted = parseDateToISO(inDate);
    if (!converted) {
      errors.push(`入库日期"${row.inDate}"格式非法，应为YYYY-MM-DD`);
    } else {
      inDate = converted;
      info.push(`入库日期已自动转换为"${inDate}"`);
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
  if (normalizedSale === '已售') {
    warnings.push('「已售」状态需通过订单登记，导入后为「待售」');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    artistStatus,
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

function buildNewArtists(newArtistNames) {
  return Array.from(newArtistNames).map(name => ({
    id: crypto.randomUUID(),
    name,
    phone: '',
    style: '',
    note: '批量导入自动创建'
  }));
}

function classifyRows(rows, existingTitles, existingArtists, autoCreateArtists) {
  const batchTitles = new Set();
  const newArtistNames = new Set();
  const validRows = [];
  const skippedRows = [];
  const warningRows = [];
  const errorRows = [];

  rows.forEach((row) => {
    const result = validateRow(row, existingTitles, existingArtists, batchTitles, autoCreateArtists);
    if (result.valid) {
      batchTitles.add(result.cleaned.title);
      const rowData = {
        ...row,
        cleaned: result.cleaned,
        warnings: result.warnings || [],
        info: result.info || [],
        artistStatus: result.artistStatus
      };
      validRows.push(rowData);
      if (result.artistStatus === 'new') {
        newArtistNames.add(result.cleaned.artist);
      }
      if ((result.warnings && result.warnings.length > 0) || (result.info && result.info.length > 0)) {
        warningRows.push(rowData);
      }
    } else {
      const hasArtistError = result.errors.some(e => e.includes('未在系统中登记'));
      if (hasArtistError && !autoCreateArtists) {
        skippedRows.push({ ...row, errors: result.errors, skipReason: '艺术家未登记' });
      } else {
        errorRows.push({ ...row, errors: result.errors });
      }
    }
  });

  return {
    validRows,
    skippedRows,
    warningRows,
    errorRows,
    newArtists: buildNewArtists(newArtistNames),
    batchTitles,
    newArtistNames
  };
}

function computeImportPreview(csvText, currentMapping, works, artists, autoCreateArtists) {
  const parsed = parseCSV(csvText, currentMapping);

  const existingTitles = new Set(works.map((w) => w.title));
  const existingArtists = new Set(artists.map((a) => a.name));

  const classification = classifyRows(parsed.rows, existingTitles, existingArtists, autoCreateArtists);

  return {
    ...classification,
    totalRows: parsed.rows.length,
    header: parsed.header,
    headerMap: parsed.headerMap,
    detectedColumns: parsed.detectedColumns,
    mappingStatus: parsed.mappingStatus,
    missingRequired: parsed.missingRequired,
    autoMapping: parsed.autoMapping,
    activeMapping: parsed.activeMapping,
    hasHeader: parsed.hasHeader
  };
}

export {
  iso,
  validateRow,
  classifyRows,
  computeImportPreview,
  buildNewArtists
};
