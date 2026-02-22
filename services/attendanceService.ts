/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

import firebase from 'firebase/compat/app';
import { db, isMockMode } from './firebase';
import { format } from 'date-fns';
import { Student, AttendanceStatus } from '../types';
import { countQueueItems, deleteQueueItem, getQueueItems, upsertQueueItem } from './offlineQueue';

export type AttendanceSession = 'Masuk' | 'Duha' | 'Zuhur' | 'Ashar' | 'Pulang' | 'Masuk/Duha' | 'Ashar/Pulang';

interface ScanResult {
    success: boolean;
    message: string;
    student?: Student;
    timestamp?: string;
    statusRecorded?: AttendanceStatus;
    offlineQueued?: boolean;
}

const STUDENTS_CACHE_KEY = 'imam_students_cache_v1';
const QR_SECRET_FALLBACK = 'IMAM_OFFLINE_QR_KEY_V2';
const QR_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SYNC_RETRY = 10;

const getStorage = () => {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
};

const mapSessionToField = (session: AttendanceSession, currentHour: number): string => {
    const fieldMap: Record<AttendanceSession, string> = {
        'Masuk': 'checkIn',
        'Duha': 'duha',
        'Zuhur': 'zuhur',
        'Ashar': 'ashar',
        'Pulang': 'checkOut',
        'Masuk/Duha': currentHour < 8 ? 'checkIn' : 'duha',
        'Ashar/Pulang': currentHour < 16 ? 'ashar' : 'checkOut'
    };
    return fieldMap[session];
};

const readStudentsCache = (): Student[] => {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const raw = storage.getItem(STUDENTS_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeStudentsCache = (students: Student[]) => {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(students));
};

const resolveStudentFromCache = (code: string): Student | null => {
    const cachedStudents = readStudentsCache();
    const found = cachedStudents.find(s => s.id === code || s.idUnik === code);
    return found || null;
};

const isLikelyOfflineError = (error: any): boolean => {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return code.includes('unavailable') || code.includes('network') || message.includes('offline') || message.includes('network');
};

const resolveStudentOnline = async (code: string): Promise<Student | null> => {
    if (!db) return null;
    const studentDoc = await db.collection('students').doc(code).get();
    if (studentDoc.exists) return { id: studentDoc.id, ...studentDoc.data() } as Student;

    const studentQuery = await db.collection('students').where('idUnik', '==', code).limit(1).get();
    if (!studentQuery.empty) {
        const sDoc = studentQuery.docs[0];
        return { id: sDoc.id, ...sDoc.data() } as Student;
    }

    return null;
};

const getQrSecret = (): string => {
    const storage = getStorage();
    return storage?.getItem('imam_qr_secret') || QR_SECRET_FALLBACK;
};

const getDeviceId = (): string => {
    const storage = getStorage();
    if (!storage) return 'unknown-device';
    const key = 'imam_device_id';
    const existing = storage.getItem(key);
    if (existing) return existing;
    const generated = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    storage.setItem(key, generated);
    return generated;
};

const hexToBytes = (hex: string): Uint8Array => {
    const pairs = hex.match(/.{1,2}/g) || [];
    return new Uint8Array(pairs.map(b => parseInt(b, 16)));
};

const secureEqualHex = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return out === 0;
};

