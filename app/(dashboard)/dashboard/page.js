'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAppointmentsByDate, getAppointments, getPatients, updateAppointment, shiftRemainingAppointments, updatePatient, getPatient } from '@/lib/firestore';
import { getToday, formatTime, VISIT_TYPES, APPOINTMENT_STATUS, formatDate, getDayName } from '@/lib/utils';
import styles from './dashboard.module.css';


export default function DashboardPage() {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
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
    const schedDate = new Date();
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
      loadData();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تسجيل الحضور.', 'error');
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const today = getToday();
      const [appointments, patients, allAppointments] = await Promise.all([
        getAppointmentsByDate(today),
        getPatients(),
        getAppointments(),
      ]);
      setTodayAppointments(appointments);
      setTotalPatients(patients.length);
      
      // Filter pending requests (status === 'pending') across all dates
      const pending = allAppointments.filter(a => a.status === 'pending');
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRequest(aptId) {
    try {
      await updateAppointment(aptId, { status: 'confirmed' });
      const apt = pendingRequests.find(a => a.id === aptId) || todayAppointments.find(a => a.id === aptId);
      if (apt && apt.patientId) {
        await updatePatient(apt.patientId, { status: 'active' });
      }
      showToast('تم تأكيد الموعد ونقله للجدول الفعلي بنجاح وتفعيل ملف المريض رسمياً.', 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تأكيد الموعد.', 'error');
    }
  }

  async function handleDeclineRequest(aptId) {
    if (confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
      try {
        await updateAppointment(aptId, { status: 'cancelled' });
        const apt = pendingRequests.find(a => a.id === aptId) || todayAppointments.find(a => a.id === aptId);
        if (apt && apt.patientId) {
          const patientData = await getPatient(apt.patientId);
          if (patientData && patientData.status === 'pending_approval') {
            await updatePatient(apt.patientId, { status: 'inactive' });
          }
        }
        showToast('تم إلغاء طلب الموعد.', 'info');
        loadData();
      } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء إلغاء الموعد.', 'error');
      }
    }
  }


  const confirmedToday = todayAppointments.filter(a => a.status === 'confirmed').length;
  const completedToday = todayAppointments.filter(a => a.status === 'completed').length;
  const pendingCount = pendingRequests.length;
  const upcomingAppointments = todayAppointments
    .filter(a => a.status === 'confirmed')
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  const today = new Date();
  const todayStr = today.toLocaleDateString('ar-JO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });


  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>لوحة التحكم</h1>
            <p className="subtitle">{todayStr}</p>
          </div>
        </div>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="skeleton skeleton-card" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>لوحة التحكم</h1>
          <p className="subtitle">{todayStr}</p>
        </div>
        <Link href="/booking" className="btn btn-primary">
          ➕ حجز موعد جديد
        </Link>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={`card ${styles.statCard}`}>
          <div className="card-body">
            <div className={styles.statIcon} style={{ background: 'var(--info-bg)' }}>📅</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{todayAppointments.length}</span>
              <span className={styles.statLabel}>مواعيد اليوم</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className="card-body">
            <div className={styles.statIcon} style={{ background: 'var(--success-bg)' }}>✅</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{completedToday}</span>
              <span className={styles.statLabel}>مكتملة</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className="card-body">
            <div className={styles.statIcon} style={{ background: 'var(--warning-bg)' }}>⏳</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{pendingCount}</span>
              <span className={styles.statLabel}>بانتظار التأكيد</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className="card-body">
            <div className={styles.statIcon} style={{ background: 'var(--purple-bg)' }}>👥</div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{totalPatients}</span>
              <span className={styles.statLabel}>إجمالي المرضى</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div className={styles.contentGrid}>
        {/* Upcoming Appointments */}
        <div className="card">
          <div className="card-header">
            <h3>📋 المواعيد القادمة اليوم</h3>
            <Link href="/appointments" className="btn btn-ghost btn-sm">عرض الكل ←</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {upcomingAppointments.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-icon">🎉</div>
                <h3>لا توجد مواعيد قادمة</h3>
                <p>جدول اليوم فارغ</p>
              </div>
            ) : (
              <div className={styles.appointmentsList}>
                {upcomingAppointments.map((apt) => {
                  const typeInfo = VISIT_TYPES[apt.type] || VISIT_TYPES.checkup;
                  const statusInfo = APPOINTMENT_STATUS[apt.status] || APPOINTMENT_STATUS.pending;
                  return (
                    <div key={apt.id} className={styles.appointmentItem}>
                      <div className={styles.aptTime}>
                        <span className={styles.aptTimeText}>{formatTime(apt.time)}</span>
                      </div>
                      <div className={styles.aptInfo}>
                        <div className={styles.aptName}>{apt.patientName}</div>
                        <div className={styles.aptMeta} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="badge" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                              {typeInfo.icon} {typeInfo.label}
                            </span>
                            <span className="badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                              {statusInfo.label}
                            </span>
                          </div>
                          {(apt.chiefComplaint || apt.notes) && (
                            <span className="text-muted text-xs" style={{ marginTop: 4, display: 'block' }}>
                              📝 الشكوى: {apt.chiefComplaint || apt.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openCheckIn(apt)}
                          title="تسجيل حضور وإزاحة الجدول"
                          style={{ fontSize: 16 }}
                        >
                          ⏰
                        </button>
                        {apt.patientId && (
                          <Link href={`/patients/${apt.patientId}`} className="btn btn-ghost btn-sm" title="ملف المريض">
                            📄
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

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3>⚡ إجراءات سريعة</h3>
          </div>
          <div className="card-body">
            <div className={styles.quickActions}>
              <Link href="/booking" className={styles.quickAction}>
                <span className={styles.qaIcon} style={{ background: 'var(--info-bg)' }}>➕</span>
                <span>حجز موعد جديد</span>
              </Link>
              <Link href="/patients" className={styles.quickAction}>
                <span className={styles.qaIcon} style={{ background: 'var(--success-bg)' }}>👥</span>
                <span>عرض المرضى</span>
              </Link>
              <Link href="/appointments" className={styles.quickAction}>
                <span className={styles.qaIcon} style={{ background: 'var(--warning-bg)' }}>📅</span>
                <span>جدول المواعيد</span>
              </Link>
              <Link href="/reports" className={styles.quickAction}>
                <span className={styles.qaIcon} style={{ background: 'var(--purple-bg)' }}>📊</span>
                <span>التقارير</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className={styles.pendingSection}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                📥 طلبات الحجز المعلقة بانتظار التأكيد ({pendingRequests.length})
              </h3>
              <Link href="/appointments" className="btn btn-ghost btn-sm" style={{ fontSize: '13px' }}>إدارة كافة المواعيد ←</Link>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
              <div className={styles.pendingGrid}>
                {pendingRequests.map((req) => {
                  const typeInfo = VISIT_TYPES[req.type] || VISIT_TYPES.checkup;
                  return (
                    <div key={req.id} className={styles.pendingCard}>
                      <div className={styles.pendingCardHeader}>
                        <span className={styles.pendingPatientName}>
                          {req.patientId ? (
                            <Link href={`/patients/${req.patientId}`} title="عرض الملف الطبي المبدئي والشكوى للمريض">
                              {req.patientName}
                            </Link>
                          ) : (
                            req.patientName
                          )}
                        </span>
                        <span className="badge" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </div>
                      <div className={styles.pendingCardDetails}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📞 <span dir="ltr">{req.patientPhone}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📅 {req.date} (الساعة {formatTime(req.time)})</div>
                        {req.chiefComplaint && (
                          <div className={styles.pendingComplaint}>
                            📝 <em>{req.chiefComplaint}</em>
                          </div>
                        )}
                      </div>
                      <div className={styles.pendingCardActions}>
                        <button className={`btn btn-sm ${styles.btnConfirm}`} onClick={() => handleConfirmRequest(req.id)}>
                          ✓ تأكيد الموعد
                        </button>
                        <button className={`btn btn-sm ${styles.btnDecline}`} onClick={() => handleDeclineRequest(req.id)}>
                          ✕ رفض الطلب
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
