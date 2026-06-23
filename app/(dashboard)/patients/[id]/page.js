'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatient, updatePatient, getAppointmentsByPatient,
  getTreatmentPlans, addTreatmentPlan, updateTreatmentPlan, deleteTreatmentPlan,
  updateAppointment
} from '@/lib/firestore';
import { formatDate, formatTime, VISIT_TYPES, APPOINTMENT_STATUS, TREATMENT_STATUS, formatPhone, FDI_TEETH } from '@/lib/utils';
import styles from './profile.module.css';
import Odontogram from '@/components/Odontogram';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);


// Helper to classify tooth type based on FDI number
function getToothType(toothNum) {
  const lastDigit = toothNum % 10;
  if (lastDigit === 1 || lastDigit === 2) return 'incisor';
  if (lastDigit === 3) return 'canine';
  if (lastDigit === 4 || lastDigit === 5) return 'premolar';
  return 'molar'; // 6, 7, 8
}

function getToothOffset(toothNum) {
  const lastDigit = toothNum % 10;
  const isUpper = toothNum < 30;
  
  // Shift outer teeth DOWN for upper jaw (to make ∩), and UP for lower jaw (to make ∪)
  // Center teeth stay at 0 to avoid overlapping labels
  const offsetMap = {
    1: 0,
    2: 2,
    3: 5,
    4: 8,
    5: 11,
    6: 14,
    7: 16,
    8: 17
  };
  
  const baseOffset = offsetMap[lastDigit] || 0;
  return isUpper ? baseOffset : -baseOffset;
}

// Helper to get local date (YYYY-MM-DD) and time (HH:mm)
function getLocalNow() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - (offset * 60 * 1000));
  return {
    date: local.toISOString().split('T')[0],
    time: local.toISOString().split('T')[1].substring(0, 5)
  };
}

// Helper to get robust date/time from treatment plan item
function getPlanDateTime(plan) {
  let d = plan.date;
  let t = plan.time;
  if (!d && plan.createdAt) {
    const dateObj = typeof plan.createdAt.toDate === 'function'
      ? plan.createdAt.toDate()
      : new Date(plan.createdAt);
    
    if (!isNaN(dateObj.getTime())) {
      const offset = dateObj.getTimezoneOffset();
      const local = new Date(dateObj.getTime() - (offset * 60 * 1000));
      d = local.toISOString().split('T')[0];
      t = local.toISOString().split('T')[1].substring(0, 5);
    }
  }
  return { date: d, time: t };
}

const RX_TEMPLATES = {
  extraction: {
    label: 'بعد خلع سن - طبيعي (Post-Extraction)',
    items: [
      { medicine: 'Amoxicillin 500mg', dosage: 'كبسولة واحدة (كل 8 ساعات)', frequency: '3 مرات يومياً بعد الطعام', duration: '5 أيام' },
      { medicine: 'Ibuprofen 400mg', dosage: 'حبة بالتناوب مع باراسيتامول 500 ملغ', frequency: 'كل 4 ساعات عند الألم', duration: '3 أيام' },
      { medicine: 'Chlorhexidine 0.12% Mouthwash', dosage: 'مضمضة فم (15 مل) بعد 24 ساعة', frequency: 'مرتين يومياً', duration: '7 أيام' }
    ]
  },
  extraction_pen_allergy: {
    label: 'بعد خلع سن - حساسية بنسلين (Pen-Allergic)',
    items: [
      { medicine: 'Clindamycin 300mg', dosage: 'كبسولة واحدة (كل 8 ساعات)', frequency: '3 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Ibuprofen 400mg', dosage: 'حبة بالتناوب مع باراسيتامول 500 ملغ', frequency: 'كل 4 ساعات عند الألم', duration: '3 أيام' },
      { medicine: 'Chlorhexidine 0.12% Mouthwash', dosage: 'مضمضة فم (15 مل) بعد 24 ساعة', frequency: 'مرتين يومياً', duration: '7 أيام' }
    ]
  },
  root_canal: {
    label: 'علاج عصب (Root Canal Post-Op)',
    items: [
      { medicine: 'Ibuprofen 400mg', dosage: 'حبة بالتناوب مع باراسيتامول 500 ملغ', frequency: 'كل 4 ساعات عند اللزوم (ألم)', duration: '3 أيام' },
      { medicine: 'Paracetamol 500mg', dosage: 'حبة بالتناوب مع إيبوبروفين 400 ملغ', frequency: 'كل 4 ساعات عند اللزوم (ألم)', duration: '3 أيام' }
    ]
  },
  gum_infection: {
    label: 'التهاب لثة حاد / خراج أسنان (Acute Abscess)',
    items: [
      { medicine: 'Amoxicillin 500mg', dosage: 'كبسولة واحدة (كل 8 ساعات)', frequency: '3 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Metronidazole 500mg', dosage: 'حبة واحدة (كل 8 ساعات)', frequency: '3 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Chlorhexidine 0.12% Mouthwash', dosage: 'مضمضة فم (15 مل)', frequency: 'مرتين يومياً', duration: '7 أيام' }
    ]
  },
  pericoronitis: {
    label: 'التهاب حول ضرس العقل (Pericoronitis)',
    items: [
      { medicine: 'Augmentin 1g', dosage: 'حبة واحدة (كل 12 ساعة)', frequency: 'مرتين يومياً بعد الطعام', duration: '5 أيام' },
      { medicine: 'Metronidazole 500mg', dosage: 'حبة واحدة (كل 8 ساعات)', frequency: '3 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Chlorhexidine 0.12% Mouthwash', dosage: 'مضمضة فم (15 مل) دافئة برفق', frequency: '3 مرات يومياً', duration: '5 أيام' }
    ]
  },
  pediatric: {
    label: 'خراج / ألم للأطفال (Pediatric Abscess)',
    items: [
      { medicine: 'Amoxicillin Suspension (250mg/5ml)', dosage: 'حسب الوزن (مثال: 5 مل كل 8 ساعات)', frequency: '3 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Paracetamol Syrup (250mg/5ml)', dosage: 'حسب الوزن واللزوم للألم والحرارة', frequency: 'كل 6 ساعات عند اللزوم', duration: '3 أيام' }
    ]
  },
  oral_fungus: {
    label: 'فطريات الفم / السلاق (Oral Fungus)',
    items: [
      { medicine: 'Nystatin Oral Suspension 100,000 U/ml', dosage: 'مضمضة (5 مل) لثوانٍ ثم بلعها', frequency: '4 مرات يومياً', duration: '7 أيام' },
      { medicine: 'Miconazole Oral Gel (Daktarin)', dosage: 'دهن لثة وغشاء الفم بإصبع نظيف', frequency: '4 مرات يومياً بعد الطعام', duration: '7 أيام' }
    ]
  },
  aphthous_ulcer: {
    label: 'قرح فموية متكررة (Aphthous Ulcers)',
    items: [
      { medicine: 'Triamcinolone Acetonide 0.1% Paste', dosage: 'وضع طبقة رقيقة على القرحة دون فرك', frequency: 'مرتين إلى 3 مرات يومياً قبل النوم', duration: '5 أيام' },
      { medicine: 'Antiseptic / Pain relief Gel (Gengigel)', dosage: 'دهن مباشر لتخفيف الألم وتسريع الالتئام', frequency: '3 مرات يومياً', duration: '5 أيام' }
    ]
  },
  tmj_spasm: {
    label: 'آلام الفك وتشنج العضلات (TMJ/Spasm)',
    items: [
      { medicine: 'Diclofenac Potassium 50mg (Cataflam)', dosage: 'حبة واحدة بعد الطعام مباشرة', frequency: 'مرتين يومياً عند اللزوم (ألم)', duration: '5 أيام' },
      { medicine: 'Muscadol (Muscle relaxant)', dosage: 'حبة واحدة لارتخاء العضلات', frequency: 'مرتين يومياً', duration: '5 أيام' }
    ]
  },
  periodontitis: {
    label: 'التهاب اللثة المزمن وتقليح الأسنان (Periodontitis & Scaling)',
    items: [
      { medicine: 'Chlorhexidine 0.12% Mouthwash', dosage: 'مضمضة فم (15 مل) صباحاً ومساءً', frequency: 'مرتين يومياً بعد تنظيف الأسنان', duration: '10 أيام' },
      { medicine: 'Gengigel Oral Gel', dosage: 'تدليك اللثة المصابة بلطف بأصبع نظيف', frequency: '3 مرات يومياً بعد الأكل', duration: '7 أيام' },
      { medicine: 'Paracetamol 500mg', dosage: 'حبة واحدة عند اللزوم لتسجيل ألم اللثة البسيط', frequency: 'كل 6 إلى 8 ساعات', duration: '3 أيام' }
    ]
  },
  severe_pain: {
    label: 'تسكين الألم الشديد وحماية المعدة (Severe Pain Management)',
    items: [
      { medicine: 'Ibuprofen 600mg', dosage: 'حبة واحدة بعد الوجبة مباشرة (تجنب أخذها على معدة فارغة)', frequency: '3 مرات يومياً عند اللزوم', duration: '3 أيام' },
      { medicine: 'Paracetamol 500mg', dosage: 'حبة واحدة بالتناوب مع إيبوبروفين عند استمرار الألم', frequency: 'كل 4 ساعات بالتبادل مع المسكن الآخر', duration: '3 أيام' },
      { medicine: 'Esomeprazole 20mg (Nexium)', dosage: 'حبة واحدة قبل الفطور بنصف ساعة لحماية المعدة', frequency: 'مرة واحدة يومياً', duration: '5 أيام' }
    ]
  },
  oral_herpes: {
    label: 'الهربس الفموي وقروح البرد (Oral Herpes / Cold Sores)',
    items: [
      { medicine: 'Acyclovir 400mg', dosage: 'حبة واحدة كل 8 ساعات (تجنب تفويت الجرعات)', frequency: '3 مرات يومياً', duration: '7 أيام' },
      { medicine: 'Acyclovir 5% Cream', dosage: 'دهن رقيق للشفاه الخارجية عند الشعور بالوخز', frequency: '5 مرات يومياً', duration: '5 أيام' },
      { medicine: 'Lidocaine 2% Oral Gel', dosage: 'مسكن موضعي لتخفيف ألم القروح المزعجة', frequency: 'قبل تناول الطعام بـ 15 دقيقة وعند الحاجة', duration: '5 أيام' }
    ]
  },
  dry_mouth: {
    label: 'علاج جفاف الفم الشديد (Xerostomia / Dry Mouth)',
    items: [
      { medicine: 'Biotene Dry Mouth Moisturizing Gel', dosage: 'وضع كمية صغيرة على اللسان وتوزيعها داخل الفم', frequency: 'عند النوم وخلال اليوم عند الشعور بالجفاف', duration: 'حسب الحاجة المستمرة' },
      { medicine: 'Artificial Saliva Spray', dosage: 'بخاخ مرطب للفم واللسان لمنع الجفاف وتسهيل البلع', frequency: 'بخ مباشر عند الحاجة وبشكل متكرر', duration: 'مستمر' }
    ]
  },
  prophylaxis: {
    label: 'الوقاية لمرضى القلب قبل الجراحة (Antibiotic Prophylaxis)',
    items: [
      { medicine: 'Amoxicillin 500mg', dosage: '4 كبسولات دفعة واحدة قبل الإجراء بساعة (2 جرام إجمالاً)', frequency: 'جرعة وقائية واحدة فقط قبل موعد طبيب الأسنان بساعة', duration: 'يوم واحد (جرعة منفردة)' }
    ]
  }
};



