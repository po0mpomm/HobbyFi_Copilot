'use client';
import React, { useState, useEffect } from 'react';
import { CopilotChat } from '@/components/copilot/CopilotChat';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function DashboardPage() {
  const { vendorId, vendorName, track, vendors, switchVendor } = useAuth();
  const [metrics, setMetrics] = useState({ revenue: 0, activityCount: 0, pendingPayout: 0 });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    if (!vendorId || !track) return;
    setLoadingMetrics(true);
    fetch(`/api/metrics?vendorId=${vendorId}&track=${track}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setMetrics(data);
      })
      .catch(console.error)
      .finally(() => setLoadingMetrics(false));
  }, [vendorId, track]);

  return (
    <div className={styles.layout}>
      {/* Sidebar / Nav */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <h1>HobbyFi Portal</h1>
        </div>
        
        <div className={styles.vendorSelector}>
          <label>Active Vendor Environment</label>
          <select 
            value={vendorId}
            onChange={(e) => {
              const v = vendors.find(v => v.id === e.target.value);
              if (v) switchVendor(v.id, v.name, v.track, v.staffId);
            }}
            className={styles.select}
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.track})
              </option>
            ))}
          </select>
        </div>

        <nav className={styles.nav}>
          <a href="#" className={`${styles.navLink} ${styles.active}`}>📊 Dashboard</a>
          {track === 'play' ? (
            <>
              <a href="#" className={styles.navLink}>🎾 Courts & Slots</a>
              <a href="#" className={styles.navLink}>📅 Bookings</a>
            </>
          ) : (
            <>
              <a href="#" className={styles.navLink}>🎟️ Memberships</a>
              <a href="#" className={styles.navLink}>🏃‍♂️ Trials</a>
            </>
          )}
          <a href="#" className={styles.navLink}>💰 Payouts</a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h2>Welcome back, {vendorName}</h2>
          <div className={styles.userProfile}>
            <div className={styles.avatar}>A</div>
            <span>Admin</span>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.metricsGrid}>
            <div className={`${styles.metricCard} glass`}>
              <h3>Revenue this Month</h3>
              <div className="gradient-text">
                {loadingMetrics ? '...' : `₹${metrics.revenue.toLocaleString()}`}
              </div>
            </div>
            <div className={`${styles.metricCard} glass`}>
              <h3>{track === 'play' ? 'Total Bookings' : 'Active Members'}</h3>
              <div className="gradient-text">
                {loadingMetrics ? '...' : metrics.activityCount}
              </div>
            </div>
            <div className={`${styles.metricCard} glass`}>
              <h3>Pending Payout</h3>
              <div className="gradient-text">
                {loadingMetrics ? '...' : `₹${metrics.pendingPayout.toLocaleString()}`}
              </div>
            </div>
          </div>

          <div className={styles.mainPanel}>
            <div className={`${styles.chartMock} glass`}>
              <h3>Activity Overview</h3>
              <div className={styles.chartPlaceholder}>
                [ Chart goes here ]
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Copilot Floating Panel */}
      <div className={styles.copilotWrapper}>
        <CopilotChat />
      </div>
    </div>
  );
}
