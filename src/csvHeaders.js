const CSV_COLUMNS = ['艺术家', '作品名', '价格', '入库日期', '展态', '销售状态'];

const CSV_COLUMN_ALIASES = {
  '艺术家': ['艺术家', '作者', '画家', '创作者', 'artist', 'Artist', 'ARTIST', '艺术家名称', '艺术家姓名'],
  '作品名': ['作品名', '作品名称', '标题', '名称', 'title', 'Title', 'TITLE', '作品标题', '画作名称'],
  '价格': ['价格', '售价', '定价', 'price', 'Price', 'PRICE', '寄售价格', '市场价', '金额'],
  '入库日期': ['入库日期', '日期', '时间', 'date', 'Date', 'DATE', '入仓日期', '到店日期', '创作日期'],
  '展态': ['展态', '状态', '展览状态', 'exhibit', 'Exhibit', 'EXHIBIT', '位置', '存放位置'],
  '销售状态': ['销售状态', '销售', '出售状态', 'sale', 'Sale', 'SALE', '售卖状态', '是否可售']
};

const VALID_EXHIBIT = ['展出中', '库房', '借展', '退回'];
const VALID_SALE = ['待售', '已预订', '已售'];

const CSV_FIELD_KEYS = ['artist', 'title', 'price', 'inDate', 'exhibit', 'sale'];

const FIELD_TO_COLUMN = {
  artist: '艺术家',
  title: '作品名',
  price: '价格',
  inDate: '入库日期',
  exhibit: '展态',
  sale: '销售状态'
};

const normalizeHeader = (header) => {
  const trimmed = header.trim().toLowerCase();
  for (const [standardColumn, aliases] of Object.entries(CSV_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (trimmed === alias.toLowerCase()) {
        return standardColumn;
      }
    }
  }
  return null;
};

const isNumericCell = (cell) => {
  const cleaned = cell.trim().replace(/[￥¥,，\s]/g, '');
  return cleaned !== '' && Number.isFinite(Number(cleaned));
};

const isDateLikeCell = (cell) => {
  const value = cell.trim();
  if (!value) return false;
  return /^\d{4}[-/年]\d{1,2}([-月/]\d{1,2})?/.test(value) || !isNaN(new Date(value).getTime());
};

const looksLikeUnmatchedHeader = (cells) => {
  const nonEmptyCells = cells.map((cell) => cell.trim()).filter(Boolean);
  if (nonEmptyCells.length < 2) return false;

  const hasDataValue = nonEmptyCells.some((cell) => (
    isNumericCell(cell) ||
    isDateLikeCell(cell) ||
    VALID_EXHIBIT.includes(cell) ||
    VALID_SALE.includes(cell)
  ));
  if (hasDataValue) return false;

  const headerKeywordPattern = /(艺术|作者|画家|创作|作品|品名|标题|名称|价格|标价|售价|定价|金额|日期|时间|入库|入仓|到店|展态|状态|位置|库位|销售|售卖|artist|title|price|date|exhibit|sale)/i;
  const keywordHits = nonEmptyCells.filter((cell) => headerKeywordPattern.test(cell)).length;
  return keywordHits >= Math.min(2, nonEmptyCells.length);
};

const generateDefaultMapping = (detectedColumns) => {
  const mapping = {};
  const usedTargets = new Set();
  detectedColumns.forEach((col) => {
    const normalized = normalizeHeader(col);
    if (normalized && !usedTargets.has(normalized)) {
      mapping[col] = normalized;
      usedTargets.add(normalized);
    }
  });
  return mapping;
};

const getMappedColumnStatus = (detectedColumns, mapping) => {
  return detectedColumns.map((col) => ({
    source: col,
    target: mapping[col] || null,
    autoMatched: mapping[col] && normalizeHeader(col) === mapping[col],
    required: ['艺术家', '作品名', '价格'].includes(mapping[col])
  }));
};

const getMissingRequiredColumns = (mappingStatus) => {
  return ['艺术家', '作品名', '价格'].filter(req =>
    !mappingStatus.some(s => s.target === req)
  );
};

export {
  CSV_COLUMNS,
  CSV_COLUMN_ALIASES,
  VALID_EXHIBIT,
  VALID_SALE,
  CSV_FIELD_KEYS,
  FIELD_TO_COLUMN,
  normalizeHeader,
  isNumericCell,
  isDateLikeCell,
  looksLikeUnmatchedHeader,
  generateDefaultMapping,
  getMappedColumnStatus,
  getMissingRequiredColumns
};
