
export type Member = {
  id: string;
  name: string;
};

export type DayType = 'WORKDAY' | 'SATURDAY' | 'SUNDAY' | 'HOLIDAY' | 'COMPANY_HOLIDAY' | 'FULL_ATTENDANCE_SATURDAY';

export interface DayInfo {
  date: Date;
  isoDate: string;
  dayType: DayType;
  label: string;
}

export interface SaturdayPreference {
  memberId: string;
  date: string; // ISO string
  isAvailable: boolean | null; // true: 〇, false: ×, null: empty
}

export interface ShiftOffRequest {
  memberId: string;
  date: string; // ISO string
  type?: 'normal' | 'paid'; // normal: 通常の休み希望, paid: 有休希望
}

export interface Preferences {
  saturdays: SaturdayPreference[];
  shiftOffRequests: ShiftOffRequest[];
}

export interface ShiftEntry {
  date: string;
  memberId: string;
  status: 'WORK' | 'OFF' | 'SAT_WORK' | 'PAID';
}

export interface MonthlyShift {
  monthKey: string; // YYYY-MM
  entries: ShiftEntry[];
}
