'use client';

import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './Header.module.css';

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const today = new Date().toLocaleDateString('ar-JO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/patients?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerRight}>
        <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="القائمة">
          ☰
        </button>
        <form onSubmit={handleSearch} className={styles.searchContainer}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="ابحث عن مريض..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
      </div>
      <div className={styles.headerLeft}>
        <span className={styles.dateDisplay}>{today}</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          🚪 خروج
        </button>
      </div>
    </header>
  );
}
