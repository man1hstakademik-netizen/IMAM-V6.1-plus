
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, isMockMode, auth } from './firebase';
import { JournalEntry, Assignment } from '../types';

const JOURNAL_COLLECTION = 'journals';
const ASSIGNMENT_COLLECTION = 'assignments';

// --- MOCK DATA (Schema v1 compatible) ---
const MOCK_JOURNALS: JournalEntry[] = [
    {
        id: 'j1',
        academicYearId: '2024', // REQUIRED
        teacherId: 'mock-teacher-1',
        classId: 'class-1',
        subjectId: 'math-1',
        date: new Date().toISOString().split('T')[0],
        jamKe: '1-2',
        materi: 'Persamaan Linear Tiga Variabel',
        catatan: 'Siswa antusias, 2 orang izin ke UKS.',
        createdAt: new Date(),
        createdBy: 'mock-teacher-1',
        schemaVersion: 1,
        // Denormalized cache only
        teacherNameCache: 'Budi Santoso, S.Pd',
        classNameCache: 'X IPA 1',
        subjectNameCache: 'Matematika Wajib',
        isDenormalized: true
    }
];

const MOCK_ASSIGNMENTS: Assignment[] = [
    {
        id: 'a1',
        academicYearId: '2024', // REQUIRED
        title: 'Latihan Soal SPLTV',
        description: 'Kerjakan LKS Halaman 15 Nomor 1-5.',
        subjectId: 'math-1',
        classId: 'class-1',
        teacherId: 'mock-teacher-1',
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        status: 'Open',
        priority: 'Medium',
        createdAt: new Date(),
        createdBy: 'mock-teacher-1',
        schemaVersion: 1,
        // Denormalized cache
        teacherNameCache: 'Budi Santoso, S.Pd',
        classNameCache: 'X IPA 1',
        subjectNameCache: 'Matematika Wajib',
        isDenormalized: true
    }
];

// --- JOURNAL SERVICES ---

export const getJournals = async (teacherId?: string, academicYearId?: string): Promise<JournalEntry[]> => {
    if (isMockMode) return MOCK_JOURNALS;
    try {
        if (!db) throw new Error("Database not initialized");
        let query: any = db.collection(JOURNAL_COLLECTION).orderBy('date', 'desc').limit(50);
        if (teacherId) query = query.where('teacherId', '==', teacherId);
        if (academicYearId) query = query.where('academicYearId', '==', academicYearId);
        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as JournalEntry));
    } catch (error: any) {
        console.error("Error fetching journals:", error);
        return [];
    }
};

export const addJournal = async (entry: Omit<JournalEntry, 'id'>): Promise<void> => {
    if (isMockMode) return;
    try {
        if (!db) throw new Error("Database not initialized");
        const journal = {
            ...entry,
            schemaVersion: 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth?.currentUser?.uid || 'unknown'
        };
        await db.collection(JOURNAL_COLLECTION).add(journal);
    } catch (error) { throw error; }
};

// --- ASSIGNMENT SERVICES ---

export const getAssignments = async (classId?: string, academicYearId?: string): Promise<Assignment[]> => {
    if (isMockMode) return MOCK_ASSIGNMENTS;
    try {
        if (!db) throw new Error("Database not initialized");
        let query: any = db.collection(ASSIGNMENT_COLLECTION).orderBy('dueDate', 'asc').limit(50);
        if (classId) query = query.where('classId', '==', classId);
        if (academicYearId) query = query.where('academicYearId', '==', academicYearId);
        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Assignment));
    } catch (error: any) {
        console.error("Error fetching assignments:", error);
        return [];
    }
};

export const addAssignment = async (assignment: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    if (isMockMode) return;
    try {
        if (!db) throw new Error("Database not initialized");
        const doc = {
            ...assignment,
            schemaVersion: 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth?.currentUser?.uid || 'unknown'
        };
        await db.collection(ASSIGNMENT_COLLECTION).add(doc);
    } catch (error) { throw error; }
};
