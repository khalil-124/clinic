'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'لوحة التحكم' },
  { href: '/appointments', icon: '📅', label: 'المواعيد' },
  { href: '/booking', icon: '➕', label: 'حجز جديد' },
  { href: '/patients', icon: '👥', label: 'المرضى' },
  { href: '/reports', icon: '📋', label: 'التقارير' },
  { href: '/settings', icon: '⚙️', label: 'الإعدادات' },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const roleLabel = user?.role === 'admin' ? 'مسؤول النظام' : 'طبيب';
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '؟';

  return (
    <>
      {isOpen && (
        <div className={styles.sidebarOverlay} onClick={onClose} />
      )}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand */}
        <div className={styles.sidebarBrand}>
          <div className={styles.brandIcon}>🦷</div>
          <div className={styles.brandName}>د. محمد تيسير ذبالح</div>
          <div className={styles.brandSub}>طب الأسنان</div>
        </div>

        {/* Navigation */}
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href || pathname?.startsWith(item.href + '/') ? styles.navItemActive : ''}`}
              onClick={onClose}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>{initials}</div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user?.displayName || 'مستخدم'}</div>
              <div className={styles.userRole}>{roleLabel}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