const hmacSha256Hex = async (message: string, secret: string): Promise<string> => {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
        throw new Error('WEBCRYPTO_UNAVAILABLE');
    }

    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
    const bytes = new Uint8Array(sig);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const normalizeRawQr = (rawCode: string) => String(rawCode || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

const parseQrPayload = async (rawCode: string): Promise<{ code: string; signed: boolean }> => {
    const cleaned = normalizeRawQr(rawCode);
    if (!cleaned.startsWith('IMAMQR:')) return { code: cleaned, signed: false };

    try {
        const b64 = cleaned.substring(7);
        if (typeof atob !== 'function') return { code: '', signed: true };
        const decoded = atob(b64);
        const payload = JSON.parse(decoded) as { id?: string; ts?: number; sig?: string };
        if (!payload?.id || !payload?.sig || !payload?.ts) return { code: '', signed: true };

        const age = Math.abs(Date.now() - payload.ts);
        if (age > QR_MAX_AGE_MS) return { code: '', signed: true };

        const message = `${payload.id}.${payload.ts}`;
        const expected = await hmacSha256Hex(message, getQrSecret());
        if (!secureEqualHex(expected, payload.sig)) return { code: '', signed: true };

        return { code: payload.id, signed: true };
    } catch {
        return { code: '', signed: true };
    }
};

const buildQueueKey = (studentId: string, date: string, fieldName: string) => `${studentId}:${date}:${fieldName}`;

export const preloadStudentsForOffline = async (): Promise<number> => {
    if (isMockMode || !db) return 0;
    try {
        const snap = await db.collection('students').where('status', '==', 'Aktif').get();
        const students = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        writeStudentsCache(students);
        return students.length;
    } catch (error) {
        console.warn('Gagal preload students cache:', error);
        return readStudentsCache().length;
    }
};

export const getPendingAttendanceCount = async (): Promise<number> => countQueueItems();

export const syncPendingAttendance = async (): Promise<{ synced: number; failed: number }> => {
    const queue = await getQueueItems();
    if (!queue.length) return { synced: 0, failed: 0 };
    if (isMockMode || !db) return { synced: 0, failed: queue.length };
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: queue.length };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
        const retries = item.retryCount || 0;
        if (retries >= MAX_SYNC_RETRY) {
            failed += 1;
            await deleteQueueItem(item.key);
            console.warn('[attendance-sync] item dropped after max retries', { key: item.key, retries });
            continue;
        }

        try {
            const ref = db.collection('attendance').doc(item.attendanceId);
            const doc = await ref.get();
            if (doc.exists) await ref.update(item.payload);
            else await ref.set(item.payload);
            await deleteQueueItem(item.key);
            synced += 1;
        } catch {
            failed += 1;
            await upsertQueueItem({
                ...item,
                retryCount: retries + 1,
                lastAttemptAt: Date.now()
            });
        }
    }

    return { synced, failed };
};

