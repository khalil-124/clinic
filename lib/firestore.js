import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, isMock } from './firebase';
import * as mock from './mockDb';

// ==================== PATIENTS ====================

/**
 * Add a new patient
 */
export async function addPatient(patientData) {
  if (isMock) {
    return mock.mockAddPatient(patientData);
  }
  const docRef = await addDoc(collection(db, 'patients'), {
    ...patientData,
    status: patientData.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Get all patients
 */
export async function getPatients() {
  if (isMock) {
    return mock.mockGetPatients();
  }
  const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single patient by ID
 */
export async function getPatient(patientId) {
  if (isMock) {
    return mock.mockGetPatient(patientId);
  }
  const docRef = doc(db, 'patients', patientId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Update a patient
 */
export async function updatePatient(patientId, data) {
  if (isMock) {
    return mock.mockUpdatePatient(patientId, data);
  }
  const docRef = doc(db, 'patients', patientId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a patient
 */
export async function deletePatient(patientId) {
  if (isMock) {
    return mock.mockDeletePatient(patientId);
  }
  await deleteDoc(doc(db, 'patients', patientId));
}

/**
 * Search patients by name or phone
 */
export async function searchPatients(searchTerm) {
  const patients = await getPatients();
  const term = searchTerm.toLowerCase().trim();
  return patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
  );
}

// ==================== APPOINTMENTS ====================

/**
 * Add a new appointment
 */
export async function addAppointment(appointmentData) {
  if (isMock) {
    return mock.mockAddAppointment(appointmentData);
  }
  const docRef = await addDoc(collection(db, 'appointments'), {
    ...appointmentData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Get all appointments
 */
export async function getAppointments() {
  if (isMock) {
    return mock.mockGetAppointments();
  }
  const q = query(collection(db, 'appointments'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get appointments by date
 */
export async function getAppointmentsByDate(date) {
  if (isMock) {
    return mock.mockGetAppointmentsByDate(date);
  }
  const q = query(
    collection(db, 'appointments'),
    where('date', '==', date)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return results.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

/**
 * Get appointments by patient
 */
export async function getAppointmentsByPatient(patientId) {
  if (isMock) {
    return mock.mockGetAppointmentsByPatient(patientId);
  }
  const q = query(
    collection(db, 'appointments'),
    where('patientId', '==', patientId)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return results.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.time || '').localeCompare(a.time || '');
  });
}

/**
 * Get appointments for a date range
 */
export async function getAppointmentsByDateRange(startDate, endDate) {
  if (isMock) {
    return mock.mockGetAppointmentsByDateRange(startDate, endDate);
  }
  const q = query(
    collection(db, 'appointments'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });
}

/**
 * Update an appointment
 */
export async function updateAppointment(appointmentId, data) {
  if (isMock) {
    return mock.mockUpdateAppointment(appointmentId, data);
  }
  const docRef = doc(db, 'appointments', appointmentId);
  await updateDoc(docRef, data);
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(appointmentId) {
  if (isMock) {
    return mock.mockDeleteAppointment(appointmentId);
  }
  await deleteDoc(doc(db, 'appointments', appointmentId));
}

// ==================== TREATMENT PLANS ====================

/**
 * Add a treatment plan item to a patient
 */
export async function addTreatmentPlan(patientId, planData) {
  if (isMock) {
    return mock.mockAddTreatmentPlan(patientId, planData);
  }
  const docRef = await addDoc(
    collection(db, 'patients', patientId, 'treatmentPlan'),
    {
      ...planData,
      status: 'pending',
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

/**
 * Get treatment plans for a patient
 */
export async function getTreatmentPlans(patientId) {
  if (isMock) {
    return mock.mockGetTreatmentPlans(patientId);
  }
  const q = query(
    collection(db, 'patients', patientId, 'treatmentPlan'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Update a treatment plan item
 */
export async function updateTreatmentPlan(patientId, planId, data) {
  if (isMock) {
    return mock.mockUpdateTreatmentPlan(patientId, planId, data);
  }
  const docRef = doc(db, 'patients', patientId, 'treatmentPlan', planId);
  await updateDoc(docRef, data);
}

/**
 * Delete a treatment plan item
 */
export async function deleteTreatmentPlan(patientId, planId) {
  if (isMock) {
    return mock.mockDeleteTreatmentPlan(patientId, planId);
  }
  await deleteDoc(doc(db, 'patients', patientId, 'treatmentPlan', planId));
}

// ==================== SETTINGS ====================

/**
 * Get clinic settings
 */
export async function getSettings() {
  if (isMock) {
    return mock.mockGetSettings();
  }
  const docRef = doc(db, 'settings', 'clinic');
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    // Return defaults
    return {
      clinicName: 'عيادة الدكتور محمد تيسير ذبالح لطب الأسنان',
      doctorName: 'د. محمد تيسير ذبالح',
      workDays: [0, 1, 2, 3, 4], // Sunday-Thursday
      workHoursStart: '09:00',
      workHoursEnd: '17:00',
      appointmentDuration: 30,
    };
  }
  return snapshot.data();
}

/**
 * Save clinic settings
 */
export async function saveSettings(settings) {
  if (isMock) {
    return mock.mockSaveSettings(settings);
  }
  await setDoc(doc(db, 'settings', 'clinic'), settings);
}

// ==================== USERS ====================

/**
 * Get user by ID
 */
export async function getUser(userId) {
  if (isMock) {
    return mock.mockGetUser(userId);
  }
  const docRef = doc(db, 'users', userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Get all users
 */
export async function getUsers() {
  if (isMock) {
    return mock.mockGetUsers();
  }
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Create a user document (after Firebase Auth account creation)
 */
export async function createUserDoc(userId, userData) {
  if (isMock) {
    return mock.mockCreateUserDoc(userId, userData);
  }
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    createdAt: serverTimestamp(),
  });
}

/**
 * Shift remaining appointments of a date starting at or after fromTime
 */
export async function shiftRemainingAppointments(date, fromTime, shiftMinutes) {
  if (isMock) {
    return mock.mockShiftRemainingAppointments(date, fromTime, shiftMinutes);
  }
  
  const q = query(
    collection(db, 'appointments'),
    where('date', '==', date),
    where('status', 'in', ['confirmed', 'pending'])
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.time >= fromTime) {
      const [hours, minutes] = data.time.split(':').map(Number);
      let totalMinutes = hours * 60 + minutes + shiftMinutes;
      if (totalMinutes < 0) totalMinutes = 0;
      if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
      const newHours = Math.floor(totalMinutes / 60);
      const newMinutes = totalMinutes % 60;
      const newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
      
      batch.update(docSnap.ref, { time: newTime });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
  }
  return count;
}

