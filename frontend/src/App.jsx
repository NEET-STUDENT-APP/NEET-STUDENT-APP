import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Clock, UserCheck, Users, CheckCircle2, XCircle, 
  AlertCircle, Download, LogOut, RefreshCw, Play, Send, FileText, ChevronRight, Check, ShieldAlert, Calendar,
  Info, AlertTriangle
} from 'lucide-react';
import { generateStudentPDFReport } from './utils/pdfGenerator';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:5050' : '');

const validateReason = (text) => {
  const reason = text.trim();
  if (reason.length < 15) {
    return { isValid: false, message: 'Explanation must be at least 15 characters.' };
  }

  if (/(.)\1{4,}/i.test(reason)) {
    return { isValid: false, message: 'Too many repeated characters.' };
  }

  const cleanText = reason.replace(/[^a-zA-Z\s]/g, '');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  
  for (const word of words) {
    if (word.length >= 6) {
      if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/.test(word)) {
        return { isValid: false, message: 'Please write actual words, not random letters.' };
      }
    }
  }

  const lettersOnly = cleanText.replace(/\s/g, '');
  if (lettersOnly.length > 0) {
    const vowels = lettersOnly.match(/[aeiouyAEIOUY]/g);
    const vowelCount = vowels ? vowels.length : 0;
    const vowelRatio = vowelCount / lettersOnly.length;
    if (vowelRatio < 0.15) {
      return { isValid: false, message: 'Text does not seem to contain real words.' };
    }
  }

  if (/[a-zA-Z]+\d+[a-zA-Z]+/i.test(reason) || /\b[a-zA-Z]{2,}\d{2,}\b/i.test(reason)) {
    return { isValid: false, message: 'Please do not mix random numbers inside words.' };
  }

  return { isValid: true };
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [userProfile, setUserProfile] = useState(JSON.parse(localStorage.getItem('userProfile')) || null);

  // General States
  const [activeTab, setActiveTab] = useState('login'); // login | register
  const [authRole, setAuthRole] = useState('student'); // student | staff | hod
  
  // Notification messages
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notification, setNotification] = useState(null); // { message, type: 'info' | 'success' | 'warning' | 'error' }

  const showToast = (msg, type = 'info') => {
    setNotification({ message: msg, type });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userProfile');
    setToken('');
    setRole('');
    setUserProfile(null);
    setActiveTab('login');
  };

  // Helper to store login details
  const saveAuthDetails = (tok, rol, prof) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('role', rol);
    localStorage.setItem('userProfile', JSON.stringify(prof));
    setToken(tok);
    setRole(rol);
    setUserProfile(prof);
  };

  // Render correct view
  if (!token) {
    return (
      <>
        <AuthPortal 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          authRole={authRole} 
          setAuthRole={setAuthRole}
          saveAuthDetails={saveAuthDetails}
          message={message}
          setMessage={setMessage}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
        />
        {notification && (
          <div className={`toast-notification ${notification.type}`}>
            <div className="toast-content">
              <span className="toast-icon">
                {notification.type === 'success' && <CheckCircle2 size={20} />}
                {notification.type === 'error' && <XCircle size={20} />}
                {notification.type === 'warning' && <AlertCircle size={20} />}
                {notification.type === 'info' && <Info size={20} />}
              </span>
              <span className="toast-message">{notification.message}</span>
            </div>
            <button className="toast-close" onClick={() => setNotification(null)}>×</button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="dashboard-layout">
        {/* App Header */}
        <header className="app-header glass-panel">
          <div className="header-brand">
            <img src="/logo.png" alt="Sri Chaitanya Logo" className="header-logo" />
            <div className="header-titles">
              <h2>SRI CHAITANYA EDUCATIONAL INSTITUTIONS</h2>
              <span>NEET Student Performance Analyzer</span>
            </div>
          </div>
          
          <div className="header-user">
            <div className="user-badge">
              <strong>{userProfile?.name || 'HOD Admin'}</strong> ({role.toUpperCase()})
            </div>
            <button className="btn btn-danger btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>
  
        <main className="container" style={{ flex: 1 }}>
          {role === 'hod' && <HodDashboard token={token} />}
          {role === 'student' && <StudentDashboard token={token} profile={userProfile} />}
          {role === 'staff' && <StaffDashboard token={token} profile={userProfile} />}
        </main>
      </div>
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {notification.type === 'success' && <CheckCircle2 size={20} />}
              {notification.type === 'error' && <XCircle size={20} />}
              {notification.type === 'warning' && <AlertCircle size={20} />}
              {notification.type === 'info' && <Info size={20} />}
            </span>
            <span className="toast-message">{notification.message}</span>
          </div>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   AUTHENTICATION & REGISTRATION PORTAL
   ========================================================================== */
function AuthPortal({ 
  activeTab, setActiveTab, authRole, setAuthRole, saveAuthDetails,
  message, setMessage, errorMsg, setErrorMsg
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [scsLoginDigits, setScsLoginDigits] = useState('');

  // Register Fields - Common
  const [createPwd, setCreatePwd] = useState('');
  
  // Register Fields - Student
  const [scsDigits, setScsDigits] = useState('');
  const [studentDetails, setStudentDetails] = useState(null);
  const [parentMobile, setParentMobile] = useState('');
  const [isCheckingScs, setIsCheckingScs] = useState(false);

  // Register Fields - Staff
  const [staffName, setStaffName] = useState('');
  const [bngCode, setBngCode] = useState('');
  const [staffSubject, setStaffSubject] = useState('BOTANY');
  const [staffDean, setStaffDean] = useState('Anand Sir');
  const [staffCategory, setStaffCategory] = useState('');
  const [staffSection, setStaffSection] = useState('');
  const [staffCampuses, setStaffCampuses] = useState([]); // multi-select array
  const [staffMobile, setStaffMobile] = useState('');
  
  // Unique dropdowns for staff
  const [dropdowns, setDropdowns] = useState({ categories: [], sections: [], campuses: [] });

  // Custom handler for SCS ID digits input (numeric-only, max 8 digits)
  const handleScsDigitsChange = (val) => {
    const cleaned = val.replace(/\D/g, ''); // Extract only digits
    if (cleaned.length <= 8) {
      setScsDigits(cleaned);
    }
  };

  // Clear messages and inputs on toggle
  useEffect(() => {
    setMessage('');
    setErrorMsg('');
    setUsername('');
    setPassword('');
    setScsDigits('');
    setScsLoginDigits('');
    setStudentDetails(null);
  }, [activeTab, authRole]);

  // Load dropdown data for staff register
  useEffect(() => {
    if (activeTab === 'register' && authRole === 'staff') {
      fetch(`${API_BASE}/api/auth/dropdowns`)
        .then(res => res.json())
        .then(data => {
          setDropdowns(data);
          if (data.categories.length) setStaffCategory(data.categories[0]);
          if (data.sections.length) setStaffSection(data.sections[0]);
          // Multi campus: start with nothing selected
          setStaffCampuses([]);
        })
        .catch(err => console.error('Error fetching dropdowns:', err));
    }
  }, [activeTab, authRole]);

  // SCS lookup as student types
  useEffect(() => {
    if (scsDigits.length >= 7) {
      const fullScs = 'SCS' + scsDigits;
      setIsCheckingScs(true);
      setErrorMsg('');
      fetch(`${API_BASE}/api/auth/lookup/${fullScs}`)
        .then(res => {
          if (!res.ok) throw new Error('Student ID not found in database.');
          return res.json();
        })
        .then(data => {
          setStudentDetails(data);
          setIsCheckingScs(false);
        })
        .catch(err => {
          setStudentDetails(null);
          setErrorMsg(err.message);
          setIsCheckingScs(false);
        });
    } else {
      setStudentDetails(null);
    }
  }, [scsDigits]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setMessage('');
    
    // Determine the actual username to send
    let cleanUsername = authRole === 'student' ? ('SCS' + scsLoginDigits.trim()) : username.trim();
    
    // HOD bypass credentials override
    if (cleanUsername === 'yenjarappa.s@varsitymgmt.com' && authRole !== 'hod') {
      setAuthRole('hod');
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      saveAuthDetails(data.token, data.role, data.profile);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Student register handler
  const handleStudentRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setMessage('');

    if (!studentDetails) {
      setErrorMsg('Please enter a valid SCS student ID before submitting.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scsNumber: 'SCS' + scsDigits,
          parentMobile,
          password: createPwd
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setMessage(data.message);
      setScsDigits('');
      setParentMobile('');
      setCreatePwd('');
      setStudentDetails(null);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Staff register handler
  const handleStaffRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/register/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bngCode,
          name: staffName,
          subject: staffSubject,
          dean: staffDean,
          category: staffCategory,
          section: staffSection,
          campuses: staffCampuses,
          mobile: staffMobile,
          password: createPwd
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setMessage(data.message);
      setBngCode('');
      setStaffName('');
      setStaffMobile('');
      setCreatePwd('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        <div className="logo-container">
          <img src="/logo.png" alt="Sri Chaitanya Logo" className="app-logo" />
          <span className="institution-title">Sri Chaitanya Educational Institutions</span>
          <h1 className="app-title">NEET Student Hub</h1>
        </div>

        {/* Outer Login/Register Tabs */}
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`} onClick={() => setActiveTab('login')}>
            Account Login
          </button>
          <button className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>
            Register Account
          </button>
        </div>

        {/* Inner Role Selectors */}
        <div className="tabs-header" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: '20px' }}>
          <button className={`tab-btn ${authRole === 'student' ? 'active' : ''}`} onClick={() => setAuthRole('student')} style={{ fontSize: '13px', padding: '6px' }}>
            Student
          </button>
          <button className={`tab-btn ${authRole === 'staff' ? 'active' : ''}`} onClick={() => setAuthRole('staff')} style={{ fontSize: '13px', padding: '6px' }}>
            Staff Faculty
          </button>
          {activeTab === 'login' && (
            <button className={`tab-btn ${authRole === 'hod' ? 'active' : ''}`} onClick={() => setAuthRole('hod')} style={{ fontSize: '13px', padding: '6px' }}>
              HOD Admin
            </button>
          )}
        </div>

        {message && <div className="badge badge-approved" style={{ width: '100%', padding: '12px', marginBottom: '16px' }}><CheckCircle2 size={16} /> {message}</div>}
        {errorMsg && <div className="badge badge-rejected" style={{ width: '100%', padding: '12px', marginBottom: '16px' }}><AlertCircle size={16} /> {errorMsg}</div>}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>{authRole === 'student' ? 'SCS Student ID' : authRole === 'staff' ? 'Staff BNG Code' : 'Email Address'}</label>
              {authRole === 'student' ? (
                <div style={{ display: 'flex', width: '100%' }}>
                  <span style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRight: 'none',
                    color: 'var(--text-secondary)',
                    padding: '12px 16px',
                    borderTopLeftRadius: 'var(--radius-md)',
                    borderBottomLeftRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: '700',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none'
                  }}>
                    SCS
                  </span>
                  <input 
                    type="text" 
                    id="login-user-student"
                    name="login-user-student"
                    className="form-control" 
                    placeholder="Enter number (e.g. 1353615)"
                    value={scsLoginDigits}
                    onChange={e => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned.length <= 8) setScsLoginDigits(cleaned);
                    }}
                    style={{
                      borderTopLeftRadius: '0',
                      borderBottomLeftRadius: '0',
                      flex: 1
                    }}
                    required 
                  />
                </div>
              ) : (
                <input 
                  type="text" 
                  id={`login-user-${authRole}`}
                  name={`login-user-${authRole}`}
                  className="form-control" 
                  placeholder={authRole === 'staff' ? 'Enter BNG Code (e.g. BNG1002)' : 'Enter HOD Email Address'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required 
                />
              )}
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                id={`login-pass-${authRole}`}
                name={`login-pass-${authRole}`}
                className="form-control" 
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Log In
            </button>
            {authRole === 'student' && (
              <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                New student?{' '}
                <button 
                  type="button" 
                  onClick={() => setActiveTab('register')} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--primary)', 
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit'
                  }}
                >
                  Register your account here
                </button>
              </p>
            )}
          </form>
        )}

        {/* Register Forms */}
        {activeTab === 'register' && authRole === 'student' && (
          <form onSubmit={handleStudentRegister}>
            <div className="form-group">
              <label>SCS Student ID</label>
              <div style={{ display: 'flex', width: '100%' }}>
                <span style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRight: 'none',
                  color: 'var(--text-secondary)',
                  padding: '12px 16px',
                  borderTopLeftRadius: 'var(--radius-md)',
                  borderBottomLeftRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: '700',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none'
                }}>
                  SCS
                </span>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter number (e.g. 1353615)"
                  value={scsDigits}
                  onChange={e => handleScsDigitsChange(e.target.value)}
                  style={{
                    borderTopLeftRadius: '0',
                    borderBottomLeftRadius: '0',
                    flex: 1
                  }}
                  required 
                />
              </div>
              {isCheckingScs ? (
                <span style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '4px' }}>Fetching details...</span>
              ) : (
                !studentDetails && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Enter your 7 or 8 digit student number to fetch official details.</span>
              )}
            </div>

            <div className="form-group">
              <label>Student Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={studentDetails ? studentDetails.name : ''} 
                disabled 
                placeholder="Auto-extracted Student Name"
              />
            </div>

            <div className="form-group">
              <label>Category (Class)</label>
              <input 
                type="text" 
                className="form-control" 
                value={studentDetails ? studentDetails.category : ''} 
                disabled 
                placeholder="Auto-extracted Category"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Section</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={studentDetails ? studentDetails.section : ''} 
                  disabled 
                  placeholder="Auto-extracted Section"
                />
              </div>

              <div className="form-group">
                <label>Campus</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={studentDetails ? studentDetails.campus : ''} 
                  disabled 
                  placeholder="Auto-extracted Campus"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Parent mobile watsup number</label>
              <input 
                type="tel" 
                className="form-control" 
                placeholder="10 digit contact number"
                value={parentMobile}
                onChange={e => setParentMobile(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                required 
              />
            </div>

            <div className="form-group">
              <label>Create Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="Create password"
                value={createPwd}
                onChange={e => setCreatePwd(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={!studentDetails}>
              Register Student
            </button>
          </form>
        )}

        {activeTab === 'register' && authRole === 'staff' && (
          <form onSubmit={handleStaffRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Staff BNG Code</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="BNGXXXX"
                  value={bngCode}
                  onChange={e => setBngCode(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Staff Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter name"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Subject Teaching</label>
                <select className="form-control" value={staffSubject} onChange={e => setStaffSubject(e.target.value)}>
                  <option value="BOTANY">BOTANY</option>
                  <option value="ZOOLOGY">ZOOLOGY</option>
                  <option value="PHYSICS">PHYSICS</option>
                  <option value="CHEMISTRY">CHEMISTRY</option>
                  <option value="BIOLOGY">BIOLOGY</option>
                </select>
              </div>
              <div className="form-group">
                <label>Dean Assigned</label>
                <select className="form-control" value={staffDean} onChange={e => setStaffDean(e.target.value)}>
                  <option value="Anand Sir">Anand Sir</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Select Category (Class)</label>
              <select className="form-control" value={staffCategory} onChange={e => setStaffCategory(e.target.value)}>
                {dropdowns.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Select Section</label>
              <select className="form-control" value={staffSection} onChange={e => setStaffSection(e.target.value)}>
                {dropdowns.sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Select Campus(es) <span style={{ fontWeight: '400', fontSize: '12px', color: 'var(--text-muted)' }}>(tick all that apply)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                {dropdowns.campuses.map(c => (
                  <label 
                    key={c} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      border: staffCampuses.includes(c) ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                      background: staffCampuses.includes(c) ? 'var(--primary-glow)' : '#f8fafc',
                      fontWeight: staffCampuses.includes(c) ? '700' : '500',
                      color: staffCampuses.includes(c) ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      transition: 'var(--transition)',
                      userSelect: 'none'
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={staffCampuses.includes(c)}
                      onChange={e => {
                        if (e.target.checked) {
                          setStaffCampuses(prev => [...prev, c]);
                        } else {
                          setStaffCampuses(prev => prev.filter(x => x !== c));
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <span style={{ 
                      width: '16px', height: '16px', borderRadius: '4px', border: '2px solid',
                      borderColor: staffCampuses.includes(c) ? 'var(--primary)' : '#94a3b8',
                      background: staffCampuses.includes(c) ? 'var(--primary)' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {staffCampuses.includes(c) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                    </span>
                    {c}
                  </label>
                ))}
              </div>
              {staffCampuses.length === 0 && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>Please select at least one campus</span>}
            </div>

            <div className="form-group">
              <label>Staff WhatsApp Number</label>
              <input 
                type="tel" 
                className="form-control" 
                placeholder="10 digit number"
                value={staffMobile}
                onChange={e => setStaffMobile(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                required 
              />
            </div>

            <div className="form-group">
              <label>Create Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••"
                value={createPwd}
                onChange={e => setCreatePwd(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Register Staff
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   HOD ADMIN DASHBOARD
   ========================================================================== */
function HodDashboard({ token }) {
  const [pendingStudents, setPendingStudents] = useState([]);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [exams, setExams] = useState([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('users'); // users | exams | logs

  // Fetch all pending users and exams
  const loadData = async () => {
    try {
      const userRes = await fetch(`${API_BASE}/api/admin/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();
      setPendingStudents(userData.students || []);
      setPendingStaff(userData.staff || []);

      const examRes = await fetch(`${API_BASE}/api/exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const examData = await examRes.json();
      setExams(examData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle Approvals
  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Add to simulated logs
      if (data.whatsapp) {
        setWhatsAppLogs(prev => [
          {
            phone: data.whatsapp.phone,
            text: data.whatsapp.text,
            time: new Date().toLocaleTimeString()
          },
          ...prev
        ]);

        // Open WhatsApp Web automatically for manual send bypass
        const waUrl = `https://api.whatsapp.com/send?phone=91${data.whatsapp.phone}&text=${encodeURIComponent(data.whatsapp.text)}`;
        window.open(waUrl, '_blank');
      }

      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Handle Rejections
  const handleReject = async (userId) => {
    // Use a simple inline state-based confirm via toast instead of window.confirm
    const confirmed = window.confirm('Are you sure you want to reject this registration? This action cannot be undone.');
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Rejection failed');
      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Release Exam
  const handleReleaseExam = async (examId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/release`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ examId })
      });
      const data = await res.json();
      showToast(data.message, 'success');
      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Re-scan exams folder
  const handleScanExams = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      let report = `${data.message}\n`;
      if (data.ingested.length) {
        report += `\nIngested:\n` + data.ingested.map(i => `- ${i.name} (${i.questionsCount} Qs)`).join('\n');
      }
      if (data.skipped.length) {
        report += `\nSkipped (exists/no key):\n` + data.skipped.map(s => `- ${s.name}: ${s.reason}`).join('\n');
      }
      showToast(report, 'success');
      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="glass-panel" style={{ minHeight: '80vh' }}>
      <div className="dashboard-tabs">
        <button className={`dashboard-tab-link ${activeSubTab === 'users' ? 'active' : ''}`} onClick={() => setActiveSubTab('users')}>
          <Users size={16} /> Approvals Queue ({pendingStudents.length + pendingStaff.length})
        </button>
        <button className={`dashboard-tab-link ${activeSubTab === 'exams' ? 'active' : ''}`} onClick={() => setActiveSubTab('exams')}>
          <BookOpen size={16} /> Exam Manager
        </button>
        <button className={`dashboard-tab-link ${activeSubTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveSubTab('logs')}>
          <Send size={16} /> WhatsApp Sending Logs ({whatsAppLogs.length})
        </button>
      </div>

      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div>
            <h3>Pending Student Registrations ({pendingStudents.length})</h3>
            {pendingStudents.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>No student approvals pending.</p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SCS Number</th>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Section</th>
                      <th>Campus</th>
                      <th>Parent WhatsApp</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingStudents.map(student => (
                      <tr key={student.user_id}>
                        <td>{student.scs_number}</td>
                        <td><strong>{student.name}</strong></td>
                        <td>{student.category}</td>
                        <td>{student.section}</td>
                        <td>{student.campus}</td>
                        <td>{student.parent_mobile}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-success" onClick={() => handleApprove(student.user_id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Approve
                            </button>
                            <button className="btn btn-danger" onClick={() => handleReject(student.user_id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3>Pending Staff Registrations ({pendingStaff.length})</h3>
            {pendingStaff.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>No staff approvals pending.</p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>BNG Code</th>
                      <th>Staff Name</th>
                      <th>Subject</th>
                      <th>Dean</th>
                      <th>Category/Section</th>
                      <th>Campus</th>
                      <th>WhatsApp</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingStaff.map(staff => (
                      <tr key={staff.user_id}>
                        <td>{staff.username}</td>
                        <td><strong>{staff.name}</strong></td>
                        <td><span className="badge badge-approved">{staff.subject}</span></td>
                        <td>{staff.dean}</td>
                        <td>{staff.category} - {staff.section}</td>
                        <td>{staff.campus}</td>
                        <td>{staff.mobile}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-success" onClick={() => handleApprove(staff.user_id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Approve
                            </button>
                            <button className="btn btn-danger" onClick={() => handleReject(staff.user_id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'exams' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Ingested Exam Library ({exams.length})</h3>
            <button className="btn btn-primary" onClick={handleScanExams}>
              <RefreshCw size={16} /> Scan Exams Folder
            </button>
          </div>

          {exams.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No exams ingested. Click "Scan Exams Folder" to parse local folders.</p>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exam Folder Name</th>
                    <th>Test Type</th>
                    <th>Scheduled Date</th>
                    <th>Release Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(exam => (
                    <tr key={exam.id}>
                      <td><strong>{exam.name}</strong></td>
                      <td><span className="badge" style={{ background: 'var(--primary-glow)', color: '#93c5fd' }}>{exam.test_type}</span></td>
                      <td>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        {exam.is_released ? (
                          <span className="badge badge-approved"><Check size={12} /> Released</span>
                        ) : (
                          <span className="badge badge-pending">Draft Ingested</span>
                        )}
                      </td>
                      <td>
                        {!exam.is_released && (
                          <button className="btn btn-success" onClick={() => handleReleaseExam(exam.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            Release Paper
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div>
          <h3>Simulated Outbox Notifications</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Logs of sent parent/staff registration approvals (Clicking approve automatically opens these pre-filled messages on WhatsApp Web).
          </p>
          {whatsAppLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No messages sent in this session.</p>
          ) : (
            <div>
              {whatsAppLogs.map((log, idx) => (
                <div key={idx} className="whatsapp-log-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span><strong>To: +91 {log.phone}</strong></span>
                    <span>{log.time}</span>
                  </div>
                  <p style={{ fontSize: '14px' }}>{log.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   STUDENT DASHBOARD & TEST ENVIRONMENT
   ========================================================================== */
function StudentDashboard({ token, profile }) {
  const [subTab, setSubTab] = useState('tests'); // tests | reports
  const [exams, setExams] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  
  // Test Exec States
  const [activeExam, setActiveExam] = useState(null); // active exam object or null
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0); // 0 to 179
  const [answers, setAnswers] = useState({}); // { qNo: { selected, time_spent_sec } }
  const [timeLeft, setTimeLeft] = useState(3 * 60 * 60); // 3 Hours (180 Mins)
  const [isTestStarted, setIsTestStarted] = useState(false);
  
  // Live question timer display (seconds on current question)
  const [currentQSecs, setCurrentQSecs] = useState(0);

  // Time tracker for active question
  const questionFocusTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const questionIntervalRef = useRef(null);

  // Professional confirm modal state
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }

  // Reattempt Modal State
  const [reattemptQ, setReattemptQ] = useState(null); // question number
  const [reattemptReason, setReattemptReason] = useState('');
  const [reattemptOption, setReattemptOption] = useState(null);
  const [reattemptResult, setReattemptResult] = useState(null);

  const fetchExamsAndReports = async () => {
    try {
      // 1. Fetch exams
      const examRes = await fetch(`${API_BASE}/api/exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const examData = await examRes.json();
      setExams(examData);

      // 2. Fetch submissions to display reports
      // Here we scan submissions, we need student submissions list. But wait, in SQL we can get it.
      // Let's fetch all submissions for this student. In backend, we don't have a direct submissions route but we can fetch them.
      // Wait, let's look at the database. Yes, we can fetch submission list by sending a GET to `/api/reports/` if we write the endpoint,
      // or we can fetch them by joining submissions with student id.
      // Wait, did we define a route for list of submissions? No, in server.js we only defined `/api/reports/:submissionId`.
      // Let's create an endpoint on the fly or adjust the server, or we can fetch reports via a query.
      // Wait! We can add an endpoint to fetch reports in `server.js` or we can make a query. Let's see:
      // Can we fetch submissions using a GET `/api/reports` which returns all submissions for the logged in student?
      // Yes! That's missing in our server.js routes. Let's check `server.js`:
      // `app.get('/api/reports/:submissionId', authMiddleware(['hod', 'staff', 'student']), examController.getReport);`
      // We need a route: `app.get('/api/reports', authMiddleware(['student']), ...);` to get all submissions for a student!
      // Let's check: can we add a list submissions handler inside `examController.js` and register it in `server.js`?
      // Yes, absolutely! Let's write `examController.getSubmissionsForStudent` and add it. We will do this via file edit soon.
      // For now, let's call the API `/api/reports` and load the data.
      const reportsRes = await fetch(`${API_BASE}/api/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (subTab === 'reports') {
      fetchExamsAndReports();
    } else {
      // Fetch exams list
      fetch(`${API_BASE}/api/exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setExams(data))
        .catch(err => console.error(err));
    }
  }, [subTab]);

  // Handle auto-submit when timer reaches 0
  useEffect(() => {
    if (isTestStarted && timeLeft === 0) {
      handleAutoSubmit();
    }
  }, [timeLeft, isTestStarted]);

  // Start Exam
  const handleStartExam = async (exam) => {
    // Check if exam was already attempted
    // Students cannot reattempt released exams directly unless they complete it once and view reports
    const alreadyDone = reports.find(r => r.exam_id === exam.id);
    if (alreadyDone) {
      showToast('You have already completed this exam. Check the Reports tab to review your performance.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/exams/${exam.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      setActiveExam(data.exam);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswers({});
      setTimeLeft(3 * 60 * 60); // 3 Hours (180 minutes)
      setIsTestStarted(true);

      // Start timers
      questionFocusTimeRef.current = 0;
      startTimerInterval();
    } catch (e) {
      console.error(e);
      showToast('Failed to load exam details.', 'error');
    }
  };

  // Timer intervals
  const startTimerInterval = () => {
    // Global countdown
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Active question focus timer - also updates display counter
    questionIntervalRef.current = setInterval(() => {
      questionFocusTimeRef.current += 1;
      setCurrentQSecs(prev => prev + 1);
    }, 1000);
  };

  // Switch questions
  const handleGoToQuestion = (idx) => {
    // 1. Record current question time spent
    const currentQNo = questions[currentIdx].q_no;
    const currentFocusTime = questionFocusTimeRef.current;
    setAnswers(prev => {
      const currentAnsObj = prev[currentQNo] || { selected: null, time_spent_sec: 0 };
      return {
        ...prev,
        [currentQNo]: {
          ...currentAnsObj,
          time_spent_sec: currentAnsObj.time_spent_sec + currentFocusTime
        }
      };
    });

    // 2. Reset focus timer and display
    questionFocusTimeRef.current = 0;
    setCurrentQSecs(0);

    // 3. Switch idx
    setCurrentIdx(idx);
  };

  // Lock option handler
  const handleSelectOption = (optionVal) => {
    const qNo = questions[currentIdx].q_no;
    
    // Once clicked: locks the option (not editable)
    if (answers[qNo]?.selected !== undefined && answers[qNo]?.selected !== null) {
      // Already selected, locked
      return;
    }

    const currentFocusTime = questionFocusTimeRef.current;

    setAnswers(prev => ({
      ...prev,
      [qNo]: {
        selected: optionVal,
        time_spent_sec: (prev[qNo]?.time_spent_sec || 0) + currentFocusTime
      }
    }));

    // Reset question focus timer
    questionFocusTimeRef.current = 0;
    setCurrentQSecs(0);

    // Auto navigate to next question if available after a brief visual confirmation delay
    if (currentIdx < questions.length - 1) {
      setTimeout(() => {
        setCurrentIdx(prevIdx => prevIdx + 1);
      }, 400);
    }
  };

  // Skip question handler
  const handleSkipQuestion = () => {
    const qNo = questions[currentIdx].q_no;
    
    if (answers[qNo]?.selected !== undefined && answers[qNo]?.selected !== null) {
      // Already selected, locked
      return;
    }

    const currentFocusTime = questionFocusTimeRef.current;

    setAnswers(prev => ({
      ...prev,
      [qNo]: {
        selected: null,
        time_spent_sec: (prev[qNo]?.time_spent_sec || 0) + currentFocusTime
      }
    }));

    questionFocusTimeRef.current = 0;
    setCurrentQSecs(0);

    // Auto navigate to next question if available
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  // Auto Submit when time finishes
  const handleAutoSubmit = () => {
    showToast('Time limit reached! Your responses are being submitted automatically.', 'info');
    submitTest(true);
  };

  // Show professional confirm modal
  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ title, message, onConfirm });
  };

  // Submit test
  const submitTest = async (isAuto = false) => {
    if (!isAuto) {
      // Use professional modal instead of window.confirm
      showConfirm(
        'Submit Exam Paper',
        'Are you sure you want to finish and submit your exam? Once submitted, you cannot change your answers.',
        () => doSubmit()
      );
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {

    // Capture the final question focus time
    const currentQNo = questions[currentIdx].q_no;
    const finalAnswers = {
      ...answers,
      [currentQNo]: {
        selected: answers[currentQNo]?.selected || null,
        time_spent_sec: (answers[currentQNo]?.time_spent_sec || 0) + questionFocusTimeRef.current
      }
    };

    // Stop intervals
    clearInterval(timerIntervalRef.current);
    clearInterval(questionIntervalRef.current);

    try {
      const res = await fetch(`${API_BASE}/api/exams/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          examId: activeExam.id,
          studentId: profile.user_id,
          answers: finalAnswers
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(`Submission successful! You scored ${data.score} / 720`, 'success');
      setIsTestStarted(false);
      setActiveExam(null);
      setSubTab('reports');
      viewReportDetails(data.submissionId); // Immediately load and open the detailed report!
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Fetch individual report details
  const viewReportDetails = async (subId) => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/${subId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedReport(data);
    } catch (e) {
      showToast('Error fetching report details.', 'error');
    }
  };

  // Reattempt workflow
  const openReattemptModal = (qNo) => {
    setReattemptQ(qNo);
    setReattemptReason('');
    setReattemptOption(null);
    setReattemptResult(null);
  };

  const handleReattemptSubmit = async () => {
    const validation = validateReason(reattemptReason);
    if (!validation.isValid) {
      showToast(validation.message, 'warning');
      return;
    }
    if (!reattemptOption) {
      showToast('Please select your new option key.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/exams/reattempt`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submissionId: selectedReport.submission.id,
          qNo: reattemptQ,
          reason: reattemptReason,
          selectedKey: reattemptOption
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setReattemptResult({
        isCorrect: data.isCorrect,
        correctKey: data.correctKey
      });

      // Reload report details to refresh the screen state
      viewReportDetails(selectedReport.submission.id);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Active testing viewport
  if (isTestStarted && activeExam) {
    const currentQuestion = questions[currentIdx];
    const qNo = currentQuestion?.q_no;
    const selectedAns = answers[qNo]?.selected;
    const isLocked = selectedAns !== undefined && selectedAns !== null;

    // Total time spent on current question so far
    const totalQTime = (answers[qNo]?.time_spent_sec || 0) + currentQSecs;

    return (
      <>
      {confirmModal && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }}>Yes, Submit Exam</button>
            </div>
          </div>
        </div>
      )}
      <div className="exam-layout">
        {/* Left side: Exam question console */}
        <div className="exam-content">
          <div className="exam-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="subject-badge">{currentQuestion?.subject}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                Q {currentIdx + 1} / 180
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: '600' }}>This Question</div>
                <div style={{ color: 'var(--primary)', fontWeight: '700' }}>{totalQTime}s spent</div>
              </div>
              <div className={`timer-box ${timeLeft < 600 ? 'critical' : ''}`}>
                <Clock size={20} /> {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="question-panel">
            <div className="question-image-container">
              <img 
                src={currentQuestion?.image_url || `${API_BASE}/api/exams/${activeExam.id}/questions/${qNo}/image?token=${token}`} 
                alt={`Question ${qNo}`} 
                className="question-image" 
              />
            </div>

            <div className="answer-options-bar">
              <div className="options-row">
                {[1, 2, 3, 4].map(opt => {
                  const labelMap = { 1: '1 (A)', 2: '2 (B)', 3: '3 (C)', 4: '4 (D)' };
                  return (
                    <button 
                      key={opt}
                      className={`option-btn ${selectedAns === opt ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isLocked}
                    >
                      {isLocked && selectedAns === opt && <CheckCircle2 size={16} />}
                      {labelMap[opt]}
                    </button>
                  );
                })}
              </div>

              <div className="question-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleGoToQuestion(currentIdx - 1)}
                  disabled={currentIdx === 0}
                >
                  Previous Question
                </button>

                <button 
                  className="btn btn-danger"
                  onClick={handleSkipQuestion}
                  disabled={isLocked}
                  style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}
                >
                  Skip Question
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleGoToQuestion(currentIdx + 1)}
                  >
                    Next Question <ChevronRight size={16} />
                  </button>
                ) : (
                  <button 
                    className="btn btn-success"
                    onClick={() => submitTest(false)}
                  >
                    Submit Exam Paper
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Questions navigation grid */}
        <div className="exam-side-panel">
          <div className="side-panel-header">
            <h4>Question Navigation</h4>
            <div className="grid-legend" style={{ marginTop: '8px' }}>
              <div className="legend-item"><span className="legend-dot answered"></span> Answered</div>
              <div className="legend-item"><span className="legend-dot skipped"></span> Skipped</div>
              <div className="legend-item"><span className="legend-dot unvisited"></span> Unvisited</div>
            </div>
          </div>

          <div className="question-grid">
            {questions.map((q, idx) => {
              const ansState = answers[q.q_no];
              let cellClass = '';
              if (ansState) {
                cellClass = ansState.selected !== null ? 'answered' : 'skipped';
              }
              const timeSpent = ansState?.time_spent_sec || (currentIdx === idx ? currentQSecs : 0);
              return (
                <div 
                  key={q.q_no} 
                  className={`grid-cell ${cellClass} ${currentIdx === idx ? 'active' : ''}`}
                  onClick={() => handleGoToQuestion(idx)}
                  title={`${q.subject} — ${timeSpent}s spent`}
                >
                  <span style={{ fontSize: '11px', fontWeight: '700' }}>{q.q_no}</span>
                  {timeSpent > 0 && <span style={{ fontSize: '8px', opacity: 0.7, display: 'block' }}>{timeSpent}s</span>}
                </div>
              );
            })}
          </div>

          <button className="btn btn-success" onClick={() => submitTest(false)} style={{ width: '100%' }}>
            Finish & Submit
          </button>
        </div>
      </div>
      </>
    );
  }

  // Dashboard View
  return (
    <div className="glass-panel" style={{ minHeight: '80vh' }}>
      <div className="dashboard-tabs">
        <button className={`dashboard-tab-link ${subTab === 'tests' ? 'active' : ''}`} onClick={() => { setSubTab('tests'); setSelectedReport(null); setSelectedFolder(null); }}>
          <BookOpen size={16} /> Exams to write
        </button>
        <button className={`dashboard-tab-link ${subTab === 'reports' ? 'active' : ''}`} onClick={() => setSubTab('reports')}>
          <FileText size={16} /> Test Performance Reports
        </button>
      </div>

      {subTab === 'tests' && (
        <div>
          {selectedFolder === null ? (
            <div>
              <h3>Academic Year 2025 NEET Exam Papers</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Select a test type category below to browse and attempt date-wise academic year 2025 objective papers.
              </p>

              {exams.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No exams have been released yet by the HOD Admin.</p>
              ) : (
                (() => {
                  const availableTypes = Array.from(new Set(exams.map(e => e.test_type).filter(Boolean))).sort();
                  return (
                    <div className="exams-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                      {availableTypes.map(type => {
                        const count = exams.filter(e => e.test_type === type).length;
                        return (
                          <div 
                            key={type} 
                            className="exam-card" 
                            onClick={() => setSelectedFolder(type)}
                            style={{ 
                              cursor: 'pointer', 
                              textAlign: 'center', 
                              padding: '30px 20px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 'var(--radius-md)',
                              transition: 'var(--transition)',
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.borderColor = 'var(--primary)';
                              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)';
                            }}
                          >
                            <BookOpen size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>{type}</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                              {count} {count === 1 ? 'Exam' : 'Exams'} Available
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          ) : (
            <div>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedFolder(null)} 
                style={{ marginBottom: '20px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                ← Back to Categories
              </button>
              
              <h3>2025 {selectedFolder} Test Papers</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Browse and solve date-wise 2025 objective papers. Answers lock immediately upon selection.
              </p>

              <div className="exams-grid">
                {exams.filter(e => e.test_type === selectedFolder).map(exam => (
                  <div key={exam.id} className="exam-card">
                    <div className="exam-info">
                      <h3>{exam.name}</h3>
                      <div className="exam-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <span className="meta-item"><Clock size={14} /> 180 Minutes (3 hrs)</span>
                        <span className="meta-item"><BookOpen size={14} /> 180 Questions</span>
                        {exam.exam_date && (
                          <span className="meta-item" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                            <Calendar size={14} /> Date: {new Date(exam.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleStartExam(exam)} style={{ width: '100%', marginTop: '15px' }}>
                      <Play size={16} /> Start Test Paper
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'reports' && !selectedReport && (
        <div>
          <h3>My Test Reports</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Review your scorecard, check skipped/wrong answers, download dynamic PDFs, and access the reattempt mistake log.
          </p>

          {reports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>You haven't submitted any tests yet.</p>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exam Name</th>
                    <th>Date Attempted</th>
                    <th>Score (out of 720)</th>
                    <th>Time Spent</th>
                    <th>Accuracy Breakdown</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(rep => (
                    <tr key={rep.id}>
                      <td><strong>{rep.exam_name}</strong></td>
                      <td>{new Date(rep.submitted_at).toLocaleString()}</td>
                      <td>
                        <strong style={{ color: rep.score >= 360 ? 'var(--success)' : 'var(--danger)' }}>
                          {rep.score} / 720
                        </strong>
                      </td>
                      <td>{Math.floor(rep.time_spent / 60)}m {rep.time_spent % 60}s</td>
                      <td>
                        <span style={{ color: 'var(--success)' }}>{rep.correct_count} Correct</span> |{' '}
                        <span style={{ color: 'var(--danger)' }}>{rep.wrong_count} Wrong</span> |{' '}
                        <span style={{ color: 'var(--warning)' }}>{rep.unattempted_count} Skipped</span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => viewReportDetails(rep.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                          View Full Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'reports' && selectedReport && (
        <div className="report-grid">
          {/* Main details */}
          <div>
            <div className="report-card-header">
              <div>
                <button className="btn btn-secondary" onClick={() => setSelectedReport(null)} style={{ padding: '4px 10px', fontSize: '12px', marginBottom: '10px' }}>
                  ← Back to List
                </button>
                <h2>Performance Report: {selectedReport.submission.exam_name}</h2>
                <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                  <span>Attempted: <strong>{new Date(selectedReport.submission.submitted_at).toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Total Time Spent: <strong>{Math.floor(selectedReport.submission.time_spent / 60)}m {selectedReport.submission.time_spent % 60}s</strong></span>
                </div>
              </div>
              <button className="btn btn-success" onClick={() => generateStudentPDFReport(selectedReport)}>
                <Download size={16} /> Download PDF Report Card
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--primary-glow)' }}><FileText /></div>
                <div className="stat-details">
                  <h4>TOTAL SCORE</h4>
                  <p>{selectedReport.submission.score} / 720</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon success" style={{ background: 'var(--success-bg)' }}><CheckCircle2 /></div>
                <div className="stat-details">
                  <h4>CORRECT (+4)</h4>
                  <p>{selectedReport.submission.correct_count}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon danger" style={{ background: 'var(--danger-bg)' }}><XCircle /></div>
                <div className="stat-details">
                  <h4>WRONG (-1)</h4>
                  <p>{selectedReport.submission.wrong_count}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon warning" style={{ background: 'var(--warning-bg)' }}><Clock /></div>
                <div className="stat-details">
                  <h4>SKIPPED (0)</h4>
                  <p>{selectedReport.submission.unattempted_count}</p>
                </div>
              </div>
            </div>

            {/* Reattempt Wrong/Unattempted console */}
            <div style={{ marginTop: '30px' }}>
              <h3>Incorrect & Skipped Questions — Reattempt Portal</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                You can reattempt questions you got wrong or skipped. Write a clear, genuine reason why you missed the question to unlock it. Nonsensical or random text will not be accepted.
              </p>

              <div className="reattempt-grid">
                {Object.keys(selectedReport.submission.answers).map(qNoStr => {
                  const ans = selectedReport.submission.answers[qNoStr];
                  const reattemptDone = selectedReport.reattempts.find(r => r.q_no.toString() === qNoStr);
                  
                  // Filter out correct answers
                  if (ans.is_correct && ans.is_attempted) return null;

                  return (
                    <div key={qNoStr} className="reattempt-card" style={{ borderLeft: reattemptDone ? '3px solid var(--success)' : '3px solid var(--danger)' }}>
                      <div className="reattempt-info">
                        <strong>Question {qNoStr}</strong>
                        <span className="badge" style={{ background: ans.is_attempted ? 'var(--danger-bg)' : 'var(--warning-bg)', color: ans.is_attempted ? 'var(--danger)' : 'var(--warning)' }}>
                          {ans.is_attempted ? 'Wrong' : 'Skipped'}
                        </span>
                      </div>
                      
                      {reattemptDone ? (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                          <p style={{ color: 'var(--success)' }}><strong>Reattempted:</strong> {reattemptDone.is_correct ? 'CORRECT now' : 'INCORRECT'}</p>
                          <p style={{ color: 'var(--text-muted)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            Reason: {reattemptDone.reason}
                          </p>
                        </div>
                      ) : (
                        <button className="btn btn-primary" onClick={() => openReattemptModal(parseInt(qNoStr))} style={{ padding: '8px', fontSize: '13px' }}>
                          Unlock & Reattempt
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar: Subject Staff and Info */}
          <div>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4>My Teaching Staff</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
                Class teachers mapped to your Campus, Class, and Section.
              </p>
              
              <div className="staff-section">
                <div className="staff-item">
                  <span className="staff-subj">BOTANY</span>
                  <span className="staff-name">{selectedReport.staff.BOTANY.join(', ') || 'Not Assigned'}</span>
                </div>
                <div className="staff-item">
                  <span className="staff-subj">ZOOLOGY</span>
                  <span className="staff-name">{selectedReport.staff.ZOOLOGY.join(', ') || 'Not Assigned'}</span>
                </div>
                <div className="staff-item">
                  <span className="staff-subj">PHYSICS</span>
                  <span className="staff-name">{selectedReport.staff.PHYSICS.join(', ') || 'Not Assigned'}</span>
                </div>
                <div className="staff-item">
                  <span className="staff-subj">CHEMISTRY</span>
                  <span className="staff-name">{selectedReport.staff.CHEMISTRY.join(', ') || 'Not Assigned'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reattempt Modal — full-screen two-column popup */}
      {reattemptQ && (
        <div className="modal-backdrop" style={{ padding: '16px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px',
              background: 'var(--primary)',
              color: '#fff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.2)', borderRadius: '8px',
                  padding: '6px 12px', fontSize: '13px', fontWeight: '700'
                }}>
                  Q {reattemptQ}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>Reattempt Question</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {selectedReport?.submission?.answers?.[reattemptQ]?.subject} &nbsp;·&nbsp;
                    {selectedReport?.submission?.answers?.[reattemptQ]?.is_attempted ? 'Wrong Answer' : 'Skipped'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setReattemptQ(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  width: '34px', height: '34px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                ✕
              </button>
            </div>

            {/* Modal Body — two columns */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* LEFT: Question Image (large, scrollable) */}
              <div style={{
                flex: '1 1 55%',
                background: '#f1f5f9',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 16px',
                  background: '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#64748b',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>
                  Question Image
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center'
                }}>
                  <img
                    src={selectedReport?.submission?.answers?.[reattemptQ]?.image_url || `${API_BASE}/api/exams/${selectedReport.submission.exam_id}/questions/${reattemptQ}/image?token=${token}`}
                    alt={`Question ${reattemptQ}`}
                    style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '8px' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* RIGHT: Controls */}
              <div style={{
                flex: '1 1 45%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Step 1: Reason */}
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '800', flexShrink: 0
                      }}>1</div>
                      <label style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                        Why did you get this wrong / skip it?
                      </label>
                    </div>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="E.g., I made a calculation mistake, or I ran out of time and skipped it..."
                      value={reattemptReason}
                      onChange={e => setReattemptReason(e.target.value)}
                      disabled={reattemptResult !== null}
                      style={{ fontSize: '13px', resize: 'vertical', minHeight: '80px' }}
                    />
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '11px', marginTop: '6px',
                      color: reattemptReason.length >= 15
                        ? (validateReason(reattemptReason).isValid ? 'var(--success)' : 'var(--danger)')
                        : 'var(--warning)'
                    }}>
                      <span>{reattemptReason.length} / 15 characters</span>
                      {reattemptReason.length < 15 && (
                        <span>{15 - reattemptReason.length} more needed</span>
                      )}
                      {reattemptReason.length >= 15 && !validateReason(reattemptReason).isValid && (
                        <span style={{ fontWeight: '700' }}>{validateReason(reattemptReason).message}</span>
                      )}
                      {reattemptReason.length >= 15 && validateReason(reattemptReason).isValid && (
                        <span style={{ fontWeight: '700' }}>✓ Reason accepted</span>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Pick answer — shown only after reason is valid */}
                  {validateReason(reattemptReason).isValid && !reattemptResult && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: 'var(--primary)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: '800', flexShrink: 0
                        }}>2</div>
                        <label style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                          Select your answer:
                        </label>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {[1, 2, 3, 4].map(opt => {
                          const labels = { 1: 'Option A', 2: 'Option B', 3: 'Option C', 4: 'Option D' };
                          const isSelected = reattemptOption === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => setReattemptOption(opt)}
                              style={{
                                padding: '14px 10px',
                                borderRadius: '10px',
                                border: isSelected ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                                background: isSelected ? 'var(--primary)' : '#f8fafc',
                                color: isSelected ? '#fff' : 'var(--text-primary)',
                                fontWeight: '700', fontSize: '14px',
                                cursor: 'pointer', transition: 'all 0.15s',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '2px'
                              }}
                            >
                              <span style={{ fontSize: '18px' }}>{opt}</span>
                              <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: '500' }}>{labels[opt]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {reattemptResult && (
                    <div style={{
                      background: reattemptResult.isCorrect ? 'var(--success-bg)' : 'var(--danger-bg)',
                      padding: '16px', borderRadius: '10px',
                      border: reattemptResult.isCorrect ? '1px solid var(--success)' : '1px solid var(--danger)',
                      display: 'flex', gap: '12px', alignItems: 'center'
                    }}>
                      {reattemptResult.isCorrect ? (
                        <>
                          <CheckCircle2 color="var(--success)" size={28} />
                          <div>
                            <strong style={{ color: 'var(--success)', fontSize: '15px' }}>Correct! Well done.</strong>
                            <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>You have successfully resolved this mistake.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle color="var(--danger)" size={28} />
                          <div>
                            <strong style={{ color: 'var(--danger)', fontSize: '15px' }}>Incorrect Option</strong>
                            <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>Study this question again carefully and try when ready.</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: '10px',
                  padding: '16px 20px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexShrink: 0
                }}>
                  <button className="btn btn-secondary" onClick={() => setReattemptQ(null)}>
                    Close
                  </button>
                  {validateReason(reattemptReason).isValid && !reattemptResult && (
                    <button
                      className="btn btn-primary"
                      onClick={handleReattemptSubmit}
                      disabled={!reattemptOption}
                      style={{
                        opacity: reattemptOption ? 1 : 0.45,
                        cursor: reattemptOption ? 'pointer' : 'not-allowed',
                        minWidth: '160px'
                      }}
                    >
                      {reattemptOption ? '✓ Submit Reattempt' : 'Select an option first'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ==========================================================================
   STAFF ANALYTICS DASHBOARD
   ========================================================================== */
function StaffDashboard({ token, profile }) {
  const [studentsList, setStudentsList] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [reattempts, setReattempts] = useState([]);
  const [classroom, setClassroom] = useState(null);

  // Filter States
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [filterOptions, setFilterOptions] = useState({ sections: [], campuses: [] });
  const [viewDetailsSub, setViewDetailsSub] = useState(null); // Active detailed view

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/staff/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setClassroom(data.classroom);
      setStudentsList(data.students || []);
      setSubmissions(data.submissions || []);
      setReattempts(data.reattempts || []);
      setFilterOptions(data.filterOptions || { sections: [], campuses: [] });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Send WhatsApp notification
  const handleNotifyStudent = (mobileNo, examName) => {
    const textMsg = `*SRI CHAITANYA EDUCATIONAL INSTITUTIONS*\n\nDear Parent,\nPlease note that a new NEET mock practice test paper has been released: *${examName.trim()}*.\n\nKindly ensure that your ward attempts the test paper on time within the 3-hour limit, and reviews their performance afterward.\n\n*App URL:* http://localhost:5174/\n\nRegards,\n*Sri Chaitanya Faculty Team*`;
    const waUrl = `https://api.whatsapp.com/send?phone=91${mobileNo}&text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  };

  // Multi-filter: section, campus, student
  const filteredSubmissions = submissions.filter(s => {
    if (selectedSection && s.student_section !== selectedSection) return false;
    if (selectedCampus && s.student_campus !== selectedCampus) return false;
    if (selectedStudent && s.scs_number !== selectedStudent) return false;
    return true;
  });

  // Filtered students list (for the student selector dropdown and WhatsApp table)
  const filteredStudents = studentsList.filter(s => {
    if (selectedSection && s.student_section !== selectedSection) return false;
    if (selectedCampus && s.student_campus !== selectedCampus) return false;
    return true;
  });

  return (
    <div className="glass-panel" style={{ minHeight: '80vh' }}>
      {/* Header + Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
        <div>
          <h3>Staff Classroom Performance Tracker</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Class: <strong>{classroom?.category}</strong> | Section: <strong>{classroom?.section}</strong> | Campus: <strong>{classroom?.campusList?.join(', ') || classroom?.campus}</strong>
          </p>
        </div>
        
        {/* Section + Campus + Student filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {filterOptions.campuses.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Campus:</label>
              <select className="form-control" value={selectedCampus} onChange={e => { setSelectedCampus(e.target.value); setSelectedStudent(''); }} style={{ width: '180px', padding: '6px 10px', fontSize: '12px' }}>
                <option value="">All Campuses</option>
                {filterOptions.campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {filterOptions.sections.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Section:</label>
              <select className="form-control" value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(''); }} style={{ width: '160px', padding: '6px 10px', fontSize: '12px' }}>
                <option value="">All Sections</option>
                {filterOptions.sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Student:</label>
            <select className="form-control" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} style={{ width: '200px', padding: '6px 10px', fontSize: '12px' }}>
              <option value="">All Students</option>
              {filteredStudents.map(st => <option key={st.scs_number} value={st.scs_number}>{st.name} ({st.scs_number})</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        {/* Submissions Section */}
        <div>
          <h3>Exam Results & Question Focus Timings</h3>
          {filteredSubmissions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>No exam papers submitted yet by students in this section.</p>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Exam Title</th>
                    <th>Score</th>
                    <th>Correct / Wrong / Skipped</th>
                    <th>Total Time Spent</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map(sub => {
                    const mins = Math.floor(sub.time_spent / 60);
                    const secs = sub.time_spent % 60;
                    return (
                      <tr key={sub.submission_id}>
                        <td>
                          <strong>{sub.student_name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub.scs_number}</div>
                        </td>
                        <td>{sub.exam_name}</td>
                        <td>
                          <strong style={{ color: sub.score >= 360 ? 'var(--success)' : 'var(--danger)' }}>
                            {sub.score} / 720
                          </strong>
                        </td>
                        <td>
                          <span style={{ color: 'var(--success)' }}>{sub.correct_count} C</span> |{' '}
                          <span style={{ color: 'var(--danger)' }}>{sub.wrong_count} W</span> |{' '}
                          <span style={{ color: 'var(--warning)' }}>{sub.unattempted_count} S</span>
                        </td>
                        <td>{mins}m {secs}s</td>
                        <td>
                          <button className="btn btn-secondary" onClick={() => setViewDetailsSub(sub)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            View Focus Timings
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reattempts Section */}
        <div>
          <h3>Reattempt logs & Error Explanations</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>
            Review wrong or skipped questions that students reattempted along with their written explanation of the mistake.
          </p>
          {reattempts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No reattempts logged yet.</p>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Exam & Q.No</th>
                    <th>Subject</th>
                    <th>New Result</th>
                    <th>Student Error Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {reattempts.map(reatt => (
                    <tr key={reatt.reattempt_id}>
                      <td>
                        <strong>{reatt.student_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{reatt.scs_number}</div>
                      </td>
                      <td>
                        <div>{reatt.exam_name}</div>
                        <span className="badge badge-pending">Q{reatt.q_no}</span>
                      </td>
                      <td>{reatt.subject}</td>
                      <td>
                        {reatt.is_correct ? (
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Correct Now</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Incorrect</span>
                        )}
                      </td>
                      <td>
                        <div style={{ maxWidth: '400px', fontSize: '12px', whiteSpace: 'normal', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {reatt.reason}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Exam Release Student WhatsApp Broadcasting */}
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
          <h3>Broadcasting & WhatsApp Invites</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '15px' }}>
            Send quick alerts to registered parents about recently released tests.
          </p>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>SCS Number</th>
                  <th>Parent WhatsApp</th>
                  <th>Notify released exams</th>
                </tr>
              </thead>
              <tbody>
                {studentsList.map(st => (
                  <tr key={st.scs_number}>
                    <td><strong>{st.name}</strong></td>
                    <td>{st.scs_number}</td>
                    <td>{st.parent_mobile}</td>
                    <td>
                      <button className="btn btn-primary" onClick={() => handleNotifyStudent(st.parent_mobile, 'Sr Elite (incoming) NEET WET-01')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        <Send size={12} /> Send WhatsApp Alert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Focus Timings Detail Overlay Modal */}
      {viewDetailsSub && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Question Focus Timings: {viewDetailsSub.student_name}</h3>
              <button className="btn btn-secondary" onClick={() => setViewDetailsSub(null)} style={{ padding: '4px 8px' }}>X</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '70vh' }}>
              <p style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
                Exam: <strong>{viewDetailsSub.exam_name}</strong> | Final Score: <strong>{viewDetailsSub.score} / 720</strong>
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {Object.keys(viewDetailsSub.answers).map(qNo => {
                  const ans = viewDetailsSub.answers[qNo];
                  let bg = 'rgba(255, 255, 255, 0.02)';
                  let color = 'var(--text-primary)';
                  if (ans.is_attempted) {
                    bg = ans.is_correct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
                    color = ans.is_correct ? 'var(--success)' : 'var(--danger)';
                  } else {
                    bg = 'rgba(245, 158, 11, 0.15)';
                    color = 'var(--warning)';
                  }
                  
                  return (
                    <div key={qNo} style={{ background: bg, padding: '10px', borderRadius: '6px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: color }}>Q{qNo}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Time: <strong>{ans.time_spent_sec}s</strong>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Option: {ans.selected ? ans.selected : 'Skipped'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewDetailsSub(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
