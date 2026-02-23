
/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import React from 'react';

export enum ViewState {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  DASHBOARD = 'DASHBOARD',
  PRESENSI = 'PRESENSI',
  CONTENT_GENERATION = 'CONTENT_GENERATION',
  REPORTS = 'REPORTS',
  PROFILE = 'PROFILE',
  CLASSES = 'CLASSES',
  PROMOTION = 'PROMOTION',
  SCHEDULE = 'SCHEDULE',
  SCANNER = 'SCANNER',
  ALL_FEATURES = 'ALL_FEATURES',
  ACADEMIC_YEAR = 'ACADEMIC_YEAR',
  JOURNAL = 'JOURNAL',
  ASSIGNMENTS = 'ASSIGNMENTS',
  GRADES = 'GRADES',
  REPORT_CARDS = 'REPORT_CARDS',
  STUDENTS = 'STUDENTS',
  TEACHERS = 'TEACHERS',
  ID_CARD = 'ID_CARD',
  LETTERS = 'LETTERS',
  CREATE_ACCOUNT = 'CREATE_ACCOUNT',
  DEVELOPER = 'DEVELOPER',
  LOGIN_HISTORY = 'LOGIN_HISTORY',
  ABOUT = 'ABOUT',
  PREMIUM = 'PREMIUM', 
  NEWS = 'NEWS',
  MADRASAH_INFO = 'MADRASAH_INFO',
  ADVISOR = 'ADVISOR',
  SETTINGS = 'SETTINGS',
  PUSAKA = 'PUSAKA',
  GUIDE = 'GUIDE',
  POINTS = 'POINTS',
  KEMENAG_HUB = 'KEMENAG_HUB',
  CLAIM_MANAGEMENT = 'CLAIM_MANAGEMENT',
}

import { Role, type Role as UnifiedRole } from './src/auth/roles';

export const UserRole = Role;
export type UserRole = UnifiedRole;

export interface ClaimRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'siswa' | 'guru';
  targetId: string; // NISN or NIP
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  adminReason?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  autoMatch?: boolean; // New: metadata for auto-validation
}

export interface FAQItemData {
  question: string;
  answer: string;
  iconName: string;
}

export interface AboutContent {
  engineVersion: string;
  brandingText: string;
  devName: string;
  devNip: string;
  devQuote: string;
  faqs: FAQItemData[];
}

export interface MadrasahData {
  nama: string;
  nsm: string;
  npsn: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
  kepalaNama: string;
  kepalaNip: string;
  visi?: string;
  misi?: string[];
  akreditasi?: string;
  photo?: string;
}

/**
 * User Profile (Auth layer)
 * Document ID: authUid (from Firebase Auth)
 * Links to either Student or Teacher profile
 */
export interface UserProfile {
  authUid: string; // PRIMARY KEY - document ID in Firestore
  email: string;
  role: UserRole;
  profileType: 'student' | 'teacher' | 'admin' | 'staff';
  profileId?: string; // idUnik for student or nip for teacher
  isActive: boolean;
  lastLoginAt?: any; // Firebase Timestamp
  
  // Secondary roles for multi-role users
  secondaryRoles?: UserRole[];
  
  // Audit trail
  createdAt: any;
  updatedAt: any;
  createdBy?: string;
  updatedBy?: string;
  
  schemaVersion: 1;
}

export interface ClassData {
    id?: string;
    academicYearId: string; // REQUIRED - root key
    name: string;
    level: string; 
    teacherId?: string; // PRIMARY RELATION - use ID only
    academicYear: string; // Deprecated - use academicYearId instead
    captainId?: string; // PRIMARY RELATION
    subjects?: string[]; // Could be subjectIds
    
    // Denormalized cache
    teacherNameCache?: string;
    captainNameCache?: string;
    isDenormalized?: boolean;
    
    // Audit trail
    createdAt?: any;
    updatedAt?: any;
    createdBy?: string;
    updatedBy?: string;
    
    schemaVersion: 1;
}

