
/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db, isMockMode } from '../services/firebase';
import { Student, UserRole, Teacher, ClassData } from '../types';
import { 
    BuildingLibraryIcon, Loader2, PlusIcon, TrashIcon, 
    ArrowLeftIcon, FileSpreadsheet, IdentificationIcon
} from './Icons';
import { deleteStudent } from '../services/studentService';

const ClassList: React.FC<{ onBack: () => void, userRole: UserRole }> = ({ onBack, userRole }) => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'subjects'>('students');
  
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = userRole === UserRole.ADMIN || userRole === UserRole.DEVELOPER;

  useEffect(() => {
    if (isMockMode) {
        // Fix: Add missing 'level' property required by ClassData interface
        setClasses([{ id: '1', name: 'X IPA 1', level: '10', academicYear: '2023/2024' }]);
        setAllStudents([{ id: 's1', namaLengkap: 'Adelia Sri Sundari', idUnik: '25002', tingkatRombel: 'X IPA 1', status: 'Aktif', jenisKelamin: 'Perempuan', nisn: '0086806440' } as Student]);
        setLoading(false);
        return;
    }
    if (!db) return;
    db.collection('classes').onSnapshot(s => setClasses(s.docs.map(d => ({ id: d.id, ...d.data() } as ClassData))));
    db.collection('students').onSnapshot(s => setAllStudents(s.docs.map(d => ({ id: d.id, ...d.data() } as Student))));
    setLoading(false);
  }, []);

  const classStudents = useMemo(() => {
      if (!selectedClass) return [];
      return allStudents.filter(s => s.tingkatRombel === selectedClass.name).sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
  }, [selectedClass, allStudents]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] overflow-hidden">
      <div className="bg-white/80 dark:bg-[#0B1121]/80 backdrop-blur-xl px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 safe-pt z-40">
          <div className="flex items-center gap-4">
              <button onClick={view === 'detail' ? () => setView('list') : onBack} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700"><ArrowLeftIcon className="w-5 h-5" /></button>
              <div>
                  <h2 className="text-[10px] font-bold text-slate-900 dark:text-white leading-none uppercase tracking-widest">{view === 'detail' ? selectedClass?.name : 'Rombongan belajar'}</h2>
                  <p className="text-[10px] font-medium text-indigo-600 mt-1.5">Manajemen kelas</p>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
              <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 opacity-20 mx-auto" /></div>
          ) : view === 'list' ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {classes.map(cls => (
                      <div key={cls.id} onClick={() => { setSelectedClass(cls); setView('detail'); setActiveTab('students'); }} className="bg-white dark:bg-[#151E32] p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl cursor-pointer transition-all">
                           <h4 className="text-base font-bold text-slate-800 dark:text-white truncate">{cls.name}</h4>
                           <p className="text-[10px] font-medium text-slate-400 mt-1">Tapel: {cls.academicYear}</p>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="p-5 lg:p-8 space-y-6">
                  <div className="flex p-1 bg-slate-100 dark:bg-[#151E32] rounded-2xl w-fit border border-slate-200">
                      <button onClick={() => setActiveTab('students')} className={`px-8 py-2.5 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Daftar siswa</button>
                      <button onClick={() => setActiveTab('subjects')} className={`px-8 py-2.5 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'subjects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Mata pelajaran</button>
                  </div>

                  {activeTab === 'students' && (
                      <div className="bg-white dark:bg-[#151E32] rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                          <div className="overflow-x-auto custom-scrollbar">
                              <table className="excel-table">
                                  <thead>
                                      <tr>
                                          <th className="text-center w-12">No</th>
                                          <th>Nama lengkap peserta didik</th>
                                          <th className="text-center">Nisn</th>
                                          <th className="text-center">Gender</th>
                                          <th className="text-center">Status</th>
                                          {canManage && <th className="text-center w-24">Aksi</th>}
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {classStudents.length > 0 ? (
                                          classStudents.map((s, idx) => (
                                              <tr key={s.id}>
                                                  <td className="text-center font-mono text-slate-400">{idx + 1}</td>
                                                  <td className="font-bold text-slate-800 dark:text-slate-200">{s.namaLengkap}</td>
                                                  <td className="text-center font-mono text-slate-500">{s.nisn}</td>
                                                  <td className="text-center">
                                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${s.jenisKelamin === 'Perempuan' ? 'text-rose-500 bg-rose-50' : 'text-blue-500 bg-blue-50'}`}>{s.jenisKelamin === 'Perempuan' ? 'P' : 'L'}</span>
                                                  </td>
                                                  <td className="text-center">
                                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">{s.status}</span>
                                                  </td>
                                                  {canManage && (
                                                      <td className="text-center">
                                                          <button onClick={() => deleteStudent(s.id!)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-rose-600 transition-all"><TrashIcon className="w-3 h-3"/></button>
                                                      </td>
                                                  )}
                                              </tr>
                                          ))
                                      ) : (
                                          <tr><td colSpan={6} className="py-20 text-center text-[10px] font-bold text-slate-400">Rombel belum memiliki data siswa</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex justify-between items-center border-t border-slate-200">
                              <p className="text-[10px] font-bold text-slate-400">Total: {classStudents.length} siswa terdaftar</p>
                              {canManage && (
                                  <button className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600">
                                      <FileSpreadsheet className="w-3 h-3" /> Impor data
                                  </button>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default ClassList;
