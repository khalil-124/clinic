import { NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { email, password, displayName, role } = await request.json();

    if (!email || !password || !displayName || !role) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // Create Firestore user document
    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
    });

    // Sign back out the newly created user from this server context
    await auth.signOut();

    return NextResponse.json({
      success: true,
      uid: newUser.uid,
      message: 'تم إنشاء الحساب بنجاح',
    });
  } catch (error) {
    let message = error.message;
    if (error.code === 'auth/email-already-in-use') message = 'البريد الإلكتروني مستخدم مسبقاً';
    if (error.code === 'auth/weak-password') message = 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
    if (error.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صالح';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'UID مطلوب' }, { status: 400 });

    // Delete Firestore document only (Firebase Auth deletion requires Admin SDK)
    await deleteDoc(doc(db, 'users', uid));

    return NextResponse.json({ success: true, message: 'تم حذف الموظف من النظام' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
