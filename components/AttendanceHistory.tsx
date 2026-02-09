/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React, { useState, useEffect, useMemo } from 'react';
import Layout from './Layout';
import { db, auth, isMockMode } from '../services/firebase';
import { 
  ClockIcon, Search, Loader2, ShieldCheckIcon, CalendarIcon, BuildingLibraryIcon, ChevronDownIcon
} from './Icons';
import { format } from 'date-fns';
import { ViewState, AttendanceStatus, UserRole } from '../types';

interface AttendanceHistoryProps {
  onBack: () => void;
  onNavigate: (view: ViewState) => void;
  userRole: UserRole;
}

interface AttendanceRecord {
    id: string;
    studentId: string;
    studentName: string;
    class: string;
    date: string;
    status: AttendanceStatus;
    checkIn: string | null;
    checkOut: string | null;
    duha: string | null;
    zuhur: string | null;
    ashar: string | null;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ onBack, userRole }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isStudent = userRole === UserRole.SISWA;

  useEffect(() => {
    if (isMockMode) { 
        setClasses(['X IPA 1', 'XI IPS 1', 'XII AGAMA']); 
    } else if (db) { 
        db.collection('classes').get().then(s => setClasses(s.docs.map(d => d.data().name).sort())); 
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (isMockMode) {
        setTimeout(() => {
            setRecords([{ id: 'r1', studentName: 'Adelia Sri Sundari', class: 'X IPA 1', date: selectedDate, status: 'Hadir', checkIn: '07:15', checkOut: '16:00', duha: '09:30', zuhur: '12:30', ashar: '15:30' } as any]);
            setLoading(false);
        }, 500);
        return;
    }
    if (!db || !auth.currentUser) return;
    let query = db.collection('attendance').where('date', '==', selectedDate);
    if (isStudent) query = query.where('studentId', '==', auth.currentUser.uid);
    else if (selectedClass !== 'All') query = query.where('class', '==', selectedClass);
    
    const unsubscribe = query.onSnapshot(snap => {
        setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
        setLoading(false);
    }, () => setLoading(false));
    
    return () => unsubscribe();
  }, [selectedDate, selectedClass, isStudent]);

  const filteredRecords = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      return records.filter(r => String(r.studentName).toLowerCase().includes(q));
  }, [records, searchQuery]);

  const formatTime = (time: string | null) => {
      if (!time) return '-';
      if (time.startsWith('Haid')) return 'Haid';
      return time.substring(0, 5);
  };

  return (
    <Layout title="Riwayat Absensi" subtitle="Database log kehadiran madrasah" icon={ClockIcon} onBack={onBack}>
      <div className="p-4 lg:p-8 pb-32 space-y-5 max-w-6xl mx-auto">
        
        {/* Kontrol Filter & Pencarian */}
        <div className="bg-white dark:bg-[#151E32] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="grid grid-cols-2 gap-3 flex-1">
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                    />
                </div>
                {!isStudent && (
                    <div className="relative">
                        <BuildingLibraryIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select 
                            value={selectedClass} 
                            onChange={e => setSelectedClass(e.target.value)} 
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10.5px] font-bold outline-none appearance-none cursor-pointer shadow-inner"
                        >
                            <option value="All">Semua kelas</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                )}
            </div>
            {!isStudent && (
                <div className="relative flex-[1.5]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Cari nama siswa..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full pl-11 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-[10.5px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-inner" 
                    />
                </div>
            )}
        </div>

        {/* Tabel Spreadsheet Style */}
        <div className="bg-white dark:bg-[#151E32] rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th className="text-center w-10">No</th>
                            <th>Nama siswa</th>
                            <th className="text-center">Kelas</th>
                            <th className="text-center">Masuk</th>
                            <th className="text-center">Duha</th>
                            <th className="text-center">Zuhur</th>
                            <th className="text-center">Ashar</th>
                            <th className="text-center">Pulang</th>
                            <th className="text-center w-20">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 opacity-20" /></td></tr>
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map((r, i) => (
                                <tr key={r.id}>
                                    <td className="text-center font-mono text-slate-400">{i + 1}</td>
                                    <td className="font-bold text-slate-800 dark:text-slate-200">{r.studentName}</td>
                                    <td className="text-center font-medium text-slate-500">{r.class}</td>
                                    <td className="text-center font-mono text-slate-600 dark:text-slate-400">{formatTime(r.checkIn)}</td>
                                    <td className="text-center font-mono text-slate-600 dark:text-slate-400">{formatTime(r.duha)}</td>
                                    <td className="text-center font-mono text-slate-600 dark:text-slate-400">{formatTime(r.zuhur)}</td>
                                    <td className="text-center font-mono text-slate-600 dark:text-slate-400">{formatTime(r.ashar)}</td>
                                    <td className="text-center font-mono text-slate-600 dark:text-slate-400">{formatTime(r.checkOut)}</td>
                                    <td className="text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                            r.status === 'Alpha' ? 'bg-red-50 text-red-600' : 
                                            r.status === 'Haid' ? 'bg-rose-50 text-rose-600' : 
                                            'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={9} className="py-20 text-center text-slate-400 font-medium">Data log tidak ditemukan pada periode ini</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Table Footer / Summary */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total: {filteredRecords.length} entri ditemukan</span>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    <ShieldCheckIcon className="w-3.5 h-3.5" /> Database terverifikasi
                </div>
            </div>
        </div>

        {/* Info Legend */}
        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-[2rem] border border-dashed border-indigo-100 dark:border-indigo-800 text-center">
            <p className="text-[10px] font-bold text-indigo-600/70 dark:text-indigo-400/60 uppercase tracking-[0.2em] leading-relaxed">
                Data di atas disinkronisasi secara otomatis melalui sistem Hyper Scan IMAM. <br/>
                Perubahan data hanya dapat dilakukan oleh Admin atau Guru piket yang berwenang.
            </p>
        </div>
      </div>
    </Layout>
  );
};

export default AttendanceHistory;