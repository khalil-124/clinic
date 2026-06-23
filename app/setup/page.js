'use client';

import { useState } from 'react';

export default function SetupPage() {
  const [uid, setUid] = useState('');
  const [name, setName] = useState('د. محمد تيسير ذبالح');
  const [email, setEmail] = useState('dr.mohammed@clinic.com');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSetup() {
    if (!uid.trim()) {
      setStatus('❌ أدخل الـ UID أولاً');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch('/api/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid.trim(), email: email.trim(), displayName: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('✅ تم إنشاء حساب المدير بنجاح! يمكنك الآن تسجيل الدخول.');
        setDone(true);
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (e) {
      setStatus(`❌ خطأ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      fontFamily: 'sans-serif',
      direction: 'rtl',
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 16,
        padding: 40,
        width: 420,
        border: '1px solid #334155',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚙️</div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, margin: 0 }}>إعداد المدير الأول</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>
            هذه الصفحة تُستخدم مرة واحدة فقط لإنشاء حساب الطبيب
          </p>
        </div>

        {!done ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                User UID (من Firebase Console)
              </label>
              <input
                type="text"
                value={uid}
                onChange={e => setUid(e.target.value)}
                placeholder="الصق الـ UID هنا..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: '#0f172a', border: '1px solid #475569',
                  color: '#f1f5f9', fontSize: 13, direction: 'ltr',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                الاسم الكامل
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: '#0f172a', border: '1px solid #475569',
                  color: '#f1f5f9', fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: '#0f172a', border: '1px solid #475569',
                  color: '#f1f5f9', fontSize: 13, direction: 'ltr',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleSetup}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: loading ? '#334155' : '#3b82f6',
                color: 'white', border: 'none', fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {loading ? 'جاري الإنشاء...' : '🚀 إنشاء حساب المدير'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <a
              href="/login"
              style={{
                display: 'block', padding: '12px', borderRadius: 8,
                background: '#22c55e', color: 'white', textDecoration: 'none',
                fontSize: 15, fontWeight: 600, marginTop: 16,
              }}
            >
              تسجيل الدخول الآن →
            </a>
          </div>
        )}

        {status && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8,
            background: status.startsWith('✅') ? '#14532d' : '#450a0a',
            color: status.startsWith('✅') ? '#86efac' : '#fca5a5',
            fontSize: 14, textAlign: 'center',
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
