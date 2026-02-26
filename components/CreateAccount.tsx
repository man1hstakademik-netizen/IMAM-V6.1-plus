/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React, { useState, useEffect, useMemo } from 'react';
import { db, isMockMode } from '../services/firebase';
import { UserRole, Student, Teacher } from '../types';
import Layout from './Layout';
import {
    ShieldCheckIcon, TrashIcon, Search, Loader2, SparklesIcon,
    EnvelopeIcon, LockIcon, IdentificationIcon,
    UserIcon, CheckCircleIcon, ArrowPathIcon, PhoneIcon,
    KeyIcon, EyeIcon, ClipboardDocumentCheckIcon
} from './Icons';
import { toast } from 'sonner';
import { roleHierarchy } from '../src/auth/roles';
import { getPermissions } from '../src/auth/rbac';
import { getTeachers } from '../services/teacherService';

interface UserData {
    uid: string;
    displayName: string;
    email: string;
    role: string;
    idUnik?: string;
}

interface CreateUserFormState {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    password: string;
    confirmPassword: string;
    role: UserRole;
    isActive: boolean;
    sendVerificationEmail: boolean;
    forcePasswordChange: boolean;
    linkedUserId?: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
    ADMIN: 'Akses penuh manajemen sistem dan pengguna.',
    DEVELOPER: 'Akses teknis dan debugging platform.',
    KEPALA_MADRASAH: 'Monitoring strategis dan persetujuan kebijakan.',
    WAKA_KURIKULUM: 'Pengelolaan akademik dan supervisi kurikulum.',
    WAKA_KESISWAAN: 'Fokus pada kesiswaan, presensi, dan pembinaan.',
    WAKA_SARPRAS: 'Monitoring sarana prasarana madrasah.',
    GURU: 'Mengelola nilai, presensi, dan jurnal pembelajaran.',
    WALI_KELAS: 'Pendampingan kelas, presensi, dan akademik kelas.',
    BK: 'Layanan bimbingan konseling dan pelaporan pembinaan.',
    STAF_TU: 'Administrasi operasional dan tata usaha.',
    OPERATOR: 'Operasional data harian dan administrasi sistem.',
    PETUGAS_PIKET: 'Pencatatan piket, disiplin, dan presensi lapangan.',
    SISWA: 'Akses fitur siswa dan data pembelajaran personal.',
    KETUA_KELAS: 'Akses siswa dengan kemampuan koordinasi kelas.',
    ORANG_TUA: 'Akses monitoring data siswa terkait.',
    TAMU: 'Akses publik terbatas tanpa data sensitif.'
};

const ACCOUNT_ROLES = Object.values(UserRole).filter(role => role !== UserRole.TAMU);

