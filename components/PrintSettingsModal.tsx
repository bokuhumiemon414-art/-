
import React, { useState } from 'react';
import { Printer, X, Check, ArrowRight, Scan, Settings2, Laptop } from 'lucide-react';
import { PRINTER_OPTIONS, SCANNER_OPTIONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (orientation: 'landscape' | 'portrait', printerId: string) => void;
}

const PrintSettingsModal: React.FC<Props> = ({ isOpen, onClose, onPrint }) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [selectedPrinter, setSelectedPrinter] = useState(PRINTER_OPTIONS[0].id);
  const [selectedScanner, setSelectedScanner] = useState(SCANNER_OPTIONS[0].id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between text-white shadow-md">
          <h3 className="font-bold text-lg flex items-center">
            <Printer className="w-5 h-5 mr-2" />
            印刷・デバイス設定
          </h3>
          <button onClick={onClose} className="hover:bg-indigo-600 p-1.5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* Device Selection Section */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center">
              <span className="bg-slate-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">1</span>
              使用デバイスの選択
            </h4>
            <div className="pl-7 space-y-4">
              {/* Printer Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center">
                  <Printer className="w-3 h-3 mr-1" />
                  プリンタ (出力先)
                </label>
                <div className="relative">
                  <select 
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    {PRINTER_OPTIONS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <Settings2 className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Scanner Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center">
                  <Scan className="w-3 h-3 mr-1" />
                  スキャナー (連携時のみ)
                </label>
                <div className="relative">
                  <select 
                    value={selectedScanner}
                    onChange={(e) => setSelectedScanner(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    {SCANNER_OPTIONS.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <Settings2 className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Orientation Section */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center">
              <span className="bg-slate-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">2</span>
              用紙の向き
            </h4>
            <div className="grid grid-cols-2 gap-4 pl-7">
              <button
                onClick={() => setOrientation('landscape')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all relative ${orientation === 'landscape' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50'}`}
              >
                {orientation === 'landscape' && (
                  <div className="absolute top-2 right-2 text-indigo-600">
                    <CheckCircleIcon />
                  </div>
                )}
                <div className="w-16 h-10 border-2 border-current rounded mb-3 bg-white shadow-sm mx-auto"></div>
                <span className="text-sm font-bold">横 (Landscape)</span>
              </button>
              
              <button
                onClick={() => setOrientation('portrait')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all relative ${orientation === 'portrait' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50'}`}
              >
                {orientation === 'portrait' && (
                  <div className="absolute top-2 right-2 text-indigo-600">
                    <CheckCircleIcon />
                  </div>
                )}
                <div className="w-10 h-16 border-2 border-current rounded mb-3 bg-white shadow-sm mx-auto"></div>
                <span className="text-sm font-bold">縦 (Portrait)</span>
              </button>
            </div>
          </div>

          {/* Info Box */}
           <div className={`border rounded-lg p-3 flex items-start space-x-2 transition-colors ${selectedPrinter === 'richo_sp_c840' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
             <Laptop className={`w-4 h-4 mt-0.5 ${selectedPrinter === 'richo_sp_c840' ? 'text-indigo-500' : 'text-amber-500'}`} />
             <p className={`text-xs leading-tight ${selectedPrinter === 'richo_sp_c840' ? 'text-indigo-700' : 'text-amber-700'}`}>
               {selectedPrinter === 'richo_sp_c840' ? (
                 <>
                   <strong>Windows連携印刷:</strong> 「印刷を開始する」を押すとデータファイル(.txt)がダウンロードされます。連携ツール(print_utility.py)を使用して印刷を実行してください。
                 </>
               ) : (
                 <>
                   <strong>確認:</strong> 「印刷を開始する」を押すとデータが送信され、OSの印刷ダイアログが開きます。そこで最終的な用紙設定を行ってください。
                 </>
               )}
             </p>
           </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={() => onPrint(orientation, selectedPrinter)}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all flex items-center text-sm transform active:scale-95"
          >
            <Printer className="w-4 h-4 mr-2" />
            印刷を開始する
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export default PrintSettingsModal;
