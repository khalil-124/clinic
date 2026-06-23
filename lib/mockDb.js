// lib/mockDb.js

// Safe localStorage checks for SSR
const isBrowser = typeof window !== 'undefined';

const DEFAULT_USERS = [
  { id: 'uid_admin', email: 'admin@clinic.com', password: 'password123', role: 'admin', displayName: 'سارة (السكرتيرة)' },
  { id: 'uid_doctor', email: 'doctor@clinic.com', password: 'password123', role: 'doctor', displayName: 'د. محمد تيسير ذبالح' }
];

const DEFAULT_SETTINGS = {
  clinicName: 'عيادة الدكتور محمد تيسير ذبالح لطب الأسنان',
  doctorName: 'د. محمد تيسير ذبالح',
  workDays: [0, 1, 2, 3, 4], // Sun-Thu
  workHoursStart: '09:00',
  workHoursEnd: '17:00',
  appointmentDuration: 30,
};

function getTodayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const DEFAULT_PATIENTS = [
  { id: 'patient_1', name: 'أحمد محمود العلي', phone: '0791234567', gender: 'male', dob: '1990-05-15', notes: 'يعاني من حساسية البنسلين', status: 'active', createdAt: new Date().toISOString() },
  { id: 'patient_2', name: 'سارة عبد الله حسن', phone: '0787654321', gender: 'female', dob: '1995-10-22', notes: 'تخاف من إبر البنج', status: 'active', createdAt: new Date().toISOString() },
  { id: 'patient_3', name: 'ليلى خالد عمر', phone: '0779998888', gender: 'female', dob: '1985-03-08', notes: 'متابعة تقويم الأسنان', status: 'active', createdAt: new Date().toISOString() }
];

const DEFAULT_APPOINTMENTS = [
  { id: 'apt_1', patientId: 'patient_1', patientName: 'أحمد محمود العلي', patientPhone: '0791234567', date: getTodayStr(0), time: '10:00', type: 'treatment', status: 'confirmed', notes: 'حشو عصب السن السادس العلوي' },
  { id: 'apt_2', patientId: 'patient_2', patientName: 'سارة عبد الله حسن', patientPhone: '0787654321', date: getTodayStr(0), time: '11:30', type: 'checkup', status: 'pending', notes: 'فحص دوري وألم بالضروس' },
  { id: 'apt_3', patientId: 'patient_3', patientName: 'ليلى خالد عمر', patientPhone: '0779998888', date: getTodayStr(1), time: '09:30', type: 'followup', status: 'confirmed', notes: 'شد سلك التقويم' }
];

const DEFAULT_TREATMENT_PLANS = {
  'patient_1': [
    { id: 'plan_1', procedure: 'حشو عصب', tooth: '16', diagnosis: 'تسوس عميق مع التهاب عصب حاد', notes: 'تنظيف قنوات العصب ووضع حشوة مؤقتة ثم حشوة دائمة', status: 'in_progress', estimatedCost: 120, createdAt: new Date().toISOString() },
    { id: 'plan_2', procedure: 'تنظيف وتلميع الأسنان', tooth: '', diagnosis: 'تراكم الجير والتصبغات', notes: 'إزالة الجير بالموجات فوق الصوتية وتلميع الأسطح', status: 'completed', estimatedCost: 30, createdAt: new Date().toISOString() }
  ],
  'patient_3': [
    { id: 'plan_3', procedure: 'تقويم أسنان معدني', tooth: '', diagnosis: 'سوء إطباق وسن متراجع', notes: 'شد دوري للتقويم كل شهر ومراقبة التقدم', status: 'in_progress', estimatedCost: 800, createdAt: new Date().toISOString() }
  ]
};


// Initialize localStorage helper
function getStorage(key, defaultValue) {
  if (!isBrowser) return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return defaultValue;
  }
}

