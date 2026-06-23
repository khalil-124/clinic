'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, saveSettings } from '@/lib/firestore';
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

  useEffect(() => {
    loadSettings();
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

  function toggleWorkDay(day) {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  const weekDays = getWeekDays();

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
              <input
                id="clinic-name"
                className="form-input"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doctor-name">اسم الدكتور</label>
              <input
                id="doctor-name"
                className="form-input"
                value={doctorName}
                onChange={e => setDoctorName(e.target.value)}
              />
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
                  <button
                    key={i}
                    type="button"
                    className={`${styles.dayBtn} ${workDays.includes(i) ? styles.dayBtnActive : ''}`}
                    onClick={() => toggleWorkDay(i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="work-start">بداية الدوام</label>
                <input
                  id="work-start"
                  type="time"
                  className="form-input"
                  value={workStart}
                  onChange={e => setWorkStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="work-end">نهاية الدوام</label>
                <input
                  id="work-end"
                  type="time"
                  className="form-input"
                  value={workEnd}
                  onChange={e => setWorkEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="apt-duration">مدة الموعد (دقائق)</label>
              <select
                id="apt-duration"
                className="form-select"
                value={aptDuration}
                onChange={e => setAptDuration(e.target.value)}
              >
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
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><span className="spinner spinner-sm" /> جاري الحفظ...</>
          ) : saved ? (
            '✅ تم الحفظ بنجاح!'
          ) : (
            '💾 حفظ الإعدادات'
          )}
        </button>
      </div>
    </div>
  );
}
