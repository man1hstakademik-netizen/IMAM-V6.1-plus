import React, { useState, useEffect, useMemo } from 'react';
import { getTeachers, addTeacher, updateTeacher, deleteTeacher } from '../services/teacherService';
import { Teacher, UserRole } from '../types';
import { db, isMockMode } from '../services/firebase';
import { toast } from 'sonner';
import Layout from './Layout';
import { 
  BriefcaseIcon, Search, PlusIcon, PencilIcon, TrashIcon, 
  Loader2, SaveIcon, XCircleIcon, SparklesIcon
} from './Icons';

interface TeacherDataProps {
  onBack: () => void;
  userRole: UserRole;
}

const TeacherData: React.FC<TeacherDataProps> = ({ onBack, userRole }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Teacher>>({ name: '', nip: '', subject: '', status: 'PNS' });

  const canManage = userRole === UserRole.ADMIN || userRole === UserRole.DEVELOPER;

  useEffect(() => {
    setLoading(true);
    if (isMockMode) {
        getTeachers().then(d => { setTeachers(d); setLoading(false); });
        return;
    }
    if (!db) return;
    const unsubscribe = db.collection('teachers').orderBy('name').onSnapshot(s => {
        setTeachers(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
        setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const processedTeachers = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      return teachers.filter(t => String(t.name).toLowerCase().includes(q) || String(t.nip).includes(q));
  }, [teachers, searchQuery]);

  const handleEdit = (teacher: Teacher) => {
      setEditingId(teacher.id || null);
      setFormData({ ...teacher });
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      const toastId = toast.loading("Menyimpan...");
      try {
          if (editingId) await updateTeacher(editingId, formData);
          else await addTeacher(formData as Teacher);
          setIsModalOpen(false);
          toast.success("Berhasil disimpan", { id: toastId });
      } catch (e) { toast.error("Gagal menyimpan", { id: toastId }); }
  };

  return (
    <Layout title="Data guru" subtitle="Direktori GTK madrasah" icon={BriefcaseIcon} onBack={onBack}>
      <div className="p-4 lg:p-6 pb-32 space-y-6">
          <div className="bg-white dark:bg-[#151E32] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                      type="text" placeholder="Cari nama atau nip..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 pl-12 text-[10.5px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
              </div>
              {canManage && (
                  <button onClick={() => { setEditingId(null); setFormData({name:'',nip:'',subject:'',status:'PNS'}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10.5px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                      <PlusIcon className="w-4 h-4" /> Tambah guru
                  </button>
              )}
          </div>

          <div className="bg-white dark:bg-[#151E32] rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                  <table className="excel-table">
                      <thead>
                          <tr>
                              <th className="text-center w-12">No</th>
                              <th>Nama lengkap</th>
                              <th className="text-center">Nip / niy</th>
                              <th>Mata pelajaran</th>
                              <th className="text-center">Status</th>
                              {canManage && <th className="text-center w-24">Aksi</th>}
                          </tr>
                      </thead>
                      <tbody>
                          {loading ? (
                              <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 opacity-20" /></td></tr>
                          ) : processedTeachers.length > 0 ? (
                              processedTeachers.map((t, idx) => (
                                  <tr key={t.id}>
                                      <td className="text-center font-mono text-slate-400">{idx + 1}</td>
                                      <td className="font-bold text-slate-800 dark:text-slate-200 capitalize">{t.name}</td>
                                      <td className="text-center font-mono text-slate-500">{t.nip || '-'}</td>
                                      <td className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{t.subject || '-'}</td>
                                      <td className="text-center">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.status === 'PNS' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                              {t.status}
                                          </span>
                                      </td>
                                      {canManage && (
                                          <td className="text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                  <button onClick={() => handleEdit(t)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><PencilIcon className="w-3 h-3" /></button>
                                                  <button onClick={() => deleteTeacher(t.id!)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"><TrashIcon className="w-3 h-3" /></button>
                                              </div>
                                          </td>
                                      )}
                                  </tr>
                              ))
                          ) : (
                              <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Data tidak ditemukan</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400">Total: {processedTeachers.length} personil</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><SparklesIcon className="w-3 h-3" /> Data terverifikasi</div>
              </div>
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <div className="bg-white dark:bg-[#0B1121] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col border border-white/10">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-slate-800 dark:text-white leading-none">{editingId ? 'Edit data guru' : 'Tambah guru baru'}</h3>
                          <p className="text-[10px] font-medium text-indigo-50 mt-2">Database kepegawaian</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><XCircleIcon className="w-6 h-6" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <form id="teacherForm" onSubmit={handleSave} className="space-y-4">
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 ml-1">Nama lengkap & gelar *</label>
                              <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 ml-1">Nip / niy</label>
                                <input type="text" value={formData.nip || ''} onChange={e => setFormData({...formData, nip: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 ml-1">Mata pelajaran *</label>
                                <input required type="text" value={formData.subject || ''} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                            </div>
                          </div>
                      </form>
                  </div>
                  <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 dark:bg-[#0B1121]">
                      <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-white text-slate-500 font-bold text-[10.5px]">Batal</button>
                      <button type="submit" form="teacherForm" className="flex-[2] bg-indigo-600 text-white font-bold py-4 rounded-2xl text-[10.5px] shadow-xl flex items-center justify-center gap-2"><SaveIcon className="w-4 h-4" /> Simpan data</button>
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default TeacherData;