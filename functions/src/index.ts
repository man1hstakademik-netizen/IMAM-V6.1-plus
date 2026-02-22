import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const findUniqueByEmail = async (collection: 'students' | 'teachers', email: string) => {
  const direct = await db.collection(collection).where('email', '==', email).limit(2).get();

  if (direct.size > 1) {
    functions.logger.error('Duplicate email found', { collection, email, matches: direct.size });
    return { doc: null, duplicate: true };
  }

  if (!direct.empty) {
    return { doc: direct.docs[0], duplicate: false };
  }

  const lower = await db.collection(collection).where('emailLower', '==', email).limit(2).get();

  if (lower.size > 1) {
    functions.logger.error('Duplicate emailLower found', { collection, email, matches: lower.size });
    return { doc: null, duplicate: true };
  }

  return { doc: lower.empty ? null : lower.docs[0], duplicate: false };
};

export const autoLinkAccount = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    functions.logger.info('Skip auto-link: auth user has no email', { uid: user.uid });
    return;
  }

  const email = normalizeEmail(user.email);

  const [studentResult, teacherResult] = await Promise.all([
    findUniqueByEmail('students', email),
    findUniqueByEmail('teachers', email),
  ]);

  if (studentResult.duplicate || teacherResult.duplicate) {
    functions.logger.error('Skip auto-link: duplicate email in master data', { uid: user.uid, email });
    return;
  }

  if (studentResult.doc && teacherResult.doc) {
    functions.logger.error('Skip auto-link: ambiguous role (student + teacher)', {
      uid: user.uid,
      email,
      studentPath: studentResult.doc.ref.path,
      teacherPath: teacherResult.doc.ref.path,
    });
    return;
  }

  if (!studentResult.doc && !teacherResult.doc) {
    functions.logger.info('No student/teacher profile found for auth email', { uid: user.uid, email });
    return;
  }

  if (studentResult.doc) {
    const data = studentResult.doc.data();
    if (data.authUid && data.authUid !== user.uid) {
      functions.logger.warn('Skip overwrite existing student.authUid', {
        uid: user.uid,
        email,
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
        emailLower: email,
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
      linkedProfilePath: studentResult.doc.ref.path,
    });

    functions.logger.info('Student account linked automatically', {
      uid: user.uid,
      email,
      studentId: studentResult.doc.id,
    });
    return;
  }

  const teacherDoc = teacherResult.doc!;
  const teacherData = teacherDoc.data();

  if (teacherData.authUid && teacherData.authUid !== user.uid) {
    functions.logger.warn('Skip overwrite existing teacher.authUid', {
      uid: user.uid,
      email,
      teacherId: teacherDoc.id,
      currentAuthUid: teacherData.authUid,
    });
    return;
  }

  await teacherDoc.ref.set(
    {
      authUid: user.uid,
      linkedUserId: user.uid,
      emailLower: email,
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
    linkedProfilePath: teacherDoc.ref.path,
  });

  functions.logger.info('Teacher account linked automatically', {
    uid: user.uid,
    email,
    teacherId: teacherDoc.id,
  });
});
