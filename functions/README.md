# Firebase Functions: Auto-link `uidAuth`

Function `autoFillUidAuth` berjalan saat akun Firebase Auth dibuat (`auth.user().onCreate`) dan akan:

1. Ambil `email` dari user Auth.
2. Cari dokumen pada `collectionGroup('students')` dan `collectionGroup('teachers')`.
3. Isi `uidAuth` jika belum terisi.
4. Set `emailLower`, `accountLinked`, timestamp, dan custom claims (`role`, `schoolId`, `linkedProfilePath`).

## Catatan data
- Simpan email di dokumen profil dalam huruf kecil (`emailLower`) untuk matching konsisten.
- Hindari email duplikat lintas koleksi `students` dan `teachers`.

## Deploy
```bash
npm --prefix functions install
npm --prefix functions run build
firebase deploy --only functions
```
