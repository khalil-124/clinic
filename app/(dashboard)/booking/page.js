'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addPatient, addAppointment, searchPatients, getAppointmentsByDate, getSettings, getPatient } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { generateTimeSlots, formatTime, getToday, VISIT_TYPES, getDayName } from '@/lib/utils';
import styles from './booking.module.css';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function BookingForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patient');

  // Patient
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');

  // Appointment
  const [date, setDate] = useState(getToday());
  const [time, setTime] = useState('');
  const [type, setType] = useState('checkup');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState('confirmed');

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    if (!SpeechRecognition) {
      alert('التعرف على الصوت غير مدعوم في هذا المتصفح. يرجى استخدام Google Chrome أو Microsoft Edge.');
      return;
    }

    if (isListening) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-JO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

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
    if (preselectedPatientId) {
      loadPreselectedPatient(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  async function loadPreselectedPatient(patientId) {
    try {
      const p = await getPatient(patientId);
      if (p) {
        selectPatient(p);
      }
    } catch (err) {
      console.error('Error loading preselected patient:', err);
    }
  }

  useEffect(() => {
    if (date && settings) {
      loadBookedTimes(date);
    }
  }, [date, settings]);

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
    setDuration(s.appointmentDuration || 30);
    setTimeSlots(generateTimeSlots(s.workHoursStart || '09:00', s.workHoursEnd || '17:00', s.appointmentDuration || 30));
  }

  async function loadBookedTimes(selectedDate) {
    const appointments = await getAppointmentsByDate(selectedDate);
    const booked = appointments.filter(a => a.status !== 'cancelled');
    setBookedTimes(booked);
  }

  async function handlePatientSearch(value) {
    setPatientSearch(value);
    setSelectedPatient(null);
    if (value.trim().length >= 2) {
      const results = await searchPatients(value.trim());
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setPatientName(patient.name);
    setPatientPhone(patient.phone);
    setPatientAge(patient.age?.toString() || '');
    setPatientGender(patient.gender || '');
    setPatientSearch('');
    setSearchResults([]);
    setIsNewPatient(false);
  }

  function handleNewPatient() {
    setIsNewPatient(true);
    setSelectedPatient(null);
    setPatientName(patientSearch);
    setSearchResults([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!patientName.trim()) {
      setError('الرجاء إدخال اسم المريض');
      return;
    }
    if (!patientPhone.trim()) {
      setError('الرجاء إدخال رقم الهاتف');
      return;
    }
    if (!date) {
      setError('الرجاء اختيار التاريخ');
      return;
    }
    if (!time) {
      setError('الرجاء اختيار الوقت');
      return;
    }

    setLoading(true);
    try {
      let patientId = selectedPatient?.id;

      // Create new patient if needed
      if (!patientId) {
        patientId = await addPatient({
          name: patientName.trim(),
          phone: patientPhone.trim(),
          age: patientAge ? parseInt(patientAge) : null,
          gender: patientGender || null,
          status: status === 'pending' ? 'pending_approval' : 'active',
          medicalHistory: {
            chronicDiseases: [],
            allergies: [],
            currentMedications: [],
            notes: '',
          },
          notes: '',
        });
      }

      // Create appointment
      await addAppointment({
        patientId,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        date,
        time,
        duration,
        type,
        status: status,
        chiefComplaint: notes,
        diagnosis: '',
        treatment: '',
        doctorNotes: '',
        createdBy: user?.uid || '',
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/appointments');
      }, 1500);
    } catch (err) {
      setError('حدث خطأ أثناء الحجز. حاول مرة أخرى.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <div className={styles.successMessage}>
          <div className={styles.successIcon}>✅</div>
          <h2>تم الحجز بنجاح!</h2>
          <p>تم حجز موعد لـ <strong>{patientName}</strong></p>
          <p>{getDayName(date)} - {formatTime(time)}</p>
          <p className="text-muted">جاري التوجيه لصفحة المواعيد...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>➕ حجز موعد جديد</h1>
          <p className="subtitle">أدخل بيانات المريض واختر الموعد المناسب</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.bookingGrid}>
          {/* Patient Section */}
          <div className="card">
            <div className="card-header">
              <h3>👤 بيانات المريض</h3>
            </div>
            <div className="card-body">
              {/* Search existing */}
              {!selectedPatient && !isNewPatient && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">ابحث عن مريض موجود أو أضف جديد</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="اكتب اسم المريض أو رقم الهاتف..."
                    value={patientSearch}
                    onChange={(e) => handlePatientSearch(e.target.value)}
                    id="patient-search"
                  />
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={styles.searchResultItem}
                          onClick={() => selectPatient(p)}
                        >
                          <span className={styles.resultName}>{p.name}</span>
                          <span className={styles.resultPhone}>{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {patientSearch.trim().length >= 2 && searchResults.length === 0 && (
                    <button
                      type="button"
                      className={`btn btn-secondary ${styles.newPatientBtn}`}
                      onClick={handleNewPatient}
                    >
                      ➕ إضافة &quot;{patientSearch}&quot; كمريض جديد
                    </button>
                  )}
                </div>
              )}

              {/* Selected patient info */}
              {selectedPatient && (
                <div className={styles.selectedPatient}>
                  <div className={styles.selectedInfo}>
                    <strong>{selectedPatient.name}</strong>
                    <span>{selectedPatient.phone}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientName('');
                      setPatientPhone('');
                    }}
                  >
                    تغيير
                  </button>
                </div>
              )}

              {/* New patient form */}
              {(isNewPatient || (!selectedPatient && patientSearch.length === 0)) && (
                <div className={styles.patientForm}>
                  {isNewPatient && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setIsNewPatient(false); setPatientName(''); }}
                      style={{ marginBottom: 12 }}
                    >
                      ← البحث عن مريض موجود
                    </button>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="patient-name">الاسم الكامل *</label>
                      <input
                        id="patient-name"
                        type="text"
                        className="form-input"
                        placeholder="أدخل اسم المريض"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="patient-phone">رقم الهاتف *</label>
                      <input
                        id="patient-phone"
                        type="tel"
                        className="form-input"
                        placeholder="07XXXXXXXX"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="patient-age">العمر</label>
                      <input
                        id="patient-age"
                        type="number"
                        className="form-input"
                        placeholder="العمر"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        min="1"
                        max="120"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="patient-gender">الجنس</label>
                      <select
                        id="patient-gender"
                        className="form-select"
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                      >
                        <option value="">-- اختر --</option>
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                      </select>
                    </div>
                  </div>


                </div>
              )}
            </div>
          </div>

          {/* Appointment Section */}
          <div className="card">
            <div className="card-header">
              <h3>📅 بيانات الموعد</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="apt-date">التاريخ *</label>
                  <input
                    id="apt-date"
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setTime(''); }}
                    min={getToday()}
                    required
                  />
                  {date && <small className="text-muted">{getDayName(date)}</small>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="apt-type">نوع الزيارة</label>
                  <select
                    id="apt-type"
                    className="form-select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {Object.entries(VISIT_TYPES).map(([key, val]) => (
                      <option key={key} value={key}>{val.icon} {val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="apt-duration">مدة الموعد (بالدقائق) *</label>
                  <input
                    id="apt-duration"
                    type="number"
                    className="form-input"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                    min="5"
                    max="480"
                    step="5"
                    required
                  />
                </div>
                <div className="form-group">
                  {/* Empty for layout grid alignment */}
                </div>
              </div>


              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">اختر الوقت *</label>
                <div className={styles.timeGrid}>
                  {timeSlots.map((slot) => {
                    const isBooked = bookedTimes.some(appt => {
                      const slotStart = timeToMinutes(slot);
                      const slotDuration = duration || 30;
                      const slotEnd = slotStart + slotDuration;
                      const apptStart = timeToMinutes(appt.time);
                      const apptEnd = apptStart + (parseInt(appt.duration) || 30);
                      return slotStart < apptEnd && apptStart < slotEnd;
                    });
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
                  <label className="form-label" htmlFor="apt-notes" style={{ marginBottom: 0 }}>ملاحظات / الشكوى الرئيسية</label>
                  <button
                    type="button"
                    className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                    onClick={handleVoiceInput}
                    title="اضغط للتحدث وإملاء الشكوى صوتياً"
                  >
                    {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي (بالعربية)'}
                  </button>
                </div>
                <textarea
                  id="apt-notes"
                  className="form-textarea"
                  placeholder="وصف المشكلة أو سبب الزيارة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                />
              </div>


              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" htmlFor="booking-status">حالة تأكيد الحجز *</label>
                <select
                  id="booking-status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="confirmed">🟢 موعد مؤكد ومباشر (من العيادة)</option>
                  <option value="pending">🟡 طلب حجز معلق بانتظار التأكيد (من المريض)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBox}>⚠️ {error}</div>
        )}

        {/* Submit */}
        <div className={styles.submitRow}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner spinner-sm" />
                جاري الحجز...
              </>
            ) : (
              '✅ تأكيد الحجز'
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => router.back()}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="loading-spinner">
        <div className="spinner" />
        <p className="text-muted">جاري تحميل صفحة الحجز...</p>
      </div>
    }>
      <BookingForm />
    </Suspense>
  );
}
