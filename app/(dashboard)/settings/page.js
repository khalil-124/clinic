'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, saveSettings, getUsers, createUserDoc } from '@/lib/firestore';
import { getWeekDays } from '@/lib/utils';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [workDays, setWorkDays] = useState([]);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [aptDuration, setAptDuration] = useState(30);

  // Staff management
  const [staffList, setStaffList] = useState([]);
  const [newUid, setNewUid] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('secretary');
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');

  useEffect(() => {
    loadSettings();
    loadStaff();
  }, []);

  async function loadSettings() {
    try {
      const s = await getSettings();
      setSettings(s);
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
      console.error(err);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings({
        clinicName,
        doctorName,
        workDays,
        workHoursStart: workStart,
        workHoursEnd: workEnd,
        appointmentDuration: parseInt(aptDuration),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStaff() {
    if (!newUid.trim() || !newName.trim() || !newEmail.trim()) {
      setStaffMsg('❌ يرجى ملء جميع الحقول');
      return;
    }
    setAddingStaff(true);
    setStaffMsg('');
    try {
      await createUserDoc(newUid.trim(), {
        uid: newUid.trim(),
        email: newEmail.trim(),
        displayName: newName.trim(),
        role: newRole,
      });
      setStaffMsg('✅ تمت إضافة الموظف بنجاح!');
      setNewUid('');
      setNewName('');
      setNewEmail('');
      setNewRole('secretary');
      await loadStaff();
      setTimeout(() => setStaffMsg(''), 4000);
    } catch (err) {
      setStaffMsg(`❌ خطأ: ${err.message}`);
    } finally {
      setAddingStaff(false);
    }
  }

  function toggleWorkDay(day) {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  const weekDays = getWeekDays();
  const roleLabel = { doctor: '👨‍⚕️ طبيب', secretary: '👩‍💼 سكرتيرة' };

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h1>⚙️ الإعدادات</h1></div></div>
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>⚙️ الإعدادات</h1>
          <p className="subtitle">إعدادات العيادة والنظام</p>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        {/* Clinic Info */}
        <div className="card">
          <div className="card-header"><h3>🏥 معلومات العيادة</h3></div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="clinic-name">اسم العيادة</label>
              <input id="clinic-name" className="form-input" value={clinicName}
                onChange={e => setClinicName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doctor-name">اسم الدكتور</label>
              <input id="doctor-name" className="form-input" value={doctorName}
                onChange={e => setDoctorName(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Work Hours */}
        <div className="card">
          <div className="card-header"><h3>🕐 أوقات العمل</h3></div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">أيام العمل</label>
              <div className={styles.daysGrid}>
                {weekDays.map((name, i) => (
                  <button key={i} type="button"
                    className={`${styles.dayBtn} ${workDays.includes(i) ? styles.dayBtnActive : ''}`}
                    onClick={() => toggleWorkDay(i)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="work-start">بداية الدوام</label>
                <input id="work-start" type="time" className="form-input" value={workStart}
                  onChange={e => setWorkStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="work-end">نهاية الدوام</label>
                <input id="work-end" type="time" className="form-input" value={workEnd}
                  onChange={e => setWorkEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="apt-duration">مدة الموعد (دقائق)</label>
              <select id="apt-duration" className="form-select" value={aptDuration}
                onChange={e => setAptDuration(e.target.value)}>
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

      {/* Save Button */}
      <div className={styles.saveRow}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner spinner-sm" /> جاري الحفظ...</>
            : saved ? '✅ تم الحفظ بنجاح!' : '💾 حفظ الإعدادات'}
        </button>
      </div>

      {/* Staff Management - only for doctors */}
      {user?.role === 'doctor' && (
        <div className="card" style={{ marginTop: 32 }}>
          <div className="card-header"><h3>👥 إدارة الموظفين</h3></div>
          <div className="card-body">

            {/* Current Staff List */}
            {staffList.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 14 }}>الموظفون الحاليون</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffList.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.displayName}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, marginRight: 8 }}>{s.email}</span>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12,
                        background: s.role === 'doctor' ? '#1e3a5f' : '#1a3a2a',
                        color: s.role === 'doctor' ? '#60a5fa' : '#4ade80',
                      }}>
                        {roleLabel[s.role] || s.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Staff */}
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 14 }}>➕ إضافة موظف جديد</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              أنشئ الحساب أولاً من{' '}
              <a href="https://console.firebase.google.com/project/clinic-e156b/authentication/users"
                target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                Firebase Console ↗
              </a>
              {' '}ثم انسخ الـ UID وأدخله هنا.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="staff-uid">User UID</label>
                <input id="staff-uid" className="form-input" dir="ltr"
                  placeholder="الصق الـ UID من Firebase"
                  value={newUid} onChange={e => setNewUid(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="staff-role">الدور</label>
                <select id="staff-role" className="form-select"
                  value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="secretary">👩‍💼 سكرتيرة</option>
                  <option value="doctor">👨‍⚕️ طبيب</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="staff-name">الاسم الكامل</label>
                <input id="staff-name" className="form-input" placeholder="اسم الموظف"
                  value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="staff-email">البريد الإلكتروني</label>
                <input id="staff-email" className="form-input" dir="ltr" type="email"
                  placeholder="email@example.com"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)} />
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

            <button className="btn btn-primary" onClick={handleAddStaff} disabled={addingStaff}>
              {addingStaff ? <><span className="spinner spinner-sm" /> جاري الإضافة...</> : '➕ إضافة الموظف'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
