const SHIPMENT_ID_REGEX = /^VE-(\d{4})-(\d{6})$/i;
const BOX_ID_REGEX = /^(VE-\d{4}-\d{6})-(\d{2})$/i;

const unique = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export const normalizeLookupValue = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '');

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

export const getShipmentIdFromScanCode = (scanCode: string) => {
  const digitsOnly = scanCode.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digitsOnly)) return null;
  const year = digitsOnly.slice(0, 4);
  const sequence = digitsOnly.slice(4);
  return `VE-${year}-${sequence}`;
};

export const getBoxIdFromScanCode = (scanCode: string) => {
  const digitsOnly = scanCode.replace(/\D/g, '');
  if (!/^\d{12}$/.test(digitsOnly)) return null;
  const shipmentId = getShipmentIdFromScanCode(digitsOnly.slice(0, 10));
  if (!shipmentId) return null;
  const boxNumber = digitsOnly.slice(10);
  return `${shipmentId}-${boxNumber}`;
};

export const buildLookupCandidates = (input: string) => {
  const normalizedQuery = normalizeLookupValue(input);
  const digitsOnly = normalizedQuery.replace(/\D/g, '');
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
