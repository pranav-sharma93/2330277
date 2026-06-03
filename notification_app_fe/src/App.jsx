import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    failed: 0,
    sending: 0,
    read: 0,
    unread: 0,
    channels: { email: 0, sms: 0, in_app: 0 }
  });
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ title: '', message: '', channel: 'in_app' });
  const [submitting, setSubmitting] = useState(false);

  const BACKEND_URL = 'http://localhost:5000';

  // Fetch initial notifications list
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`);
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch initial stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Show a toast message
  const triggerToast = (notification) => {
    const toastId = Math.random().toString(36).substring(2, 9);
    
    // Add toast
    setToasts((prev) => [...prev, { ...notification, toastId }]);

    // Remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    }, 4000);
  };

  // Connect to Server-Sent Events (SSE) for real-time updates
  useEffect(() => {
    fetchNotifications();
    fetchStats();

    const eventSource = new EventSource(`${BACKEND_URL}/api/events`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;

        if (type === 'CONNECTED') {
          setConnected(true);
        } else if (type === 'NEW_NOTIFICATION') {
          // Append new notification to feed
          setNotifications((prev) => [data, ...prev]);
          // Trigger browser-like toast notification
          triggerToast(data);
          // Refresh statistics
          fetchStats();
        } else if (type === 'UPDATE_NOTIFICATION') {
          // Update matching notification in feed
          setNotifications((prev) =>
            prev.map((n) => (n.id === data.id ? data : n))
          );
          // Refresh statistics
          fetchStats();
        } else if (type === 'CLEARED_ALL') {
          setNotifications([]);
          setStats({
            total: 0,
            delivered: 0,
            failed: 0,
            sending: 0,
            read: 0,
            unread: 0,
            channels: { email: 0, sms: 0, in_app: 0 }
          });
        }
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Send a new notification
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        // Reset form inputs (keep same channel for ease of re-testing)
        setForm({ ...form, title: '', message: '' });
      } else {
        const errData = await response.json();
        alert(`Failed to send: ${errData.error}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Failed to connect to backend server. Make sure it is running on port 5000.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mark In-App notification as read
  const markAsRead = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
        method: 'PATCH'
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notification logs?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/notifications`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  };

  // Filter notifications list
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return n.channel === filter;
  });

  // Calculate percentages for channel graphs
  const getChannelPercentage = (count) => {
    if (stats.total === 0) return 0;
    return Math.round((count / stats.total) * 100);
  };

  return (
    <div className="app-container">
      {/* Toast popup notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.toastId} className={`toast-card ${t.channel}`}>
            <div className="toast-header">
              <span className="toast-title">New {t.channel === 'in_app' ? 'In-App' : t.channel.toUpperCase()} Alert</span>
              <button 
                className="toast-close" 
                onClick={() => setToasts((prev) => prev.filter((item) => item.toastId !== t.toastId))}
              >
                &times;
              </button>
            </div>
            <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{t.title}</strong>
            <div className="toast-body">{t.message}</div>
          </div>
        ))}
      </div>

      {/* Header section */}
      <header className="app-header animate-fade-in">
        <div className="brand-section">
          <div className="brand-icon">⚡</div>
          <h1>Notification Center</h1>
          <span>Full Stack</span>
        </div>
        <div className="status-badge">
          <div className={`status-dot ${connected ? 'online' : 'offline'}`}></div>
          <span>Server Status: {connected ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="dashboard-grid">
        
        {/* Left Column: Form & Statistics */}
        <section className="dashboard-left animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Notification Creation Panel */}
          <div className="panel">
            <h2 className="panel-title">Dispatch Notification</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="channel">Delivery Channel</label>
                <select
                  id="channel"
                  className="form-select"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  <option value="in_app">Push / In-App Notification</option>
                  <option value="email">Email Message</option>
                  <option value="sms">SMS Text Alert</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="title">Notification Title</label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Order Confirmed, Security Alert"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message Body</label>
                <textarea
                  id="message"
                  className="form-textarea"
                  placeholder="Type your notification description here..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  maxLength={500}
                  required
                />
              </div>

              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Dispatching...' : 'Send Notification'}
              </button>
            </form>
          </div>

          {/* Delivery Statistics Panel */}
          <div className="panel">
            <h2 className="panel-title">System Metrics</h2>
            <div className="stats-container">
              <div className="stats-grid">
                <div className="stat-card total">
                  <span className="stat-label">Total Ingested</span>
                  <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-card delivered">
                  <span className="stat-label">Delivered</span>
                  <span className="stat-value">{stats.delivered}</span>
                </div>
                <div className="stat-card sending">
                  <span className="stat-label">In Flight</span>
                  <span className="stat-value">{stats.sending}</span>
                </div>
                <div className="stat-card failed">
                  <span className="stat-label">Failed</span>
                  <span className="stat-value">{stats.failed}</span>
                </div>
              </div>

              {/* Progress meters for Channels */}
              <div className="channel-analytics">
                <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Distribution by Channel
                </h3>
                
                {/* In-App percentage progress */}
                <div className="channel-bar-group">
                  <div className="channel-info">
                    <span className="channel-name">
                      <span className="channel-dot in-app"></span> In-App / Push
                    </span>
                    <span>{stats.channels.in_app} ({getChannelPercentage(stats.channels.in_app)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill in-app" 
                      style={{ width: `${getChannelPercentage(stats.channels.in_app)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Email percentage progress */}
                <div className="channel-bar-group">
                  <div className="channel-info">
                    <span className="channel-name">
                      <span className="channel-dot email"></span> Email
                    </span>
                    <span>{stats.channels.email} ({getChannelPercentage(stats.channels.email)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill email" 
                      style={{ width: `${getChannelPercentage(stats.channels.email)}%` }}
                    ></div>
                  </div>
                </div>

                {/* SMS percentage progress */}
                <div className="channel-bar-group">
                  <div className="channel-info">
                    <span className="channel-name">
                      <span className="channel-dot sms"></span> SMS
                    </span>
                    <span>{stats.channels.sms} ({getChannelPercentage(stats.channels.sms)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill sms" 
                      style={{ width: `${getChannelPercentage(stats.channels.sms)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Right Column: History & Live Feed */}
        <section className="panel animate-fade-in">
          <div className="panel-title">
            <span>Audit Logs & Live Feed</span>
            <button 
              className="clear-btn" 
              onClick={handleClearAll}
              disabled={notifications.length === 0}
            >
              Clear Logs
            </button>
          </div>

          <div className="history-controls">
            <div className="filters-tabs">
              <button 
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={`filter-tab ${filter === 'in_app' ? 'active' : ''}`}
                onClick={() => setFilter('in_app')}
              >
                In-App
              </button>
              <button 
                className={`filter-tab ${filter === 'email' ? 'active' : ''}`}
                onClick={() => setFilter('email')}
              >
                Email
              </button>
              <button 
                className={`filter-tab ${filter === 'sms' ? 'active' : ''}`}
                onClick={() => setFilter('sms')}
              >
                SMS
              </button>
              <button 
                className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
                onClick={() => setFilter('unread')}
              >
                Unread
              </button>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {filteredNotifications.length} of {notifications.length}
            </div>
          </div>

          {/* Feed list scrollbox */}
          <div className="feed-list">
            {filteredNotifications.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <h3>No notifications found</h3>
                <p>Use the form on the left to dispatch notifications and watch them arrive in real-time.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div key={n.id} className={`notification-card ${!n.read && n.channel === 'in_app' ? 'unread' : ''}`}>
                  <div className="card-header">
                    <div className="card-title-group">
                      <h4 className="card-title">{n.title}</h4>
                      <div className="card-meta">
                        <span>ID: {n.id}</span>
                        <span>•</span>
                        <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className={`channel-tag ${n.channel}`}>
                        {n.channel === 'in_app' ? 'In-App' : n.channel}
                      </span>
                      <span className={`status-badge-item ${n.status}`}>
                        {n.status === 'sending' && <span className="status-dot online" style={{ width: 6, height: 6, animation: 'pulse-glow 1s infinite' }}></span>}
                        {n.status}
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    {n.message}
                  </div>

                  <div className="card-footer">
                    <div>
                      {n.status === 'failed' && n.failure_reason && (
                        <span className="failure-info">
                          ⚠️ {n.failure_reason}
                        </span>
                      )}
                    </div>
                    
                    {!n.read && n.channel === 'in_app' && (
                      <button className="mark-read-btn" onClick={() => markAsRead(n.id)}>
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
