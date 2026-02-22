import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

interface LinkTarget {
  role: 'student' | 'teacher';
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
}

const buildEmailCandidates = (email: string): string[] => {
  const normalized = email.trim().toLowerCase();
  return Array.from(new Set([normalized, email.trim()]));
};

const findFirstByEmail = async (
  collectionGroupName: 'students' | 'teachers',
  emailCandidates: string[]
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> => {
  const db = admin.firestore();

  for (const candidate of emailCandidates) {
    const directMatch = await db
      .collectionGroup(collectionGroupName)
      .where('email', '==', candidate)
      .limit(2)
      .get();

    if (directMatch.size > 1) {
      functions.logger.error('Duplicate email detected', {
        collectionGroupName,
        email: candidate,
        matches: directMatch.size,
      });
      return null;
    }

    if (!directMatch.empty) {
      return directMatch.docs[0];
    }

    const loweredMatch = await db
      .collectionGroup(collectionGroupName)
      .where('emailLower', '==', candidate.toLowerCase())
      .limit(2)
      .get();

    if (loweredMatch.size > 1) {
      functions.logger.error('Duplicate emailLower detected', {
        collectionGroupName,
        email: candidate.toLowerCase(),
        matches: loweredMatch.size,
      });
      return null;
    }

    if (!loweredMatch.empty) {
      return loweredMatch.docs[0];
    }
  }

  return null;
};

const findLinkTarget = async (email: string): Promise<LinkTarget | null> => {
  const emailCandidates = buildEmailCandidates(email);

  const [studentDoc, teacherDoc] = await Promise.all([
    findFirstByEmail('students', emailCandidates),
    findFirstByEmail('teachers', emailCandidates),
  ]);

  if (studentDoc && teacherDoc) {
    functions.logger.error('Ambiguous email: found both student and teacher record', {
      email,
      studentPath: studentDoc.ref.path,
      teacherPath: teacherDoc.ref.path,
    });
    return null;
  }

  if (studentDoc) {
    return { role: 'student', ref: studentDoc.ref, data: studentDoc.data() };
  }

  if (teacherDoc) {
    return { role: 'teacher', ref: teacherDoc.ref, data: teacherDoc.data() };
  }

  return null;
};

export const autoFillUidAuth = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    functions.logger.info('Skip auto-link: auth user has no email', { uid: user.uid });
    return;
  }

  const target = await findLinkTarget(user.email);
  if (!target) {
    functions.logger.info('No student/teacher found for auth email', {
      uid: user.uid,
      email: user.email,
    });
    return;
  }

  const currentUidAuth = target.data.uidAuth as string | undefined;
  if (currentUidAuth && currentUidAuth !== user.uid) {
    functions.logger.warn('Skip overwrite existing uidAuth', {
      uid: user.uid,
      email: user.email,
      existingUidAuth: currentUidAuth,
      targetPath: target.ref.path,
    });
    return;
  }

  await target.ref.set(
    {
      uidAuth: user.uid,
      emailLower: user.email.toLowerCase(),
      accountLinked: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const existingClaims = (await admin.auth().getUser(user.uid)).customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, {
    ...existingClaims,
    role: target.role,
    schoolId: target.data.schoolId || null,
    linkedProfilePath: target.ref.path,
  });

  functions.logger.info('uidAuth auto-filled successfully', {
    uid: user.uid,
    email: user.email,
    role: target.role,
    targetPath: target.ref.path,
  });
});
