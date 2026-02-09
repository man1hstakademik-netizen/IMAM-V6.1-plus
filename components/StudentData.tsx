
/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React, { useState, useEffect, useMemo } from 'react';
import { deleteStudent, updateStudent, addStudent } from '../services/studentService';
import { Student, UserRole } from '../types';
import { db, isMockMode } from '../services/firebase';
import { toast } from 'sonner';
import Layout from './Layout';
import { 
  UsersGroupIcon, 
  PencilIcon, TrashIcon, Search, PlusIcon,
  Loader2, XCircleIcon, SaveIcon,
  SparklesIcon, IdentificationIcon,
  BuildingLibraryIcon, ChevronDownIcon,
  FileSpreadsheet
} from './Icons';

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: keyof Student | 'aksi' | 'id';
  direction: SortDirection;
}

const StudentData: React.FC<{ onBack: () => void, userRole: UserRole }> = ({ onBack, userRole }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'namaLengkap', direction: 'asc' });

  const initialFormState: Partial<Student> = {
    namaLengkap: '', nisn: '', idUnik: '', status: 'Aktif', jenisKelamin: 'Laki-laki', tingkatRombel: ''
  };

  const [formData, setFormData] = useState<Partial<Student>>(initialFormState);

  useEffect(() => {
    setLoading(true);
    if (isMockMode) {
        setTimeout(() => {
            setStudents([
                { 
                    id: 'doc_88291x', namaLengkap: 'Adelia Sri Sundari', nisn: '0086806447', idUnik: '15012', 
                    tingkatRombel: 'XII IPA 1', status: 'Aktif', jenisKelamin: 'Perempuan',
                    nik: '6307123456780001', tempatLahir: 'Barabai', tanggalLahir: '2008-05-30',
                    email: 'adelia@gmail.com', noTelepon: '085233445566', peminatan: 'MIPA',
                    namaAyahKandung: 'H. Bakri', nikAyah: '6307010101010001', pekerjaanAyah: 'Wiraswasta',
                    namaIbuKandung: 'Hj. Siti', nikIbu: '6307010101010002', pekerjaanIbu: 'IRT',
                    alamat: 'Jl. Merdeka', rt: '01', rw: '01', kelurahan: 'Barabai Barat',
                    kecamatan: 'Barabai', kabupaten: 'HST', kodePos: '71312', transportasi: 'Motor',
                    kebutuhanKhusus: 'Nihil', disciplinePoints: 100, tglMasuk: '2022-07-15',
                    linkedUserId: 'UID-ADL-091'
                } as Student,
                {
                    id: 'doc_99102z', namaLengkap: 'Zulfikar Ahmad', nisn: '0086806448', idUnik: '15013', 
                    tingkatRombel: 'X IPA 1', status: 'Aktif', jenisKelamin: 'Laki-laki',
                    disciplinePoints: 95, linkedUserId: 'UID-ZLF-082'
                } as Student
            ]);
            setLoading(false);
        }, 1000);
        return;
    }
    if (!db) return;
    const unsubscribe = db.collection('students').orderBy('namaLengkap').onSnapshot(s => {
        setStudents(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
        setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const classLevels = useMemo(() => {
    const levels = Array.from(new Set(students.map(s => s.tingkatRombel).filter(Boolean)));
    return (levels as string[]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const handleSort = (key: keyof Student | 'aksi' | 'id') => {
    if (key === 'aksi') return;
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const processedStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let filtered = students.filter(s => {
      const matchesSearch = 
        String(s.namaLengkap).toLowerCase().includes(q) || 
        String(s.nisn).includes(q) || 
        String(s.idUnik).includes(q) ||
        String(s.id).toLowerCase().includes(q);
      const matchesClass = selectedClass === 'All' || s.tingkatRombel === selectedClass;
      return matchesSearch && matchesClass;
    });

    if (sortConfig.direction && sortConfig.key !== 'aksi') {
        filtered = [...filtered].sort((a: any, b: any) => {
            const key = sortConfig.key;
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();

            if (sortConfig.direction === 'asc') {
                return strA.localeCompare(strB, undefined, { numeric: true });
            } else {
                return strB.localeCompare(strA, undefined, { numeric: true });
            }
        });
    }

    return filtered;
  }, [students, searchQuery, selectedClass, sortConfig]);

  const handleEdit = (student: Student) => { 
    setEditingId(student.id || null); 
    setFormData({ ...student }); 
    setIsModalOpen(true); 
  };

  const handleDeleteStudent = async (id: string) => {
    if (window.confirm("PERINGATAN: Menghapus data akan menghapus Document ID ini secara permanen dari server. Lanjutkan?")) {
        const toastId = toast.loading("Menghapus data dari server...");
        try {
            await deleteStudent(id);
            toast.success("Data dan Document ID berhasil dihapus.", { id: toastId });
        } catch (e) {
            toast.error("Gagal menghapus data.", { id: toastId });
        }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
          if (editingId) await updateStudent(editingId, formData);
          else await addStudent(formData as Student);
          setIsModalOpen(false);
          toast.success("Data berhasil disimpan");
      } catch (e) { toast.error("Gagal menyimpan data"); }
      finally { setSaving(false); }
  };

  const canManage = userRole === UserRole.ADMIN || userRole === UserRole.DEVELOPER;

  // Header 41 Kolom
  const tableHeaders: { label: string; key: keyof Student | 'aksi' | 'id' }[] = [
      { label: "Aksi", key: 'aksi' },
      { label: "ID Unik", key: 'idUnik' },
      { label: "Doc ID", key: 'id' },
      { label: "Nama Lengkap", key: 'namaLengkap' },
      { label: "UID Account", key: 'linkedUserId' },
      { label: "NISN", key: 'nisn' },
      { label: "NIK", key: 'nik' },
      { label: "Gender", key: 'jenisKelamin' },
      { label: "Tempat Lahir", key: 'tempatLahir' },
      { label: "Tgl Lahir", key: 'tanggalLahir' },
      { label: "Email", key: 'email' },
      { label: "Telepon", key: 'noTelepon' },
      { label: "Rombel", key: 'tingkatRombel' },
      { label: "Peminatan", key: 'peminatan' },
      { label: "Status Siswa", key: 'status' },
      { label: "Poin Disiplin", key: 'disciplinePoints' },
      { label: "Tgl Masuk", key: 'tglMasuk' },
      { label: "No Akta Lahir", key: 'noAktaLahir' },
      { label: "No Ijazah SMP", key: 'nomorKIPP_PIP' },
      { label: "Transportasi", key: 'transportasi' },
      { label: "Jenis Tinggal", key: 'jenisTinggal' },
      { label: "Account", key: 'accountStatus' },
      { label: "Nama Ayah", key: 'namaAyahKandung' },
      { label: "NIK Ayah", key: 'nikAyah' },
      { label: "Pekerjaan Ayah", key: 'pekerjaanAyah' },
      { label: "Pendidikan Ayah", key: 'pendidikanAyah' },
      { label: "Nama Ibu", key: 'namaIbuKandung' },
      { label: "NIK Ibu", key: 'nikIbu' },
      { label: "Pekerjaan Ibu", key: 'pekerjaanIbu' },
      { label: "Pendidikan Ibu", key: 'pendidikanIbu' },
      { label: "Nama Wali", key: 'namaWali' },
      { label: "HP Wali", key: 'hpWali' },
      { label: "Alamat", key: 'alamat' },
      { label: "RT", key: 'rt' },
      { label: "RW", key: 'rw' },
      { label: "Kelurahan", key: 'kelurahan' },
      { label: "Kecamatan", key: 'kecamatan' },
      { label: "Kabupaten", key: 'kabupaten' },
      { label: "Kode Pos", key: 'kodePos' },
      { label: "Kebutuhan Khusus", key: 'kebutuhanKhusus' }
  ];

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <div className="w-2.5 h-2.5 opacity-20"><ChevronDownIcon className="w-full h-full" /></div>;
    return (
        <div className={`w-2.5 h-2.5 text-indigo-600 transition-transform duration-300 ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="w-full h-full" />
        </div>
    );
  };

  return (
    <Layout title="Data Siswa (Master)" subtitle="Manajemen Data Induk" icon={UsersGroupIcon} onBack={onBack}>
      <div className="p-4 lg:p-6 pb-32 space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white dark:bg-[#151E32] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row flex-1 w-full gap-3">
                <div className="relative flex-[2]">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" placeholder="Cari nama, nisn, atau ID..." value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 pl-12 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner" 
                    />
                </div>
                <div className="relative flex-1 min-w-[140px]">
                    <BuildingLibraryIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 pl-12 pr-8 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer text-slate-700 dark:text-slate-300 shadow-inner"
                    >
                        <option value="All">Semua rombel</option>
                        {classLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                    <ChevronDownIcon className="w-3 h-3 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
            {canManage && (
                <button onClick={() => { setFormData(initialFormState); setEditingId(null); setIsModalOpen(true); }} className="w-full lg:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10.5px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                    <PlusIcon className="w-4 h-4" /> Tambah Siswa
                </button>
            )}
        </div>

        {/* Wide Spreadsheet View */}
        <div className="bg-white dark:bg-[#151E32] rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="excel-table min-w-[4500px]">
                    <thead>
                        <tr>
                            {tableHeaders.map((head, i) => (
                                <th 
                                    key={i} 
                                    onClick={() => handleSort(head.key)}
                                    className={`whitespace-nowrap px-4 py-3 cursor-pointer select-none transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ${i <= 3 ? 'sticky z-30 bg-slate-100 dark:bg-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.05)]' : ''}`}
                                    style={
                                        i === 0 ? { left: '0', minWidth: '60px' } : 
                                        i === 1 ? { left: '60px', minWidth: '80px' } : 
                                        i === 2 ? { left: '140px', minWidth: '110px' } :
                                        i === 3 ? { left: '250px' } : {}
                                    }
                                >
                                    <div className="flex items-center gap-2">
                                        {head.label}
                                        {head.key !== 'aksi' && <SortIndicator columnKey={head.key} />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={41} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 opacity-20" /></td></tr>
                        ) : processedStudents.length > 0 ? (
                            processedStudents.map((s, idx) => (
                                <tr key={s.id} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10 group">
                                    {/* Kolom Aksi (Sticky) */}
                                    <td className="text-center sticky left-0 bg-white dark:bg-[#0B1121] z-20 transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30">
                                        <div className="flex items-center justify-center gap-1.5 py-1">
                                            {canManage ? (
                                                <>
                                                    <button onClick={() => handleEdit(s)} className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Edit"><PencilIcon className="w-2.5 h-2.5" /></button>
                                                    <button onClick={() => handleDeleteStudent(s.id!)} className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="Hapus Permanen"><TrashIcon className="w-2.5 h-2.5" /></button>
                                                </>
                                            ) : (
                                                <span className="text-[10.5px] font-black text-slate-300 uppercase">Lock</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* ID Unik (Sticky) */}
                                    <td className="text-center font-mono font-bold text-indigo-600 sticky left-[60px] bg-white dark:bg-[#0B1121] z-20 transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30">{s.idUnik || '-'}</td>
                                    
                                    {/* Document ID (Sticky) */}
                                    <td className="text-center font-mono text-[10.5px] text-slate-400 sticky left-[140px] bg-white dark:bg-[#0B1121] z-20 transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30">{s.id}</td>

                                    {/* Nama Lengkap (Sticky) */}
                                    <td className="font-bold text-slate-800 dark:text-slate-200 sticky left-[250px] bg-white dark:bg-[#0B1121] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30">{s.namaLengkap}</td>
                                    
                                    {/* UID Account */}
                                    <td className="text-center text-[10.5px] font-mono text-indigo-500 font-bold bg-indigo-50/20 dark:bg-indigo-900/10">{s.linkedUserId || '-'}</td>
                                    
                                    {/* Sisa Kolom */}
                                    <td className="text-center font-mono font-bold">{s.nisn}</td>
                                    <td className="text-center font-mono">{s.nik || '-'}</td>
                                    <td className="text-center font-bold">{s.jenisKelamin === 'Perempuan' ? 'P' : 'L'}</td>
                                    <td>{s.tempatLahir || '-'}</td>
                                    <td className="text-center">{s.tanggalLahir || '-'}</td>
                                    <td>{s.email || '-'}</td>
                                    <td className="text-center">{s.noTelepon || '-'}</td>
                                    
                                    <td className="text-center font-black">{s.tingkatRombel || '-'}</td>
                                    <td className="text-center font-bold">{s.peminatan || '-'}</td>
                                    <td className="text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-black ${s.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>{s.status}</span>
                                    </td>
                                    <td className="text-center font-black text-amber-600">{s.disciplinePoints ?? 100}</td>
                                    <td className="text-center">{s.tglMasuk || '-'}</td>
                                    <td>{s.noAktaLahir || '-'}</td>
                                    <td>{s.nomorKIPP_PIP || '-'}</td>
                                    <td>{s.transportasi || '-'}</td>
                                    <td>{s.jenisTinggal || '-'}</td>
                                    <td className="text-center font-black text-[10.5px] uppercase">{s.accountStatus || 'No Account'}</td>
                                    
                                    <td>{s.namaAyahKandung || '-'}</td>
                                    <td className="text-center font-mono">{s.nikAyah || '-'}</td>
                                    <td>{s.pekerjaanAyah || '-'}</td>
                                    <td>{s.pendidikanAyah || '-'}</td>
                                    <td>{s.namaIbuKandung || '-'}</td>
                                    <td className="text-center font-mono">{s.nikIbu || '-'}</td>
                                    <td>{s.pekerjaanIbu || '-'}</td>
                                    <td>{s.pendidikanIbu || '-'}</td>
                                    <td>{s.namaWali || '-'}</td>
                                    <td className="text-center">{s.hpWali || '-'}</td>
                                    
                                    <td>{s.alamat || '-'}</td>
                                    <td className="text-center">{s.rt || '-'}</td>
                                    <td className="text-center">{s.rw || '-'}</td>
                                    <td>{s.kelurahan || '-'}</td>
                                    <td>{s.kecamatan || '-'}</td>
                                    <td>{s.kabupaten || '-'}</td>
                                    <td className="text-center font-mono">{s.kodePos || '-'}</td>
                                    <td>{s.kebutuhanKhusus || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={41} className="py-20 text-center text-slate-400 font-bold">Data tidak ditemukan</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10.5px] font-black text-slate-400">Total: {processedStudents.length} entri aktif</p>
                <div className="flex items-center gap-1.5 text-[10.5px] font-black text-indigo-600 uppercase tracking-widest">
                    <SparklesIcon className="w-3.5 h-3.5" /> Document Management System Active
                </div>
            </div>
        </div>
      </div>

      {/* Modal Edit/Tambah */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <div className="bg-white dark:bg-[#0B1121] w-full max-w-4xl rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-white/10 relative overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#0B1121] z-10">
                      <div>
                          <h3 className="text-base font-black text-slate-800 dark:text-white uppercase leading-none">{editingId ? 'Edit Profil Siswa Lengkap' : 'Pendaftaran Siswa Master'}</h3>
                          <p className="text-[10.5px] font-bold text-indigo-600 mt-2 uppercase tracking-widest">Database Terintegrasi Madrasah</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 pb-20">
                      <form id="studentForm" onSubmit={handleSave} className="space-y-8">
                          {/* Part 1: Identitas */}
                          <section>
                              <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h4 className="text-[10.5px] font-black text-indigo-500 uppercase tracking-[0.2em]">I. Identitas Pribadi</h4>
                                <div className="flex gap-4">
                                    {formData.linkedUserId && (
                                        <span className="text-[10.5px] font-mono font-black text-slate-400">Linked UID: {formData.linkedUserId}</span>
                                    )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  <div className="md:col-span-2 space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap *</label>
                                      <input required type="text" value={formData.namaLengkap || ''} onChange={e => setFormData({...formData, namaLengkap: (e.target.value || '').toUpperCase()})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Gender</label>
                                      <select value={formData.jenisKelamin || 'Laki-laki'} onChange={e => setFormData({...formData, jenisKelamin: e.target.value as any})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none">
                                          <option value="Laki-laki">Laki-laki</option>
                                          <option value="Perempuan">Perempuan</option>
                                      </select>
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">NISN *</label>
                                      <input required type="text" value={formData.nisn || ''} onChange={e => setFormData({...formData, nisn: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">NIK</label>
                                      <input type="text" value={formData.nik || ''} onChange={e => setFormData({...formData, nik: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ID Unik</label>
                                      <input type="text" value={formData.idUnik || ''} onChange={e => setFormData({...formData, idUnik: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none placeholder:font-medium" placeholder="Generate Otomatis" />
                                  </div>
                                  {/* Document ID Field (Read-only System Reference) */}
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Document ID (System ID)</label>
                                      <div className="relative group">
                                          <input type="text" disabled value={formData.id || '-'} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-mono font-bold outline-none text-slate-500 cursor-not-allowed shadow-inner" />
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Read Only</div>
                                      </div>
                                  </div>
                              </div>
                          </section>

                          {/* Part 2: Akademik */}
                          <section>
                              <h4 className="text-[10.5px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 border-b pb-2">II. Data Akademik</h4>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Rombel Aktif</label>
                                      <input type="text" value={formData.tingkatRombel || ''} onChange={e => setFormData({...formData, tingkatRombel: (e.target.value || '').toUpperCase()})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" placeholder="Contoh: XII IPA 1" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Peminatan</label>
                                      <input type="text" value={formData.peminatan || ''} onChange={e => setFormData({...formData, peminatan: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tanggal Masuk</label>
                                      <input type="date" value={formData.tglMasuk || ''} onChange={e => setFormData({...formData, tglMasuk: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none cursor-pointer" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status</label>
                                      <select value={formData.status || 'Aktif'} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-[10.5px] font-bold outline-none">
                                          <option value="Aktif">Aktif</option>
                                          <option value="Lulus">Lulus</option>
                                          <option value="Mutasi">Mutasi</option>
                                          <option value="Keluar">Keluar</option>
                                      </select>
                                  </div>
                              </div>
                          </section>

                          {/* Part 3: Orang Tua */}
                          <section>
                              <h4 className="text-[10.5px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 border-b pb-2">III. Data Keluarga</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] space-y-4 border border-slate-100 dark:border-slate-800">
                                      <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Ayah Kandung</h5>
                                      <input type="text" value={formData.namaAyahKandung || ''} onChange={e => setFormData({...formData, namaAyahKandung: (e.target.value || '').toUpperCase()})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 rounded-xl py-2.5 px-4 text-[10.5px] font-bold" placeholder="NAMA LENGKAP AYAH" />
                                      <input type="text" value={formData.nikAyah || ''} onChange={e => setFormData({...formData, nikAyah: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 rounded-xl py-2.5 px-4 text-[10.5px] font-bold" placeholder="NIK AYAH" />
                                  </div>
                                  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] space-y-4 border border-slate-100 dark:border-slate-800">
                                      <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Ibu Kandung</h5>
                                      <input type="text" value={formData.namaIbuKandung || ''} onChange={e => setFormData({...formData, namaIbuKandung: (e.target.value || '').toUpperCase()})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 rounded-xl py-2.5 px-4 text-[10.5px] font-bold" placeholder="NAMA LENGKAP IBU" />
                                      <input type="text" value={formData.nikIbu || ''} onChange={e => setFormData({...formData, nikIbu: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 rounded-xl py-2.5 px-4 text-[10.5px] font-bold" placeholder="NIK IBU" />
                                  </div>
                              </div>
                          </section>
                      </form>
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1121] flex flex-col sm:flex-row gap-4 z-10">
                      <div className="flex-1 flex gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-500 font-black rounded-2xl border border-slate-200 text-[10.5px] uppercase tracking-widest">Tutup</button>
                          {editingId && (
                             <button type="button" onClick={() => handleDeleteStudent(editingId)} className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all shadow-md group" title="Hapus Permanen">
                                 <TrashIcon className="w-5 h-5" />
                             </button>
                          )}
                      </div>
                      <button type="submit" form="studentForm" disabled={saving} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                        <span className="text-[10.5px] uppercase tracking-[0.2em]">Simpan Master Data</span>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default StudentData;
