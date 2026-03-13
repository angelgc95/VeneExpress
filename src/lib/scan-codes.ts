const SHIPMENT_ID_REGEX = /^VE-(\d{4})-(\d{6})$/i;
const BOX_ID_REGEX = /^(VE-\d{4}-\d{6})-(\d{2})$/i;
const EAN13_REGEX = /^\d{13}$/;

const unique = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export const normalizeLookupValue = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '');

export const getEan13CheckDigit = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!/^\d{12}$/.test(digitsOnly)) return null;

  const total = digitsOnly
    .split('')
    .map(Number)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);

  return String((10 - (total % 10)) % 10);
};

export const isValidEan13 = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!EAN13_REGEX.test(digitsOnly)) return false;
  return getEan13CheckDigit(digitsOnly.slice(0, 12)) === digitsOnly.slice(12);
};

const normalizeNumericScanPayload = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (isValidEan13(digitsOnly)) {
    return digitsOnly.slice(0, 12);
  }
  return digitsOnly;
};

export const getShipmentScanCodeFromId = (shipmentId: string) => {
  const match = normalizeLookupValue(shipmentId).match(SHIPMENT_ID_REGEX);
  if (!match) return null;
  const [, year, sequence] = match;
  return `${year}${sequence}`;
};

export const getBoxScanCodeFromId = (boxId: string) => {
  const match = normalizeLookupValue(boxId).match(BOX_ID_REGEX);
  if (!match) return null;
  const [, shipmentId, boxNumber] = match;
  const shipmentScanCode = getShipmentScanCodeFromId(shipmentId);
  if (!shipmentScanCode) return null;
  return `${shipmentScanCode}${boxNumber}`;
};

export const getBoxBarcodeValueFromId = (boxId: string) => {
  const scanCode = getBoxScanCodeFromId(boxId);
  if (!scanCode) return null;
  const checkDigit = getEan13CheckDigit(scanCode);
  if (!checkDigit) return null;
  return `${scanCode}${checkDigit}`;
};

export const getShipmentIdFromScanCode = (scanCode: string) => {
  const digitsOnly = normalizeNumericScanPayload(scanCode);
  if (!/^\d{10}$/.test(digitsOnly)) return null;
  const year = digitsOnly.slice(0, 4);
  const sequence = digitsOnly.slice(4);
  return `VE-${year}-${sequence}`;
};

export const getBoxIdFromScanCode = (scanCode: string) => {
  const digitsOnly = normalizeNumericScanPayload(scanCode);
  if (!/^\d{12}$/.test(digitsOnly)) return null;
  const shipmentId = getShipmentIdFromScanCode(digitsOnly.slice(0, 10));
  if (!shipmentId) return null;
  const boxNumber = digitsOnly.slice(10);
  return `${shipmentId}-${boxNumber}`;
};

export const buildLookupCandidates = (input: string) => {
  const normalizedQuery = normalizeLookupValue(input);
  const digitsOnly = normalizeNumericScanPayload(normalizedQuery);
  const normalizedShipmentId = normalizedQuery.match(SHIPMENT_ID_REGEX)?.[0];
  const normalizedBoxId = normalizedQuery.match(BOX_ID_REGEX)?.[0];
  const shipmentIdFromCode = getShipmentIdFromScanCode(digitsOnly);
  const boxIdFromCode = getBoxIdFromScanCode(digitsOnly);

  return {
    normalizedQuery,
    digitsOnly,
    shipmentIds: unique([
      normalizedShipmentId,
      shipmentIdFromCode,
      normalizedBoxId?.replace(/-\d{2}$/, ''),
      boxIdFromCode?.replace(/-\d{2}$/, ''),
    ]),
    boxIds: unique([normalizedBoxId, boxIdFromCode]),
  };
};