/**
 * Student Entity
 * Primary ID: idUnik (document ID in Firestore)
 * docId should be: students/{idUnik}
 * Never use 'id' field - it's redundant. Use 'idUnik' as single source of truth.
 */
export interface Student {
  idUnik: string; // PRIMARY KEY - document ID in Firestore
  userlogin?: string;
  namaLengkap: string;
  nisn: string;
  nik?: string;
  email?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  tingkatRombel: string;
  umur?: string;
  status: 'Aktif' | 'Lulus' | 'Mutasi' | 'Keluar' | 'Nonaktif';
  jenisKelamin: 'Laki-laki' | 'Perempuan';
  alamat?: string;
  noTelepon?: string;
  kebutuhanKhusus?: string;
  disabilitas?: string;
  nomorKIPP_PIP?: string;
  namaAyahKandung?: string;
  nikAyah?: string;
  pekerjaanAyah?: string;
  pendidikanAyah?: string;
  namaIbuKandung?: string;
  nikIbu?: string;
  pekerjaanIbu?: string;
  pendidikanIbu?: string;
  namaWali?: string;
  nikWali?: string;
  pekerjaanWali?: string;
  hpWali?: string;
  rt?: string;
  rw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
  kodePos?: string;
  jenisTinggal?: string;
  transportasi?: string;
  tglMasuk?: string;
  noAktaLahir?: string;
  peminatan?: string;
  accountStatus?: string;
  authUid?: string; // Link to users/{authUid} - NOT linkedUserId
  disciplinePoints?: number;
  schemaVersion: 1;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  createdBy?: string; // userId who created
  updatedBy?: string; // userId who last updated
}

// Added 'Terlambat' and 'Haid' to AttendanceStatus to fix assignment errors in services and components
export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Sakit' | 'Izin' | 'Alpha' | 'Haid';

/**
 * Attendance Record
 * Primary ID: uuid4 
 * Collection path: attendance/{academicYearId}/records/{attendanceId}
 * OR: students/{studentId}/attendance/{attendanceId}
 * 
 * One record = one day (5 sessions per day model)
 * Alternative future model: one record = one session
 */
export interface AttendanceRecord {
  id: string; // UUID
  academicYearId: string; // REQUIRED - root key for data isolation
  studentId: string; // PRIMARY RELATION - use ID only
  classId: string; // PRIMARY RELATION - use ID only
  date: string; // ISO 8601 format (could migrate to Timestamp)
  status: AttendanceStatus;
  
  // 5 prayer sessions per day (5 sesi model)
  checkIn: string | null; // HH:mm format or ISO timestamp
  duha: string | null;
  zuhur: string | null;
  ashar: string | null;
  checkOut: string | null;
  
  // Offline & Sync metadata (PENTING for offline-first)
  deviceId?: string; // Device yang recording
  syncStatus: 'pending' | 'synced'; // REQUIRED
  version: number; // For conflict resolution
  
  // Audit trail
  recordedBy: string; // userId who recorded
  recordedAt: any; // Firebase Timestamp
  lastModifiedBy?: string;
  lastModifiedAt?: any; // Firebase Timestamp
  createdAt: any;
  updatedAt: any;
  
  // Denormalized cache (optional, can be rebuilt)
  studentNameCache?: string;
  classNameCache?: string;
  isDenormalized?: boolean;
  
