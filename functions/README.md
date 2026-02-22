# Firebase Functions: Auto-link akun ke profil master

Function `autoLinkAccount` berjalan saat akun Firebase Auth dibuat (`auth.user().onCreate`) dan akan:

1. Ambil `email` dari user Auth.
2. Cari dokumen pada koleksi `students` dan `teachers` berdasarkan `email`/`emailLower`.
3. Jika role cocok dan unik:
   - **Student:** isi `authUid`, `linkedUserId`, `isClaimed`.
   - **Teacher:** isi `authUid`, `linkedUserId`.
4. Set custom claims (`role`, `studentId`/`teacherId`, `linkedProfilePath`).

## Guardrails
- Tidak overwrite jika `authUid` sudah terisi UID lain.
- Hentikan proses jika email duplikat.
- Hentikan proses jika email muncul di student dan teacher sekaligus (ambiguous role).

## Deploy
```bash
npm --prefix functions install
npm --prefix functions run build
firebase deploy --only functions
```