const CreateAccount: React.FC<{ onBack: () => void, userRole: UserRole }> = ({ onBack, userRole }) => {
    const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'used'>('idle');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
        basic: true,
        credentials: true,
        role: true,
        linking: true,
        status: true
    });

    const [formData, setFormData] = useState<CreateUserFormState>({
        fullName: '',
        email: '',
        phone: '',
        idNumber: '',
        password: '',
        confirmPassword: '',
        role: UserRole.GURU,
        isActive: true,
        sendVerificationEmail: false,
        forcePasswordChange: true,
        linkedUserId: ''
    });

    const fetchUsers = async () => {
        setLoading(true);
        if (isMockMode) {
            setTimeout(() => {
                setUsers([
                    { uid: '1', displayName: 'AKHMAD ARIFIN', email: 'dev@imam.id', role: UserRole.DEVELOPER },
                    { uid: '2', displayName: 'H. SOMERAN, S.PD.,MM', email: 'admin@madrasah.id', role: UserRole.ADMIN }
                ]);
                setStudents([
                    { id: 's1', namaLengkap: 'ADELIA SRI SUNDARI', nisn: '007001', status: 'Aktif', tingkatRombel: 'X IPA 1', jenisKelamin: 'Perempuan' },
                    { id: 's2', namaLengkap: 'AHMAD MUZAKI', nisn: '007002', status: 'Aktif', tingkatRombel: 'X IPA 2', jenisKelamin: 'Laki-laki' }
                ]);
                setTeachers([
                    { id: 't1', name: 'SITI AMINAH, M.AG', nip: '198505052010012003', subject: 'Fikih', status: 'PNS' }
                ]);
                setLoading(false);
            }, 500);
            return;
        }
        if (!db) return;

        try {
            const [userSnap, studentSnap, teacherData] = await Promise.all([
                db.collection('users').limit(200).get(),
                db.collection('students').where('status', '==', 'Aktif').limit(200).get(),
                getTeachers()
            ]);

            setUsers(userSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData)));
            setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
            setTeachers(teacherData);
        } catch (e) {
            toast.error('Gagal mengambil data pengguna.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            String(u.displayName).toLowerCase().includes(q) ||
            String(u.email).toLowerCase().includes(q) ||
            String(u.idUnik).includes(q)
        );
    }, [users, searchQuery]);

    const passwordStrength = useMemo(() => {
        const p = formData.password;
        let score = 0;
        if (p.length >= 8) score += 1;
        if (/[A-Z]/.test(p)) score += 1;
        if (/[0-9]/.test(p)) score += 1;
        if (/[^A-Za-z0-9]/.test(p)) score += 1;
        if (score <= 1) return { label: 'Lemah', color: 'bg-rose-500', width: 'w-1/4' };
        if (score <= 2) return { label: 'Sedang', color: 'bg-amber-500', width: 'w-2/4' };
        if (score <= 3) return { label: 'Baik', color: 'bg-indigo-500', width: 'w-3/4' };
        return { label: 'Sangat kuat', color: 'bg-emerald-500', width: 'w-full' };
    }, [formData.password]);

    const selectedRoleLevel = roleHierarchy[formData.role] ?? 0;
    const currentRoleLevel = roleHierarchy[userRole] ?? 0;
    const roleWarning = selectedRoleLevel > currentRoleLevel;
    const rolePermissionsCount = getPermissions(formData.role).length;

    const isNameValid = formData.fullName.trim().length >= 3;
    const isEmailValid = /^\S+@\S+\.\S+$/.test(formData.email);
    const isPasswordValid = formData.password.length >= 8;
    const isConfirmValid = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

    useEffect(() => {
        const email = formData.email.trim().toLowerCase();
        if (!email || !isEmailValid) {
            setEmailStatus('idle');
            return;
        }

        const timer = setTimeout(async () => {
            setEmailStatus('checking');
            try {
                if (isMockMode) {
                    const used = users.some(u => u.email?.toLowerCase() === email);
                    setEmailStatus(used ? 'used' : 'available');
                } else if (db) {
                    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
                    setEmailStatus(snap.empty ? 'available' : 'used');
                }
            } catch (e) {
                setEmailStatus('idle');
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [formData.email, isEmailValid, users]);

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const value = Array.from({ length: 12 }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
        setFormData(prev => ({ ...prev, password: value, confirmPassword: value }));
    };

    const validateBeforeSubmit = () => {
        if (!isNameValid) return 'Nama minimal 3 karakter.';
        if (!isEmailValid) return 'Format email tidak valid.';
        if (emailStatus === 'used') return 'Email sudah digunakan.';
        if (!isPasswordValid) return 'Password minimal 8 karakter.';
        if (!isConfirmValid) return 'Konfirmasi password harus sama.';
        if (!formData.role) return 'Role wajib dipilih.';
        if (roleWarning) return 'Anda tidak memiliki izin membuat role ini.';
        return null;
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        const invalidMsg = validateBeforeSubmit();
        if (invalidMsg) return toast.error(invalidMsg);

        setSaving(true);
        const toastId = toast.loading('Membuat akun pengguna...');

        try {
            const payload = {
                displayName: formData.fullName.trim(),
                email: formData.email.trim().toLowerCase(),
                role: formData.role,
                roleLevel: selectedRoleLevel,
                isActive: formData.isActive,
                linkedUserId: formData.linkedUserId || null,
                phone: formData.phone || null,
                idUnik: formData.idNumber || null,
                forcePasswordChange: formData.forcePasswordChange,
                sendVerificationEmail: formData.sendVerificationEmail,
                createdAt: new Date().toISOString(),
                createdByRole: userRole
            };

            if (!isMockMode && db) {
                const docRef = await db.collection('users').add(payload);
                await db.collection('user_logs').add({
                    action: 'CREATE_USER',
                    actorRole: userRole,
                    targetUserId: docRef.id,
                    targetEmail: payload.email,
                    targetRole: payload.role,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        linkedUserId: payload.linkedUserId,
                        forcePasswordChange: payload.forcePasswordChange,
                        sendVerificationEmail: payload.sendVerificationEmail
                    }
                });
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }

            toast.success('Akun berhasil dibuat!', { id: toastId });
            toast.message(`Email: ${payload.email} | Role: ${payload.role}`);
            setFormData({
                fullName: '',
                email: '',
                phone: '',
                idNumber: '',
                password: '',
                confirmPassword: '',
                role: UserRole.GURU,
                isActive: true,
                sendVerificationEmail: false,
                forcePasswordChange: true,
                linkedUserId: ''
            });
            setActiveTab('list');
            fetchUsers();
        } catch (err: any) {
            toast.error(`Gagal: ${err.message}`, { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const linkOptions = formData.role === UserRole.GURU
        ? teachers.map(t => ({ id: t.id || '', label: `${t.name} (${t.nip || '-'})` }))
        : formData.role === UserRole.SISWA
            ? students.map(s => ({ id: s.id || '', label: `${s.namaLengkap} (${s.nisn})` }))
            : [];

    const SectionCard: React.FC<{ id: string; title: string; desc: string; children: React.ReactNode }> = ({ id, title, desc, children }) => (
        <section className="bg-slate-50/70 dark:bg-slate-900/40 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 p-5">
            <button
                type="button"
                onClick={() => setAccordionOpen(prev => ({ ...prev, [id]: !prev[id] }))}
                className="w-full flex items-start justify-between gap-4 text-left"
            >
                <div>
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-slate-500">{title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
                </div>
                <span className="text-slate-400 text-xs lg:hidden">{accordionOpen[id] ? '−' : '+'}</span>
            </button>
            <div className={`mt-4 space-y-4 ${accordionOpen[id] ? 'block' : 'hidden lg:block'}`}>
                {children}
            </div>
        </section>
    );

    return (
        <Layout
            title="Manajemen User"
            subtitle="Pusat Kontrol Akses"
            icon={ShieldCheckIcon}
            onBack={onBack}
            actions={
                <button onClick={fetchUsers} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all">
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            }
        >
            <div className="p-4 lg:p-8 pb-32 max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white dark:bg-[#151E32] p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                        <button onClick={() => setActiveTab('list')} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5' : 'text-slate-400'}`}>Daftar Pengguna</button>
                        <button onClick={() => setActiveTab('create')} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Buat Akun</button>
                    </div>

                    {activeTab === 'list' && (
                        <div className="relative group flex-1 max-w-md w-full">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Filter di memori..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-[10.5px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner" />
                        </div>
                    )}
                </div>

                {activeTab === 'list' ? (
                    <div className="bg-white dark:bg-[#151E32] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
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
                                            <tr key={u.uid}>
                                                <td className="text-center font-mono text-slate-400 font-bold">{i + 1}</td>
                                                <td className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{u.displayName}</td>
                                                <td className="text-slate-500 font-bold lowercase">{u.email}</td>
                                                <td className="text-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === UserRole.DEVELOPER ? 'bg-slate-950 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{u.role}</span>
                                                </td>
                                                <td className="text-center font-mono text-indigo-600 dark:text-indigo-400 font-black tracking-widest">{u.idUnik || '-'}</td>
                                                <td className="text-center"><button className="p-2 text-slate-300 hover:text-rose-600"><TrashIcon className="w-4 h-4" /></button></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={6} className="py-24 text-center text-[10.5px] font-black text-slate-400 uppercase tracking-widest">Data tidak ditemukan</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quota Saving Mode Active</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#151E32] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl p-5 lg:p-8 space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Dashboard &gt; User Management &gt; Create</p>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white mt-2">➕ Buat Akun Pengguna</h3>
                                <p className="text-[11px] font-medium text-slate-500 mt-1">Tambahkan pengguna baru ke sistem dengan kontrol role dan akses.</p>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">Admin Only</span>
                        </div>

                        {roleWarning && (
                            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-[10.5px] font-bold">
                                ⚠ Anda tidak memiliki izin membuat role ini.
                            </div>
                        )}

                        <form onSubmit={handleCreateAccount} className="space-y-5">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                <SectionCard id="basic" title="Informasi Dasar" desc="Data identitas pengguna baru.">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nama Lengkap *</label>
                                        <div className="relative">
                                            <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={formData.fullName} onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-4 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Nama lengkap sesuai dokumen" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Email *</label>
                                        <div className="relative">
                                            <EnvelopeIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-24 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="contoh@imam.sch.id" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider">
                                                {emailStatus === 'checking' && <span className="text-amber-500">Checking</span>}
                                                {emailStatus === 'available' && <span className="text-emerald-600">✔ Tersedia</span>}
                                                {emailStatus === 'used' && <span className="text-rose-600">✖ Dipakai</span>}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nomor HP</label>
                                            <div className="relative">
                                                <PhoneIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-4 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="08xxxxxxxxxx" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">NIP / NISN</label>
                                            <div className="relative">
                                                <IdentificationIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input value={formData.idNumber} onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-4 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Opsional" />
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>

                                <SectionCard id="credentials" title="Kredensial" desc="Password aman untuk login pertama.">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Password *</label>
                                        <div className="relative">
                                            <LockIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-12 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Minimal 8 karakter" />
                                            <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><EyeIcon className="w-4 h-4" /></button>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${passwordStrength.color} ${passwordStrength.width}`} /></div>
                                        <p className="text-[9px] text-slate-500 font-bold">Kekuatan: {passwordStrength.label}</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Konfirmasi Password *</label>
                                        <div className="relative">
                                            <KeyIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 pl-11 pr-12 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Harus sama" />
                                            <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><EyeIcon className="w-4 h-4" /></button>
                                        </div>
                                        {isConfirmValid && <p className="text-[9px] text-emerald-600 font-black">Password cocok.</p>}
                                    </div>

                                    <button type="button" onClick={generatePassword} className="w-full h-11 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <SparklesIcon className="w-4 h-4" /> Generate Random Password
                                    </button>
                                </SectionCard>

                                <SectionCard id="role" title="Role & Akses" desc="Pilih role sesuai struktur RBAC.">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Role *</label>
                                        <select value={formData.role} onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as UserRole, linkedUserId: '' }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 px-4 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                            {ACCOUNT_ROLES.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Role Description</p>
                                        <p className="text-[10.5px] font-semibold text-slate-700">Role Level: {selectedRoleLevel}</p>
                                        <p className="text-[10.5px] text-slate-600">{ROLE_DESCRIPTIONS[formData.role] || 'Role aktif untuk kebutuhan operasional sistem.'}</p>
                                        <p className="text-[10px] font-bold text-indigo-600">Permissions: {rolePermissionsCount} fitur aktif</p>
                                    </div>
                                </SectionCard>

                                <SectionCard id="linking" title="Linking Data (Opsional)" desc="Hubungkan akun dengan data guru/siswa existing.">
                                    {(formData.role === UserRole.GURU || formData.role === UserRole.SISWA) ? (
                                        <>
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pilih Data Existing</label>
                                            <select value={formData.linkedUserId || ''} onChange={e => setFormData(prev => ({ ...prev, linkedUserId: e.target.value }))} className="w-full h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 px-4 text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                                <option value="">-- Tidak dihubungkan --</option>
                                                {linkOptions.map(option => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                            <p className="text-[9px] text-slate-500">Field ini akan mengisi linkedUserId.</p>
                                        </>
                                    ) : (
                                        <p className="text-[10.5px] text-slate-500">Linking hanya muncul untuk role GURU atau SISWA.</p>
                                    )}
                                </SectionCard>

                                <SectionCard id="status" title="Status" desc="Pengaturan aktivasi akun baru.">
                                    <label className="flex items-center justify-between text-[10.5px] font-bold text-slate-700">
                                        Akun Aktif
                                        <input type="checkbox" checked={formData.isActive} onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))} className="w-4 h-4" />
                                    </label>
                                    <label className="flex items-center justify-between text-[10.5px] font-bold text-slate-700">
                                        Kirim Email Verifikasi
                                        <input type="checkbox" checked={formData.sendVerificationEmail} onChange={e => setFormData(prev => ({ ...prev, sendVerificationEmail: e.target.checked }))} className="w-4 h-4" />
                                    </label>
                                    <label className="flex items-center justify-between text-[10.5px] font-bold text-slate-700">
                                        Paksa Ganti Password Login Pertama
                                        <input type="checkbox" checked={formData.forcePasswordChange} onChange={e => setFormData(prev => ({ ...prev, forcePasswordChange: e.target.checked }))} className="w-4 h-4" />
                                    </label>
                                </SectionCard>
                            </div>

                            <div className="fixed bottom-4 left-4 right-4 z-40 xl:static xl:z-auto">
                                <button type="submit" disabled={saving} className="w-full h-12 rounded-2xl bg-indigo-600 text-white text-[10.5px] font-black uppercase tracking-[0.2em] shadow-2xl disabled:opacity-60 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardDocumentCheckIcon className="w-4 h-4" />} Buat Akun
                                </button>
                            </div>
                        </form>

                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-[10px] text-emerald-700 font-bold flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4" /> Submit Flow: validasi akhir → create user → log user_logs → sukses.
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default CreateAccount;
