'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="loading-spinner" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginBackground}>
        <div className={styles.bgShape1} />
        <div className={styles.bgShape2} />
        <div className={styles.bgShape3} />
      </div>

      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div className={styles.logoIcon}>🦷</div>
          <h1 className={styles.clinicName}>عيادة د. محمد تيسير ذبالح</h1>
          <p className={styles.clinicSub}>طب الأسنان</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">البريد الإلكتروني</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="example@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">كلمة المرور</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.loginBtn}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner spinner-sm" />
                جاري الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        <div className={styles.loginFooter}>
          <p>نظام إدارة العيادة © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
