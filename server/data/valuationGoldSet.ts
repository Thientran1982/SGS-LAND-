/**
 * Small, versioned gold set of verified completed transactions.
 *
 * Prices are deliberately stored as VND/m² (not "billions" or "millions").
 * A row is usable for evaluation only when its verification metadata is
 * complete. Add new verified transactions rather than changing old rows.
 */
export interface VerifiedTransaction {
  id: string;
  locationKey: string;
  location: string;
  propertyType: string;
  transactedAt: string;
  pricePerM2: number;
  priceUnit: 'VND_PER_M2';
  verified: true;
  verificationSource: 'notary_deed' | 'bank_disbursement' | 'owner_contract';
}

export const valuationGoldSet: readonly VerifiedTransaction[] = [
  { id: 'hcm-q1-001', locationKey: 'hcm|quan-1|ben-nghe', location: 'Quận 1, Bến Nghé, TP.HCM', propertyType: 'townhouse_center', transactedAt: '2025-10-14', pricePerM2: 238000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'bank_disbursement' },
  { id: 'hcm-q1-002', locationKey: 'hcm|quan-1|ben-nghe', location: 'Quận 1, Bến Nghé, TP.HCM', propertyType: 'townhouse_center', transactedAt: '2025-11-03', pricePerM2: 251000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'notary_deed' },
  { id: 'hcm-q7-001', locationKey: 'hcm|quan-7|tan-phong', location: 'Quận 7, Tân Phong, TP.HCM', propertyType: 'apartment_suburb', transactedAt: '2025-09-21', pricePerM2: 72000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'owner_contract' },
  { id: 'hcm-q7-002', locationKey: 'hcm|quan-7|tan-phong', location: 'Quận 7, Tân Phong, TP.HCM', propertyType: 'apartment_suburb', transactedAt: '2025-12-12', pricePerM2: 76000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'bank_disbursement' },
  { id: 'hanoi-caugiay-001', locationKey: 'hanoi|cau-giay|yen-hoa', location: 'Cầu Giấy, Yên Hòa, Hà Nội', propertyType: 'townhouse_center', transactedAt: '2025-08-19', pricePerM2: 182000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'notary_deed' },
  { id: 'hanoi-caugiay-002', locationKey: 'hanoi|cau-giay|yen-hoa', location: 'Cầu Giấy, Yên Hòa, Hà Nội', propertyType: 'townhouse_center', transactedAt: '2025-11-27', pricePerM2: 176000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'bank_disbursement' },
  { id: 'hanoi-hoangmai-001', locationKey: 'hanoi|hoang-mai|dai-kim', location: 'Hoàng Mai, Đại Kim, Hà Nội', propertyType: 'land_urban', transactedAt: '2025-10-08', pricePerM2: 88000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'owner_contract' },
  { id: 'hanoi-hoangmai-002', locationKey: 'hanoi|hoang-mai|dai-kim', location: 'Hoàng Mai, Đại Kim, Hà Nội', propertyType: 'land_urban', transactedAt: '2025-12-05', pricePerM2: 91000000, priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'notary_deed' },
];