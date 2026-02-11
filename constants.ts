
import { Member } from './types';

export interface MemberWithColor extends Member {
  color: string;
  bgActive: string;
  borderActive: string;
}

export const MEMBERS: MemberWithColor[] = [
  { id: '1', name: '竹内いづみ', color: 'text-rose-600', bgActive: 'bg-rose-100', borderActive: 'border-rose-200' },
  { id: '2', name: '山本久美子', color: 'text-amber-600', bgActive: 'bg-amber-100', borderActive: 'border-amber-200' },
  { id: '3', name: '工藤美穂', color: 'text-emerald-600', bgActive: 'bg-emerald-100', borderActive: 'border-emerald-200' },
  { id: '4', name: '木村倭人', color: 'text-sky-600', bgActive: 'bg-sky-100', borderActive: 'border-sky-200' },
  { id: '5', name: '我満乃愛', color: 'text-violet-600', bgActive: 'bg-violet-100', borderActive: 'border-violet-200' },
  { id: '6', name: '工藤貴史', color: 'text-pink-600', bgActive: 'bg-pink-100', borderActive: 'border-pink-200' },
];

export const FULL_ATTENDANCE_SATURDAYS = [
  '2026-05-02',
  '2026-08-01',
  '2026-09-05',
  '2026-10-03',
  '2026-11-07',
  '2026-12-05',
  '2027-01-16',
  '2027-02-06',
];

export const COMPANY_HOLIDAYS = [
  '2026-08-13', '2026-08-14', '2026-08-15',
  '2026-12-30', '2026-12-31',
  '2027-01-02', '2027-01-04', '2027-01-05',
];

export const MONTHLY_SHIFT_OFF_QUOTA: Record<string, number> = {
  '2026-04': 4,
  '2026-05': 4,
  '2026-06': 5,
  '2026-07': 4,
  '2026-08': 3,
  '2026-09': 4,
  '2026-10': 4,
  '2026-11': 3,
  '2026-12': 3,
  '2027-01': 3,
  '2027-02': 3,
  '2027-03': 4,
};

export const PUBLIC_HOLIDAYS = [
  '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
  '2026-10-12', '2026-11-03', '2026-11-23',
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22'
];

export const PRINTER_OPTIONS = [
  { id: 'default', name: 'システム既定のプリンタ (標準)' },
  { id: 'richo_sp_c840', name: 'RICHO SP C840 (弘前)' },
  { id: 'office_main', name: '本社 複合機 (Canon iR-ADV)' },
  { id: 'warehouse_1', name: '物流倉庫 第1プリンタ (EPSON)' },
  { id: 'warehouse_2', name: '物流倉庫 第2プリンタ (HP LaserJet)' },
  { id: 'pdf', name: 'PDFとして保存' }
];

export const SCANNER_OPTIONS = [
  { id: 'none', name: '使用しない' },
  { id: 'office_scan', name: '本社 複合機 (スキャナ機能)' },
  { id: 'scansnap', name: 'デスク用 ScanSnap' }
];
