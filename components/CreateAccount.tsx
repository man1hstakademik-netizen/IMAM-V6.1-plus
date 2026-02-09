/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, isMockMode } from '../services/firebase';
import { UserRole } from '../types';
import Layout from './Layout';
import { 
    ShieldCheckIcon, TrashIcon, Search, Loader2, SparklesIcon,
    UserPlusIcon, EnvelopeIcon, LockIcon, IdentificationIcon,
    ChevronDownIcon, UserIcon, SaveIcon, CheckCircleIcon
} from './Icons';
import { toast } from 'sonner';

interface UserData {
    uid: string;
    displayName: string;
    email: string;
    role: string;
    idUnik?: string;
}

const CreateAccount: React.FC<{ onBack: () => void, userRole: UserRole }> = ({ onBack, userRole }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
      displayName: '',
      email: '',
      password: '',
      role: UserRole.GURU,
      idUnik: ''
  });

  // Validation State
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isNameValid = formData.displayName.trim().length >= 3;
  const isIdValid = formData.idUnik.trim().length >= 4;
  const isPasswordValid = formData.password.length >= 6;

  const getInputClass = (isValid: boolean) => {
    return `w-full bg-slate-50 dark:bg-slate-900 border rounded-2xl py-4 pl-12 pr-4 text-[11px] font-bold outline-none transition-all duration-300 shadow-inner ${
        isValid 
        ? 'border-emerald-500 bg-emerald-50 focus:ring-4 focus:ring-emerald-500/10' 
        : 'border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/10'
    }`;
  };

  useEffect(() => {
    setLoading(true);
    if (isMockMode) {
        setTimeout(() => {
            setUsers([
                { uid: '1', displayName: 'AKHMAD ARIFIN', email: 'dev@imam.id', role: UserRole.DEVELOPER },
                { uid: '2', displayName: 'H. SOMERAN, S.PD.,MM', email: 'admin@madrasah.id', role: UserRole.ADMIN },
                { uid: '3', displayName: 'ADELIA SRI SUNDARI', email: 'adelia@siswa.id', role: UserRole.SISWA, idUnik: '15012' }
            ]);
            setLoading(false);
        }, 800);
        return;
    }
    if (!db) return;
    const unsub = db.collection('users').onSnapshot(snap => {
        setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData)));
        setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
      const q = searchQuery.toLowerCase();
      return users.filter(u => 
        String(u.displayName).toLowerCase().includes(q) || 
        String(u.email).toLowerCase().includes(q) ||
        String(u.idUnik).includes(q)
      );
  }, [users, searchQuery]);

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isPasswordValid) {
          toast.error("Password minimal 6 karakter.");
          return;
      }

      setSaving(true);
      const toastId = toast.loading("Memproses pendaftaran akun...");

      try {
          if (isMockMode) {
              await new Promise(r => setTimeout(r, 1500));
          } else {
              await db!.collection('users').add({
                  ...formData,
                  createdAt: new Date().toISOString()
              });
          }
          
          toast.success("Akun berhasil didaftarkan!", { id: toastId });
          setFormData({ displayName: '', email: '', password: '', role: UserRole.GURU, idUnik: '' });
          setActiveTab('list');
      } catch (err: any) {
          toast.error("Gagal: " + err.message, { id: toastId });
      } finally {
          setSaving(false);
      }
  };

  return (
    <Layout title="Manajemen User" subtitle="Pusat Kontrol Akses" icon={ShieldCheckIcon} onBack={onBack}>
      <div className="p-4 lg:p-8 pb-32 max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white dark:bg-[#151E32] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                <button onClick={() => setActiveTab('list')} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5' : 'text-slate-400'}`}>Daftar Pengguna</button>
                <button onClick={() => setActiveTab('create')} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Aktivasi Akses</button>
            </div>
            
            {activeTab === 'list' && (
                <div className="relative group flex-1 max-w-md w-full">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cari pengguna..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-[10.5px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                </div>
            )}
        </div>

        {activeTab === 'list' ? (
            <div className="bg-white dark:bg-[#151E32] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="excel-table">
                        <thead>
                            <tr>
                                <th className="text-center w-12">No</th>
                                <th>Nama Lengkap User</th>
                                <th>Alamat Email</th>
                                <th className="text-center">Level Akses</th>
                                <th className="text-center">ID Unik</th>
                                <th className="text-center w-24">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500 opacity-20" /></td></tr>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((u, i) => (
                                    <tr key={u.uid} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
                                        <td className="text-center font-mono text-slate-400 font-bold">{i + 1}</td>
                                        <td className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{u.displayName}</td>
                                        <td className="text-slate-500 font-bold lowercase">{u.email}</td>
                                        <td className="text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === UserRole.DEVELOPER ? 'bg-slate-950 text-indigo-400 border border-indigo-900/50' : u.role === UserRole.ADMIN ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>{u.role}</span>
                                        </td>
                                        <td className="text-center font-mono text-indigo-600 dark:text-indigo-400 font-black tracking-widest">{u.idUnik || '-'}</td>
                                        <td className="text-center">
                                            <button className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"><TrashIcon className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="py-24 text-center text-[10.5px] font-black text-slate-400 uppercase tracking-widest">Data tidak ditemukan</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
            <div className="max-w-2xl mx-auto bg-white dark:bg-[#151E32] rounded-[3rem] p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-xl animate-in zoom-in duration-500 relative overflow-hidden">
                <div className="mb-8 relative z-10">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Aktivasi Akses Baru</h3>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mt-2 tracking-widest">Otoritas Administrator</p>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                            <div className="relative group">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input required type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value.toUpperCase()})} className={getInputClass(isNameValid)} placeholder="NAMA LENGKAP" />
                                {isNameValid && <CheckCircleIcon className="w-4 h-4 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>
                        </div>
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Unik (NIP/NIK)</label>
                            <div className="relative group">
                                <IdentificationIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input required type="text" value={formData.idUnik} onChange={e => setFormData({...formData, idUnik: e.target.value})} className={getInputClass(isIdValid)} placeholder="1980..." />
                                {isIdValid && <CheckCircleIcon className="w-4 h-4 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Resmi</label>
                        <div className="relative group">
                            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} className={getInputClass(isValidEmail)} placeholder="nama@madrasah.id" />
                            {isValidEmail && <CheckCircleIcon className="w-4 h-4 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kata Sandi</label>
                            <div className="relative group">
                                <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={getInputClass(isPasswordValid)} placeholder="Min. 6 Karakter" />
                                {isPasswordValid && <CheckCircleIcon className="w-4 h-4 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level Akses</label>
                            <div className="relative">
                                <ShieldCheckIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 pointer-events-none" />
                                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-10 text-[11px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer shadow-inner">
                                    <option value={UserRole.GURU}>Guru / Wali Kelas</option>
                                    <option value={UserRole.STAF}>Staf Tata Usaha</option>
                                    <option value={UserRole.ADMIN}>Administrator</option>
                                    <option value={UserRole.KEPALA_MADRASAH}>Kepala Madrasah</option>
                                    <option value={UserRole.SISWA}>Siswa (Manual)</option>
                                </select>
                                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={saving} className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-[2rem] text-[10.5px] uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                        Simpan Akun
                    </button>
                </form>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default CreateAccount;