  schemaVersion: 1;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

/**
 * Teacher Entity
 * Primary ID: nip (document ID in Firestore)
 * docId should be: teachers/{nip}
 * Never use 'id' field - it's redundant. Use 'nip' as single source of truth.
 */
export interface Teacher {
  nip: string; // PRIMARY KEY - document ID in Firestore
  name: string;
  subject: string;
  status: 'PNS' | 'PPPK' | 'GTY' | 'Honorer';
  phone?: string;
  email?: string;
  birthDate?: string;
  address?: string;
  authUid?: string; // Link to users/{authUid}
  // Denormalized fields (cache only - can be rebuilt)
  isDenormalized?: boolean;
  schemaVersion: 1;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  createdBy?: string;
  updatedBy?: string;
}

export type LetterStatus = 'Pending' | 'Verified' | 'Validated' | 'Signed' | 'Ditolak';

export interface LetterRequest {
  id?: string;
  userId: string; // PRIMARY RELATION
  userName: string; // Cache only - use userId as primary
  userRole: UserRole;
  type: string;
  description: string;
  date: string;
  status: LetterStatus;
  letterNumber?: string;
  adminNote?: string;
  verifiedBy?: string;
  verifiedAt?: any; // Firebase Timestamp
  validatedBy?: string;
  validatedAt?: any;
  signedBy?: string;
  signedAt?: any;
  digitalSignatureHash?: string;
  
  isDenormalized?: boolean;
  
  // Complete audit trail
  createdAt: any; // Firebase Timestamp
  updatedAt: any;
  createdBy: string;
  updatedBy?: string;
  
  schemaVersion: 1;
}

export interface StudentGrade {
  id?: string;
  academicYearId: string; // REQUIRED - root key
  subjectId: string; // PRIMARY RELATION
  studentId: string; // PRIMARY RELATION
  nilaiHarian: number;
  nilaiUTS: number;
  nilaiUAS: number;
  nilaiAkhir: number;
  
  // Audit trail
  createdAt: any; // Firebase Timestamp
  updatedAt: any;
  createdBy: string;
  updatedBy?: string;
  
  schemaVersion: 1;
}

/**
 * Journal Entry
 * Primary relations: teacherId, classId, subjectId, academicYearId
 * All based on ID - names are cache only
 */
export interface JournalEntry {
  id?: string;
  academicYearId: string; // REQUIRED - root key
  teacherId: string; // PRIMARY RELATION
  classId: string; // PRIMARY RELATION
  subjectId: string; // PRIMARY RELATION
  date: string; // ISO 8601
  jamKe: string; // period/jam ke berapa
  materi: string;
  catatan?: string;
  
  // Denormalized cache (optional)
  teacherNameCache?: string;
  classNameCache?: string;
  subjectNameCache?: string;
  isDenormalized?: boolean;
  
  // Audit trail
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  createdBy: string; // userId
  updatedBy?: string;
  
  schemaVersion: 1;
}

/**
 * Assignment
 * Primary relations: teacherId, classId, subjectId, academicYearId
 * All based on ID - names are cache only
 */
export interface Assignment {
  id?: string;
  academicYearId: string; // REQUIRED
  title: string;
  description: string;
  subjectId: string; // PRIMARY RELATION
  classId: string; // PRIMARY RELATION
  teacherId: string; // PRIMARY RELATION
  dueDate: string; // ISO 8601
  status: 'Open' | 'Closed';
  priority?: 'High' | 'Medium' | 'Low';
  
  // Denormalized cache
  teacherNameCache?: string;
  classNameCache?: string;
  subjectNameCache?: string;
  isDenormalized?: boolean;
  
  // Audit trail
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  createdBy: string;
  updatedBy?: string;
  
  schemaVersion: 1;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  timestamp: string;
  device: string;
  ip: string;
  status: 'Success' | 'Failed';
}

export interface ViolationMaster {
  id: string;
  category: string;
  description: string;
  points: number;
}

export interface DisciplineLog {
  id: string;
  studentId: string; // PRIMARY RELATION - use ID only
  type: 'Violation' | 'Reward';
  violationId: string; // PRIMARY RELATION - use ID only
  points: number;
  date: string; // ISO 8601
  recordedBy: string; // userId
  status: 'Approved' | 'Pending' | 'Rejected';
  note?: string;
  
  // Denormalized cache
  studentNameCache?: string;
  violationDescriptionCache?: string;
  isDenormalized?: boolean;
  
  // Complete audit trail
  createdAt: any; // Firebase Timestamp
  updatedAt: any;
  createdBy: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: any;
  
  schemaVersion: 1;
}
