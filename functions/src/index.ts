import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const buildEmailCandidates = (email: string): string[] => {
  const trimmed = email.trim();
  const lowered = normalizeEmail(trimmed);
  return Array.from(new Set([trimmed, lowered]));
};

type LookupResult = { doc: FirebaseFirestore.QueryDocumentSnapshot | null; duplicate: boolean };

const queryUnique = async (collection: 'students' | 'teachers', field: string, value: string): Promise<LookupResult> => {
  const snap = await db.collection(collection).where(field, '==', value).limit(2).get();
  if (snap.size > 1) {
    functions.logger.error('Duplicate identity field found', { collection, field, value, matches: snap.size });
    return { doc: null, duplicate: true };
  }
  return { doc: snap.empty ? null : snap.docs[0], duplicate: false };
};

const findStudentByAuthEmail = async (emailCandidates: string[], emailLower: string): Promise<LookupResult> => {
  // Khusus Student, field email login berada di `userlogin`.
  for (const candidate of emailCandidates) {
    const byUserLogin = await queryUnique('students', 'userlogin', candidate);
    if (byUserLogin.duplicate || byUserLogin.doc) return byUserLogin;
  }

  const byEmailLower = await queryUnique('students', 'emailLower', emailLower);
  if (byEmailLower.duplicate || byEmailLower.doc) return byEmailLower;

  for (const candidate of emailCandidates) {
    const byEmail = await queryUnique('students', 'email', candidate);
    if (byEmail.duplicate || byEmail.doc) return byEmail;
  }

  return { doc: null, duplicate: false };
};

const findTeacherByAuthEmail = async (emailCandidates: string[], emailLower: string): Promise<LookupResult> => {
  for (const candidate of emailCandidates) {
    const byEmail = await queryUnique('teachers', 'email', candidate);
    if (byEmail.duplicate || byEmail.doc) return byEmail;
  }

  return queryUnique('teachers', 'emailLower', emailLower);
};

export const autoLinkAccount = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    functions.logger.info('Skip auto-link: auth user has no email', { uid: user.uid });
    return;
  }

  const emailCandidates = buildEmailCandidates(user.email);
  const emailLower = normalizeEmail(user.email);

  const [studentResult, teacherResult] = await Promise.all([
    findStudentByAuthEmail(emailCandidates, emailLower),
    findTeacherByAuthEmail(emailCandidates, emailLower),
  ]);

  if (studentResult.duplicate || teacherResult.duplicate) {
    functions.logger.error('Skip auto-link: duplicate identity value in master data', { uid: user.uid, email: emailLower });
    return;
  }

  if (studentResult.doc && teacherResult.doc) {
    functions.logger.error('Skip auto-link: ambiguous role (student + teacher)', {
      uid: user.uid,
      email: emailLower,
      studentPath: studentResult.doc.ref.path,
      teacherPath: teacherResult.doc.ref.path,
    });
    return;
  }

  if (!studentResult.doc && !teacherResult.doc) {
    functions.logger.info('No student/teacher profile found for auth email', { uid: user.uid, email: emailLower });
    return;
  }

  if (studentResult.doc) {
    const data = studentResult.doc.data();
    if (data.authUid && data.authUid !== user.uid) {
      functions.logger.warn('Skip overwrite existing student.authUid', {
        uid: user.uid,
        email: emailLower,
        studentId: studentResult.doc.id,
        currentAuthUid: data.authUid,
      });
      return;
    }

    await studentResult.doc.ref.set(
      {
        authUid: user.uid,
        linkedUserId: user.uid,
        isClaimed: true,
        userlogin: emailLower,
        emailLower,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const existingClaims = (await admin.auth().getUser(user.uid)).customClaims || {};
    await admin.auth().setCustomUserClaims(user.uid, {
      ...existingClaims,
      role: 'siswa',
      studentId: studentResult.doc.id,
      schoolId: (data.schoolId as string | undefined) || existingClaims.schoolId || null,
      linkedProfilePath: studentResult.doc.ref.path,
    });

    functions.logger.info('Student account linked automatically', {
      uid: user.uid,
      email: emailLower,
      studentId: studentResult.doc.id,
    });
    return;
  }

  const teacherDoc = teacherResult.doc!;
  const teacherData = teacherDoc.data();

  if (teacherData.authUid && teacherData.authUid !== user.uid) {
    functions.logger.warn('Skip overwrite existing teacher.authUid', {
      uid: user.uid,
      email: emailLower,
      teacherId: teacherDoc.id,
      currentAuthUid: teacherData.authUid,
    });
    return;
  }

  await teacherDoc.ref.set(
    {
      authUid: user.uid,
      linkedUserId: user.uid,
      emailLower,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const existingClaims = (await admin.auth().getUser(user.uid)).customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, {
    ...existingClaims,
    role: 'guru',
    teacherId: teacherDoc.id,
    schoolId: (teacherData.schoolId as string | undefined) || existingClaims.schoolId || null,
    linkedProfilePath: teacherDoc.ref.path,
  });

  functions.logger.info('Teacher account linked automatically', {
    uid: user.uid,
    email: emailLower,
    teacherId: teacherDoc.id,
  });
});
