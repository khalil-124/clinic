'use client';

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard/AuthGuard';
import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-area">
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