export const recordAttendanceByScan = async (rawCode: string, session: AttendanceSession, isHaid: boolean = false): Promise<ScanResult> => {
    const qr = await parseQrPayload(rawCode);
    const code = qr.code;
    if (!code) {
        return { success: false, message: qr.signed ? 'QR TIDAK VALID / KEDALUWARSA' : 'ID TIDAK TERBACA' };
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const nowObj = new Date();
    const now = format(nowObj, 'HH:mm:ss');
    const nowShort = format(nowObj, 'HH:mm');
    const currentHour = nowObj.getHours();
    const LATE_THRESHOLD = '07:30:00';

    const fieldName = mapSessionToField(session, currentHour);
    const recordValue = isHaid ? `${nowShort} H` : now;

    if (isMockMode) {
        return new Promise<ScanResult>(resolve => {
            setTimeout(() => {
                if (code === '000') return resolve({ success: false, message: 'ID TIDAK TERDAFTAR' });
                const isLate = (session === 'Masuk' || session === 'Masuk/Duha') && now > LATE_THRESHOLD;
                resolve({
                    success: true,
                    message: isHaid ? 'STATUS HAID TERKONFIRMASI' : (isLate ? 'MASUK (TERLAMBAT)' : 'PRESENSI BERHASIL'),
                    student: { namaLengkap: 'SISWA SIMULASI', tingkatRombel: 'XII IPA 1', idUnik: code, jenisKelamin: 'Perempuan' } as any,
                    timestamp: recordValue,
                    statusRecorded: isHaid ? 'Haid' : (isLate ? 'Terlambat' : 'Hadir')
                });
            }, 400);
        });
    }

    let studentData: Student | null = null;
    try {
        studentData = await resolveStudentOnline(code);
    } catch (error) {
        studentData = resolveStudentFromCache(code);
        if (!studentData && !isLikelyOfflineError(error)) {
            return { success: false, message: 'GAGAL MEMBACA DATA SISWA' };
        }
    }

    if (!studentData) studentData = resolveStudentFromCache(code);
    if (!studentData) return { success: false, message: `ID "${code}" TIDAK TERDAFTAR` };

    if (isHaid && !['Duha', 'Zuhur', 'Ashar'].includes(session)) {
        return { success: false, message: 'MODE HAID KHUSUS SESI DUHA/ZUHUR/ASHAR' };
    }
    if (isHaid && studentData.jenisKelamin === 'Laki-laki') {
        return { success: false, message: 'MODE HAID HANYA UNTUK PUTRI', student: studentData };
    }

    const attendanceId = `${studentData.id}_${today}`;
    const isLate = (session === 'Masuk' || session === 'Masuk/Duha') && now > LATE_THRESHOLD;

    const basePayload: any = {
        [fieldName]: recordValue,
        studentId: studentData.id,
        studentName: studentData.namaLengkap,
        class: studentData.tingkatRombel,
        idUnik: studentData.idUnik,
        date: today,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isHaid) basePayload.status = 'Haid';
    else if (session === 'Masuk' || session === 'Masuk/Duha') basePayload.status = isLate ? 'Terlambat' : 'Hadir';

    const queueItem = {
        key: buildQueueKey(studentData.id || code, today, fieldName),
        attendanceId,
        fieldName,
        payload: basePayload,
        createdAt: Date.now(),
        retryCount: 0,
        lastAttemptAt: Date.now(),
        deviceId: getDeviceId()
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await upsertQueueItem(queueItem);
        return {
            success: true,
            message: 'TERSIMPAN OFFLINE (MENUNGGU SINKRONISASI)',
            student: studentData,
            timestamp: recordValue,
            statusRecorded: basePayload.status || 'Hadir',
            offlineQueued: true
        };
    }

    if (!db) {
        await upsertQueueItem(queueItem);
        return {
            success: true,
            message: 'DATABASE OFFLINE - DATA DIANTRIKAN',
            student: studentData,
            timestamp: recordValue,
            statusRecorded: basePayload.status || 'Hadir',
            offlineQueued: true
        };
    }

    try {
        const attendanceRef = db.collection('attendance').doc(attendanceId);
        const docSnapshot = await attendanceRef.get();
        const currentData = docSnapshot?.exists ? docSnapshot.data() : null;

        if (docSnapshot?.exists && currentData?.[fieldName] && !String(currentData[fieldName]).startsWith('Alpha')) {
            return { success: false, message: 'SUDAH TERREKAM', student: studentData };
        }

        const updatePayload = { ...basePayload };
        if (!isHaid && (!currentData?.status || ['Alpha', 'Hadir', 'Terlambat'].includes(currentData.status))) {
            if (session === 'Masuk' || session === 'Masuk/Duha') {
                updatePayload.status = isLate ? 'Terlambat' : 'Hadir';
            }
        }

        if (docSnapshot?.exists) await attendanceRef.update(updatePayload);
        else await attendanceRef.set(updatePayload);

        return {
            success: true,
            message: isHaid ? 'STATUS HAID DICATAT' : (isLate ? 'MASUK (TERLAMBAT)' : 'BERHASIL'),
            student: studentData,
            timestamp: recordValue,
            statusRecorded: updatePayload.status || 'Hadir'
        };
    } catch (error: any) {
        if (isLikelyOfflineError(error)) {
            await upsertQueueItem(queueItem);
            return {
                success: true,
                message: 'TERSIMPAN OFFLINE (MENUNGGU SINKRONISASI)',
                student: studentData,
                timestamp: recordValue,
                statusRecorded: basePayload.status || 'Hadir',
                offlineQueued: true
            };
        }

        console.error('Attendance Error:', error);
        return { success: false, message: 'GANGGUAN IZIN DATABASE' };
    }
};
