
import React, { useState } from 'react';
import { format, endOfMonth, eachDayOfInterval, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { MonthlyShift, DayInfo, Preferences } from '../types';
import { MEMBERS } from '../constants';
import { Info, HelpCircle } from 'lucide-react';

interface Props {
  monthKey: string;
  monthDays: DayInfo[];
  currentShift: MonthlyShift | undefined;
  preferences: Preferences;
}

const ShiftCalendar: React.FC<Props> = ({ monthKey, monthDays, currentShift, preferences }) => {
  const [showOnlyRequests, setShowOnlyRequests] = useState(false);
  const [year, month] = monthKey.split('-').map(Number);
  const monthDate = new Date(year, month - 1);
  
  // Fix: Manual calculation for start of week as startOfMonth and startOfWeek are missing from the package
  const monthStart = new Date(year, month - 1, 1);
  const start = new Date(monthStart);
  start.setDate(monthStart.getDate() - monthStart.getDay());
  const end = endOfWeek(endOfMonth(monthDate));
  const calendarDays = eachDayOfInterval({ start, end });

  const getDayEntries = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    if (!currentShift) return [];
    return currentShift.entries.filter(e => e.date === iso);
  };

  const getDayRequests = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    return preferences.shiftOffRequests.filter(r => r.date === iso);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Legend & Controls */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center text-sm font-bold text-slate-700 mr-2">
            <Info className="w-4 h-4 mr-1.5 text-indigo-500" />
            凡例:
          </div>
          {MEMBERS.map(m => (
            <div key={m.id} className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 shadow-sm">
              <div className={`w-2.5 h-2.5 rounded-full ${m.bgActive.split(' ')[0]} border border-slate-300`}></div>
              <span className={`text-[10px] font-bold ${m.color}`}>{m.name}</span>
            </div>
          ))}
          <div className="flex items-center space-x-4 ml-4 border-l pl-4 border-slate-200">
            <div className="flex items-center text-[10px] font-bold text-slate-500">
               <span className="w-3 h-3 rounded border border-indigo-200 bg-white mr-1.5 border-dashed"></span>
               希望のみ
            </div>
            <div className="flex items-center text-[10px] font-bold text-slate-700">
               <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 mr-1.5"></span>
               確定(シフト休)
            </div>
            <div className="flex items-center text-[10px] font-bold text-amber-600">
               <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 mr-1.5"></span>
               有休
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-l border-t border-slate-200">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div key={d} className={`px-4 py-3 text-center text-xs font-bold border-r border-b border-slate-200 bg-slate-50/50 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-indigo-500' : 'text-slate-500'}`}>
              {d}
            </div>
          ))}
          
          {calendarDays.map((date, i) => {
            const isCurrentMonth = isSameMonth(date, monthDate);
            const iso = format(date, 'yyyy-MM-dd');
            const entries = getDayEntries(date);
            const requests = getDayRequests(date);
            
            // 休みとして確定しているメンバー
            const confirmedOffMembers = MEMBERS.filter(m => entries.find(e => e.memberId === m.id && e.status === 'OFF'));
            // 有休として確定しているメンバー
            const confirmedPaidMembers = MEMBERS.filter(m => entries.find(e => e.memberId === m.id && e.status === 'PAID'));
            // 荷受当番
            const dutyMembers = MEMBERS.filter(m => entries.find(e => e.memberId === m.id && e.status === 'SAT_WORK'));
            // 希望は出しているが、まだ確定になっていないメンバー
            const pendingRequestMembers = MEMBERS.filter(m => {
              const req = requests.find(r => r.memberId === m.id);
              if (!req) return false;
              // 既にOFFかPAIDになっているならPendingではない
              const status = entries.find(e => e.memberId === m.id)?.status;
              return status !== 'OFF' && status !== 'PAID';
            });

            const dayInfo = monthDays.find(d => d.isoDate === iso);
            const isHoliday = dayInfo?.dayType === 'SUNDAY' || dayInfo?.dayType === 'HOLIDAY' || dayInfo?.dayType === 'COMPANY_HOLIDAY';
            const isSat = date.getDay() === 6;

            return (
              <div 
                key={iso} 
                className={`min-h-[140px] p-2 border-r border-b border-slate-100 transition-colors ${!isCurrentMonth ? 'bg-slate-50/30' : 'bg-white'} ${isHoliday ? 'bg-rose-50/5' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold ${!isCurrentMonth ? 'text-slate-300' : isHoliday ? 'text-rose-500' : isSat ? 'text-indigo-500' : 'text-slate-500'}`}>
                    {format(date, 'd')}
                  </span>
                  {dayInfo?.dayType === 'FULL_ATTENDANCE_SATURDAY' && (
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-black">全員出勤</span>
                  )}
                </div>

                <div className="space-y-1">
                  {/* Duty Members */}
                  {dutyMembers.map(m => (
                    <div key={m.id} className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${m.bgActive} ${m.borderActive} shadow-sm border-l-4 border-l-indigo-600`}>
                      <span className="truncate">{m.name} (荷受)</span>
                    </div>
                  ))}

                  {/* Confirmed Paid Members */}
                  {confirmedPaidMembers.map(m => (
                    <div key={m.id} className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-700 shadow-sm`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0"></span>
                      <span className="truncate">【有休】{m.name}</span>
                    </div>
                  ))}

                  {/* Confirmed Off Members */}
                  {!isHoliday && confirmedOffMembers.map(m => (
                    <div key={m.id} className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-700 shadow-sm`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${m.bgActive.split(' ')[0]} mr-1.5 shrink-0`}></div>
                      <span className="truncate">【シフト休】{m.name}</span>
                    </div>
                  ))}

                  {/* Pending Requests */}
                  {!isHoliday && pendingRequestMembers.map(m => {
                    const req = requests.find(r => r.memberId === m.id);
                    const isPaidReq = req?.type === 'paid';
                    return (
                      <div key={m.id} className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-white border border-dashed opacity-80 ${isPaidReq ? 'border-amber-300 text-amber-500' : 'border-indigo-100 text-indigo-400'}`}>
                        <HelpCircle className={`w-2.5 h-2.5 mr-1 ${isPaidReq ? 'text-amber-400' : 'text-indigo-300'}`} />
                        <span className="truncate">{m.name} ({isPaidReq ? '有休希望' : '希望'})</span>
                      </div>
                    );
                  })}
                  
                  {isHoliday && confirmedOffMembers.length > 0 && (
                    <div className="text-[9px] text-slate-300 italic text-center pt-2">
                      祝日一斉休
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ShiftCalendar;
