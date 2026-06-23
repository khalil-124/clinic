import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { setDoc, doc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { uid, displayName, email } = await request.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'uid and email are required' }, { status: 400 });
    }

    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      displayName: displayName || 'د. محمد تيسير ذبالح',
      role: 'doctor',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Admin doctor created successfully!' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
