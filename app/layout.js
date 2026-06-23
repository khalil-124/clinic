import { Cairo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import PWAInstallBanner from '@/components/PWAInstallBanner';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'عيادة د. محمد تيسير ذبالح | طب الأسنان',
  description: 'نظام إدارة عيادة الدكتور محمد تيسير ذبالح لطب الأسنان - حجز مواعيد وإدارة ملفات المرضى',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.className}>
      <body>
        <AuthProvider>
          {children}
          <PWAInstallBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