// Tooth SVG renderer component representing a professional clinical odontogram diagram
function ToothIcon({ type, status, isUpper }) {
  let fill = '#FFFFFF';
  let stroke = '#94A3B8';
  const isMissing = status === 'missing';

  if (status === 'caries') {
    fill = '#FEE2E2';
    stroke = '#EF4444';
  } else if (status === 'filled') {
    fill = '#FEF3C7';
    stroke = '#D97706';
  } else if (status === 'crown') {
    fill = '#DBEAFE';
    stroke = '#3B82F6';
  } else if (status === 'missing') {
    fill = 'transparent';
    stroke = '#CBD5E1';
  }

  // Clinical styles: molars/premolars have division grooves, missing teeth have a red X
  switch (type) {
    case 'molar':
      return (
        <svg viewBox="0 0 32 32" className={styles.toothSvg} style={{ stroke }}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill={fill} strokeWidth="2" strokeDasharray={isMissing ? "3,3" : "none"} />
          {!isMissing && <path d="M16 6 L16 26 M6 16 L26 16" stroke="#E2E8F0" strokeWidth="1.5" />}
          {isMissing && <path d="M6 6 L26 26 M26 6 L6 26" stroke="#94A3B8" strokeWidth="2" opacity="0.6" />}
        </svg>
      );
    case 'premolar':
      return (
        <svg viewBox="0 0 32 32" className={styles.toothSvg} style={{ stroke }}>
          <rect x="4" y="2" width="24" height="28" rx="5" fill={fill} strokeWidth="2" strokeDasharray={isMissing ? "3,3" : "none"} />
          {!isMissing && <path d="M4 16 L28 16" stroke="#E2E8F0" strokeWidth="1.5" />}
          {isMissing && <path d="M6 6 L26 26 M26 6 L6 26" stroke="#94A3B8" strokeWidth="2" opacity="0.6" />}
        </svg>
      );
    case 'canine':
      return (
        <svg viewBox="0 0 32 32" className={styles.toothSvg} style={{ stroke }}>
          <path d="M16 2 L27 10 L27 26 L5 26 L5 10 Z" fill={fill} strokeWidth="2" strokeLinejoin="round" strokeDasharray={isMissing ? "3,3" : "none"} />
          {!isMissing && <path d="M16 2 L16 26" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="2,2" />}
          {isMissing && <path d="M6 6 L26 26 M26 6 L6 26" stroke="#94A3B8" strokeWidth="2" opacity="0.6" />}
        </svg>
      );
    case 'incisor':
    default:
      return (
        <svg viewBox="0 0 32 32" className={styles.toothSvg} style={{ stroke }}>
          <rect x="6" y="2" width="20" height="28" rx="3" fill={fill} strokeWidth="2" strokeDasharray={isMissing ? "3,3" : "none"} />
          {!isMissing && <path d="M6 10 L26 10" stroke="#E2E8F0" strokeWidth="1.5" opacity="0.4" />}
          {isMissing && <path d="M6 6 L26 26 M26 6 L6 26" stroke="#94A3B8" strokeWidth="2" opacity="0.6" />}
        </svg>
      );
  }
}

