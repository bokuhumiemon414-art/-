
import React, { useState, useMemo } from 'react';
import { Check, X, Info, BadgeCheck, UserPlus, UserMinus, CheckCircle, ListChecks, CalendarOff, CheckSquare, RotateCcw, ArrowRightLeft, Trash2, Save, RefreshCw } from 'lucide-react';
import { DayInfo, Preferences, Member, SaturdayPreference, ShiftOffRequest, MonthlyShift, ShiftEntry } from '../types';
import { MEMBERS } from '../constants';
import { format } from 'date-fns';

interface Props {
  monthKey: string;
  monthDays: DayInfo[];
  saturdays: DayInfo[];
  preferences: Preferences;
  currentShift?: MonthlyShift;
  onUpdate: (prefs: Preferences) => void;
  onUpdateShift: (shift: MonthlyShift) => void;
  quota: number;
}

const PreferenceForm: React.FC<Props> = ({ monthKey, monthDays, saturdays, preferences, currentShift, onUpdate, onUpdateShift, quota }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // 安全な配列アクセスを保証
  const safeSaturdays = useMemo(() => preferences?.saturdays || [], [preferences]);
  const safeRequests = useMemo(() => preferences?.shiftOffRequests || [], [preferences]);

  const getSatStatus = (memberId: string, date: string) => {
    const found = safeSaturdays.find(s => s.memberId === memberId && s.date === date);
    return found ? found.isAvailable : null;
  };

  const isConfirmedStatus = (memberId: string, date: string, status: 'OFF' | 'SAT_WORK' | 'PAID') => {
    if (!currentShift) return false;
    const entry = currentShift.entries.find(e => e.memberId === memberId && e.date === date);
    return entry?.status === status;
  };

  const getDayAssignedCount = (date: string) => {
    return currentShift?.entries.filter(e => e.date === date && e.status === 'SAT_WORK').length || 0;
  };

  const getInitializedShift = (): MonthlyShift => {
    if (currentShift) return currentShift;
    const entries: ShiftEntry[] = [];
    monthDays.forEach(day => {
      MEMBERS.forEach(m => {
        const isOff = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY';
        entries.push({ date: day.isoDate, memberId: m.id, status: isOff ? 'OFF' : 'WORK' });
      });
    });
    return { monthKey, entries };
  };

  const handleManualSave = () => {
    // 擬似的な遅延を削除し、即座に保存完了状態にする
    setSaveStatus('saved');
    setLastSaved(format(new Date(), 'HH:mm:ss'));
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleSatToggle = (memberId: string, date: string, val: boolean) => {
    const currentStatus = getSatStatus(memberId, date);
    const newValue = currentStatus === val ? null : val;
    
    const filteredSats = safeSaturdays.filter(s => !(s.memberId === memberId && s.date === date));
    const newSats = newValue !== null ? [...filteredSats, { memberId, date, isAvailable: newValue }] : filteredSats;

    let newRequests = [...safeRequests];
    if (newValue === false) {
      if (!newRequests.some(r => r.memberId === memberId && r.date === date)) {
        newRequests.push({ memberId, date, type: 'normal' });
      }
    } else {
      newRequests = newRequests.filter(r => !(r.memberId === memberId && r.date === date));
    }

    onUpdate({ saturdays: newSats, shiftOffRequests: newRequests });
  };

  const handleBulkSatUpdate = (memberId: string | 'ALL', val: boolean | null) => {
    const targetMemberIds = memberId === 'ALL' ? MEMBERS.map(m => m.id) : [memberId];
    const targetDates = saturdays
      .filter(sat => sat.dayType !== 'FULL_ATTENDANCE_SATURDAY')
      .map(sat => sat.isoDate);

    let newSats = safeSaturdays.filter(s => 
      !(targetMemberIds.includes(s.memberId) && targetDates.includes(s.date))
    );
    let newRequests = safeRequests.filter(r => 
      !(targetMemberIds.includes(r.memberId) && targetDates.includes(r.date))
    );

    if (val !== null) {
      targetMemberIds.forEach(mId => {
        targetDates.forEach(date => {
          newSats.push({ memberId: mId, date, isAvailable: val });
          if (val === false) {
            newRequests.push({ memberId: mId, date, type: 'normal' });
          }
        });
      });
    }

    onUpdate({ saturdays: newSats, shiftOffRequests: newRequests });

    if (val === null && currentShift) {
      const shift = getInitializedShift();
      const newEntries = shift.entries.map(e => {
        if (targetMemberIds.includes(e.memberId) && targetDates.includes(e.date)) {
          return { ...e, status: 'WORK' } as ShiftEntry;
        }
        return e;
      });
      onUpdateShift({ ...shift, entries: newEntries });
    }
  };

  const handleReflectSaturdaysToRequests = () => {
    let newRequests = [...safeRequests];
    
    MEMBERS.forEach(member => {
      saturdays.forEach(sat => {
        if (sat.dayType === 'FULL_ATTENDANCE_SATURDAY') return;
        
        const isDuty = isConfirmedStatus(member.id, sat.isoDate, 'SAT_WORK');
        const alreadyRequested = newRequests.some(r => r.memberId === member.id && r.date === sat.isoDate);
        
        if (!isDuty && !alreadyRequested) {
          newRequests.push({ memberId: member.id, date: sat.isoDate, type: 'normal' });
        } else if (isDuty && alreadyRequested) {
          newRequests = newRequests.filter(r => !(r.memberId === member.id && r.date === sat.isoDate));
        }
      });
    });
    
    onUpdate({ saturdays: safeSaturdays, shiftOffRequests: newRequests });
  };

  const handleClearIndividualRequests = () => {
    if (!window.confirm('全メンバーの個別休み希望（カレンダーのマーク）をすべて解除しますか？\n※土曜日の出勤可能設定は維持されます。')) return;
    
    // saturdaysは維持し、shiftOffRequestsのみ空にする
    onUpdate({
      saturdays: safeSaturdays,
      shiftOffRequests: []
    });
    
    handleManualSave();
  };

  const handleManualAssign = (memberId: string, date: string, status: 'OFF' | 'SAT_WORK' | 'WORK' | 'PAID') => {
    const shift = getInitializedShift();
    let newEntries = shift.entries.map(e => {
      if (e.date === date && e.memberId === memberId) {
        return { ...e, status } as ShiftEntry;
      }
      return e;
    });

    const isLogisticsSaturday = saturdays.some(s => s.isoDate === date && s.dayType === 'SATURDAY');
    if (isLogisticsSaturday) {
      const currentDutyCount = newEntries.filter(e => e.date === date && e.status === 'SAT_WORK').length;
      if (currentDutyCount === 2) {
        newEntries = newEntries.map(e => {
          if (e.date === date && e.status !== 'SAT_WORK') {
            return { ...e, status: 'OFF' } as ShiftEntry;
          }
          return e;
        });
      }
    }

    onUpdateShift({ ...shift, entries: newEntries });
  };

  const handleBulkConfirmOff = (memberId: string) => {
    const shift = getInitializedShift();
    const myRequests = safeRequests.filter(r => r.memberId === memberId).map(r => r.date);
    const newEntries = shift.entries.map(e => {
      if (memberId === e.memberId && myRequests.includes(e.date)) {
        return { ...e, status: 'OFF' } as ShiftEntry;
      }
      return e;
    });
    onUpdateShift({ ...shift, entries: newEntries });
  };

  const handleRequestToggle = (memberId: string, date: string) => {
    const existingReq = safeRequests.find(r => r.memberId === memberId && r.date === date);
    let newRequests = [...safeRequests];
    
    if (!existingReq) {
      // 状態なし -> 通常休み希望
      newRequests.push({ memberId, date, type: 'normal' });
    } else if (!existingReq.type || existingReq.type === 'normal') {
      // 通常休み希望 -> 有休希望
      newRequests = newRequests.map(r => 
        (r.memberId === memberId && r.date === date) ? { ...r, type: 'paid' } : r
      );
    } else {
      // 有休希望 -> 解除
      newRequests = newRequests.filter(r => !(r.memberId === memberId && r.date === date));
    }
    
    onUpdate({ saturdays: safeSaturdays, shiftOffRequests: newRequests });
  };

  const getRequest = (memberId: string, date: string) => {
    return safeRequests.find(r => r.memberId === memberId && r.date === date);
  };

  const startDayOffset = useMemo(() => {
    if (monthDays.length === 0) return 0;
    return monthDays[0].date.getDay();
  }, [monthDays]);

  const weekHeaders = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="relative">
      {saveStatus === 'saved' && (
        <div className="fixed top-20 right-8 z-[100] bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center animate-in fade-in slide-in-from-top-4 duration-300 no-print">
          <CheckCircle className="w-5 h-5 mr-2" />
          データを更新・保存しました
        </div>
      )}

      <div className="flex justify-end mb-4 items-center space-x-4 no-print">
        {lastSaved && <span className="text-[10px] text-slate-400">最終保存: {lastSaved}</span>}
        <button 
          onClick={handleManualSave}
          disabled={saveStatus !== 'idle'}
          className={`flex items-center px-6 py-2 rounded-lg shadow-md transition-all font-bold text-sm ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saveStatus === 'saved' ? '保存完了' : 'データを保存'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between no-print">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-800">土曜日出勤可能調査</h3>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center">
                  <CalendarOff className="w-3 h-3 mr-1" />
                  当番以外は自動でシフト休に反映
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleBulkSatUpdate('ALL', true)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center bg-indigo-50 px-2 py-1 rounded transition-colors"
                >
                  <CheckSquare className="w-3 h-3 mr-1" />
                  全員を一括〇
                </button>
                <button 
                  onClick={() => handleBulkSatUpdate('ALL', null)}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-700 flex items-center bg-slate-100 px-2 py-1 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  全員を一括解除
                </button>
              </div>
            </div>
            <div className="hidden print:block bg-slate-50 px-4 py-2 font-bold text-sm border-b">
              土曜日出勤可能調査状況
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-3 text-sm font-semibold text-slate-600 border-b">メンバー</th>
                    {saturdays.map(sat => {
                      const assignedCount = getDayAssignedCount(sat.isoDate);
                      return (
                        <th key={sat.isoDate} className="px-4 py-3 text-center text-sm font-semibold text-slate-600 border-b min-w-[100px]">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 mb-1">{format(sat.date, 'MM/dd')}</span>
                            <span>{sat.label}日</span>
                            <span className={`text-[10px] mt-1 ${assignedCount === 2 ? 'text-green-600 font-bold' : 'text-slate-400'} no-print`}>
                              {assignedCount}/2名
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {MEMBERS.map(member => (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 border-b">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{member.name}</span>
                          <button 
                            onClick={() => handleBulkConfirmOff(member.id)}
                            className="text-[10px] text-indigo-600 hover:underline mt-1 text-left flex items-center no-print"
                          >
                            <BadgeCheck className="w-3 h-3 mr-1" />
                            希望をシフト休に一括反映
                          </button>
                        </div>
                      </td>
                      {saturdays.map(sat => {
                        const status = getSatStatus(member.id, sat.isoDate);
                        const isSatWork = isConfirmedStatus(member.id, sat.isoDate, 'SAT_WORK');
                        const isFullAttendance = sat.dayType === 'FULL_ATTENDANCE_SATURDAY';

                        if (isFullAttendance) {
                          return (
                            <td key={sat.isoDate} className="px-4 py-4 text-center border-b bg-indigo-50/30">
                              <span className="text-xs font-bold text-indigo-700">全員出勤</span>
                            </td>
                          );
                        }

                        return (
                          <td key={sat.isoDate} className="px-4 py-4 border-b text-center">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="flex items-center space-x-1 justify-center">
                                {status === true ? <div className="p-1 bg-green-100 text-green-700 rounded text-xs font-bold px-2">〇</div> : status === false ? <div className="p-1 bg-rose-100 text-rose-700 rounded text-xs font-bold px-2">×</div> : <div className="no-print p-1 bg-slate-100 text-slate-300 rounded text-xs px-2">-</div>}
                                <button
                                  onClick={() => handleSatToggle(member.id, sat.isoDate, true)}
                                  className={`p-1.5 rounded-md transition-all no-print ${status === true ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                  <span className="w-4 h-4 flex items-center justify-center font-bold text-xs leading-none">〇</span>
                                </button>
                                <button
                                  onClick={() => handleSatToggle(member.id, sat.isoDate, false)}
                                  className={`p-1.5 rounded-md transition-all no-print ${status === false ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {status === true && (
                                  <button
                                    onClick={() => handleManualAssign(member.id, sat.isoDate, isSatWork ? 'WORK' : 'SAT_WORK')}
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${isSatWork ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-indigo-200 text-indigo-400 hover:border-indigo-600 hover:text-indigo-600 no-print'}`}
                                  >
                                    {isSatWork ? '当番' : '当番設定'}
                                  </button>
                              )}
                              {isSatWork && <span className="hidden print:block text-[8px] font-bold text-indigo-600">当番</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CalendarOff className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-800">個別 休み希望</h3>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-2 rounded no-print">
                 <span>クリックで切替:</span>
                 <div className="flex items-center space-x-2">
                   <span className="flex items-center"><span className="w-2 h-2 bg-indigo-600 rounded mr-1"></span>休み希望</span>
                   <span className="flex items-center"><span className="w-2 h-2 bg-amber-500 rounded mr-1"></span>有休希望</span>
                 </div>
              </div>
              <div className="flex items-center space-x-2 no-print">
                <button 
                  onClick={handleReflectSaturdaysToRequests}
                  className="flex-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                  title="当番ではない土曜日を全て休み希望に追加します"
                >
                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                  非当番の土曜反映
                </button>
                <button 
                  onClick={handleClearIndividualRequests}
                  className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                  title="個別休み希望（カレンダーのマーク）を一括解除します"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  一括解除
                </button>
              </div>
            </div>
            <div className="space-y-8">
              {MEMBERS.map(member => {
                const myRequests = safeRequests.filter(r => r.memberId === member.id);
                // 有休以外の希望数をカウント
                const normalRequestsCount = myRequests.filter(r => !r.type || r.type === 'normal').length;
                
                return (
                  <div key={member.id} className="pb-4 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-bold text-slate-700 text-sm border-l-4 border-indigo-500 pl-2">{member.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${normalRequestsCount > quota ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                         希望 {normalRequestsCount} / {quota} 回
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {weekHeaders.map((h, idx) => (
                        <div key={h} className={`text-[9px] text-center font-bold mb-1 ${idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-indigo-500' : 'text-slate-400'}`}>
                          {h}
                        </div>
                      ))}
                      {Array.from({ length: startDayOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-8"></div>
                      ))}
                      {monthDays.map(day => {
                        const req = getRequest(member.id, day.isoDate);
                        const isClickable = day.dayType === 'WORKDAY' || day.dayType === 'SATURDAY';
                        const isSunday = day.date.getDay() === 0;
                        const isHoliday = day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY';
                        
                        const isPaid = req?.type === 'paid';
                        const isNormal = req && !isPaid;

                        if (!req && window.matchMedia('print').matches) {
                          return <div key={day.isoDate} className="w-8 h-8"></div>;
                        }
                        return (
                          <button
                            key={day.isoDate}
                            disabled={!isClickable}
                            onClick={() => handleRequestToggle(member.id, day.isoDate)}
                            className={`
                              text-[10px] w-8 h-8 rounded-md flex flex-col items-center justify-center transition-all relative
                              ${isPaid
                                ? 'bg-amber-500 text-white font-bold ring-2 ring-amber-300 ring-offset-1 z-10 shadow-sm'
                                : isNormal
                                  ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-300 ring-offset-1 z-10 shadow-sm'
                                  : !isClickable 
                                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                              }
                            `}
                          >
                            <span>{day.label}</span>
                            {isPaid && <span className="text-[7px] absolute bottom-0.5 leading-none">有</span>}
                            {(isSunday || isHoliday) && !req && (
                              <span className="text-[6px] absolute bottom-0.5 scale-75 leading-none text-rose-300">休</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 no-print">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div className="text-sm text-indigo-800 leading-relaxed">
                <p className="font-bold mb-1 underline decoration-indigo-300">運用ルール</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-indigo-700">
                  <li>土曜日は交代で2名が出勤（荷受）します。</li>
                  <li>荷受当番以外の土曜日は原則「休み」です。</li>
                  <li>平日の休みは、合計回数が規定（今月は{quota}回）になるよう調整されます。</li>
                  <li>カレンダー形式の日・祝は固定休のため、平日の休みのみマークしてください。</li>
                  <li>有休希望（オレンジ色）はシフト休の規定回数には含まれません。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferenceForm;
