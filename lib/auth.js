import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isMock } from './firebase';
import { mockSignIn, mockSignOut, mockOnAuthChange } from './mockDb';

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (isMock) {
    return mockSignIn(email, password);
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get user role from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      throw new Error('لم يتم العثور على بيانات المستخدم. تواصل مع المسؤول.');
    }

    const userData = userDoc.data();
    return {
      uid: user.uid,
      email: user.email,
      displayName: userData.displayName,
      role: userData.role,
    };
  } catch (error) {
    let message = 'حدث خطأ أثناء تسجيل الدخول';
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'البريد الإلكتروني غير مسجل';
        break;
      case 'auth/wrong-password':
        message = 'كلمة المرور غير صحيحة';
        break;
      case 'auth/invalid-email':
        message = 'البريد الإلكتروني غير صالح';
        break;
      case 'auth/too-many-requests':
        message = 'تم تجاوز عدد المحاولات. حاول لاحقاً';
        break;
      case 'auth/invalid-credential':
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        break;
      default:
        message = error.message || message;
    }
    throw new Error(message);
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (isMock) {
    return mockSignOut();
  }
  await firebaseSignOut(auth);
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback) {
  if (isMock) {
    return mockOnAuthChange(callback);
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          callback({
            uid: user.uid,
            email: user.email,
            displayName: userData.displayName,
            role: userData.role,
          });
        } else {
          callback(null);
        }
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}

