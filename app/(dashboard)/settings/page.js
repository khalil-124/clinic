'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, saveSettings, getUsers } from '@/lib/firestore';
import { getWeekDays } from '@/lib/utils';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [workDays, setWorkDays] = useState([]);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [aptDuration, setAptDuration] = useState(30);

  // Staff
  const [staffList, setStaffList] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('secretary');
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadSettings();
    loadStaff();
  }, []);

  async function loadSettings() {
    try {
      const s = await getSettings();
      setClinicName(s.clinicName || '');
      setDoctorName(s.doctorName || '');
      setWorkDays(s.workDays || [0, 1, 2, 3, 4]);
      setWorkStart(s.workHoursStart || '09:00');
      setWorkEnd(s.workHoursEnd || '17:00');
      setAptDuration(s.appointmentDuration || 30);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaff() {
    try {
      const users = await getUsers();
      setStaffList(users);
    } catch (err) {
      console.error('Could not load staff:', err);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings({ clinicName, doctorName, workDays,
        workHoursStart: workStart, workHoursEnd: workEnd,
        appointmentDuration: parseInt(aptDuration) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) {
      setStaffMsg('❌ يرجى ملء جميع الحقول');
      return;
    }
    setAddingStaff(true);
    setStaffMsg('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newName, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setStaffMsg('✅ تم إنشاء الحساب بنجاح!');
        setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretary');
        await loadStaff();
        setTimeout(() => setStaffMsg(''), 4000);
      } else {
        setStaffMsg(`❌ ${data.error}`);
      }
    } catch (err) { setStaffMsg(`❌ خطأ: ${err.message}`); }
    finally { setAddingStaff(false); }
  }

  async function handleDeleteStaff(uid, name) {
    if (!confirm(`هل أنت متأكد من حذف حساب "${name}"؟`)) return;
    setDeletingId(uid);
    try {
      const res = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (res.ok) {
        await loadStaff();
      }
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  }

  function toggleWorkDay(day) {
    setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  }

  const weekDays = getWeekDays();
  const roleLabel = { doctor: '👨‍⚕️ طبيب', secretary: '👩‍💼 سكرتيرة' };
  const isDoctor = user?.role === 'doctor';

  if (loading) return (
    <div>
      <div className="page-header"><div><h1>⚙️ الإعدادات</h1></div></div>
      <div className="loading-spinner"><div className="spinner" /></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>⚙️ الإعدادات</h1>
          <p className="subtitle">إعدادات العيادة والنظام</p>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        <div className="card">
          <div className="card-header"><h3>🏥 معلومات العيادة</h3></div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="clinic-name">اسم العيادة</label>
              <input id="clinic-name" className="form-input" value={clinicName} onChange={e => setClinicName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doctor-name">اسم الدكتور</label>
              <input id="doctor-name" className="form-input" value={doctorName} onChange={e => setDoctorName(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>🕐 أوقات العمل</h3></div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">أيام العمل</label>
              <div className={styles.daysGrid}>
                {weekDays.map((name, i) => (
                  <button key={i} type="button"
                    className={`${styles.dayBtn} ${workDays.includes(i) ? styles.dayBtnActive : ''}`}
                    onClick={() => toggleWorkDay(i)}>{name}</button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="work-start">بداية الدوام</label>
                <input id="work-start" type="time" className="form-input" value={workStart} onChange={e => setWorkStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="work-end">نهاية الدوام</label>
                <input id="work-end" type="time" className="form-input" value={workEnd} onChange={e => setWorkEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="apt-duration">مدة الموعد (دقائق)</label>
              <select id="apt-duration" className="form-select" value={aptDuration} onChange={e => setAptDuration(e.target.value)}>
                <option value="15">15 دقيقة</option>
                <option value="20">20 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">60 دقيقة</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.saveRow}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner spinner-sm" /> جاري الحفظ...</> : saved ? '✅ تم الحفظ!' : '💾 حفظ الإعدادات'}
        </button>
      </div>

      {/* Staff Management - doctors only */}
      {isDoctor && (
        <div className="card" style={{ marginTop: 32 }}>
          <div className="card-header"><h3>👥 إدارة حسابات الموظفين</h3></div>
          <div className="card-body">

            {/* Staff List */}
            {staffList.filter(s => s.uid !== user?.uid).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  الحسابات المضافة
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffList.filter(s => s.uid !== user?.uid).map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 10,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: s.role === 'doctor' ? '#1e3a5f' : '#1a3a2a',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>
                          {s.role === 'doctor' ? '👨‍⚕️' : '👩‍💼'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{s.displayName}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.email} · {roleLabel[s.role] || s.role}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteStaff(s.uid || s.id, s.displayName)}
                        disabled={deletingId === (s.uid || s.id)}
                        style={{
                          background: 'transparent', border: '1px solid #ef4444',
                          color: '#ef4444', padding: '5px 12px', borderRadius: 6,
                          cursor: 'pointer', fontSize: 12,
                        }}>
                        {deletingId === (s.uid || s.id) ? '...' : '🗑️ حذف'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Staff Form */}
            <h4 style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ➕ إضافة حساب جديد
            </h4>
            <form onSubmit={handleAddStaff}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-staff-name">الاسم الكامل</label>
                  <input id="new-staff-name" className="form-input" placeholder="اسم الموظف"
                    value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-staff-role">الدور</label>
                  <select id="new-staff-role" className="form-select" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="secretary">👩‍💼 سكرتيرة</option>
                    <option value="doctor">👨‍⚕️ طبيب</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-staff-email">البريد الإلكتروني</label>
                  <input id="new-staff-email" className="form-input" dir="ltr" type="email"
                    placeholder="email@example.com"
                    value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-staff-pass">كلمة المرور</label>
                  <input id="new-staff-pass" className="form-input" dir="ltr" type="password"
                    placeholder="6 أحرف على الأقل"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
              </div>

              {staffMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                  background: staffMsg.startsWith('✅') ? '#14532d' : '#450a0a',
                  color: staffMsg.startsWith('✅') ? '#86efac' : '#fca5a5', fontSize: 14,
                }}>
                  {staffMsg}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={addingStaff}>
                {addingStaff ? <><span className="spinner spinner-sm" /> جاري الإنشاء...</> : '➕ إنشاء الحساب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
