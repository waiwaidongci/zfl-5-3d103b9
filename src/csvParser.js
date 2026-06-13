import {
  CSV_COLUMNS,
  CSV_FIELD_KEYS,
  normalizeHeader,
  looksLikeUnmatchedHeader,
  generateDefaultMapping,
  getMappedColumnStatus,
  getMissingRequiredColumns
} from './csvHeaders.js';

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

function detectDelimiter(line) {
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
}

function buildHeaderMap(detectedColumns, activeMapping) {
  const headerMap = {};
  detectedColumns.forEach((cell, idx) => {
    const normalized = cell.trim();
    if (activeMapping[normalized] && CSV_COLUMNS.includes(activeMapping[normalized])) {
      headerMap[activeMapping[normalized]] = idx;
    }
  });
  return headerMap;
}

function buildHeaderMapFromFirstLine(firstLine) {
  const headerMap = {};
  firstLine.forEach((cell, idx) => {
    const trimmed = cell.trim();
    const normalized = normalizeHeader(trimmed);
    const target = normalized || (CSV_COLUMNS.includes(trimmed) ? trimmed : null);
    if (target) {
      headerMap[target] = idx;
    }
  });
  return headerMap;
}

function mapRowToFields(cells, headerMap) {
  const row = {};
  CSV_FIELD_KEYS.forEach((key, idx) => {
    const columnLabel = CSV_COLUMNS[idx];
    if (headerMap && headerMap[columnLabel] !== undefined) {
      row[key] = cells[headerMap[columnLabel]] ?? '';
    } else {
      row[key] = cells[idx] ?? '';
    }
  });
  return row;
}

function parseCSV(text, customMapping = {}) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { header: null, rows: [], detectedColumns: [] };

  const delimiter = detectDelimiter(lines[0]);
  const parseLine = (line) => parseCSVLine(line, delimiter);

  const firstLine = parseLine(lines[0]);
  const hasRecognizedHeader = firstLine.some(cell => {
    const normalized = normalizeHeader(cell.trim());
    return normalized !== null || CSV_COLUMNS.includes(cell.trim());
  });
  const looksLikeHeader = looksLikeUnmatchedHeader(firstLine);
  const hasCustomMapping = Object.keys(customMapping).length > 0;
  const firstLineMatchesCustomMapping = hasCustomMapping && firstLine.some(cell => customMapping[cell.trim()]);
  const hasHeader = hasRecognizedHeader || looksLikeHeader || firstLineMatchesCustomMapping;

  let headerMap = null;
  let dataStart = 0;
  const rawHeader = hasHeader ? firstLine : null;
  const detectedColumns = hasHeader ? firstLine : firstLine.map((_, i) => `列${i + 1}`);
  const autoMapping = hasHeader ? generateDefaultMapping(firstLine) : {};
  const activeMapping = hasCustomMapping ? customMapping : autoMapping;

  if (Object.keys(activeMapping).length > 0) {
    headerMap = buildHeaderMap(detectedColumns, activeMapping);
    dataStart = hasHeader ? 1 : 0;
  } else if (hasHeader) {
    headerMap = buildHeaderMapFromFirstLine(firstLine);
    dataStart = 1;
  }

  const rows = [];
  for (let i = dataStart; i < lines.length; i++) {
    let cells = parseLine(lines[i]);
    const priceIndex = headerMap ? headerMap['价格'] : 2;
    cells = repairSplitThousandSeparator(cells, CSV_COLUMNS.length, priceIndex);
    if (cells.every(c => c === '')) continue;

    const rowData = mapRowToFields(cells, headerMap);
    rows.push({
      rawLine: lines[i],
      lineNumber: i + 1,
      rawCells: [...cells],
      ...rowData
    });
  }

  const mappingStatus = getMappedColumnStatus(detectedColumns, activeMapping);
  const missingRequired = getMissingRequiredColumns(mappingStatus);

  return {
    header: rawHeader,
    rows,
    headerMap,
    detectedColumns,
    autoMapping,
    activeMapping,
    mappingStatus,
    missingRequired,
    hasHeader
  };
}

export {
  parseCSVLine,
  countDelimitersOutsideQuotes,
  repairSplitThousandSeparator,
  detectDelimiter,
  parseCSV
};
