/**
 * Generate a unique ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Format date to Arabic locale
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-JO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date to short format
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-JO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format time (HH:mm) to Arabic
 */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const period = h >= 12 ? 'م' : 'ص';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minutes} ${period}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the Arabic day name
 */
export function getDayName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-JO', { weekday: 'long' });
}

/**
 * Get relative time description in Arabic
 */
export function getRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `قبل ${diffDays} أيام`;
  if (diffDays < 30) return `قبل ${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `قبل ${Math.floor(diffDays / 30)} أشهر`;
  return `قبل ${Math.floor(diffDays / 365)} سنوات`;
}

/**
 * Generate time slots for a day
 */
export function generateTimeSlots(startTime = '09:00', endTime = '17:00', duration = 30) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    currentMinutes += duration;
  }

  return slots;
}

/**
 * Get days of the week starting from Sunday
 */
export function getWeekDays() {
  return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
}

/**
 * Get month days for calendar view
 */
export function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];

  // Previous month filler days
  for (let i = 0; i < startingDay; i++) {
    const prevDate = new Date(year, month, -startingDay + i + 1);
    days.push({ date: prevDate, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Next month filler days
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
}

/**
 * Visit type labels and colors
 */
export const VISIT_TYPES = {
  checkup: { label: 'كشف أولي', color: '#4A90D9', icon: '🔍' },
  followup: { label: 'متابعة', color: '#7B68EE', icon: '🔄' },
  treatment: { label: 'علاج', color: '#2ECC71', icon: '🦷' },
  emergency: { label: 'طوارئ', color: '#E74C3C', icon: '🚨' },
};

/**
 * Appointment status labels and colors
 */
export const APPOINTMENT_STATUS = {
  confirmed: { label: 'مؤكد', color: '#4A90D9', bg: '#EBF5FF' },
  pending: { label: 'بانتظار التأكيد', color: '#F5A623', bg: '#FFF8E7' },
  completed: { label: 'مكتمل', color: '#2ECC71', bg: '#EAFAF1' },
  cancelled: { label: 'ملغي', color: '#E74C3C', bg: '#FDEDEC' },
  no_show: { label: 'لم يحضر', color: '#9B59B6', bg: '#F5EEF8' },
};

/**
 * Treatment status labels
 */
export const TREATMENT_STATUS = {
  pending: { label: 'لم يبدأ', color: '#F5A623' },
  in_progress: { label: 'قيد التنفيذ', color: '#4A90D9' },
  completed: { label: 'مكتمل', color: '#2ECC71' },
};

/**
 * Validate phone number (Jordanian format)
 */
export function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(07[789]\d{7}|962[789]\d{8})$/.test(cleaned);
}

/**
 * Format phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('07')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Get the date string for a Date object (YYYY-MM-DD)
 */
export function toDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get Arabic month name
 */
export function getMonthName(month) {
  const months = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
  ];
  return months[month];
}

/**
 * FDI World Dental Federation teeth notation layout
 */
export const FDI_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38]
};

