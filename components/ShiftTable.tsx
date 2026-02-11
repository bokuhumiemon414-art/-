
import React, { useState, useEffect } from 'react';
import { RefreshCw, Save, CheckCircle, AlertTriangle, Download, Calendar, RotateCw, Printer, Eye, EyeOff, X, Check, MessageSquare } from 'lucide-react';
import { DayInfo, Preferences, MonthlyShift, ShiftEntry, Member } from '../types';
import { MEMBERS, FULL_ATTENDANCE_SATURDAYS } from '../constants';
import { format, isSameDay } from 'date-fns';

interface Props {
  monthKey: string;
  monthDays: DayInfo[];
  preferences: Preferences;
  currentShift: MonthlyShift | undefined;
  onUpdate: (shift: MonthlyShift) => void;
  quota: number;
  isPreviewMode?: boolean;
  setIsPreviewMode?: (val: boolean) => void;
  onRequestPrint?: () => void;
}

const ShiftTable: React.FC<Props> = ({ monthKey, monthDays, preferences, currentShift, onUpdate, quota, isPreviewMode, setIsPreviewMode, onRequestPrint }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [year, month] = monthKey.split('-');

  const generateShift = (preserveManual = true) => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const newEntries: ShiftEntry[] = [];
      const existingEntries = currentShift?.entries || [];

      // 1. 初期配置（祝日・固定休の反映）
      // 平日は一度全てWORKにリセットすることで、前回の生成結果や手動変更が希望反映を邪魔しないようにする
      monthDays.forEach(day => {
        MEMBERS.forEach(member => {
          const existing = existingEntries.find(e => e.memberId === member.id && e.date === day.isoDate);
          const isHoliday = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY';
          
          if (isHoliday) {
            newEntries.push({ date: day.isoDate, memberId: member.id, status: 'OFF' });
          } else if (preserveManual && existing) {
            // 土曜日の設定（当番 or 手動OFF）は維持する
            const isSaturday = day.dayType === 'SATURDAY';
            if (existing.status === 'SAT_WORK' || (existing.status === 'OFF' && isSaturday)) {
              newEntries.push({ ...existing });
            } else if (existing.status === 'PAID') {
               // 有休も維持
               newEntries.push({ ...existing });
            } else {
              // 平日は一旦WORKに戻して、後のステップで希望を再適用させる
              newEntries.push({ date: day.isoDate, memberId: member.id, status: 'WORK' });
            }
          } else {
            newEntries.push({ date: day.isoDate, memberId: member.id, status: 'WORK' });
          }
        });
      });

      // 2. 土曜日当番・休みの決定
      monthDays.filter(d => d.dayType === 'SATURDAY').forEach(day => {
        const dayEntries = newEntries.filter(e => e.date === day.isoDate);
        let assignedDuty = dayEntries.filter(e => e.status === 'SAT_WORK');

        if (assignedDuty.length < 2) {
          const needed = 2 - assignedDuty.length;
          // 出勤可能(〇)を出している人から選ぶ
          const availableIds = preferences.saturdays
            .filter(s => s.date === day.isoDate && s.isAvailable === true)
            .map(s => s.memberId);
          
          const candidates = dayEntries.filter(e => 
            e.status === 'WORK' && 
            availableIds.includes(e.memberId)
          );

          candidates.slice(0, needed).forEach(e => {
            e.status = 'SAT_WORK';
          });
        }

        // 当番以外は一律「OFF」
        // ただし、既に「PAID」などが設定されている場合は上書きしないよう注意（現状ロジックでは土曜はWORKスタートなのでOK）
        dayEntries.forEach(e => {
          if (e.status !== 'SAT_WORK' && e.status !== 'PAID') {
            e.status = 'OFF';
          }
        });
      });

      // 全員出勤土曜の補正
      monthDays.filter(d => d.dayType === 'FULL_ATTENDANCE_SATURDAY').forEach(day => {
        newEntries.filter(e => e.date === day.isoDate).forEach(e => {
          if (e.status !== 'PAID') {
            e.status = 'WORK';
          }
        });
      });

      // 3. 有休希望と通常の休み希望の割り当て
      MEMBERS.forEach(member => {
        const memberEntries = newEntries.filter(e => e.memberId === member.id);
        const myRequests = preferences.shiftOffRequests.filter(r => r.memberId === member.id);
        
        // 3-1. 有休希望を優先適用（回数制限なし、強制OFF）
        const paidRequests = myRequests.filter(r => r.type === 'paid');
        for (const req of paidRequests) {
           const entry = memberEntries.find(e => e.date === req.date);
           // WORKの場合のみ適用（祝日などは上書きしない）
           if (entry && entry.status === 'WORK') {
              entry.status = 'PAID';
           }
        }

        // 3-2. 通常の休み希望を適用（回数制限あり）
        const normalRequests = myRequests.filter(r => !r.type || r.type === 'normal').map(r => r.date);
        
        // 現時点での「平日」のOFFのみをカウント（土曜休み、有休はカウントしない）
        const countCurrentOffs = () => memberEntries.filter(e => {
          const d = monthDays.find(day => day.isoDate === e.date);
          return e.status === 'OFF' && d && d.dayType === 'WORKDAY';
        }).length;

        for (const reqDate of normalRequests) {
          if (countCurrentOffs() >= quota) break; // 規定回数に達したら終了
          
          // 対象日が平日（WORKDAY）であるか確認
          const d = monthDays.find(day => day.isoDate === reqDate);
          if (!d || d.dayType !== 'WORKDAY') continue;

          // エントリを取得（まだWORKの状態のもの）
          const entry = memberEntries.find(e => e.date === reqDate && e.status === 'WORK');
          if (entry) {
            const totalOffOnDay = newEntries.filter(e => e.date === reqDate && (e.status === 'OFF' || e.status === 'PAID')).length;
            // 1日2名までの制約チェック（有休の人も休みに含めて判定）
            if (totalOffOnDay < 2) {
              entry.status = 'OFF';
            }
          }
        }
      });

      onUpdate({ monthKey, entries: newEntries });
      setIsGenerating(false);
    }, 600);
  };

  const handleReset = () => {
    if (!window.confirm('現在のシフト表をリセットしますか？\n平日に入力されている「休み」が全てクリアされ、初期状態（平日全出勤）に戻ります。')) return;

    // リセット処理は即時反映のためsetTimeoutなし（または短時間）で実行
    const newEntries: ShiftEntry[] = [];

    // 1. 基本配置（日曜・祝日はOFF、それ以外はWORK）
    monthDays.forEach(day => {
      MEMBERS.forEach(member => {
        const isHoliday = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY';
        newEntries.push({ 
          date: day.isoDate, 
          memberId: member.id, 
          status: isHoliday ? 'OFF' : 'WORK' 
        });
      });
    });

    // 2. 土曜日の初期割り当て（原則ルールに従う）
    monthDays.filter(d => d.dayType === 'SATURDAY').forEach(day => {
      const dayEntries = newEntries.filter(e => e.date === day.isoDate);
      
      // 土曜出勤可能者リスト
      const availableIds = preferences.saturdays
        .filter(s => s.date === day.isoDate && s.isAvailable === true)
        .map(s => s.memberId);

      // 出勤可能者を優先してソートするために一時的に配列をコピーしてソート
      const sortedEntries = [...dayEntries].sort((a, b) => {
        const aAvail = availableIds.includes(a.memberId) ? 1 : 0;
        const bAvail = availableIds.includes(b.memberId) ? 1 : 0;
        return bAvail - aAvail;
      });

      // newEntries内の該当エントリを更新
      sortedEntries.forEach((entryRef, index) => {
        // entryRefはnewEntries内のオブジェクトへの参照
        if (index < 2) {
          entryRef.status = 'SAT_WORK';
        } else {
          entryRef.status = 'OFF';
        }
      });
    });

    // 3. 全員出勤土曜の補正
    monthDays.filter(d => d.dayType === 'FULL_ATTENDANCE_SATURDAY').forEach(day => {
      newEntries.filter(e => e.date === day.isoDate).forEach(e => {
        e.status = 'WORK';
      });
    });

    onUpdate({ monthKey, entries: newEntries });
  };

  const getStatus = (memberId: string, date: string) => {
    const entry = currentShift?.entries?.find(e => e.memberId === memberId && e.date === date);
    if (entry) return entry.status;
    
    // データ未生成時の表示用フォールバック
    const day = monthDays.find(d => d.isoDate === date);
    const isHoliday = day && (day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY');
    return isHoliday ? 'OFF' : 'WORK';
  };

  const getRequestType = (memberId: string, date: string) => {
    const req = preferences.shiftOffRequests?.find(r => r.memberId === memberId && r.date === date);
    return req ? (req.type || 'normal') : null;
  };

  const toggleStatus = (memberId: string, date: string) => {
    let entries = currentShift?.entries ? [...currentShift.entries] : [];
    
    // データがまだない場合は初期化データを作成（手動編集を開始できるようにする）
    if (entries.length === 0) {
      monthDays.forEach(day => {
        MEMBERS.forEach(member => {
          const isHoliday = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY';
          entries.push({ 
            date: day.isoDate, 
            memberId: member.id, 
            status: isHoliday ? 'OFF' : 'WORK' 
          });
        });
      });
    }

    const currentEntryIndex = entries.findIndex(e => e.memberId === memberId && e.date === date);
    if (currentEntryIndex !== -1) {
      const currentStatus = entries[currentEntryIndex].status;
      let nextStatus: 'WORK' | 'OFF' | 'SAT_WORK' | 'PAID' = 'WORK';
      
      if (currentStatus === 'WORK') nextStatus = 'OFF';
      else if (currentStatus === 'OFF') nextStatus = 'PAID';
      else if (currentStatus === 'PAID') {
        const day = monthDays.find(d => d.isoDate === date);
        nextStatus = (day?.dayType === 'SATURDAY') ? 'SAT_WORK' : 'WORK';
      } else if (currentStatus === 'SAT_WORK') {
        nextStatus = 'WORK';
      }

      entries[currentEntryIndex] = { ...entries[currentEntryIndex], status: nextStatus };
      onUpdate({ monthKey, entries });
    }
  };

  const handleManualSave = () => {
    setSaveStatus('saved');
    setLastSaved(format(new Date(), 'HH:mm:ss'));
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleDownloadCSV = () => {
    if (!currentShift) return;
    let csvContent = "\uFEFF"; 
    csvContent += "日付,曜日," + MEMBERS.map(m => m.name).join(",") + "\n";
    monthDays.forEach(day => {
      let row = `${day.isoDate},${format(day.date, 'E')},`;
      row += MEMBERS.map(m => {
        const s = getStatus(m.id, day.isoDate);
        if (s === 'OFF') return '休';
        if (s === 'SAT_WORK') return '荷受';
        if (s === 'PAID') return '有休';
        return '出勤';
      }).join(",");
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_${monthKey}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getViolations = () => {
    const violations: string[] = [];
    monthDays.forEach(day => {
      const offCount = MEMBERS.filter(m => {
        const s = getStatus(m.id, day.isoDate);
        return s === 'OFF' || s === 'PAID';
      }).length;

      if (day.dayType === 'WORKDAY' && offCount >= 3) {
        violations.push(`${day.label}日に3名以上の休みが重複しています (${offCount}名休み)`);
      }
      if (day.dayType === 'SATURDAY') {
        const workingCount = MEMBERS.filter(m => getStatus(m.id, day.isoDate) === 'SAT_WORK').length;
        if (workingCount < 2) {
          violations.push(`${day.label}日の荷受当番が不足しています (現在${workingCount}名)`);
        }
      }
    });
    return violations;
  };

  const violations = getViolations();

  const TableContent = () => (
    <div className={`bg-white ${isPreviewMode ? 'p-8 sm:p-12 shadow-2xl mx-auto w-fit' : 'rounded-xl shadow-sm border border-slate-200 overflow-hidden'} print:shadow-none print:border-slate-400 print:rounded-none print:p-0`}>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left border-collapse text-xs sm:text-sm print:text-[10pt]">
          <thead>
            {/* 年月表示用のヘッダー行 */}
            <tr className="bg-indigo-600 text-white border-b border-indigo-700 print:bg-white print:text-black print:border-b-2 print:border-slate-800">
              <th colSpan={2 + MEMBERS.length} className="px-4 py-3 text-center text-lg font-bold">
                {year}年 {month}月 シフト表
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100 print:border-slate-400">
              <th className="sticky left-0 bg-slate-50 z-20 px-4 py-3 font-bold text-slate-700 border-r print:relative print:bg-slate-100 print:border-slate-400">日</th>
              <th className="sticky left-[48px] bg-slate-50 z-20 px-4 py-3 font-bold text-slate-700 border-r w-[40px] print:relative print:bg-slate-100 print:border-slate-400">曜</th>
              {MEMBERS.map(m => (
                <th key={m.id} className="px-4 py-3 text-center font-bold text-slate-700 border-r min-w-[100px] print:border-slate-400 print:min-w-0">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthDays.map(day => {
              const isSpecial = day.dayType !== 'WORKDAY';
              const rowBg = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY' ? 'bg-rose-50/40' : 
                          day.dayType === 'SATURDAY' ? 'bg-indigo-50/20' : 
                          day.dayType === 'FULL_ATTENDANCE_SATURDAY' ? 'bg-indigo-100/30' : '';
              
              // Sticky columns need solid background to hide scrolling content
              const stickyBg = day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' || day.dayType === 'COMPANY_HOLIDAY' ? 'bg-rose-50' : 
                          day.dayType === 'SATURDAY' ? 'bg-indigo-50' : 
                          day.dayType === 'FULL_ATTENDANCE_SATURDAY' ? 'bg-indigo-100' : 'bg-white';

              return (
                <tr key={day.isoDate} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors print:border-slate-400 ${rowBg}`}>
                  <td className={`sticky left-0 z-10 px-4 py-2 font-medium border-r text-center print:relative print:border-slate-400 ${stickyBg}`}>
                    {day.label}
                  </td>
                  <td className={`sticky left-[48px] z-10 px-4 py-2 text-center border-r font-medium print:relative print:border-slate-400 ${stickyBg} ${day.dayType === 'SUNDAY' || day.dayType === 'HOLIDAY' ? 'text-rose-600' : day.dayType.includes('SATURDAY') ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {format(day.date, 'E')}
                  </td>
                  {MEMBERS.map(m => {
                    const status = getStatus(m.id, day.isoDate);
                    const reqType = getRequestType(m.id, day.isoDate);
                    let statusText = '出勤';
                    let cellClass = 'text-slate-400';
                    
                    if (status === 'OFF') {
                      statusText = '休';
                      cellClass = 'text-rose-500 font-bold bg-rose-50/30 print:bg-rose-50 print:text-rose-600';
                    } else if (status === 'SAT_WORK') {
                      statusText = '荷受';
                      cellClass = 'text-indigo-600 font-bold bg-indigo-50 print:bg-indigo-50 print:text-indigo-700';
                    } else if (status === 'PAID') {
                      statusText = '有休';
                      cellClass = 'text-amber-600 font-bold bg-amber-50 print:bg-amber-50 print:text-amber-600';
                    }

                    return (
                      <td 
                        key={m.id} 
                        onClick={() => !isPreviewMode && toggleStatus(m.id, day.isoDate)}
                        className={`px-4 py-2 text-center border-r transition-all cursor-pointer relative group print:border-slate-400 ${cellClass} ${!isPreviewMode ? 'hover:bg-indigo-50/50' : ''}`}
                      >
                        <span className="relative z-10">{statusText}</span>
                        {/* 休み希望マーク (インジケータ) */}
                        {reqType && (
                          <div 
                            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${reqType === 'paid' ? 'bg-amber-400' : 'bg-indigo-400'} animate-pulse`}
                            title={reqType === 'paid' ? "有休希望あり" : "休み希望あり"}
                          ></div>
                        )}
                        {!isPreviewMode && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none">
                             <div className="text-[8px] text-indigo-300 bg-white px-1 shadow-sm rounded border border-indigo-100">変更</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isPreviewMode) {
    return (
      <div className="min-h-screen bg-slate-800 pb-20 no-print">
        <div className="sticky top-0 z-[60] bg-slate-900/90 backdrop-blur-md text-white py-4 px-6 mb-12 flex items-center justify-between border-b border-slate-700 shadow-xl">
          <div className="flex items-center space-x-4">
            <span className="bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Preview Mode</span>
            <h3 className="font-bold text-lg">{year}年 {month}月 シフト表 プレビュー</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPreviewMode?.(false)}
              className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-bold"
            >
              <X className="w-4 h-4 mr-2" />
              プレビュー解除
            </button>
            <button
              onClick={() => onRequestPrint ? onRequestPrint() : window.print()}
              className="flex items-center px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-lg font-bold text-sm"
            >
              <Printer className="w-4 h-4 mr-2" />
              印刷実行
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto">
          <TableContent />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => generateShift(true)}
            disabled={isGenerating}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            希望を反映して自動生成
          </button>
          <button
            onClick={handleReset}
            disabled={isGenerating}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            title="手動設定を含めて全てリセットします"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            リセット
          </button>
          {currentShift && (
            <div className="flex items-center space-x-2">
              <button onClick={handleManualSave} disabled={saveStatus !== 'idle'} className={`flex items-center px-5 py-2.5 rounded-lg shadow-md transition-all font-bold text-sm ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}>
                {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                保存
              </button>
              <button onClick={() => setIsPreviewMode?.(true)} className="flex items-center px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-md transition-all font-bold text-sm">
                <Eye className="w-4 h-4 mr-2" />
                プレビュー
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4 mr-2" />
                結果を印刷
              </button>
              <button onClick={handleDownloadCSV} className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <span>休み希望あり（未反映）</span>
           </div>
           {currentShift && (
             <div>
               {violations.length === 0 ? (
                 <div className="text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 text-sm font-medium flex items-center">
                   <CheckCircle className="w-4 h-4 mr-1.5" />制約クリア
                 </div>
               ) : (
                 <div className="text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 text-sm font-medium flex items-center" title={violations.join('\n')}>
                   <AlertTriangle className="w-4 h-4 mr-1.5" />警告あり
                 </div>
               )}
             </div>
           )}
        </div>
      </div>

      <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 no-print flex items-center space-x-2">
         <MessageSquare className="w-4 h-4 text-indigo-400" />
         <p className="text-[10px] text-indigo-600 font-medium">
           一覧表のセルをクリックすると「出勤 / 休 / 有休 / 荷受」を手動で切り替えられます。点は本人の希望を示しています。
         </p>
      </div>

      <TableContent />
    </div>
  );
};

export default ShiftTable;
