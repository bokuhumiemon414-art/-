
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, addMonths } from 'date-fns';
import { Calendar as CalendarIcon, ClipboardList, Settings, Users, ChevronLeft, ChevronRight, LayoutGrid, Printer, Loader2, Save, Check, Cloud } from 'lucide-react';
import { MEMBERS, MONTHLY_SHIFT_OFF_QUOTA, PRINTER_OPTIONS } from './constants';
import { Preferences, MonthlyShift, DayInfo } from './types';
import { getMonthDays, getSaturdaysOfMonth } from './utils/dateUtils';
import PreferenceForm from './components/PreferenceForm';
import ShiftTable from './components/ShiftTable';
import ShiftCalendar from './components/ShiftCalendar';
import PrintSettingsModal from './components/PrintSettingsModal';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // 2026年4月開始
  const [view, setView] = useState<'preference' | 'shift' | 'calendar'>('preference');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [preferences, setPreferences] = useState<Record<string, Preferences>>({});
  const [monthlyShifts, setMonthlyShifts] = useState<Record<string, MonthlyShift>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 印刷設定用
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingDevice, setPrintingDevice] = useState('');

  // 保存状態
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const monthKey = format(currentDate, 'yyyy-MM');
  const monthDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth() + 1), [currentDate]);
  const saturdays = useMemo(() => getSaturdaysOfMonth(monthDays), [monthDays]);

  // 初期ロード
  useEffect(() => {
    const saved = localStorage.getItem('shift-master-data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.preferences) setPreferences(data.preferences);
        if (data.monthlyShifts) setMonthlyShifts(data.monthlyShifts);
      } catch (e) {
        console.error("データの読み込みに失敗しました", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // 保存処理
  const saveData = useCallback((newPrefs: Record<string, Preferences>, newShifts: Record<string, MonthlyShift>) => {
    const dataString = JSON.stringify({ preferences: newPrefs, monthlyShifts: newShifts });
    localStorage.setItem('shift-master-data', dataString);
  }, []);

  const handleUpdatePreferences = (newPrefs: Preferences) => {
    const updated = { ...preferences, [monthKey]: { ...newPrefs } };
    setPreferences(updated);
    saveData(updated, monthlyShifts);
  };

  const handleUpdateShift = (newShift: MonthlyShift) => {
    const updated = { ...monthlyShifts, [monthKey]: { ...newShift } };
    setMonthlyShifts(updated);
    saveData(preferences, updated);
  };

  const handleManualSave = () => {
    setSaveStatus('saving');
    
    // 1. ローカルストレージに保存 (上書き)
    saveData(preferences, monthlyShifts);

    // 2. JSONファイルとしてダウンロード (Google Drive等への保存用)
    try {
      const dataString = JSON.stringify({ preferences, monthlyShifts }, null, 2);
      const blob = new Blob([dataString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shift_master_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("File download failed", e);
    }

    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const handleOpenPrintModal = () => {
    setIsPrintModalOpen(true);
  };

  const handleExecutePrint = (orientation: 'landscape' | 'portrait', printerId: string) => {
    const existingStyle = document.getElementById('print-orientation-style');
    if (existingStyle) existingStyle.remove();
    const style = document.createElement('style');
    style.id = 'print-orientation-style';
    style.innerHTML = `@media print { @page { size: A4 ${orientation}; margin: 8mm; } }`;
    document.head.appendChild(style);
    
    const printerName = PRINTER_OPTIONS.find(p => p.id === printerId)?.name || '既定のプリンタ';
    setPrintingDevice(printerName);
    setIsPrintModalOpen(false);
    setIsPrinting(true);

    // RICHOプリンタ選択時の特別処理 (print_utility.py連携用)
    if (printerId === 'richo_sp_c840') {
      setTimeout(() => {
        try {
          // テキストデータの生成
          // print_utility.pyにプリンタ名を伝えるためのヘッダーを追加
          let textContent = `::PRINTER::${printerName}\n`;
          textContent += `【シフト表】 ${format(currentDate, 'yyyy年 MM月')}\n`;
          textContent += "--------------------------------------------------------\n";
          textContent += `日付\t曜日\t${MEMBERS.map(m => m.name).join('\t')}\n`;
          textContent += "--------------------------------------------------------\n";

          monthDays.forEach(day => {
            const dateStr = day.label;
            const weekDay = format(day.date, 'E');
            const row = [dateStr.padStart(2, ' '), weekDay];

            MEMBERS.forEach(m => {
              const entry = monthlyShifts[monthKey]?.entries.find(e => e.memberId === m.id && e.date === day.isoDate);
              // ステータスの決定 (ShiftTableと同様のロジック)
              let status = entry?.status;
              if (!status) {
                 const type = day.dayType;
                 if (type === 'SUNDAY' || type === 'HOLIDAY' || type === 'COMPANY_HOLIDAY') status = 'OFF';
                 else status = 'WORK';
              }
              
              let mark = '出勤';
              if (status === 'OFF') mark = '休';
              else if (status === 'SAT_WORK') mark = '荷受';
              else if (status === 'PAID') mark = '有休';
              
              row.push(mark);
            });
            textContent += row.join('\t') + '\n';
          });
          textContent += "--------------------------------------------------------\n";
          textContent += `作成日: ${format(new Date(), 'yyyy/MM/dd HH:mm')}\n`;

          const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `print_job_${format(currentDate, 'yyyyMM')}_${format(new Date(), 'HHmmss')}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          alert("Windows連携用ファイルをダウンロードしました。\n'print_utility.py' にこのファイルを渡して印刷してください。");
        } catch (e) {
          console.error("Print generation failed", e);
          alert("印刷データの生成に失敗しました。");
        } finally {
          setIsPrinting(false);
        }
      }, 1500);
      return;
    }
    
    // 通常のブラウザ印刷
    setTimeout(() => {
      setIsPrinting(false);
      window.print();
    }, 1200);
  };

  const currentPrefs = useMemo(() => {
    return preferences[monthKey] || { saturdays: [], shiftOffRequests: [] };
  }, [preferences, monthKey]);

  const currentShift = monthlyShifts[monthKey];
  const quota = MONTHLY_SHIFT_OFF_QUOTA[monthKey] || 4;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <p className="text-slate-400 font-bold">起動中...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isPreviewMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
      <PrintSettingsModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} onPrint={handleExecutePrint} />

      {/* 印刷中オーバーレイ */}
      {isPrinting && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm text-white">
          <div className="bg-white/10 p-8 rounded-2xl flex flex-col items-center border border-white/20 shadow-2xl">
            <Printer className="w-16 h-16 text-indigo-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {printingDevice === 'RICHO SP C840 (弘前)' ? '連携データを生成中...' : '印刷データを送信中...'}
            </h2>
            <p className="text-slate-300 text-sm mb-6">{printingDevice}</p>
            <div className="w-48 bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full w-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      {!isPreviewMode && (
        <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-8 h-8" />
              <h1 className="text-xl font-black tracking-tight">ShiftMaster 2026-2027</h1>
            </div>
            
            <nav className="hidden md:flex bg-indigo-800 rounded-lg p-1">
              <button 
                onClick={() => setView('preference')}
                className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'preference' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-100 hover:bg-indigo-600'}`}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                希望収集
              </button>
              <button 
                onClick={() => setView('shift')}
                className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'shift' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-100 hover:bg-indigo-600'}`}
              >
                <Users className="w-4 h-4 mr-2" />
                一覧表
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'calendar' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-100 hover:bg-indigo-600'}`}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                カレンダー
              </button>
            </nav>

            <button 
              onClick={handleOpenPrintModal}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-md font-bold text-sm border border-indigo-400"
            >
              <Printer className="w-4 h-4 mr-2" />
              印刷設定
            </button>
          </div>
        </header>
      )}

      {/* メインコンテンツ */}
      <main className={`${isPreviewMode ? 'p-0' : 'max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8'} flex-1`}>
        {!isPreviewMode && (
          <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100 no-print">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setCurrentDate(prev => addMonths(prev, -1))}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-slate-600" />
              </button>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                {format(currentDate, 'yyyy年 MM月')}
              </h2>
              <button 
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-slate-600" />
              </button>
            </div>
            <div className="hidden sm:flex items-center space-x-3">
              <div className="text-sm font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
                今月のシフト休回数: <span className="text-indigo-600 font-bold">{quota}回</span>
              </div>
              <button 
                onClick={handleManualSave}
                disabled={saveStatus !== 'idle'}
                className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm text-white shadow-md transition-all ${
                  saveStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                title="データを保存し、バックアップファイルをダウンロードします"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : saveStatus === 'saved' ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saveStatus === 'saved' ? '保存完了' : 'データを保存'}
              </button>
            </div>
          </div>
        )}

        {/* 印刷用タイトル */}
        <div className="hidden print:block text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {format(currentDate, 'yyyy年 MM月')} シフト{view === 'preference' ? '希望状況' : view === 'shift' ? '一覧表' : 'カレンダー'}
          </h2>
        </div>

        <div className={isPreviewMode ? '' : 'space-y-6'}>
          {view === 'preference' ? (
            <PreferenceForm 
              monthKey={monthKey}
              monthDays={monthDays}
              saturdays={saturdays}
              preferences={currentPrefs}
              currentShift={currentShift}
              onUpdate={handleUpdatePreferences}
              onUpdateShift={handleUpdateShift}
              quota={quota}
            />
          ) : view === 'shift' ? (
            <ShiftTable 
              monthKey={monthKey}
              monthDays={monthDays}
              preferences={currentPrefs}
              currentShift={currentShift}
              onUpdate={handleUpdateShift}
              quota={quota}
              isPreviewMode={isPreviewMode}
              setIsPreviewMode={setIsPreviewMode}
              onRequestPrint={handleOpenPrintModal}
            />
          ) : (
            <ShiftCalendar 
              monthKey={monthKey}
              monthDays={monthDays}
              currentShift={currentShift}
              preferences={currentPrefs}
            />
          )}
        </div>
      </main>

      {!isPreviewMode && (
        <footer className="bg-white border-t border-slate-200 py-6 mt-12 no-print">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; 2026-2027 Shift Management System.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
