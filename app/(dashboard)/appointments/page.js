'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAppointmentsByDate, getAppointments, updateAppointment, shiftRemainingAppointments, updatePatient, getPatient } from '@/lib/firestore';
import { getToday, formatTime, VISIT_TYPES, APPOINTMENT_STATUS, getDayName, generateTimeSlots, getMonthDays, toDateString, getMonthName } from '@/lib/utils';
import styles from './appointments.module.css';


export default function AppointmentsPage() {
  const [view, setView] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check In Modal States
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [shouldShift, setShouldShift] = useState(true);
  const [toast, setToast] = useState(null);

  function openCheckIn(apt) {
    setSelectedApt(apt);
    const now = new Date();
    const [schedH, schedM] = apt.time.split(':').map(Number);
    const schedDate = new Date(currentDate);
    schedDate.setHours(schedH, schedM, 0, 0);

    let calculatedDelay = 0;
    if (now > schedDate) {
      calculatedDelay = Math.floor((now - schedDate) / (1000 * 60));
      calculatedDelay = Math.round(calculatedDelay / 5) * 5;
    }
    setDelayMinutes(Math.max(0, Math.min(120, calculatedDelay)));
    setShouldShift(calculatedDelay > 0);
    setShowCheckInModal(true);
  }

  async function handleCheckInSubmit() {
    try {
      await updateAppointment(selectedApt.id, {
        status: 'confirmed',
        arrivalTime: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        actualDelay: delayMinutes
      });

      if (shouldShift && delayMinutes > 0) {
        const shiftedCount = await shiftRemainingAppointments(selectedApt.date, selectedApt.time, delayMinutes);
        showToast(`تم تسجيل الحضور وإزاحة ${shiftedCount} موعداً بمقدار ${delayMinutes} دقيقة.`, 'success');
      } else {
        showToast('تم تسجيل حضور المريض بنجاح.', 'success');
      }

      setShowCheckInModal(false);
      loadAppointments();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تسجيل الحضور.', 'error');
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const dateStr = toDateString(currentDate);

  useEffect(() => {
    loadAppointments();
  }, [dateStr]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const [data, allData] = await Promise.all([
        getAppointmentsByDate(dateStr),
        getAppointments()
      ]);
      setAppointments(data);
      const pending = allData.filter(a => a.status === 'pending');
      setPendingRequests(pending);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRequest(aptId) {
    try {
      await updateAppointment(aptId, { status: 'confirmed' });
      const apt = pendingRequests.find(a => a.id === aptId) || appointments.find(a => a.id === aptId);
      if (apt && apt.patientId) {
        await updatePatient(apt.patientId, { status: 'active' });
      }
      showToast('تم تأكيد الموعد ونقله للجدول الفعلي بنجاح وتفعيل ملف المريض رسمياً.', 'success');
      loadAppointments();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تأكيد الموعد.', 'error');
    }
  }

  async function handleDeclineRequest(aptId) {
    if (confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
      try {
        await updateAppointment(aptId, { status: 'cancelled' });
        const apt = pendingRequests.find(a => a.id === aptId) || appointments.find(a => a.id === aptId);
        if (apt && apt.patientId) {
          const patientData = await getPatient(apt.patientId);
          if (patientData && patientData.status === 'pending_approval') {
            await updatePatient(apt.patientId, { status: 'inactive' });
          }
        }
        showToast('تم إلغاء طلب الموعد.', 'info');
        loadAppointments();
      } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء إلغاء الموعد.', 'error');
      }
    }
  }


  function navigateDay(offset) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  }

  function navigateMonth(offset) {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  }

  async function handleStatusChange(aptId, newStatus) {
    await updateAppointment(aptId, { status: newStatus });
    loadAppointments();
  }

  const timeSlots = generateTimeSlots('09:00', '17:00', 30);
  const isToday = dateStr === getToday();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📅 المواعيد</h1>
          <p className="subtitle">
            {view === 'day' && `${getDayName(dateStr)} - ${currentDate.toLocaleDateString('ar-JO', { year: 'numeric', month: 'long', day: 'numeric' })}`}
            {view === 'month' && `${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}`}
          </p>
        </div>
        <div className="flex gap-sm items-center">
          {!isToday && view === 'day' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>
              اليوم
            </button>
          )}
          <Link href="/booking" className="btn btn-primary">
            ➕ حجز جديد
          </Link>
        </div>
      </div>

      {/* View Toggle & Navigation */}
      <div className={styles.toolbar}>
        <div className={styles.navButtons}>
          <button className="btn btn-secondary btn-sm" onClick={() => view === 'day' ? navigateDay(-1) : navigateMonth(-1)}>→</button>
          <button className="btn btn-secondary btn-sm" onClick={() => view === 'day' ? navigateDay(1) : navigateMonth(1)}>←</button>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'day' ? styles.viewBtnActive : ''}`} onClick={() => setView('day')}>يومي</button>
          <button className={`${styles.viewBtn} ${view === 'month' ? styles.viewBtnActive : ''}`} onClick={() => setView('month')}>شهري</button>
        </div>
      </div>

      {/* Day View */}
      {view === 'day' && (
        <div className={styles.appointmentsLayout}>
          <div className={styles.calendarCol}>
            <div className="card">
              {loading ? (
                <div className="card-body">
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-text" style={{ height: 60, marginBottom: 8 }} />)}
                </div>
              ) : (
                <div className={styles.dayGrid}>
                  {timeSlots.map((slot) => {
                    const apt = appointments.find(a => a.time === slot && a.status !== 'cancelled' && a.status !== 'pending');
                    const typeInfo = apt ? (VISIT_TYPES[apt.type] || VISIT_TYPES.checkup) : null;
                    const statusInfo = apt ? (APPOINTMENT_STATUS[apt.status] || APPOINTMENT_STATUS.pending) : null;

                    return (
                      <div key={slot} className={`${styles.timeRow} ${apt ? styles.timeRowBooked : ''}`}>
                        <div className={styles.timeLabel}>{formatTime(slot)}</div>
                        <div className={styles.timeContent}>
                          {apt ? (
                            <div className={styles.aptCard} style={{ borderRightColor: typeInfo.color }}>
                              <div className={styles.aptCardInfo}>
                                <Link href={`/patients/${apt.patientId}`} className={styles.aptCardName}>
                                  {apt.patientName}
                                </Link>
                                <div className={styles.aptCardMeta}>
                                  <span className="badge" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                                    {typeInfo.icon} {typeInfo.label}
                                  </span>
                                  {apt.chiefComplaint && <span className="text-muted text-small">{apt.chiefComplaint}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openCheckIn(apt)}
                                    title="تسجيل حضور وإزاحة المواعيد"
                                    style={{ padding: 4, fontSize: 16 }}
                                  >
                                    ⏰
                                  </button>
                                )}
                                <select
                                  className={styles.aptStatusSelect}
                                  value={apt.status}
                                  onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                                  style={{ color: statusInfo.color, background: statusInfo.bg }}
                                >
                                  {Object.entries(APPOINTMENT_STATUS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : (
                            <Link href={`/booking`} className={styles.emptySlot}>
                              + متاح
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pending requests column */}
          <div className={styles.pendingCol}>
            <div className={styles.pendingRequestsTitle}>
              📥 طلبات الحجز المعلقة ({pendingRequests.length})
            </div>
            {pendingRequests.length === 0 ? (
              <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                لا توجد طلبات حجز معلقة حالياً
              </div>
            ) : (
              pendingRequests.map((req) => {
                const typeInfo = VISIT_TYPES[req.type] || VISIT_TYPES.checkup;
                return (
                  <div key={req.id} className={styles.pendingRequestCard}>
                    <div className={styles.requestPatient}>
                      {req.patientId ? (
                        <Link href={`/patients/${req.patientId}`} title="عرض الملف الطبي المبدئي والشكوى للمريض">
                          {req.patientName}
                        </Link>
                      ) : (
                        req.patientName
                      )}
                    </div>
                    <div className={styles.requestDetails}>
                      <span>📞 {req.patientPhone}</span>
                      <span>📅 {req.date} (ساعة {formatTime(req.time)})</span>
                      <span>🏷️ {typeInfo.icon} {typeInfo.label}</span>
                      {req.chiefComplaint && <span style={{ fontStyle: 'italic' }}>📝 {req.chiefComplaint}</span>}
                    </div>
                    <div className={styles.requestActions} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className={`btn btn-sm ${styles.btnConfirm}`} onClick={() => handleConfirmRequest(req.id)}>
                        ✓ تأكيد
                      </button>
                      <button className={`btn btn-sm ${styles.btnDecline}`} onClick={() => handleDeclineRequest(req.id)}>
                        ✕ رفض
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Month View */}
      {view === 'month' && (
        <div className="card">
          <div className={styles.monthGrid}>
            {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(d => (
              <div key={d} className={styles.monthHeader}>{d}</div>
            ))}
            {getMonthDays(currentDate.getFullYear(), currentDate.getMonth()).map((day, i) => {
              const dayStr = toDateString(day.date);
              const isDayToday = dayStr === getToday();
              return (
                <button
                  key={i}
                  className={`${styles.monthDay} ${!day.isCurrentMonth ? styles.monthDayOther : ''} ${isDayToday ? styles.monthDayToday : ''}`}
                  onClick={() => { setCurrentDate(day.date); setView('day'); }}
                >
                  <span className={styles.dayNumber}>{day.date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <div className="toast-message">{toast.message}</div>
            <span className="toast-close" onClick={() => setToast(null)}>×</span>
          </div>
        </div>
      )}

      {/* Check In Modal */}
      {showCheckInModal && selectedApt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>⏰ تسجيل حضور وإزاحة الموعد</h3>
              <button className="modal-close" onClick={() => setShowCheckInModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                تسجيل حضور المريض <strong>{selectedApt.patientName}</strong> لموعده في الساعة <strong>{formatTime(selectedApt.time)}</strong>.
              </p>
              
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">مقدار تأخير المريض (بالدقائق)</label>
                <input
                  type="number"
                  className="form-input"
                  value={delayMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setDelayMinutes(val);
                    setShouldShift(val > 0);
                  }}
                  min="0"
                  max="120"
                  step="5"
                />
              </div>

              <div className="flex gap-sm" style={{ marginBottom: 20 }}>
                {[5, 10, 15, 20, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setDelayMinutes(mins);
                      setShouldShift(true);
                    }}
                  >
                    {mins} د
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDelayMinutes(0);
                    setShouldShift(false);
                  }}
                >
                  بدون تأخير
                </button>
              </div>

              {delayMinutes > 0 && (
                <div style={{ background: 'var(--warning-bg)', borderRight: '4px solid var(--warning)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16 }}>
                  <label className="flex items-center gap-sm" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={shouldShift}
                      onChange={(e) => setShouldShift(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <span>إزاحة بقية المواعيد المتبقية اليوم تلقائياً بـ {delayMinutes} دقيقة</span>
                  </label>
                  <p className="text-muted text-xs" style={{ marginTop: 6, paddingRight: 22 }}>
                    عند تفعيل هذا الخيار، سيقوم النظام تلقائياً بتأخير جميع مواعيد اليوم المؤكدة والتالية لهذا الموعد لتجنب التداخل.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button className="btn btn-primary" onClick={handleCheckInSubmit}>
                💾 تأكيد وحفظ
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
