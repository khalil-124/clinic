'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getPatients, addPatient } from '@/lib/firestore';
import { formatDate, formatPhone, getRelativeTime } from '@/lib/utils';
import styles from './patients.module.css';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

function PatientsList() {
  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Add Patient Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [listeningField, setListeningField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleVoiceInput = (fieldName, setter) => {
    if (!SpeechRecognition) {
      alert('التعرف على الصوت غير مدعوم في هذا المتصفح. يرجى استخدام Google Chrome أو Microsoft Edge.');
      return;
    }

    if (listeningField) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-JO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListeningField(fieldName);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
      setListeningField(null);
    };

    recognition.onend = () => {
      setListeningField(null);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setter(prev => prev ? prev + '، ' + transcript : transcript);
    };

    recognition.start();
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('الاسم الكامل ورقم الهاتف مطلوبان.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const patientId = await addPatient({
        name: name.trim(),
        phone: phone.trim(),
        age: age ? parseInt(age) : null,
        gender: gender || null,
        status: 'active',
        medicalHistory: {
          chronicDiseases: chronicDiseases ? chronicDiseases.split('،').map(s => s.trim()).filter(Boolean) : [],
          allergies: allergies ? allergies.split('،').map(s => s.trim()).filter(Boolean) : [],
          currentMedications: currentMedications ? currentMedications.split('،').map(s => s.trim()).filter(Boolean) : [],
          notes: healthNotes.trim(),
        },
        notes: '',
      });

      // Reset Form & Close Modal
      setName('');
      setPhone('');
      setAge('');
      setGender('');
      setChronicDiseases('');
      setAllergies('');
      setCurrentMedications('');
      setHealthNotes('');
      setShowAddModal(false);

      // Redirect to the newly created patient profile
      router.push(`/patients/${patientId}`);
    } catch (err) {
      console.error('Error creating patient:', err);
      setError('حدث خطأ أثناء حفظ الملف الطبي للمريض.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const query = searchParams.get('search');
    if (query) setSearchTerm(query);
    loadPatients();
  }, [searchParams]);

  useEffect(() => {
    filterPatients();
  }, [patients, searchTerm, statusFilter]);

  async function loadPatients() {
    try {
      const data = await getPatients();
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterPatients() {
    let result = [...patients];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        p => p.name?.toLowerCase().includes(term) || p.phone?.includes(term)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    } else {
      result = result.filter(p => p.status !== 'pending_approval');
    }

    setFiltered(result);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>👥 المرضى</h1>
          <p className="subtitle">{patients.filter(p => p.status !== 'pending_approval').length} مريض مسجل</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ إنشاء ملف مريض جديد
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="patient-search-input"
          />
        </div>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 150 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          id="status-filter"
        >
          <option value="all">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">
          <div className="card-body">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton skeleton-text" style={{ height: 50, marginBottom: 8 }} />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>{searchTerm ? 'لا توجد نتائج' : 'لا يوجد مرضى'}</h3>
            <p>{searchTerm ? 'جرب كلمة بحث مختلفة' : 'ابدأ بإضافة مريض جديد عبر حجز موعد'}</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>المريض</th>
                  <th>الهاتف</th>
                  <th>العمر</th>
                  <th>تاريخ التسجيل</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                  >
                    <td>
                      <div className={styles.patientCell}>
                        <div className={styles.patientAvatar}>
                          {patient.name?.[0] || '؟'}
                        </div>
                        <span className={styles.patientName}>{patient.name}</span>
                      </div>
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{formatPhone(patient.phone)}</td>
                    <td>{patient.age || '—'}</td>
                    <td>{patient.createdAt ? getRelativeTime(patient.createdAt.toDate ? patient.createdAt.toDate() : patient.createdAt) : '—'}</td>
                    <td>
                      <span className={`badge ${patient.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {patient.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3>➕ إنشاء ملف مريض جديد</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleSavePatient}>
              <div className="modal-body">
                {error && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16 }}>
                    ⚠️ {error}
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="patient-name">الاسم الكامل *</label>
                    <input
                      type="text"
                      id="patient-name"
                      className="form-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="اسم المريض الثلاثي"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="patient-phone">رقم الهاتف *</label>
                    <input
                      type="tel"
                      id="patient-phone"
                      className="form-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="07xxxxxxxx"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="patient-age">العمر</label>
                    <input
                      type="number"
                      id="patient-age"
                      className="form-input"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="مثال: 30"
                      min="1"
                      max="120"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="patient-gender">الجنس</label>
                    <select
                      id="patient-gender"
                      className="form-select"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">اختر الجنس</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>الأمراض المزمنة (افصل بينها بـ "،")</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${listeningField === 'chronic' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleVoiceInput('chronic', setChronicDiseases)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                    >
                      {listeningField === 'chronic' ? '🎙️ جاري الاستماع...' : '🎤 إملاء صوتي'}
                    </button>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={chronicDiseases}
                    onChange={(e) => setChronicDiseases(e.target.value)}
                    placeholder="مثال: ضغط، سكري، ربو"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>الحساسية (افصل بينها بـ "،")</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${listeningField === 'allergies' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleVoiceInput('allergies', setAllergies)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                    >
                      {listeningField === 'allergies' ? '🎙️ جاري الاستماع...' : '🎤 إملاء صوتي'}
                    </button>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="مثال: بنسلين، حساسية من الحليب"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>الأدوية الحالية (افصل بينها بـ "،")</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${listeningField === 'meds' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleVoiceInput('meds', setCurrentMedications)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                    >
                      {listeningField === 'meds' ? '🎙️ جاري الاستماع...' : '🎤 إملاء صوتي'}
                    </button>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentMedications}
                    onChange={(e) => setCurrentMedications(e.target.value)}
                    placeholder="مثال: أسبرين، ريفوتريل"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ملاحظات صحية عامة</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${listeningField === 'notes' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleVoiceInput('notes', setHealthNotes)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                    >
                      {listeningField === 'notes' ? '🎙️ جاري الاستماع...' : '🎤 إملاء صوتي'}
                    </button>
                  </label>
                  <textarea
                    className="form-input"
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    rows="3"
                    placeholder="أية ملاحظات طبية أخرى تهم الطبيب..."
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : '💾 إنشاء الملف وتفعيله'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={saving}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={
      <div className="loading-spinner">
        <div className="spinner" />
        <p className="text-muted">جاري تحميل قائمة المرضى...</p>
      </div>
    }>
      <PatientsList />
    </Suspense>
  );
}

