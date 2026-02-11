
import { format, isSaturday, isSunday, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { DayType, DayInfo } from '../types';
import { FULL_ATTENDANCE_SATURDAYS, COMPANY_HOLIDAYS, PUBLIC_HOLIDAYS } from '../constants';

export const getDayType = (date: Date): DayType => {
  const iso = format(date, 'yyyy-MM-dd');
  
  if (COMPANY_HOLIDAYS.includes(iso)) return 'COMPANY_HOLIDAY';
  if (PUBLIC_HOLIDAYS.includes(iso)) return 'HOLIDAY';
  if (isSunday(date)) return 'SUNDAY';
  if (FULL_ATTENDANCE_SATURDAYS.includes(iso)) return 'FULL_ATTENDANCE_SATURDAY';
  if (isSaturday(date)) return 'SATURDAY';
  
  return 'WORKDAY';
};

export const getMonthDays = (year: number, month: number): DayInfo[] => {
  // Fix: Use native Date constructor instead of startOfMonth as it is missing from the package
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });

  return days.map(date => ({
    date,
    isoDate: format(date, 'yyyy-MM-dd'),
    dayType: getDayType(date),
    label: format(date, 'd'),
  }));
};

export const getSaturdaysOfMonth = (days: DayInfo[]): DayInfo[] => {
  return days.filter(d => d.dayType === 'SATURDAY' || d.dayType === 'FULL_ATTENDANCE_SATURDAY');
};

export const isHolidayOrOff = (dayType: DayType): boolean => {
  return dayType === 'SUNDAY' || dayType === 'HOLIDAY' || dayType === 'COMPANY_HOLIDAY';
};