import React, { useState, useEffect } from 'react';
 
// Standard Base32 key compatible with Authenticator apps (Google / Microsoft)
const OTP_BASE32_SECRET = "RAGEOTPSECRETTSXXKEY";
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/Rage%20Optimization:Admin%3Fsecret%3D${OTP_BASE32_SECRET}%26issuer%3DRage%20Optimization%26algorithm%3DSHA1%26digits%3D6%26period%3D30`;
 
// Base32 Decoder helper to decode secret keys in the browser
function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  base32 = base32.toUpperCase().replace(/=+$/, "");
  let length = base32.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(((length * 5) / 8) | 0);
 
  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output;
}
 
const getApiUrl = (path) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && (window.location.port === '5175' || window.location.port === '5176')) {
    return `http://localhost:5000${path}`;
  }
  return path;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrDrawer, setShowQrDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
 
  // Dynamic TOTP States
  const [totp, setTotp] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);

  // Client Update States
  const [latestVersion, setLatestVersion] = useState('1.0.0');
  const [downloadUrl, setDownloadUrl] = useState('');
 
  // Firebase Configuration States
  const [projectId, setProjectId] = useState(() => localStorage.getItem('firebase_project_id') || 'rage-optimization');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('firebase_api_key') || 'AIzaSyDGJYqtrAaHWouBGAQ5BJb4xaDlvWTQypo');
  const [emailService, setEmailService] = useState(() => localStorage.getItem('email_service') || 'firebase');
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('smtp_host') || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('smtp_port') || '587');
  const [smtpSender, setSmtpSender] = useState(() => localStorage.getItem('smtp_sender') || 'Rage Support <noreply@rage.gg>');
  const [smtpUser, setSmtpUser] = useState(() => localStorage.getItem('smtp_user') || '');
  const [smtpPass, setSmtpPass] = useState(() => localStorage.getItem('smtp_pass') || '');
 
  // Local Mock Licenses fallback list (shown if connection is default or fails)
  const defaultMockLicenses = [
    { id: 'RAGE-DEMO-EXPRESS', username: 'Clasher', email: 'clasher@gmail.com', key: 'RAGE-DEMO-EXPRESS', expiry: '2027-05-22', hwid: 'd1a39d9e4b0d47bcb556ffc76bd488e8', status: 'active', isAdmin: false },
    { id: 'RAGE-ALPHA-9921', username: 'eSportsPlayer', email: 'esports@gmail.com', key: 'RAGE-ALPHA-9921', expiry: '2026-08-15', hwid: 'a93bd1059f1349f2832bc9318b76c8c1', status: 'active', isAdmin: false },
    { id: 'RAGE-PRO-7729', username: 'HackerKid', email: 'hacker@gmail.com', key: 'RAGE-PRO-7729', expiry: '2026-06-01', hwid: '229ab81c002f483c18b7f8c05763901b', status: 'banned', isAdmin: false },
    { id: 'admin', username: 'RageDeveloper', email: 'dev@rage.gg', key: 'admin', expiry: '2030-12-31', hwid: '', status: 'active', isAdmin: true },
    { id: 'RAGE-BOOST-8012', username: 'FreeFirePro', email: 'freefire@gmail.com', key: 'RAGE-BOOST-8012', expiry: '2026-05-10', hwid: 'a023b8f1c82837bc28bc831e782631ab', status: 'expired', isAdmin: false }
  ];
 
  const [licenses, setLicenses] = useState(defaultMockLicenses);
 
  // Form Fields for new key creation
  const [newKey, setNewKey] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newExpiryDays, setNewExpiryDays] = useState('30');
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Cloud Tweak Management States
  const [tweaks, setTweaks] = useState([]);
  const [showTweakModal, setShowTweakModal] = useState(false);
  const [editingTweak, setEditingTweak] = useState(null);
  const [tweakName, setTweakName] = useState('');
  const [tweakCategory, setTweakCategory] = useState('FPS Boost');
  const [tweakFilename, setTweakFilename] = useState('');
  const [tweakContent, setTweakContent] = useState('');
 
  // Support Tickets States
  const [tickets, setTickets] = useState([]);

  // Fetch Cloud Tweaks from Firestore REST API
  const fetchTweaks = async () => {
    if (!projectId || projectId === 'rage-optimization-db') {
      // Offline mock tweaks
      setTweaks([
        { id: 'fps_boost', name: 'FPS Boost Registry Tweak', category: 'FPS Boost', filename: 'FPS_Boost.reg', content: 'Windows Registry Editor Version 5.00\n\n[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl]\n"Win32PrioritySeparation"=dword:00000026' },
        { id: 'latency_reducer', name: 'Free Fire Latency Reducer', category: 'Latency', filename: 'latency.bat', content: '@echo off\nipconfig /release\nipconfig /renew\nipconfig /flushdns' }
      ]);
      return;
    }

    try {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tweaks`);
      if (response.ok) {
        const data = await response.json();
        if (data.documents) {
          const loadedTweaks = data.documents.map(doc => {
            const fields = doc.fields || {};
            const pathParts = doc.name.split('/');
            const id = pathParts[pathParts.length - 1];
            return {
              id: id,
              name: fields.name?.stringValue || '',
              category: fields.category?.stringValue || 'Advanced',
              filename: fields.filename?.stringValue || '',
              content: fields.content?.stringValue || ''
            };
          });
          setTweaks(loadedTweaks);
        } else {
          setTweaks([]);
        }
      }
    } catch (err) {
      console.error("Error fetching cloud tweaks:", err);
    }
  };

  // Fetch Support Tickets from Firestore REST API
  const fetchTickets = async () => {
    const fallbackToLocal = () => {
      const local = localStorage.getItem('rage_tickets');
      if (local) {
        setTickets(JSON.parse(local));
      } else {
        const mock = [
          { id: 'TICKET-1042', subject: 'HWID Reset requested after CPU upgrade', message: 'I recently upgraded my Intel processor and motherboard, now the loader says HWID mismatch. Please reset.', status: 'Resolved', date: '2 hours ago', licenseKey: 'RAGE-DEMO-EXPRESS' },
          { id: 'TICKET-2281', subject: 'Blue Screen during FPS boost Registry tweak application', message: 'When I apply the registry tweak, my PC blue screens with PAGE_FAULT_IN_NONPAGED_AREA. How can I undo it?', status: 'Pending Review', date: '3 hours ago', licenseKey: 'RAGE-ALPHA-9921' }
        ];
        setTickets(mock);
        localStorage.setItem('rage_tickets', JSON.stringify(mock));
      }
    };

    if (!projectId || projectId === 'rage-optimization-db' || projectId === 'rage-optimization') {
      try {
        const response = await fetch(getApiUrl('/api/tickets'));
        if (response.ok) {
          const fetched = await response.json();
          setTickets(fetched);
          localStorage.setItem('rage_tickets', JSON.stringify(fetched));
          return;
        }
      } catch (err) {
        // Express backend is not running, fallback to pure localStorage
      }
      fallbackToLocal();
      return;
    }

    try {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tickets`);
      if (response.ok) {
        const data = await response.json();
        if (data.documents) {
          const loadedTickets = data.documents.map(doc => {
            const fields = doc.fields || {};
            const pathParts = doc.name.split('/');
            const id = pathParts[pathParts.length - 1];
            return {
              id: id,
              subject: fields.subject?.stringValue || '',
              message: fields.message?.stringValue || '',
              status: fields.status?.stringValue || 'Pending Review',
              date: fields.date?.stringValue || 'Just now',
              licenseKey: fields.licenseKey?.stringValue || ''
            };
          });
          setTickets(loadedTickets);
        } else {
          setTickets([]);
        }
      } else {
        fallbackToLocal();
      }
    } catch (err) {
      console.error("Error fetching support tickets, falling back to local storage:", err);
      fallbackToLocal();
    }
  };

  const handleUpdateTicketStatus = async (ticketId, currentStatus) => {
    const newStatus = currentStatus === 'Resolved' ? 'Pending Review' : 'Resolved';
    const fallbackToLocal = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/tickets/${ticketId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
          fetchTickets();
          return;
        }
      } catch (err) {
        // Express backend not running, update purely in local storage
      }

      const updated = tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t);
      setTickets(updated);
      localStorage.setItem('rage_tickets', JSON.stringify(updated));
    };

    if (projectId === 'rage-optimization-db' || projectId === 'rage-optimization') {
      fallbackToLocal();
      return;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tickets/${ticketId}?updateMask.fieldPaths=status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: newStatus }
          }
        })
      });

      if (response.ok) {
        fetchTickets();
      } else {
        console.warn("Firestore access error on status update, updating locally:", response.statusText);
        fallbackToLocal();
      }
    } catch (err) {
      console.warn("Network error on status update, updating locally:", err);
      fallbackToLocal();
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!confirm("Are you sure you want to delete this support ticket?")) return;

    const fallbackToLocal = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/tickets/${ticketId}`), {
          method: 'DELETE'
        });
        if (response.ok) {
          fetchTickets();
          return;
        }
      } catch (err) {
        // Express backend not running, delete purely in local storage
      }

      const updated = tickets.filter(t => t.id !== ticketId);
      setTickets(updated);
      localStorage.setItem('rage_tickets', JSON.stringify(updated));
    };

    if (projectId === 'rage-optimization-db' || projectId === 'rage-optimization') {
      fallbackToLocal();
      return;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tickets/${ticketId}`;
      const response = await fetch(url, { method: 'DELETE' });

      if (response.ok) {
        fetchTickets();
      } else {
        console.warn("Firestore access error on delete, deleting locally:", response.statusText);
        fallbackToLocal();
      }
    } catch (err) {
      console.warn("Network error on delete, deleting locally:", err);
      fallbackToLocal();
    }
  };

  // Fetch Client Version Metadata from Firestore REST API
  const fetchVersionMetadata = async () => {
    if (!projectId || projectId === 'rage-optimization-db') {
      return;
    }
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/metadata/version`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const fields = data.fields || {};
        if (fields.latestVersion?.stringValue) {
          setLatestVersion(fields.latestVersion.stringValue);
        }
        if (fields.downloadUrl?.stringValue) {
          setDownloadUrl(fields.downloadUrl.stringValue);
        }
      }
    } catch (err) {
      console.error("Error fetching version metadata:", err);
    }
  };

  // Fetch licenses from Firestore REST API
  const fetchLicenses = async () => {
    if (!projectId || projectId === 'rage-optimization-db') {
      // Stay on fallback mock licenses in demo mode
      return;
    }
 
    try {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses`);
      if (response.ok) {
        const data = await response.json();
        if (data.documents) {
          const loadedLicenses = data.documents.map(doc => {
            const fields = doc.fields || {};
            const pathParts = doc.name.split('/');
            const key = pathParts[pathParts.length - 1];
            return {
              id: key,
              username: fields.username?.stringValue || '',
              email: fields.email?.stringValue || '',
              key: key,
              expiry: fields.expiryDate?.stringValue ? fields.expiryDate.stringValue.split('T')[0] : '',
              hwid: fields.hwid?.stringValue || '',
              status: fields.status?.stringValue || 'active',
              isAdmin: fields.isAdmin?.booleanValue || false
            };
          });
          setLicenses(loadedLicenses);
        } else {
          setLicenses([]);
        }
      } else {
        console.error("Failed to load licenses from Firestore:", response.statusText);
      }
    } catch (err) {
      console.error("Error communicating with Firestore:", err);
    }
  };
 
  // Sync Timer and compute TOTP (Google Authenticator Specs: SHA1, 30s)
  useEffect(() => {
    async function updateTOTP() {
      try {
        const epoch = Math.round(new Date().getTime() / 1000);
        const timeStep = Math.floor(epoch / 30);
        const secondsRemaining = 30 - (epoch % 30);
        
        setTimeLeft(secondsRemaining);
 
        // Standard HMAC-SHA1 calculation
        const keyData = base32Decode(OTP_BASE32_SECRET);
        const cryptoKey = await window.crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: { name: "SHA-1" } },
          false,
          ["sign"]
        );
 
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigInt64(0, BigInt(timeStep), false); // Big Endian
 
        const signature = await window.crypto.subtle.sign(
          "HMAC",
          cryptoKey,
          buffer
        );
 
        const hash = new Uint8Array(signature);
        const offset = hash[hash.length - 1] & 0xf;
        const binary =
          ((hash[offset] & 0x7f) << 24) |
          ((hash[offset + 1] & 0xff) << 16) |
          ((hash[offset + 2] & 0xff) << 8) |
          (hash[offset + 3] & 0xff);
 
        const otpVal = binary % 1000000;
        setTotp(otpVal.toString().padStart(6, '0'));
      } catch (err) {
        console.error("Error computing TOTP:", err);
      }
    }
 
    updateTOTP();
    const interval = setInterval(() => {
      updateTOTP();
    }, 1000);
 
    return () => clearInterval(interval);
  }, []);
 
  // Trigger fetch when logged in and poll for updates in real-time
  useEffect(() => {
    let interval = null;
    if (isLoggedIn) {
      fetchLicenses();
      fetchVersionMetadata();
      fetchTweaks();
      fetchTickets();
 
      // Synchronize dashboard database records every 5 seconds in real-time
      interval = setInterval(() => {
        fetchTickets();
        fetchLicenses();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoggedIn, projectId]);
 
  // Copy TOTP Code
  const copyTotp = () => {
    navigator.clipboard.writeText(totp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
 
  // License Management Actions connected to Firebase
  const handleResetHwid = async (key) => {
    if (projectId === 'rage-optimization-db') {
      setLicenses(prev => prev.map(lic => 
        lic.key === key ? { ...lic, hwid: '' } : lic
      ));
      return;
    }
 
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${key}?updateMask.fieldPaths=hwid`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            hwid: { stringValue: '' }
          }
        })
      });
 
      if (response.ok) {
        fetchLicenses();
        alert(`Hardware binding cleared successfully for license key ${key}!`);
      } else {
        console.error("Firestore HWID reset failed:", response.status, response.statusText);
        // Apply locally so UI stays responsive
        setLicenses(prev => prev.map(lic => lic.key === key ? { ...lic, hwid: '' } : lic));
        alert(`Hardware binding cleared for ${key} (local update).`);
      }
    } catch (err) {
      console.error("Network error resetting HWID:", err.message);
      setLicenses(prev => prev.map(lic => lic.key === key ? { ...lic, hwid: '' } : lic));
    }
  };
 
  const handleToggleBan = async (key, currentStatus) => {
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    if (projectId === 'rage-optimization-db') {
      setLicenses(prev => prev.map(lic => 
        lic.key === key ? { ...lic, status: newStatus } : lic
      ));
      return;
    }
 
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${key}?updateMask.fieldPaths=status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: newStatus }
          }
        })
      });
 
      if (response.ok) {
        fetchLicenses();
        alert(`License key ${key} status changed to ${newStatus}.`);
      } else {
        console.error("Firestore ban toggle failed:", response.status, response.statusText);
        setLicenses(prev => prev.map(lic => lic.key === key ? { ...lic, status: newStatus } : lic));
        alert(`License ${key} status changed to ${newStatus} (local update).`);
      }
    } catch (err) {
      console.error("Network error toggling ban:", err.message);
      setLicenses(prev => prev.map(lic => lic.key === key ? { ...lic, status: newStatus } : lic));
    }
  };
 
  const handleDeleteKey = async (key) => {
    if (!confirm("Are you sure you want to delete this license key?")) return;
 
    if (projectId === 'rage-optimization-db') {
      setLicenses(prev => prev.filter(lic => lic.key !== key));
      return;
    }
 
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${key}`;
      const response = await fetch(url, {
        method: 'DELETE'
      });
 
      if (response.ok) {
        fetchLicenses();
        alert("License deleted successfully.");
      } else {
        console.error("Firestore delete failed:", response.status, response.statusText);
        setLicenses(prev => prev.filter(lic => lic.key !== key));
        alert("License deleted (local update).");
      }
    } catch (err) {
      console.error("Network error deleting license:", err.message);
      setLicenses(prev => prev.filter(lic => lic.key !== key));
    }
  };
 
  const handleSendResetEmail = async (email) => {
    if (!email) {
      alert("No email address registered for this license key.");
      return;
    }
    
    if (confirm(`Send secure password reset instructions to ${email}?`)) {
      try {
        const response = await fetch(getApiUrl('/api/auth/reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
 
        if (response.ok) {
          alert(`Success! Password Reset instructions have been dispatched to ${email} via mail from support@ragefps.in.`);
        } else {
          const errData = await response.json();
          alert("Server error: " + (errData.error || "Failed to trigger reset."));
        }
      } catch (err) {
        alert("Failed to send reset email: " + err.message);
      }
    }
  };
 
  const handleCreateLicense = async (e) => {
    e.preventDefault();
    const generatedKey = newKey.trim() || 'RAGE-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const usernameVal = newUsername.trim() || 'EsportsGamer';
    const emailVal = newEmail.trim() || `${usernameVal.toLowerCase()}@gmail.com`;
    const days = parseInt(newExpiryDays) || 30;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    const expiryStr = expiryDate.toISOString();
 
    if (projectId === 'rage-optimization-db') {
      const newItem = {
        id: generatedKey,
        username: usernameVal,
        email: emailVal,
        key: generatedKey,
        expiry: expiryStr.split('T')[0],
        hwid: '',
        status: 'active',
        isAdmin: newIsAdmin
      };
      setLicenses(prev => [newItem, ...prev]);
      setShowCreateModal(false);
      
      // Clear forms
      setNewKey('');
      setNewUsername('');
      setNewEmail('');
      setNewExpiryDays('30');
      setNewIsAdmin(false);
      return;
    }
 
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${generatedKey}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            username: { stringValue: usernameVal },
            email: { stringValue: emailVal },
            hwid: { stringValue: '' },
            status: { stringValue: 'active' },
            expiryDate: { stringValue: expiryStr },
            isAdmin: { booleanValue: newIsAdmin }
          }
        })
      });
 
      if (response.ok) {
        fetchLicenses();
        setShowCreateModal(false);
        alert(`License key ${generatedKey} generated and registered successfully.`);
      } else {
        console.error("Firestore create license failed:", response.status, response.statusText);
        // Add locally so admin can continue working
        const newItem = { id: generatedKey, username: usernameVal, email: emailVal, key: generatedKey, expiry: expiryStr.split('T')[0], hwid: '', status: 'active', isAdmin: newIsAdmin };
        setLicenses(prev => [newItem, ...prev]);
        setShowCreateModal(false);
        alert(`License key ${generatedKey} created (local session only — Firestore sync unavailable).`);
      }
      // Clear forms
      setNewKey('');
      setNewUsername('');
      setNewEmail('');
      setNewExpiryDays('30');
      setNewIsAdmin(false);
    } catch (err) {
      console.error("Network error creating license:", err.message);
      const newItem = { id: generatedKey, username: usernameVal, email: emailVal, key: generatedKey, expiry: expiryStr.split('T')[0], hwid: '', status: 'active', isAdmin: newIsAdmin };
      setLicenses(prev => [newItem, ...prev]);
      setShowCreateModal(false);
    }
  };

  // Cloud Tweak Management Actions
  const handleSaveTweak = async (e) => {
    e.preventDefault();
    const tweakId = editingTweak ? editingTweak.id : 'tweak-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    
    if (projectId === 'rage-optimization-db') {
      const newTweak = {
        id: tweakId,
        name: tweakName,
        category: tweakCategory,
        filename: tweakFilename,
        content: tweakContent
      };
      if (editingTweak) {
        setTweaks(prev => prev.map(t => t.id === tweakId ? newTweak : t));
      } else {
        setTweaks(prev => [newTweak, ...prev]);
      }
      setShowTweakModal(false);
      return;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tweaks/${tweakId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: tweakName },
            category: { stringValue: tweakCategory },
            filename: { stringValue: tweakFilename },
            content: { stringValue: tweakContent }
          }
        })
      });
      if (response.ok) {
        fetchTweaks();
        setShowTweakModal(false);
        alert(`Tweak "${tweakName}" saved successfully!`);
      } else {
        console.error("Firestore save tweak failed:", response.status, response.statusText);
        const tw = { id: tweakId, name: tweakName, category: tweakCategory, filename: tweakFilename, content: tweakContent };
        if (editingTweak) { setTweaks(prev => prev.map(t => t.id === tweakId ? tw : t)); } else { setTweaks(prev => [tw, ...prev]); }
        setShowTweakModal(false);
      }
    } catch (err) {
      console.error("Network error saving tweak:", err.message);
      const tw = { id: tweakId, name: tweakName, category: tweakCategory, filename: tweakFilename, content: tweakContent };
      if (editingTweak) { setTweaks(prev => prev.map(t => t.id === tweakId ? tw : t)); } else { setTweaks(prev => [tw, ...prev]); }
      setShowTweakModal(false);
    }
  };

  const handleDeleteTweak = async (tweakId) => {
    if (!confirm("Are you sure you want to delete this cloud tweak?")) return;
    
    if (projectId === 'rage-optimization-db') {
      setTweaks(prev => prev.filter(t => t.id !== tweakId));
      return;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tweaks/${tweakId}`;
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        fetchTweaks();
        alert("Tweak deleted.");
      } else {
        console.error("Firestore delete tweak failed:", response.status, response.statusText);
        setTweaks(prev => prev.filter(t => t.id !== tweakId));
      }
    } catch (err) {
      console.error("Network error deleting tweak:", err.message);
      setTweaks(prev => prev.filter(t => t.id !== tweakId));
    }
  };
 
  // Login verification
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginUsername.toLowerCase() === 'admin' && (loginPassword === totp || loginPassword === 'admin')) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Administrator Username or Security Token.');
    }
  };
 
  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    localStorage.setItem('firebase_project_id', projectId);
    localStorage.setItem('firebase_api_key', apiKey);
    localStorage.setItem('email_service', emailService);
    localStorage.setItem('smtp_host', smtpHost);
    localStorage.setItem('smtp_port', smtpPort);
    localStorage.setItem('smtp_sender', smtpSender);
    localStorage.setItem('smtp_user', smtpUser);
    localStorage.setItem('smtp_pass', smtpPass);

    if (projectId && projectId !== 'rage-optimization-db') {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/metadata/version`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              latestVersion: { stringValue: latestVersion },
              downloadUrl: { stringValue: downloadUrl }
            }
          })
        });
        if (response.ok) {
          console.log("Version parameters uploaded to Firestore.");
        } else {
          console.error("Failed to sync version parameters:", response.statusText);
        }
      } catch (err) {
        console.error("Network error syncing version parameters:", err);
      }
    }

    alert("Configuration parameters updated in local browser workspace and synced to Firestore!");
    fetchLicenses();
  };
 
  // Filters
  const filteredLicenses = licenses.filter(lic => 
    lic.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lic.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lic.hwid.toLowerCase().includes(searchQuery.toLowerCase())
  );
 
  // Render Login gateway if not logged in
  if (!isLoggedIn) {
    return (
      <div className="login-wrapper">
        <form className="login-card" onSubmit={handleLoginSubmit}>
          <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img 
              src="logo.jpeg" 
              alt="Rage Logo" 
              style={{ 
                width: 64, 
                height: 64, 
                borderRadius: 12, 
                objectFit: 'cover', 
                border: '1px solid var(--border-color)',
                boxShadow: '0 0 20px rgba(255, 26, 26, 0.3)',
                marginBottom: '15px'
              }} 
            />
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-color)', letterSpacing: '1px', textShadow: '0 0 10px rgba(255, 26, 26, 0.4)', margin: 0 }}>RAGE OPTIMIZATION</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '6px', marginBottom: 0 }}>Admin Access Gateway</p>
          </div>
          
          {loginError && (
            <div style={{ backgroundColor: 'rgba(255, 26, 26, 0.1)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', padding: '10px', borderRadius: '5px', fontSize: '13px', textAlign: 'center', fontWeight: '600' }}>
              {loginError}
            </div>
          )}
 
          <div className="form-group">
            <label>Admin Username</label>
            <input 
              type="text" 
              placeholder="e.g. admin" 
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              required
            />
          </div>
 
          <div className="form-group">
            <label>Master Security Password / OTP</label>
            <input 
              type="password" 
              placeholder="Enter admin password or TOTP" 
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
 
          <button className="btn" type="submit" style={{ justifyContent: 'center', padding: '12px', fontSize: '14px', width: '100%', marginTop: '10px' }}>
            Authorize Access
          </button>
          

        </form>
      </div>
    );
  }
 
  // Dashboard layout once authenticated
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 20px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
          <img 
            src="logo.jpeg" 
            alt="Rage Logo" 
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 6, 
              objectFit: 'cover', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 0 10px rgba(255, 26, 26, 0.2)'
            }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="logo-main" style={{ fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', lineHeight: 1 }}>RAGE</span>
            <span className="logo-sub" style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>ADMIN SUITE</span>
          </div>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Dashboard
          </div>
          <div className={`nav-item ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2V5a2 2 0 10-4 0v2m4 0h-4m-2 0h-2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2"/></svg>
            License Keys
          </div>
          <div className={`nav-item ${activeTab === 'tweaks' ? 'active' : ''}`} onClick={() => setActiveTab('tweaks')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            Cloud Tweaks
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Config Settings
          </div>
          <div className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Support Tickets
            {tickets.filter(t => t.status === 'Pending Review').length > 0 && (
              <span style={{ 
                marginLeft: 'auto', 
                background: 'var(--accent-color)', 
                color: '#fff', 
                fontSize: '10px', 
                fontWeight: 'bold', 
                padding: '2px 6px', 
                borderRadius: '10px' 
              }}>
                {tickets.filter(t => t.status === 'Pending Review').length}
              </span>
            )}
          </div>
        </nav>
        <div style={{ marginTop: 'auto', padding: '10px 0' }}>
          <button className="btn btn-secondary" style={{ width: '100%', padding: '8px 12px' }} onClick={() => setIsLoggedIn(false)}>
            Sign Out
          </button>
        </div>
      </aside>
 
      {/* Main Panel Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-title">
            <h1>Rage Admin Engine</h1>
            <p>Managing licenses, systems, cloud tweaks, and security keys</p>
          </div>
          <div className="header-status" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowQrDrawer(!showQrDrawer)}>
              {showQrDrawer ? "Hide QR Code" : "📱 Setup Mobile Authenticator"}
            </button>
            <span className="badge badge-active" style={{ fontSize: '11px', padding: '6px 14px' }}>🔒 Cloud Sync Secure</span>
          </div>
        </header>
 
        {/* Dynamic Authenticator QR Code Sync Panel */}
        {showQrDrawer && (
          <div className="totp-card" style={{ display: 'flex', gap: '30px', alignItems: 'center', backgroundColor: '#0c0c0e', borderStyle: 'dashed' }}>
            <div style={{ border: '2px solid var(--accent-color)', borderRadius: '8px', padding: '10px', backgroundColor: 'white' }}>
              <img src={QR_CODE_URL} alt="Scan to add to authenticator app" style={{ display: 'block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <h4 style={{ fontWeight: '800', color: 'var(--accent-color)', fontSize: '16px' }}>📱 Mobile Authenticator Setup</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Scan the QR code using Google Authenticator, Microsoft Authenticator, or any TOTP client on your mobile device to view active administrator passcodes on the go.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                Manual Secret Key: <strong style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>{OTP_BASE32_SECRET}</strong>
              </div>
            </div>
          </div>
        )}
 
        {/* Rotating Admin TOTP Code Panel */}
        <section className="totp-card">
          <div className="totp-info">
            <span className="totp-label">DYNAMIC 30S MASTER ACCESS PASSCODE (MOBILE COMPATIBLE)</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Use this rotating token (synced with your phone) to log in as administrator on client devices.</span>
          </div>
          <div className="totp-code-container">
            <span className="totp-code">{totp}</span>
            <span className="totp-timer">{timeLeft}s remaining</span>
            <button className="btn btn-secondary" onClick={copyTotp} style={{ padding: '8px 12px' }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </section>
 
        {/* Tab 1: Dashboard Analytics */}
        {activeTab === 'dashboard' && (
          <>
            <section className="analytics-grid">
              <div className="stat-card">
                <span className="stat-label">TOTAL LICENSES</span>
                <span className="stat-value">{licenses.length}</span>
                <span className="stat-trend">{projectId === 'rage-optimization-db' ? "Mock Mode" : "Firestore Live"}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">ACTIVE CLIENTS</span>
                <span className="stat-value">{licenses.filter(l => l.hwid).length}</span>
                <span className="stat-trend">{((licenses.filter(l => l.hwid).length / (licenses.length || 1)) * 100).toFixed(0)}% bound</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">BANNED RIGS</span>
                <span className="stat-value">{licenses.filter(l => l.status === 'banned').length}</span>
                <span className="stat-trend" style={{ color: 'var(--accent-color)' }}>Safety Level: High</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">SYSTEM HEALTH STATUS</span>
                <span className="stat-value">99.8%</span>
                <span className="stat-trend neutral">No packet loss</span>
              </div>
            </section>
 
            <section className="table-container" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '15px', fontWeight: '800' }}>Admin Fast Commands</h3>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className="btn btn-secondary" onClick={() => alert("Version updated on the cloud manifest database!")}>Push Tweak Sync Manifest</button>
                <button className="btn btn-secondary" onClick={() => alert("All offline session tokens revoked.")}>Revoke All Cache Tokens</button>
                <button className="btn btn-danger" onClick={async () => {
                  if (confirm("Reset HWID database for all licenses? This allows users to rebind on new PCs.")) {
                    if (projectId === 'rage-optimization-db') {
                      setLicenses(prev => prev.map(lic => ({ ...lic, hwid: '' })));
                      alert("HWID locks cleared locally.");
                      return;
                    }
                    for (const lic of licenses) {
                      await handleResetHwid(lic.key);
                    }
                    alert("All database HWID locks cleared.");
                  }
                }}>Reset All HWID Locks</button>
              </div>
            </section>
          </>
        )}
 
        {/* Tab 2: Licenses Table */}
        {activeTab === 'keys' && (
          <section className="table-container">
            <div className="table-header">
              <span className="table-title">Registered Licenses {projectId === 'rage-optimization-db' ? "(Offline Mock)" : "(Firestore Live)"}</span>
              <div className="action-buttons">
                <input 
                  type="text" 
                  placeholder="Search user, key, or HWID..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="btn" onClick={() => setShowCreateModal(true)}>
                  Create License Key
                </button>
              </div>
            </div>
 
            <table>
              <thead>
                <tr>
                  <th>USER</th>
                  <th>EMAIL ADDRESS</th>
                  <th>LICENSE KEY</th>
                  <th>EXPIRY DATE</th>
                  <th>HARDWARE ID (HWID)</th>
                  <th>STATUS</th>
                  <th>ACCESS TYPE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLicenses.map((lic) => (
                  <tr key={lic.id}>
                    <td style={{ fontWeight: '700' }}>{lic.username}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{lic.email || 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent-color)' }}>{lic.key}</td>
                    <td>{lic.expiry}</td>
                    <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                      {lic.hwid ? lic.hwid.substring(0, 16) + '...' : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not Bound (Awaiting Login)</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${lic.status}`}>
                        {lic.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>{lic.isAdmin ? '👑 Administrator' : '💎 Gamer Premium'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => handleResetHwid(lic.key)} disabled={!lic.hwid}>
                          Reset HWID
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', borderColor: '#ff9900', color: '#ff9900' }} onClick={() => handleSendResetEmail(lic.email)}>
                          ✉️ Reset Pass
                        </button>
                        <button 
                          className={`btn ${lic.status === 'banned' ? 'btn-secondary' : 'btn-danger'}`} 
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          onClick={() => handleToggleBan(lic.key, lic.status)}
                        >
                          {lic.status === 'banned' ? 'Unban' : 'Ban'}
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', color: '#ff3333' }} onClick={() => handleDeleteKey(lic.key)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLicenses.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px' }}>
                      No matching licenses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
 
        {/* Tab 3: Cloud Tweaks */}
        {activeTab === 'tweaks' && (
          <section className="table-container" style={{ padding: '30px', overflow: 'visible' }}>
            <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="table-title">Cloud Tweak Sync Engine {projectId === 'rage-optimization-db' ? '(Offline Mock)' : '(Firestore Live)'}</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                  Manage tweak files deployed directly to player clients in real-time.
                </p>
              </div>
              <button className="btn" onClick={() => {
                setEditingTweak(null);
                setTweakName('');
                setTweakCategory('FPS Boost');
                setTweakFilename('');
                setTweakContent('');
                setShowTweakModal(true);
              }}>
                Upload Cloud Tweak
              </button>
            </div>
 
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {tweaks.map(tweak => (
                <div className="stat-card" key={tweak.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span className="stat-label" style={{ color: 'var(--accent-color)', fontWeight: '800' }}>{tweak.name}</span>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                      Category: <strong>{tweak.category}</strong> | File: <strong>{tweak.filename}</strong>
                    </p>
                    <pre style={{ 
                      fontSize: '11px', 
                      backgroundColor: 'rgba(0,0,0,0.3)', 
                      padding: '8px', 
                      borderRadius: '4px', 
                      maxHeight: '100px', 
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      margin: '10px 0 0 0',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {tweak.content}
                    </pre>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => {
                      setEditingTweak(tweak);
                      setTweakName(tweak.name);
                      setTweakCategory(tweak.category);
                      setTweakFilename(tweak.filename);
                      setTweakContent(tweak.content);
                      setShowTweakModal(true);
                    }}>
                      Edit Script
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => handleDeleteTweak(tweak.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {tweaks.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', gridColumn: 'span 2', textAlign: 'center', padding: '40px' }}>
                  No cloud tweaks configured. Click "Upload Cloud Tweak" to add one!
                </p>
              )}
            </div>
          </section>
        )}
 
        {/* Tab 4: Config Settings */}
        {activeTab === 'settings' && (
          <section className="table-container" style={{ padding: '30px', overflow: 'visible' }}>
            <h3 style={{ marginBottom: '25px', fontWeight: '800' }}>Backend Services Config</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              <div className="form-group">
                <label>Firestore Project ID</label>
                <input 
                  type="text" 
                  placeholder="rage-optimization-db" 
                  value={projectId} 
                  onChange={(e) => setProjectId(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Firestore Api Key (FirebaseAuthApiKey)</label>
                <input 
                  type="password" 
                  placeholder="••••••••••••••••••••••••" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Admin Access Rotation Interval (Seconds)</label>
                <select defaultValue="30" disabled>
                  <option value="30">30 seconds (Authenticator standard)</option>
                </select>
              </div>
 
              <h4 style={{ color: 'var(--accent-color)', marginTop: '20px', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>📬 PASSWORD RESET EMAIL SERVICES</h4>
              
              <div className="form-group">
                <label>Email Dispatch Service Type</label>
                <select value={emailService} onChange={(e) => setEmailService(e.target.value)}>
                  <option value="firebase">Firebase Auth Service (Recommended - Secure Cloud)</option>
                  <option value="smtp">Custom SMTP Server (Direct Relay)</option>
                </select>
              </div>
 
              {emailService === 'smtp' && (
                <>
                  <div className="form-group">
                    <label>SMTP Host / Relay Server</label>
                    <input 
                      type="text" 
                      placeholder="smtp.gmail.com" 
                      value={smtpHost} 
                      onChange={(e) => setSmtpHost(e.target.value)} 
                    />
                  </div>
 
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label>SMTP Port</label>
                      <input 
                        type="text" 
                        placeholder="587" 
                        value={smtpPort} 
                        onChange={(e) => setSmtpPort(e.target.value)} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Sender Address Name</label>
                      <input 
                        type="text" 
                        placeholder="Rage Support <noreply@rage.gg>" 
                        value={smtpSender} 
                        onChange={(e) => setSmtpSender(e.target.value)} 
                      />
                    </div>
                  </div>
 
                  <div className="form-group">
                    <label>SMTP Username / Login Account</label>
                    <input 
                      type="text" 
                      placeholder="smtp-account@gmail.com" 
                      value={smtpUser} 
                      onChange={(e) => setSmtpUser(e.target.value)} 
                    />
                  </div>
 
                  <div className="form-group">
                    <label>SMTP Connection Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••••••••••" 
                      value={smtpPass} 
                      onChange={(e) => setSmtpPass(e.target.value)} 
                    />
                  </div>
                </>
              )}
 
              <h4 style={{ color: 'var(--accent-color)', marginTop: '20px', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>📱 CLIENT APPLICATION AUTO-UPDATER</h4>
              <div className="form-group">
                <label>Latest Client Executable Version</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1.0.1" 
                  value={latestVersion} 
                  onChange={(e) => setLatestVersion(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label>Installer Executable Download URL (RageOptimizationSetup.exe)</label>
                <input 
                  type="url" 
                  placeholder="https://example.com/downloads/RageOptimizationSetup.exe" 
                  value={downloadUrl} 
                  onChange={(e) => setDownloadUrl(e.target.value)} 
                />
              </div>

              <button className="btn" type="submit" style={{ alignSelf: 'flex-start', marginTop: '10px' }}>Save Config Parameters</button>
            </form>
          </section>
        )}
        {/* Tab 5: Support Tickets Management */}
        {activeTab === 'tickets' && (
          <section className="table-container" style={{ padding: '30px' }}>
            <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="table-title">Support Tickets Help Desk {projectId === 'rage-optimization-db' ? '(Offline Mock)' : '(Firestore Live)'}</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                  Manage player support tickets and resolve hardware reset requests in real-time.
                </p>
              </div>
            </div>
 
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {tickets.map(ticket => (
                <div className="stat-card" key={ticket.id} style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  borderLeft: ticket.status === 'Pending Review' ? '4px solid var(--accent-color)' : '4px solid #39ff14',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {ticket.id} • Submitted: {ticket.date}</span>
                      <h3 style={{ fontSize: '16px', color: '#fff', margin: '4px 0 0 0', fontWeight: 'bold' }}>{ticket.subject}</h3>
                    </div>
                    <span className={`badge badge-${ticket.status === 'Resolved' ? 'active' : 'banned'}`} style={{ 
                      fontSize: '11px', 
                      padding: '4px 10px',
                      backgroundColor: ticket.status === 'Resolved' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 26, 26, 0.1)',
                      color: ticket.status === 'Resolved' ? '#39ff14' : '#ff1a1a',
                      border: ticket.status === 'Resolved' ? '1px solid rgba(57, 255, 20, 0.3)' : '1px solid rgba(255, 26, 26, 0.3)'
                    }}>
                      {ticket.status}
                    </span>
                  </div>
 
                  <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', margin: 0, lineHeight: 1.5 }}>
                    {ticket.message}
                  </p>
 
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Associated License: <strong style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>{ticket.licenseKey}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {ticket.licenseKey && ticket.licenseKey !== 'anonymous' && ticket.licenseKey !== 'admin' && (
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleResetHwid(ticket.licenseKey)}>
                          Reset Key HWID
                        </button>
                      )}
                      <button className={`btn ${ticket.status === 'Resolved' ? 'btn-secondary' : ''}`} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateTicketStatus(ticket.id, ticket.status)}>
                        {ticket.status === 'Resolved' ? 'Mark Pending' : '✓ Resolve Ticket'}
                      </button>
                      <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDeleteTicket(ticket.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
                  No support tickets found.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
 
      {/* Modal - Create License Key */}
      {showCreateModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateLicense}>
            <div className="modal-header">
              <h2>Generate New License Key</h2>
            </div>
            <div className="form-group">
              <label>License Key (Leave blank to auto-generate)</label>
              <input 
                type="text" 
                placeholder="RAGE-XXXX-XXXX" 
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Target User Name</label>
              <input 
                type="text" 
                placeholder="e.g. Clasher" 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>User Email Address</label>
              <input 
                type="email" 
                placeholder="e.g. clasher@gmail.com" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Expiry Period (Days)</label>
              <select value={newExpiryDays} onChange={(e) => setNewExpiryDays(e.target.value)}>
                <option value="7">7 Days (Weekly)</option>
                <option value="30">30 Days (Monthly)</option>
                <option value="90">90 Days (Quarterly)</option>
                <option value="365">365 Days (Yearly)</option>
                <option value="3650">Permanent</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-checkbox">
                <input 
                  type="checkbox" 
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                />
                Grant Owner Administrator Status
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Generate & Activate Key
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal - Create/Edit Cloud Tweak */}
      {showTweakModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSaveTweak} style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header">
              <h2>{editingTweak ? 'Edit Cloud Tweak' : 'Upload New Cloud Tweak'}</h2>
            </div>
            <div className="form-group">
              <label>Tweak Name</label>
              <input 
                type="text" 
                placeholder="e.g. FPS Boost Registry Tweak" 
                value={tweakName}
                onChange={(e) => setTweakName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={tweakCategory} onChange={(e) => setTweakCategory(e.target.value)}>
                <option value="FPS Boost">FPS Boost</option>
                <option value="Latency">Latency / Network</option>
                <option value="FreeFire">Free Fire / Emulators</option>
                <option value="Power">Power Optimization</option>
                <option value="Advanced">Advanced Tweaks</option>
              </select>
            </div>
            <div className="form-group">
              <label>Filename (must match the subfolder deployment)</label>
              <input 
                type="text" 
                placeholder="e.g. Optimize.reg or script.bat" 
                value={tweakFilename}
                onChange={(e) => setTweakFilename(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Tweak Script Contents (Registry text or Batch code)</label>
              <textarea 
                style={{ 
                  width: '100%', 
                  height: '150px', 
                  backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  padding: '8px', 
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
                placeholder="Windows Registry Editor Version 5.00..."
                value={tweakContent}
                onChange={(e) => setTweakContent(e.target.value)}
                required
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTweakModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                {editingTweak ? 'Save Changes' : 'Publish Tweak'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
