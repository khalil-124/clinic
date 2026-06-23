'use client';

import { useState, useEffect } from 'react';
import { getPatients, getAppointments } from '@/lib/firestore';
import { VISIT_TYPES, APPOINTMENT_STATUS, getMonthName } from '@/lib/utils';
import styles from './reports.module.css';

export default function ReportsPage() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [p, a] = await Promise.all([getPatients(), getAppointments()]);
      setPatients(p);
      setAppointments(a);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === 'completed').length;
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
  const noShowAppointments = appointments.filter(a => a.status === 'no_show').length;
  const completionRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;

  // By type
  const byType = Object.entries(VISIT_TYPES).map(([key, val]) => ({
    key,
    label: val.label,
    icon: val.icon,
    color: val.color,
    count: appointments.filter(a => a.type === key).length,
  }));

  // By status
  const byStatus = Object.entries(APPOINTMENT_STATUS).map(([key, val]) => ({
    key,
    label: val.label,
    color: val.color,
    count: appointments.filter(a => a.status === key).length,
  }));

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h1>📊 التقارير</h1></div></div>
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📊 التقارير</h1>
          <p className="subtitle">نظرة عامة على إحصائيات العيادة</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className={styles.overviewGrid}>
        <div className={`card ${styles.overviewCard}`}>
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div className={styles.overviewValue}>{patients.length}</div>
            <div className={styles.overviewLabel}>إجمالي المرضى</div>
          </div>
        </div>
        <div className={`card ${styles.overviewCard}`}>
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div className={styles.overviewValue}>{totalAppointments}</div>
            <div className={styles.overviewLabel}>إجمالي المواعيد</div>
          </div>
        </div>
        <div className={`card ${styles.overviewCard}`}>
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div className={styles.overviewValue} style={{ color: 'var(--success)' }}>{completionRate}%</div>
            <div className={styles.overviewLabel}>نسبة الإتمام</div>
          </div>
        </div>
        <div className={`card ${styles.overviewCard}`}>
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div className={styles.overviewValue} style={{ color: 'var(--danger)' }}>{noShowAppointments}</div>
            <div className={styles.overviewLabel}>لم يحضر</div>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        {/* By Type */}
        <div className="card">
          <div className="card-header"><h3>📋 حسب نوع الزيارة</h3></div>
          <div className="card-body">
            {byType.map((item) => (
              <div key={item.key} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>{item.icon} {item.label}</span>
                  <span className={styles.barCount}>{item.count}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${totalAppointments > 0 ? (item.count / totalAppointments) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Status */}
        <div className="card">
          <div className="card-header"><h3>📊 حسب الحالة</h3></div>
          <div className="card-body">
            {byStatus.map((item) => (
              <div key={item.key} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>{item.label}</span>
                  <span className={styles.barCount}>{item.count}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${totalAppointments > 0 ? (item.count / totalAppointments) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
