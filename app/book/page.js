'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { addPatient, addAppointment, getAppointmentsByDate, getSettings } from '@/lib/firestore';
import { generateTimeSlots, formatTime, getToday, getDayName } from '@/lib/utils';
import styles from './book.module.css';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

function PatientBookingForm() {
  const router = useRouter();

  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');

  // Medical History
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medHistoryNotes, setMedHistoryNotes] = useState('');

  // Appointment Info
  const [date, setDate] = useState(getToday());
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    if (!SpeechRecognition) {
      alert('التعرف على الصوت غير مدعوم في هذا المتصفح. يرجى استخدام Google Chrome أو Microsoft Edge.');
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-JO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNotes(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.start();
  };

  // State
  const [bookedTimes, setBookedTimes] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (date && settings) {
      loadBookedTimes(date);
    }
  }, [date, settings]);

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
    setTimeSlots(generateTimeSlots(s.workHoursStart || '09:00', s.workHoursEnd || '17:00', s.appointmentDuration || 30));
  }

  async function loadBookedTimes(selectedDate) {
    const appointments = await getAppointmentsByDate(selectedDate);
    const booked = appointments
      .filter(a => a.status !== 'cancelled')
      .map(a => a.time);
    setBookedTimes(booked);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!patientName.trim()) return setError('الرجاء إدخال اسم المريض');
    if (!patientPhone.trim()) return setError('الرجاء إدخال رقم الهاتف');
    if (!date) return setError('الرجاء اختيار التاريخ');
    if (!time) return setError('الرجاء اختيار الوقت');

    setLoading(true);
    try {
      // Create a pending patient profile from self-registration
      const patientId = await addPatient({
        name: patientName.trim(),
        phone: patientPhone.trim(),
        age: patientAge ? parseInt(patientAge) : null,
        gender: patientGender || null,
        status: 'pending_approval',
        medicalHistory: {
          chronicDiseases: chronicDiseases ? chronicDiseases.split('،').map(s => s.trim()).filter(Boolean) : [],
          allergies: allergies ? allergies.split('،').map(s => s.trim()).filter(Boolean) : [],
          currentMedications: medications ? medications.split('،').map(s => s.trim()).filter(Boolean) : [],
          notes: medHistoryNotes.trim(),
        },
        notes: '',
      });

      // Create pending appointment
      await addAppointment({
        patientId,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        date,
        time,
        duration: settings?.appointmentDuration || 30,
        type: 'checkup',
        status: 'pending_approval',
        chiefComplaint: notes,
        diagnosis: '',
        treatment: '',
        doctorNotes: '',
        createdBy: 'patient_self_registration',
      });

      setSuccess(true);
    } catch (err) {
      setError('حدث خطأ أثناء الحجز. حاول مرة أخرى.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.publicContainer}>
        <div className={styles.publicCard}>
          <div className={styles.successMessage}>
            <div className={styles.successIcon}>✅</div>
            <h2>تم إرسال طلب الحجز بنجاح!</h2>
            <p>سنتواصل معك قريباً لتأكيد الموعد يا <strong>{patientName}</strong>.</p>
            <p>الموعد المطلوب: {getDayName(date)} - {formatTime(time)}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()} style={{marginTop: 24}}>
              حجز موعد آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.publicContainer}>
      <div className={styles.publicCard}>
        <div className={styles.publicHeader} style={{ position: 'relative' }}>
          <h1>🦷 عيادة د. محمد تيسير ذبالح</h1>
          <p className="subtitle">طلب حجز موعد جديد</p>
          <a
            href="/login"
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              fontSize: '0.75rem',
              color: 'var(--text-muted, #888)',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #333)',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.target.style.opacity = 1}
            onMouseLeave={e => e.target.style.opacity = 0.6}
          >
            🔐 دخول الطاقم الطبي
          </a>
        </div>

        <form onSubmit={handleSubmit} className={styles.publicForm}>
          
          <div className={styles.formSection}>
            <h3>👤 بيانات المريض</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="patient-name">الاسم الكامل *</label>
                <input id="patient-name" type="text" className="form-input" placeholder="أدخل اسمك الكامل" value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-phone">رقم الهاتف *</label>
                <input id="patient-phone" type="tel" className="form-input" placeholder="07XXXXXXXX" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} dir="ltr" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="patient-age">العمر</label>
                <input id="patient-age" type="number" className="form-input" placeholder="العمر" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} min="1" max="120" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-gender">الجنس</label>
                <select id="patient-gender" className="form-select" value={patientGender} onChange={(e) => setPatientGender(e.target.value)}>
                  <option value="">-- اختر --</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>📅 اختيار الموعد</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="apt-date">تاريخ الموعد *</label>
              <input id="apt-date" type="date" className="form-input" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} min={getToday()} required />
              {date && <small className="text-muted">{getDayName(date)}</small>}
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">الوقت المتاح *</label>
              <div className={styles.timeGrid}>
                {timeSlots.length === 0 ? <p className="text-muted">جاري تحميل الأوقات...</p> : null}
                {timeSlots.map((slot) => {
                  const isBooked = bookedTimes.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`${styles.timeSlot} ${time === slot ? styles.timeSlotSelected : ''} ${isBooked ? styles.timeSlotBooked : ''}`}
                      onClick={() => !isBooked && setTime(slot)}
                      disabled={isBooked}
                    >
                      {formatTime(slot)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" htmlFor="apt-notes" style={{ marginBottom: 0 }}>مما تشكو؟ (اختياري)</label>
                <button
                  type="button"
                  className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                  onClick={handleVoiceInput}
                  title="اضغط للتحدث وإملاء الشكوى صوتياً"
                >
                  {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي'}
                </button>
              </div>
              <textarea id="apt-notes" className="form-textarea" placeholder="صف ألمك أو سبب الزيارة..." value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" />
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 style={{ color: 'var(--primary)' }}>🧬 السيرة الطبية (اختياري)</h3>
            <p className="text-muted" style={{fontSize: 13, marginBottom: 12}}>يُرجى تعبئة هذه المعلومات لضمان سلامتك وتقديم رعاية صحية أفضل.</p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">الأمراض المزمنة (افصل بينها بـ "،")</label>
              <input type="text" className="form-input" placeholder="مثال: ضغط، سكري، ربو..." value={chronicDiseases} onChange={(e) => setChronicDiseases(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">الحساسية (افصل بينها بـ "،")</label>
              <input type="text" className="form-input" placeholder="مثال: بنسلين، حساسية من البنج..." value={allergies} onChange={(e) => setAllergies(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">الأدوية الحالية (افصل بينها بـ "،")</label>
              <input type="text" className="form-input" placeholder="مثال: أسبرين، كورتيزون..." value={medications} onChange={(e) => setMedications(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ملاحظات صحية أخرى</label>
              <textarea className="form-textarea" placeholder="أي عمليات سابقة أو معلومات أخرى..." value={medHistoryNotes} onChange={(e) => setMedHistoryNotes(e.target.value)} rows="2" />
            </div>
          </div>

          {error && <div className={styles.errorBox}>⚠️ {error}</div>}

          <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading || !time}>
            {loading ? <><span className="spinner spinner-sm" /> جاري الإرسال...</> : '✅ إرسال طلب الحجز'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PublicBookingPage() {
  return (
    <Suspense fallback={<div className="loading-spinner"><div className="spinner" /></div>}>
      <PatientBookingForm />
    </Suspense>
  );
}