function setStorage(key, value) {
  if (!isBrowser) return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Seed the DB if empty
export function seedMockDb() {
  if (!isBrowser) return;
  getStorage('clinic_users', DEFAULT_USERS);
  getStorage('clinic_settings', DEFAULT_SETTINGS);
  getStorage('clinic_patients', DEFAULT_PATIENTS);
  getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  getStorage('clinic_treatment_plans', DEFAULT_TREATMENT_PLANS);
}

// Listeners for auth changes
const authListeners = [];

export function mockOnAuthChange(callback) {
  if (!isBrowser) {
    callback(null);
    return () => {};
  }
  seedMockDb();
  const currentUser = getStorage('clinic_current_user', null);
  callback(currentUser);
  authListeners.push(callback);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

export async function mockSignIn(email, password) {
  seedMockDb();
  const users = getStorage('clinic_users', DEFAULT_USERS);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user || user.password !== password) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }
  
  const userData = {
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  
  setStorage('clinic_current_user', userData);
  authListeners.forEach(listener => listener(userData));
  return userData;
}

export async function mockSignOut() {
  setStorage('clinic_current_user', null);
  authListeners.forEach(listener => listener(null));
}

// Firestore mock functions
export async function mockAddPatient(patientData) {
  const patients = getStorage('clinic_patients', DEFAULT_PATIENTS);
  const id = 'patient_' + Date.now();
  const newPatient = {
    ...patientData,
    id,
    status: patientData.status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  patients.push(newPatient);
  setStorage('clinic_patients', patients);
  return id;
}

export async function mockGetPatients() {
  return getStorage('clinic_patients', DEFAULT_PATIENTS);
}

export async function mockGetPatient(patientId) {
  const patients = getStorage('clinic_patients', DEFAULT_PATIENTS);
  return patients.find(p => p.id === patientId) || null;
}

export async function mockUpdatePatient(patientId, data) {
  const patients = getStorage('clinic_patients', DEFAULT_PATIENTS);
  const idx = patients.findIndex(p => p.id === patientId);
  if (idx !== -1) {
    patients[idx] = {
      ...patients[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setStorage('clinic_patients', patients);
  }
}

export async function mockDeletePatient(patientId) {
  const patients = getStorage('clinic_patients', DEFAULT_PATIENTS);
  const filtered = patients.filter(p => p.id !== patientId);
  setStorage('clinic_patients', filtered);
}

export async function mockAddAppointment(appointmentData) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  const id = 'apt_' + Date.now();
  const newApt = {
    ...appointmentData,
    id,
    createdAt: new Date().toISOString(),
  };
  appointments.push(newApt);
  setStorage('clinic_appointments', appointments);
  return id;
}

export async function mockGetAppointments() {
  return getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
}

export async function mockGetAppointmentsByDate(date) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  return appointments.filter(a => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

export async function mockGetAppointmentsByPatient(patientId) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  return appointments.filter(a => a.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
}

export async function mockGetAppointmentsByDateRange(startDate, endDate) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  return appointments
    .filter(a => a.date >= startDate && a.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export async function mockUpdateAppointment(appointmentId, data) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  const idx = appointments.findIndex(a => a.id === appointmentId);
  if (idx !== -1) {
    appointments[idx] = { ...appointments[idx], ...data };
    setStorage('clinic_appointments', appointments);
  }
}

export async function mockDeleteAppointment(appointmentId) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  const filtered = appointments.filter(a => a.id !== appointmentId);
  setStorage('clinic_appointments', filtered);
}

function addMinutesToTime(timeStr, minutesToAdd) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + minutesToAdd;
  
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

export async function mockShiftRemainingAppointments(date, fromTime, shiftMinutes) {
  const appointments = getStorage('clinic_appointments', DEFAULT_APPOINTMENTS);
  let updatedCount = 0;
  
  const updated = appointments.map(a => {
    if (a.date === date && a.time >= fromTime && (a.status === 'confirmed' || a.status === 'pending')) {
      updatedCount++;
      return {
        ...a,
        time: addMinutesToTime(a.time, shiftMinutes)
      };
    }
    return a;
  });
  
  if (updatedCount > 0) {
    setStorage('clinic_appointments', updated);
  }
  return updatedCount;
}


export async function mockAddTreatmentPlan(patientId, planData) {
  const plans = getStorage('clinic_treatment_plans', DEFAULT_TREATMENT_PLANS);
  if (!plans[patientId]) plans[patientId] = [];
  const id = 'plan_' + Date.now();
  const newPlan = {
    ...planData,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  plans[patientId].push(newPlan);
  setStorage('clinic_treatment_plans', plans);
  return id;
}

export async function mockGetTreatmentPlans(patientId) {
  const plans = getStorage('clinic_treatment_plans', DEFAULT_TREATMENT_PLANS);
  return plans[patientId] || [];
}

export async function mockUpdateTreatmentPlan(patientId, planId, data) {
  const plans = getStorage('clinic_treatment_plans', DEFAULT_TREATMENT_PLANS);
  if (plans[patientId]) {
    const idx = plans[patientId].findIndex(p => p.id === planId);
    if (idx !== -1) {
      plans[patientId][idx] = { ...plans[patientId][idx], ...data };
      setStorage('clinic_treatment_plans', plans);
    }
  }
}

export async function mockDeleteTreatmentPlan(patientId, planId) {
  const plans = getStorage('clinic_treatment_plans', DEFAULT_TREATMENT_PLANS);
  if (plans[patientId]) {
    plans[patientId] = plans[patientId].filter(p => p.id !== planId);
    setStorage('clinic_treatment_plans', plans);
  }
}

export async function mockGetSettings() {
  return getStorage('clinic_settings', DEFAULT_SETTINGS);
}

export async function mockSaveSettings(settings) {
  setStorage('clinic_settings', settings);
}

export async function mockGetUser(userId) {
  const users = getStorage('clinic_users', DEFAULT_USERS);
  return users.find(u => u.id === userId) || null;
}

export async function mockGetUsers() {
  return getStorage('clinic_users', DEFAULT_USERS);
}

export async function mockCreateUserDoc(userId, userData) {
  const users = getStorage('clinic_users', DEFAULT_USERS);
  const idx = users.findIndex(u => u.id === userId);
  const newUser = { id: userId, ...userData, createdAt: new Date().toISOString() };
  if (idx !== -1) {
    users[idx] = newUser;
  } else {
    users.push(newUser);
  }
  setStorage('clinic_users', users);
}