export default function PatientProfilePage({ params }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visits');
  const [editingMedical, setEditingMedical] = useState(false);
  const [showAddTreatment, setShowAddTreatment] = useState(false);

  // Medical history edit
  const [diseases, setDiseases] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medNotes, setMedNotes] = useState('');

  // Treatment form
  const [treatProcedure, setTreatProcedure] = useState('');
  const [treatTooth, setTreatTooth] = useState('');
  const [treatDiagnosis, setTreatDiagnosis] = useState('');
  const [treatCost, setTreatCost] = useState('');
  const [treatNotes, setTreatNotes] = useState('');
  const [treatDate, setTreatDate] = useState('');
  const [treatTime, setTreatTime] = useState('');
  const [treatSession, setTreatSession] = useState('1');

  // Treatment plan editing
  const [editingPlan, setEditingPlan] = useState(null);
  const [editPlanProcedure, setEditPlanProcedure] = useState('');
  const [editPlanTooth, setEditPlanTooth] = useState('');
  const [editPlanDiagnosis, setEditPlanDiagnosis] = useState('');
  const [editPlanCost, setEditPlanCost] = useState('');
  const [editPlanNotes, setEditPlanNotes] = useState('');
  const [editPlanStatus, setEditPlanStatus] = useState('pending');
  const [editPlanDate, setEditPlanDate] = useState('');
  const [editPlanTime, setEditPlanTime] = useState('');
  const [editPlanSession, setEditPlanSession] = useState('1');

  // Appointment editing
  const [editingAppt, setEditingAppt] = useState(null);
  const [apptDiagnosis, setApptDiagnosis] = useState('');
  const [apptTreatment, setApptTreatment] = useState('');
  const [apptNotes, setApptNotes] = useState('');

  // Tooth interactive chart states
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothStatus, setToothStatus] = useState('normal');
  const [toothNotes, setToothNotes] = useState('');
  const [addToPlan, setAddToPlan] = useState(false);
  const [planProcedure, setPlanProcedure] = useState('');
  const [planCost, setPlanCost] = useState('');

  // Linked treatment steps in visit editing
  const [linkedSteps, setLinkedSteps] = useState({});

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Ledger cost editing states
  const [editingLedgerCostId, setEditingLedgerCostId] = useState(null);
  const [ledgerCostVal, setLedgerCostVal] = useState('');

  // Prescription states
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [rxNotes, setRxNotes] = useState('');
  const [rxItems, setRxItems] = useState([{ medicine: '', dosage: '', frequency: '', duration: '' }]);
  const [activePrintRx, setActivePrintRx] = useState(null);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = (setter, currentValue) => {
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
      setter(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    loadData();
  }, [id]);


  async function loadData() {
    try {
      const [p, apts, plans] = await Promise.all([
        getPatient(id),
        getAppointmentsByPatient(id),
        getTreatmentPlans(id),
      ]);
      if (!p) {
        router.push('/patients');
        return;
      }
      setPatient(p);
      setAppointments(apts);
      setTreatmentPlans(plans);

      const mh = p.medicalHistory || {};
      setDiseases((mh.chronicDiseases || []).join('، '));
      setAllergies((mh.allergies || []).join('، '));
      setMedications((mh.currentMedications || []).join('، '));
      setMedNotes(mh.notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveMedicalHistory() {
    try {
      await updatePatient(id, {
        medicalHistory: {
          chronicDiseases: diseases.split('،').map(s => s.trim()).filter(Boolean),
          allergies: allergies.split('،').map(s => s.trim()).filter(Boolean),
          currentMedications: medications.split('،').map(s => s.trim()).filter(Boolean),
          notes: medNotes,
        },
      });
      setEditingMedical(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddTreatment(e) {
    e.preventDefault();
    try {
      const { date: defaultDate, time: defaultTime } = getLocalNow();
      await addTreatmentPlan(id, {
        procedure: treatProcedure,
        tooth: treatTooth,
        diagnosis: treatDiagnosis,
        estimatedCost: treatCost ? parseFloat(treatCost) : 0,
        notes: treatNotes,
        date: treatDate || defaultDate,
        time: treatTime || defaultTime,
        sessionNumber: parseInt(treatSession) || 1,
        status: 'pending',
      });
      setShowAddTreatment(false);
      setTreatProcedure('');
      setTreatTooth('');
      setTreatDiagnosis('');
      setTreatCost('');
      setTreatNotes('');
      setTreatDate('');
      setTreatTime('');
      setTreatSession('1');
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleTreatmentStatus(planId, currentStatus) {
    const next = currentStatus === 'pending' ? 'in_progress' : currentStatus === 'in_progress' ? 'completed' : 'pending';
    await updateTreatmentPlan(id, planId, { status: next });
    loadData();
  }

  function startEditPlan(plan) {
    setEditingPlan(plan.id);
    setEditPlanProcedure(plan.procedure || '');
    setEditPlanTooth(plan.tooth || '');
    setEditPlanDiagnosis(plan.diagnosis || '');
    setEditPlanCost(plan.estimatedCost || '');
    setEditPlanNotes(plan.notes || '');
    setEditPlanStatus(plan.status || 'pending');
    
    const { date, time } = getPlanDateTime(plan);
    setEditPlanDate(date || '');
    setEditPlanTime(time || '');
    setEditPlanSession((plan.sessionNumber || 1).toString());
  }

  async function savePlanEdit(planId) {
    try {
      await updateTreatmentPlan(id, planId, {
        procedure: editPlanProcedure,
        tooth: editPlanTooth,
        diagnosis: editPlanDiagnosis,
        estimatedCost: editPlanCost ? parseFloat(editPlanCost) : 0,
        notes: editPlanNotes,
        status: editPlanStatus,
        date: editPlanDate,
        time: editPlanTime,
        sessionNumber: parseInt(editPlanSession) || 1,
      });
      setEditingPlan(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeletePlan(planId) {
    if (confirm('هل أنت متأكد من حذف خطوة العلاج هذه؟')) {
      try {
        await deleteTreatmentPlan(id, planId);
        loadData();
      } catch (err) {
        console.error(err);
      }
    }
  }

  function startEditAppt(apt) {
    setEditingAppt(apt.id);
    setApptDiagnosis(apt.diagnosis || '');
    setApptTreatment(apt.treatment || '');
    setApptNotes(apt.doctorNotes || '');
    
    // Initialize linked steps with their current status
    const stepStatuses = {};
    treatmentPlans.forEach(plan => {
      stepStatuses[plan.id] = plan.status;
    });
    setLinkedSteps(stepStatuses);
  }

  async function saveApptEdit(aptId) {
    await updateAppointment(aptId, {
      diagnosis: apptDiagnosis,
      treatment: apptTreatment,
      doctorNotes: apptNotes,
    });
    
    // Update any linked treatment steps whose status changed
    const updatePromises = Object.entries(linkedSteps).map(([planId, status]) => {
      const original = treatmentPlans.find(p => p.id === planId);
      if (original && original.status !== status) {
        return updateTreatmentPlan(id, planId, { status });
      }
      return null;
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    setEditingAppt(null);
    loadData();
  }

  function openToothDetails(toothNumber) {
    const chart = patient.dentalChart || {};
    const toothData = chart[toothNumber] || { status: 'normal', notes: '' };
    setSelectedTooth(toothNumber);
    setToothStatus(toothData.status || 'normal');
    setToothNotes(toothData.notes || '');
    setAddToPlan(false);
    setPlanProcedure('');
    setPlanCost('');
  }

  async function saveToothDetails() {
    try {
      const chart = patient.dentalChart || {};
      const updatedChart = {
        ...chart,
        [selectedTooth]: { status: toothStatus, notes: toothNotes }
      };
      
      await updatePatient(id, { dentalChart: updatedChart });

      if (addToPlan && planProcedure.trim()) {
        const { date, time } = getLocalNow();
        await addTreatmentPlan(id, {
          procedure: planProcedure.trim(),
          tooth: selectedTooth.toString(),
          diagnosis: toothNotes,
          estimatedCost: planCost ? parseFloat(planCost) : 0,
          notes: 'مضاف تلقائياً من مخطط الأسنان',
          date,
          time,
          status: 'pending'
        });
      }

      setSelectedTooth(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpdateLedgerCost(planId, newCost) {
    try {
      await updateTreatmentPlan(id, planId, {
        estimatedCost: parseFloat(newCost) || 0
      });
      setEditingLedgerCostId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  function openAddTreatment() {
    const { date, time } = getLocalNow();
    setTreatDate(date);
    setTreatTime(time);
    setShowAddTreatment(true);
  }

  async function updateApptStatus(aptId, status) {
    await updateAppointment(aptId, { status });
    loadData();
  }

  function openPaymentModal() {
    setPaymentAmount('');
    setPaymentDate(getLocalNow().date);
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    try {
      const amt = parseFloat(paymentAmount);
      if (isNaN(amt) || amt <= 0) return;
      
      const currentPayments = patient.payments || [];
      const newPayment = {
        id: 'pay_' + Date.now(),
        amount: amt,
        date: paymentDate || getLocalNow().date,
        method: paymentMethod,
        notes: paymentNotes
      };
      const updatedPayments = [...currentPayments, newPayment];
      
      await updatePatient(id, { payments: updatedPayments });
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeletePayment(paymentId) {
    if (confirm('هل أنت متأكد من حذف هذه الدفعة المالية؟')) {
      try {
        const currentPayments = patient.payments || [];
        const updatedPayments = currentPayments.filter(p => p.id !== paymentId);
        await updatePatient(id, { payments: updatedPayments });
        loadData();
      } catch (err) {
        console.error(err);
      }
    }
  }

  const financialTotals = useMemo(() => {
    const totalEstimated = treatmentPlans.reduce((sum, p) => sum + (p.estimatedCost || 0), 0);
    const totalInvoiced = treatmentPlans
      .filter(p => p.status === 'in_progress' || p.status === 'completed')
      .reduce((sum, p) => sum + (p.estimatedCost || 0), 0);
    const totalPaid = (patient?.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = totalInvoiced - totalPaid;
    return {
      totalEstimated,
      totalInvoiced,
      totalPaid,
      remainingBalance
    };
  }, [treatmentPlans, patient?.payments]);

  function openPrescriptionModal() {
    setRxNotes('');
    setRxItems([{ medicine: '', dosage: '', frequency: '', duration: '' }]);
    setShowPrescriptionModal(true);
  }

  function applyRxTemplate(templateKey) {
    const template = RX_TEMPLATES[templateKey];
    if (template) {
      setRxItems(template.items.map(item => ({ ...item })));
    }
  }

  function handleAddRxItem() {
    setRxItems([...rxItems, { medicine: '', dosage: '', frequency: '', duration: '' }]);
  }

  function handleRemoveRxItem(index) {
    setRxItems(rxItems.filter((_, i) => i !== index));
  }

  function handleRxItemChange(index, field, value) {
    const updated = [...rxItems];
    updated[index][field] = value;
    setRxItems(updated);
  }

  async function handleSavePrescription(e) {
    e.preventDefault();
    try {
      const itemsToSave = rxItems.filter(item => item.medicine.trim());
      if (itemsToSave.length === 0) return;
      
      const currentRxs = patient.prescriptions || [];
      const newRx = {
        id: 'rx_' + Date.now(),
        date: getLocalNow().date,
        time: getLocalNow().time,
        items: itemsToSave,
        notes: rxNotes
      };
      const updatedRxs = [newRx, ...currentRxs];
      
      await updatePatient(id, { prescriptions: updatedRxs });
      setShowPrescriptionModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeletePrescription(rxId) {
    if (confirm('هل أنت متأكد من حذف هذه الوصفة الطبية؟')) {
      try {
        const currentRxs = patient.prescriptions || [];
        const updatedRxs = currentRxs.filter(r => r.id !== rxId);
        await updatePatient(id, { prescriptions: updatedRxs });
        loadData();
      } catch (err) {
        console.error(err);
      }
    }
  }

  const groupedPlans = useMemo(() => {
    const groups = {};
    treatmentPlans.forEach(plan => {
      const sNum = plan.sessionNumber || 1;
      if (!groups[sNum]) groups[sNum] = [];
      groups[sNum].push(plan);
    });
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map(sNum => ({
        sessionNumber: sNum,
        plans: groups[sNum]
      }));
  }, [treatmentPlans]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p className="text-muted">جاري تحميل ملف المريض...</p>
      </div>
    );
  }

  if (!patient) return null;

  const mh = patient.medicalHistory || {};

  return (
    <div>
      {/* Pending Approval Banner */}
      {patient.status === 'pending_approval' && (
        <div style={{
          background: 'var(--warning-bg)',
          borderRight: '5px solid var(--warning)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <h4 style={{ color: 'var(--warning-dark)', fontWeight: 700, marginBottom: 4, fontSize: '15px' }}>
              ⏳ ملف مريض معلق بانتظار التأكيد (تسجيل ذاتي)
            </h4>
            <p className="text-muted text-xs" style={{ margin: 0 }}>
              قام هذا المريض بتعبئة بياناته وحجز موعد معلق. يمكنك مراجعة حالته الصحية وسيرته الطبية أدناه قبل تفعيل ملفه رسمياً.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={async () => {
                const pendingApt = appointments.find(a => a.status === 'pending');
                if (pendingApt) {
                  await updateAppointment(pendingApt.id, { status: 'confirmed' });
                }
                await updatePatient(id, { status: 'active' });
                alert('تم تفعيل ملف المريض رسمياً وتأكيد الموعد.');
                loadData();
              }}
            >
              ✓ تأكيد وتفعيل الملف
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (confirm('هل أنت متأكد من رفض هذا الطلب وإلغاء تسجيل المريض؟')) {
                  const pendingApt = appointments.find(a => a.status === 'pending');
                  if (pendingApt) {
                    await updateAppointment(pendingApt.id, { status: 'cancelled' });
                  }
                  await updatePatient(id, { status: 'inactive' });
                  alert('تم رفض الطلب وإلغاء تفعيل الملف.');
                  router.push('/dashboard');
                }
              }}
            >
              ✕ رفض وإلغاء
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          <div className={styles.profileAvatar}>
            {patient.name?.[0] || '؟'}
          </div>
          <div>
            <h1 className={styles.profileName}>{patient.name}</h1>
            <div className={styles.profileMeta}>
              <span>📱 {formatPhone(patient.phone)}</span>
              {patient.age && <span>🎂 {patient.age} سنة</span>}
              {patient.gender && <span>{patient.gender === 'male' ? '👨' : '👩'} {patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span>}
              <span className={`badge ${patient.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                {patient.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.profileActions}>
          <Link href={`/booking?patient=${id}`} className="btn btn-primary">
            ➕ حجز موعد
          </Link>
        </div>
      </div>

      {/* Medical History Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>🏥 التاريخ الطبي</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setEditingMedical(!editingMedical)}
          >
            {editingMedical ? 'إلغاء' : '✏️ تعديل'}
          </button>
        </div>
        <div className="card-body">
          {editingMedical ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">أمراض مزمنة (مفصولة بفاصلة)</label>
                <input className="form-input" value={diseases} onChange={e => setDiseases(e.target.value)} placeholder="سكري، ضغط..." />
              </div>
              <div className="form-group">
                <label className="form-label">حساسية أدوية</label>
                <input className="form-input" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="بنسلين..." />
              </div>
              <div className="form-group">
                <label className="form-label">أدوية حالية</label>
                <input className="form-input" value={medications} onChange={e => setMedications(e.target.value)} placeholder="ميتفورمين..." />
              </div>
              <div className="form-group">
                <label className="form-label">ملاحظات طبية</label>
                <textarea className="form-textarea" value={medNotes} onChange={e => setMedNotes(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={saveMedicalHistory}>💾 حفظ</button>
            </div>
          ) : (
            <div className={styles.medicalGrid}>
              <div className={styles.medItem}>
                <span className={styles.medLabel}>أمراض مزمنة</span>
                <span className={styles.medValue}>
                  {mh.chronicDiseases?.length > 0 ? mh.chronicDiseases.join('، ') : 'لا يوجد'}
                </span>
              </div>
              <div className={styles.medItem}>
                <span className={styles.medLabel}>حساسية</span>
                <span className={styles.medValue} style={{ color: mh.allergies?.length > 0 ? 'var(--danger)' : undefined }}>
                  {mh.allergies?.length > 0 ? mh.allergies.join('، ') : 'لا يوجد'}
                </span>
              </div>
              <div className={styles.medItem}>
                <span className={styles.medLabel}>أدوية حالية</span>
                <span className={styles.medValue}>
                  {mh.currentMedications?.length > 0 ? mh.currentMedications.join('، ') : 'لا يوجد'}
                </span>
              </div>
              {mh.notes && (
                <div className={styles.medItem} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.medLabel}>ملاحظات</span>
                  <span className={styles.medValue}>{mh.notes}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Dental Chart Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>🦷 مخطط الأسنان التفاعلي (FDI Notation)</h3>
          <span className="text-muted text-xs">اضغط على السن لتعديل حالته وإضافته لخطة العلاج</span>
        </div>
        <div className="card-body">
          <div className={styles.chartContainer} style={{ flexDirection: 'column', alignItems: 'center' }}>
            <Odontogram
              dentalChart={patient.dentalChart || {}}
              onToothClick={openToothDetails}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'visits' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('visits')}
        >
          📋 سجل الزيارات ({appointments.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'treatment' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('treatment')}
        >
          🦷 خطة العلاج ({treatmentPlans.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'financial' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('financial')}
        >
          💰 السجل المالي
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'prescriptions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          💊 الوصفات الطبية ({patient.prescriptions?.length || 0})
        </button>
      </div>

      {/* Visits Tab */}
      {activeTab === 'visits' && (
        <div className={styles.timeline}>
          {appointments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>لا توجد زيارات</h3>
                <p>لم يتم تسجيل أي زيارة لهذا المريض بعد</p>
              </div>
            </div>
          ) : (
            appointments.map((apt) => {
              const typeInfo = VISIT_TYPES[apt.type] || VISIT_TYPES.checkup;
              const statusInfo = APPOINTMENT_STATUS[apt.status] || APPOINTMENT_STATUS.pending;
              const isEditing = editingAppt === apt.id;
              return (
                <div key={apt.id} className={`card ${styles.visitCard}`}>
                  <div className={styles.visitHeader}>
                    <div className={styles.visitDate}>
                      <span className={styles.visitDateText}>{formatDate(apt.date)}</span>
                      <span className={styles.visitTime}>{formatTime(apt.time)}</span>
                    </div>
                    <div className={styles.visitBadges}>
                      <span className="badge" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <select
                        className={styles.statusSelect}
                        value={apt.status}
                        onChange={(e) => updateApptStatus(apt.id, e.target.value)}
                        style={{ color: statusInfo.color, background: statusInfo.bg }}
                      >
                        {Object.entries(APPOINTMENT_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.visitBody}>
                    {(apt.chiefComplaint || apt.notes) && (
                      <div className={styles.visitField}>
                        <span className={styles.fieldLabel}>الشكوى:</span>
                        <span>{apt.chiefComplaint || apt.notes}</span>
                      </div>
                    )}
                    {isEditing ? (
                      <div className={styles.editForm}>
                        <div className="form-group">
                          <label className="form-label">التشخيص</label>
                          <input className="form-input" value={apptDiagnosis} onChange={e => setApptDiagnosis(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">العلاج</label>
                          <input className="form-input" value={apptTreatment} onChange={e => setApptTreatment(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">ملاحظات الدكتور</label>
                          <textarea className="form-textarea" value={apptNotes} onChange={e => setApptNotes(e.target.value)} />
                        </div>
                        
                        {treatmentPlans.length > 0 && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>📌 ربط وتحديث خطوات العلاج في هذه الجلسة</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {treatmentPlans.map((plan) => (
                                <div key={plan.id} className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-sm)' }}>
                                  <span>
                                    {plan.procedure} {plan.tooth && `(سن ${plan.tooth})`}
                                  </span>
                                  <select
                                    className="form-select"
                                    style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                                    value={linkedSteps[plan.id] || plan.status}
                                    onChange={(e) => {
                                      setLinkedSteps({
                                        ...linkedSteps,
                                        [plan.id]: e.target.value
                                      });
                                    }}
                                  >
                                    <option value="pending">لم يبدأ</option>
                                    <option value="in_progress">قيد التنفيذ</option>
                                    <option value="completed">مكتمل ✓</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveApptEdit(apt.id)}>💾 حفظ</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingAppt(null)}>إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {apt.diagnosis && (
                          <div className={styles.visitField}>
                            <span className={styles.fieldLabel}>التشخيص:</span>
                            <span>{apt.diagnosis}</span>
                          </div>
                        )}
                        {apt.treatment && (
                          <div className={styles.visitField}>
                            <span className={styles.fieldLabel}>العلاج:</span>
                            <span>{apt.treatment}</span>
                          </div>
                        )}
                        {apt.doctorNotes && (
                          <div className={styles.visitField}>
                            <span className={styles.fieldLabel}>ملاحظات الدكتور:</span>
                            <span>{apt.doctorNotes}</span>
                          </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => startEditAppt(apt)}>
                          ✏️ إضافة / تعديل ملاحظات
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Treatment Plan Tab */}
      {activeTab === 'treatment' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={openAddTreatment}>
              ➕ إضافة خطوة علاج جديدة
            </button>
          </div>

          {showAddTreatment && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <form onSubmit={handleAddTreatment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">الإجراء / الخطوة *</label>
                      <input className="form-input" value={treatProcedure} onChange={e => setTreatProcedure(e.target.value)} placeholder="حشوة، سحب عصب، تلبيسة..." required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">رقم السن / الضرس</label>
                      <input className="form-input" value={treatTooth} onChange={e => setTreatTooth(e.target.value)} placeholder="مثلاً: 16، 46" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">التشخيص / وصف المشكلة</label>
                    <input className="form-input" value={treatDiagnosis} onChange={e => setTreatDiagnosis(e.target.value)} placeholder="تسوس عميق، التهاب عصب..." />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">رقم الجلسة العلاجية *</label>
                      <input type="number" min="1" className="form-input" value={treatSession} onChange={e => setTreatSession(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">التكلفة التقديرية (دينار)</label>
                      <input className="form-input" type="number" value={treatCost} onChange={e => setTreatCost(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">تاريخ الإجراء / الخطوة *</label>
                      <input type="date" className="form-input" value={treatDate} onChange={e => setTreatDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">وقت الإجراء / الخطوة *</label>
                      <input type="time" className="form-input" value={treatTime} onChange={e => setTreatTime(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>ملاحظات الخطوة</label>
                      <button
                        type="button"
                        className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                        onClick={() => handleVoiceInput(setTreatNotes, treatNotes)}
                        title="اضغط للتحدث وإملاء الملاحظات صوتياً"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي'}
                      </button>
                    </div>
                    <textarea className="form-textarea" value={treatNotes} onChange={e => setTreatNotes(e.target.value)} rows="2" placeholder="تفاصيل إضافية للخطوة..." />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">إضافة الخطوة</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddTreatment(false)}>إلغاء</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {treatmentPlans.length === 0 && !showAddTreatment ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🦷</div>
                <h3>لا توجد خطة علاج</h3>
                <p>أضف خطوات أو إجراءات العلاج المطلوبة لهذا المريض</p>
              </div>
            </div>
          ) : (
            <div className={styles.groupedList}>
              {groupedPlans.map((group) => (
                <div key={group.sessionNumber} className={styles.sessionGroup} style={{ marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontSize: '15px', fontWeight: 'bold' }}>
                    <span>📅 الجلسة العلاجية {group.sessionNumber}</span>
                  </h4>
                  <div className={styles.treatmentList} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.plans.map((plan) => {
                      const statusInfo = TREATMENT_STATUS[plan.status] || TREATMENT_STATUS.pending;
                      const isEditingThis = editingPlan === plan.id;

                      if (isEditingThis) {
                        return (
                          <div key={plan.id} className="card" style={{ marginBottom: 8, border: '1.5px solid var(--primary)' }}>
                            <div className="card-body" style={{ padding: 20 }}>
                              <form onSubmit={(e) => { e.preventDefault(); savePlanEdit(plan.id); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label className="form-label">الإجراء / الخطوة *</label>
                                    <input className="form-input" value={editPlanProcedure} onChange={e => setEditPlanProcedure(e.target.value)} required />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">رقم السن / الضرس</label>
                                    <input className="form-input" value={editPlanTooth} onChange={e => setEditPlanTooth(e.target.value)} />
                                  </div>
                                </div>
                                <div className="form-group">
                                  <label className="form-label">التشخيص / وصف المشكلة</label>
                                  <input className="form-input" value={editPlanDiagnosis} onChange={e => setEditPlanDiagnosis(e.target.value)} />
                                </div>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label className="form-label">رقم الجلسة العلاجية *</label>
                                    <input type="number" min="1" className="form-input" value={editPlanSession} onChange={e => setEditPlanSession(e.target.value)} required />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">التكلفة التقديرية (دينار)</label>
                                    <input className="form-input" type="number" value={editPlanCost} onChange={e => setEditPlanCost(e.target.value)} />
                                  </div>
                                </div>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label className="form-label">الحالة</label>
                                    <select className="form-select" value={editPlanStatus} onChange={e => setEditPlanStatus(e.target.value)}>
                                      {Object.entries(TREATMENT_STATUS).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                      <label className="form-label" style={{ marginBottom: 0 }}>ملاحظات الخطوة</label>
                                      <button
                                        type="button"
                                        className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                                        onClick={() => handleVoiceInput(setEditPlanNotes, editPlanNotes)}
                                        title="اضغط للتحدث وإملاء الملاحظات صوتياً"
                                        style={{ padding: '3px 8px', fontSize: '11px' }}
                                      >
                                        {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي'}
                                      </button>
                                    </div>
                                    <input className="form-input" value={editPlanNotes} onChange={e => setEditPlanNotes(e.target.value)} />
                                  </div>
                                </div>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label className="form-label">تاريخ الإجراء / الخطوة *</label>
                                    <input type="date" className="form-input" value={editPlanDate} onChange={e => setEditPlanDate(e.target.value)} required />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">وقت الإجراء / الخطوة *</label>
                                    <input type="time" className="form-input" value={editPlanTime} onChange={e => setEditPlanTime(e.target.value)} required />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="submit" className="btn btn-primary btn-sm">💾 حفظ التعديل</button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingPlan(null)}>إلغاء</button>
                                  </div>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeletePlan(plan.id)}>🗑️ حذف الخطوة</button>
                                </div>
                              </form>
                            </div>
                          </div>
                        );
                      }

                      const { date: planD, time: planT } = getPlanDateTime(plan);

                      return (
                        <div key={plan.id} className={`card ${styles.treatmentCard}`}>
                          <div className={styles.treatmentBody}>
                            <button
                              className={styles.treatmentCheck}
                              style={{ borderColor: statusInfo.color, background: plan.status === 'completed' ? statusInfo.color : 'transparent' }}
                              onClick={() => toggleTreatmentStatus(plan.id, plan.status)}
                              title="تغيير الحالة"
                            >
                              {plan.status === 'completed' ? '✓' : plan.status === 'in_progress' ? '◐' : ''}
                            </button>
                            <div className={styles.treatmentInfo}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div className={styles.treatmentName} style={{ textDecoration: plan.status === 'completed' ? 'line-through' : 'none' }}>
                                  {plan.procedure}
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => startEditPlan(plan)} style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}>
                                  ✏️ تعديل الخطوة
                                </button>
                              </div>
                              <div className={styles.treatmentMeta}>
                                {planD && <span>📅 {formatDate(planD)}</span>}
                                {planT && <span>⏰ {formatTime(planT)}</span>}
                                {plan.tooth && <span>🦷 سن: {plan.tooth}</span>}
                                {plan.diagnosis && <span>🔍 المشكلة: {plan.diagnosis}</span>}
                                {plan.estimatedCost > 0 && <span>💰 {plan.estimatedCost} دينار</span>}
                                <span className="badge" style={{ background: statusInfo.color + '20', color: statusInfo.color }}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              {plan.notes && <p className="text-muted text-small" style={{ marginTop: 8 }}>📝 {plan.notes}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && (
        <div>
          {/* Summary Cards */}
          <div className={styles.financialStats}>
            <div className={`${styles.statCard} ${styles.statEstimated}`}>
              <span className={styles.statLabel}>إجمالي التكلفة التقديرية</span>
              <span className={styles.statVal}>{financialTotals.totalEstimated} دينار</span>
              <span className={styles.statDesc}>لكامل خطة العلاج المقترحة</span>
            </div>
            <div className={`${styles.statCard} ${styles.statInvoiced}`}>
              <span className={styles.statLabel}>المبلغ المستحق الفعلي</span>
              <span className={styles.statVal}>{financialTotals.totalInvoiced} دينار</span>
              <span className={styles.statDesc}>للخطوات قيد التنفيذ أو المكتملة</span>
            </div>
            <div className={`${styles.statCard} ${styles.statPaid}`}>
              <span className={styles.statLabel}>إجمالي المدفوعات</span>
              <span className={styles.statVal}>{financialTotals.totalPaid} دينار</span>
              <span className={styles.statDesc}>المبالغ التي تم تحصيلها</span>
            </div>
            <div className={`${styles.statCard} ${financialTotals.remainingBalance > 0 ? styles.statDebt : styles.statBalanced}`}>
              <span className={styles.statLabel}>الرصيد المتبقي</span>
              <span className={styles.statVal}>
                {financialTotals.remainingBalance} دينار
              </span>
              <span className={styles.statDesc}>
                {financialTotals.remainingBalance > 0 ? 'مبالغ مستحقة على المريض' : 'الحساب متوازن / رصيد إيجابي'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24 }}>
            <h3>💵 سجل المعاملات المالية والدفعات</h3>
            <button className="btn btn-primary" onClick={openPaymentModal}>
              ➕ تسجيل دفعة مالية جديدة
            </button>
          </div>

          {(!patient.payments || patient.payments.length === 0) ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">💵</div>
                <h3>لا توجد دفعات مالية</h3>
                <p>لم يتم تسجيل أي دفعات مالية لهذا المريض حتى الآن</p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>تاريخ الدفعة</th>
                    <th>المبلغ (دينار)</th>
                    <th>طريقة الدفع</th>
                    <th>ملاحظات</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.payments.map((pay) => (
                    <tr key={pay.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(pay.date)}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 700 }}>{pay.amount} دينار</td>
                      <td>
                        <span className={`badge ${pay.method === 'cash' ? 'badge-primary' : pay.method === 'card' ? 'badge-purple' : 'badge-info'}`}>
                          {pay.method === 'cash' ? '💵 نقدي' : pay.method === 'card' ? '💳 بطاقة' : '🏦 تحويل بنكي'}
                        </span>
                      </td>
                      <td>{pay.notes || '-'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePayment(pay.id)} style={{ color: 'var(--danger)' }}>
                          🗑️ حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}


          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 32 }}>
            <h3>📋 بنود خطة العلاج والرسوم المترتبة</h3>
          </div>

          {treatmentPlans.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🦷</div>
                <h3>لا توجد بنود علاجية</h3>
                <p>لم يتم إضافة أي إجراءات علاجية لخطة المريض بعد</p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>الإجراء العلاجي</th>
                    <th>السن</th>
                    <th>الحالة</th>
                    <th>التكلفة (دينار)</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {treatmentPlans.map((plan) => {
                    const isEditingCost = editingLedgerCostId === plan.id;
                    const statusLabel = plan.status === 'completed' ? '🟢 مكتمل' : plan.status === 'in_progress' ? '🔵 قيد التنفيذ' : '🟡 لم يبدأ';
                    return (
                      <tr key={plan.id}>
                        <td style={{ fontWeight: 600 }}>{plan.procedure}</td>
                        <td>{plan.tooth ? `سن ${plan.tooth}` : '-'}</td>
                        <td>{statusLabel}</td>
                        <td>
                          {isEditingCost ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                style={{ width: 80, padding: '4px 8px', fontSize: '13px' }}
                                value={ledgerCostVal}
                                onChange={(e) => setLedgerCostVal(e.target.value)}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleUpdateLedgerCost(plan.id, ledgerCostVal)}
                              >
                                حفظ
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => setEditingLedgerCostId(null)}
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700 }}>{plan.estimatedCost || 0} دينار</span>
                          )}
                        </td>
                        <td>
                          {!isEditingCost && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--primary)' }}
                              onClick={() => {
                                setEditingLedgerCostId(plan.id);
                                setLedgerCostVal((plan.estimatedCost || 0).toString());
                              }}
                            >
                              ✏️ تعديل السعر
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prescriptions Tab */}
      {activeTab === 'prescriptions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>💊 الوصفات الطبية الصادرة للعدوى والخلع ومسكنات الألم</h3>
            <button className="btn btn-primary" onClick={openPrescriptionModal}>
              ➕ إصدار وصفة طبية جديدة
            </button>
          </div>

          {(!patient.prescriptions || patient.prescriptions.length === 0) ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">💊</div>
                <h3>لا توجد وصفات طبية</h3>
                <p>لم يتم تحرير أي روشتة علاجية لهذا المريض بعد</p>
              </div>
            </div>
          ) : (
            <div className={styles.prescriptionsList} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {patient.prescriptions.map((rx) => (
                <div key={rx.id} className="card">
                  <div className="card-header" style={{ padding: '16px 20px', background: 'var(--bg-hover)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <div>
                        <h4 style={{ fontWeight: 700 }}>روشتة علاجية</h4>
                        <span className="text-muted text-xs">📅 {formatDate(rx.date)} - ⏰ {formatTime(rx.time)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActivePrintRx(rx)}>
                        🖨️ طباعة ومعاينة
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePrescription(rx.id)} style={{ color: 'var(--danger)' }}>
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: 20 }}>
                    <table className={styles.prescriptionTable} style={{ width: '100%', marginBottom: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>اسم الدواء</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>الجرعة</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>التكرار</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>المدة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rx.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--primary)' }}>{item.medicine}</td>
                            <td style={{ padding: '10px 12px' }}>{item.dosage}</td>
                            <td style={{ padding: '10px 12px' }}>{item.frequency}</td>
                            <td style={{ padding: '10px 12px' }}>{item.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rx.notes && (
                      <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 'var(--font-size-sm)' }}>
                        <strong>📝 تعليمات إضافية للمريض:</strong> {rx.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Tooth details modal */}
      {selectedTooth && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>🦷 تفاصيل السن / الضرس {selectedTooth}</h3>
              <button className="modal-close" onClick={() => setSelectedTooth(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">حالة السن</label>
                <select className="form-select" value={toothStatus} onChange={(e) => setToothStatus(e.target.value)}>
                  <option value="normal">سليم / طبيعي</option>
                  <option value="caries">تسوس / بحاجة لعلاج</option>
                  <option value="filled">حشوة معالجة</option>
                  <option value="crown">تلبيسة / جسر</option>
                  <option value="missing">مفقود / مخلوع</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>التشخيص / ملاحظات السن</label>
                  <button
                    type="button"
                    className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                    onClick={() => handleVoiceInput(setToothNotes, toothNotes)}
                    title="اضغط للتحدث وإملاء الملاحظات صوتياً"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي'}
                  </button>
                </div>
                <textarea 
                  className="form-textarea" 
                  value={toothNotes} 
                  onChange={(e) => setToothNotes(e.target.value)}
                  placeholder="مثال: تسوس عميق جهة الإطباق، بحاجة لسحب عصب..."
                  rows="3"
                />
              </div>

              {/* Add to treatment plan checkbox */}
              {toothStatus !== 'normal' && (
                <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16 }}>
                  <label className="flex items-center gap-sm" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={addToPlan}
                      onChange={(e) => {
                        setAddToPlan(e.target.checked);
                        if (e.target.checked && !planProcedure) {
                          if (toothStatus === 'caries') setPlanProcedure('علاج تسوس وحشوة تجميلية');
                          else if (toothStatus === 'crown') setPlanProcedure('تلبيسة بورسلان / زيركون');
                          else if (toothStatus === 'missing') setPlanProcedure('زراعة سن / تركيب جسر');
                        }
                      }}
                      style={{ transform: 'scale(1.1)', marginLeft: 8 }}
                    />
                    <span>إدراج هذا الإجراء في خطة علاج المريض</span>
                  </label>

                  {addToPlan && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                      <div className="form-group">
                        <label className="form-label">اسم الإجراء المطلوب *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={planProcedure} 
                          onChange={(e) => setPlanProcedure(e.target.value)}
                          placeholder="سحب عصب، حشوة، تلبيسة..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">التكلفة التقديرية (دينار)</label>
                        <input 
                          type="number" 
                          min="0"
                          className="form-input" 
                          value={planCost} 
                          onChange={(e) => setPlanCost(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button className="btn btn-primary" onClick={saveToothDetails}>
                💾 حفظ التغييرات
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedTooth(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>💵 تسجيل دفعة مالية للمريض</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">المبلغ المدفوع (دينار) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="مثال: 50"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">تاريخ السداد *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">طريقة الدفع *</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">💵 نقدي (Cash)</option>
                    <option value="card">💳 بطاقة دفع (Card)</option>
                    <option value="bank_transfer">🏦 تحويل بنكي (Bank Transfer)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات المعاملة</label>
                  <textarea
                    className="form-textarea"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="مثال: دفعة الدورة العلاجية الثانية، أو حشوة السن العلوي..."
                    rows="2"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary">💾 حفظ الدفعة</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Prescription Modal */}
      {showPrescriptionModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>💊 تحرير ووصف روشتة طبية جديدة</h3>
              <button className="modal-close" onClick={() => setShowPrescriptionModal(false)}>×</button>
            </div>
            <form onSubmit={handleSavePrescription}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Clinical Template Quick Load */}
                <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: 8, color: 'var(--primary)' }}>
                    🧬 قوالب سريرية سريعة (Clinical Guidelines Templates):
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(RX_TEMPLATES).map(([key, tmpl]) => (
                      <button
                        key={key}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        onClick={() => applyRxTemplate(key)}
                      >
                        ⚡ {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medicines Editor Table */}
                <div>
                  <span style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>الأدوية والمستحضرات الطبية:</span>
                  <div className="table-container" style={{ overflow: 'visible' }}>
                    <table className="table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>اسم الدواء العلمي/التجاري</th>
                          <th>الجرعة</th>
                          <th>التكرار (مثلاً: كل 8 ساعات)</th>
                          <th>المدة الزمنية</th>
                          <th>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rxItems.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                                value={item.medicine}
                                onChange={(e) => handleRxItemChange(index, 'medicine', e.target.value)}
                                placeholder="مثال: Amoxicillin 500mg"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                                value={item.dosage}
                                onChange={(e) => handleRxItemChange(index, 'dosage', e.target.value)}
                                placeholder="مثال: كبسولة واحدة"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                                value={item.frequency}
                                onChange={(e) => handleRxItemChange(index, 'frequency', e.target.value)}
                                placeholder="مثال: 3 مرات يومياً"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                                value={item.duration}
                                onChange={(e) => handleRxItemChange(index, 'duration', e.target.value)}
                                placeholder="مثال: 5 أيام"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', color: 'var(--danger)' }}
                                onClick={() => handleRemoveRxItem(index)}
                                disabled={rxItems.length <= 1}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={handleAddRxItem}
                  >
                    ➕ إضافة دواء آخر
                  </button>
                </div>

                {/* Additional notes */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>تعليمات ونصائح خاصة للمريض (تظهر في الروشتة)</label>
                    <button
                      type="button"
                      className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnListening : ''}`}
                      onClick={() => handleVoiceInput(setRxNotes, rxNotes)}
                      title="اضغط للتحدث وإملاء التعليمات صوتياً"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      {isListening ? '🛑 جاري الاستماع...' : '🎤 إملاء صوتي'}
                    </button>
                  </div>
                  <textarea
                    className="form-textarea"
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    placeholder="مثال: المضمضة بالماء والملح بعد 24 ساعة، وتجنب تناول المشروبات الساخنة والتدخين..."
                    rows="2"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary">💾 حفظ الوصفة وتجهيزها</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrescriptionModal(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Friendly Rx View Overlay */}
      {activePrintRx && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className={`${styles.printContainer} ${styles.printArea}`} style={{ background: 'white', color: 'black', width: '100%', maxWidth: '750px', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative', fontFamily: "'Cairo', sans-serif" }}>
            
            {/* Header controls (Hidden during print) */}
            <div className={styles.noPrint} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <h4 style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🖨️ معاينة الطباعة قبل التنفيذ</span>
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success" onClick={() => window.print()}>
                  🖨️ طباعة الآن
                </button>
                <button className="btn btn-secondary" onClick={() => setActivePrintRx(null)}>
                  إغلاق النافذة
                </button>
              </div>
            </div>

            {/* Official Medical Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px double #000', paddingBottom: '16px', marginBottom: '24px', direction: 'rtl' }}>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#111' }}>د. محمد تيسير ذبالح</h2>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0', fontWeight: 600, color: '#444' }}>طب وجراحة الأسنان وتجميلها</p>
                <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: '#666' }}>عمان، الأردن | هاتف: 0790000000</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', border: '2px solid #000', borderRadius: '50%', fontWeight: 900, fontSize: '24px', color: '#000' }}>
                🦷
              </div>
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#111' }}>Dr. Mohammad Thbaleh</h2>
                <p style={{ fontSize: '12px', margin: '4px 0 0 0', fontWeight: 600, color: '#444' }}>Dental Surgeon & Implantologist</p>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: '#666' }}>Amman, Jordan</p>
              </div>
            </div>

            {/* Patient Info Sub-header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', fontSize: '14px', direction: 'rtl', textAlign: 'right' }}>
              <div>
                <strong>اسم المريض:</strong> <span style={{ marginRight: 8 }}>{patient.name}</span>
              </div>
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <strong>Date:</strong> <span style={{ marginLeft: 8 }}>{formatDate(activePrintRx.date)}</span>
              </div>
              <div>
                {patient.age && (
                  <>
                    <strong>العمر:</strong> <span style={{ marginRight: 8 }}>{patient.age} سنة</span>
                  </>
                )}
              </div>
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <strong>Time:</strong> <span style={{ marginLeft: 8 }}>{formatTime(activePrintRx.time)}</span>
              </div>
            </div>

            {/* Rx Symbol */}
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '16px 0', color: '#000', fontFamily: 'serif', fontStyle: 'italic', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              ℞
            </div>

            {/* Drugs List */}
            <div style={{ minHeight: '220px', direction: 'rtl', textAlign: 'right' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333', textAlign: 'right' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 700 }}>اسم المستحضر الدوائي</th>
                    <th style={{ padding: '10px 8px', fontWeight: 700 }}>الجرعة</th>
                    <th style={{ padding: '10px 8px', fontWeight: 700 }}>التكرار والتوقيت</th>
                    <th style={{ padding: '10px 8px', fontWeight: 700 }}>المدة</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintRx.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700, fontSize: '15px' }}>{item.medicine}</td>
                      <td style={{ padding: '12px 8px' }}>{item.dosage}</td>
                      <td style={{ padding: '12px 8px' }}>{item.frequency}</td>
                      <td style={{ padding: '12px 8px' }}>{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            {activePrintRx.notes && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#fcfcfc', borderRadius: '6px', border: '1px dashed #ccc', fontSize: '14px', direction: 'rtl', textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: '#333' }}>⚠️ نصائح طبية وإرشادات للمريض:</span>
                <p style={{ margin: '6px 0 0 0', lineHeight: '1.6', color: '#444' }}>{activePrintRx.notes}</p>
              </div>
            )}

            {/* Doctor Signature Block */}
            <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '14px', direction: 'rtl' }}>
              <div style={{ color: '#888', fontSize: '12px' }}>
                * صلاحية هذه الروشتة 30 يوماً من تاريخ الإصدار.
              </div>
              <div style={{ textAlign: 'center', minWidth: '150px' }}>
                <div style={{ borderBottom: '1px solid #000', width: '100%', height: '30px', marginBottom: '8px' }}></div>
                <strong>توقيع الطبيب المعالج</strong>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
