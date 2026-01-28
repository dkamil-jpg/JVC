import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Home, Search, RefreshCw, Menu, X, LogOut, User, Phone, Mail, MapPin,
  AlertTriangle, Pill, Heart, History, Plus, Edit, Trash2, ChevronDown,
  ChevronRight, Loader2, Shield, Users, Settings, Download, Key, UserPlus,
  ClipboardList, Lock, Unlock, Crown, Database, HardDrive, RotateCcw, Archive,
  FileSignature
} from 'lucide-react';

const StaffPortal = () => {
  const navigate = useNavigate();
  const { user, logout, isManager, isAdmin, api } = useAuth();
  const { 
    patients, queue, selectedPatient, setSelectedPatient, loading,
    loadDashboardData, loadPatient, updatePatient, getPatientVisits, createVisit, getPatientAudit
  } = useClinic();

  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbListOpen, setDbListOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  
  // Modals
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [consentsModalOpen, setConsentsModalOpen] = useState(false);
  
  // Data
  const [visits, setVisits] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [patientConsents, setPatientConsents] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [visitForm, setVisitForm] = useState({ treatment: '', notes: '', consultant: '' });
  
  // Password verification
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConsent, setDeleteConsent] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Admin/Manager Panel State
  const [adminUsers, setAdminUsers] = useState([]);
  const [loginAudit, setLoginAudit] = useState([]);
  const [systemAudit, setSystemAudit] = useState([]);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'STAFF' });
  const [adminLoading, setAdminLoading] = useState(false);

  // Data Management State (Admin only)
  const [backups, setBackups] = useState([]);
  const [dataPassword, setDataPassword] = useState('');
  const [dataActionLoading, setDataActionLoading] = useState(false);
  const [dataConfirmAction, setDataConfirmAction] = useState(null); // 'delete-patients' | 'delete-visits' | 'delete-queue' | 'restore-{id}'
  const [kioskPin, setKioskPin] = useState('1234');

  const filteredPatients = patients.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.patient_id?.toLowerCase().includes(term) || p.dob?.includes(term);
  });

  const filteredQueue = queue.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.patient_id?.toLowerCase().includes(term);
  });

  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setSidebarOpen(false);
    setEditMode(false);
    const patientVisits = await getPatientVisits(patient.patient_id);
    setVisits(patientVisits);
    setEditForm({
      phone: patient.phone || '', email: patient.email || '', street: patient.street || '',
      city: patient.city || '', postcode: patient.postcode || '',
      emergency_name: patient.emergency_name || '', emergency_phone: patient.emergency_phone || '',
      medications: patient.medications || '', allergies: patient.allergies || '',
      conditions: patient.conditions || '', surgeries: patient.surgeries || '', procedures: patient.procedures || ''
    });
  };

  const handleSavePatient = async () => {
    const result = await updatePatient(selectedPatient.patient_id, editForm);
    if (result.success) {
      setEditMode(false);
      const updated = await loadPatient(selectedPatient.patient_id);
      if (updated) setSelectedPatient({ ...selectedPatient, ...updated });
    }
  };

  const handleOpenVisitModal = () => {
    setVisitForm({
      treatment: '',
      notes: selectedPatient?.queue_reason || selectedPatient?.reason || '',
      consultant: user?.username || ''
    });
    setVisitModalOpen(true);
  };

  const handleSubmitVisit = async () => {
    const result = await createVisit({
      patient_id: selectedPatient.patient_id,
      treatment: visitForm.treatment,
      notes: visitForm.notes,
      consultant: visitForm.consultant
    });
    if (result.success) {
      setVisitModalOpen(false);
      const patientVisits = await getPatientVisits(selectedPatient.patient_id);
      setVisits(patientVisits);
      setSelectedPatient(prev => ({ ...prev, queue_reason: '', reason: '' }));
    }
  };

  const handleShowAudit = async () => {
    const logs = await getPatientAudit(selectedPatient.patient_id);
    setAuditLogs(logs);
    setAuditModalOpen(true);
  };

  const handleShowConsents = async () => {
    try {
      const response = await api().get(`/patients/${selectedPatient.patient_id}/consents`);
      setPatientConsents(response.data?.consents || []);
      setConsentsModalOpen(true);
    } catch (error) {
      alert('Failed to load consents');
    }
  };

  // PDF Export with password
  const handleExportPDF = async () => {
    if (!pdfPassword) return;
    setPdfLoading(true);
    try {
      const response = await api().post(`/patients/${selectedPatient.patient_id}/pdf`, { password: pdfPassword });
      if (response.data.success) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        printWindow.onload = () => printWindow.print();
        setPdfModalOpen(false);
        setPdfPassword('');
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Export failed - check password');
    } finally {
      setPdfLoading(false);
    }
  };

  // Delete with password
  const handleDeletePatient = async () => {
    if (!deletePassword || !deleteConsent) return;
    setDeleteLoading(true);
    try {
      await api().post(`/patients/${selectedPatient.patient_id}/delete`, { password: deletePassword });
      setDeleteModalOpen(false);
      setSelectedPatient(null);
      setDeletePassword('');
      setDeleteConsent(false);
      loadDashboardData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Delete failed - check password');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Admin/Manager Panel Functions
  const loadAdminData = async () => {
    setAdminLoading(true);
    try {
      const [usersRes, loginRes, systemRes] = await Promise.all([
        api().get('/admin/users'),
        api().get('/admin/login-audit', { params: { limit: 300 } }),
        api().get('/admin/system-audit', { params: { limit: 500 } })
      ]);
      setAdminUsers(usersRes.data || []);
      setLoginAudit(loginRes.data?.rows || []);
      setSystemAudit(systemRes.data?.logs || []);
      
      // Load backups for admin only
      if (isAdmin) {
        try {
          const backupsRes = await api().get('/admin/backups');
          setBackups(backupsRes.data?.backups || []);
          // Load kiosk settings
          const kioskRes = await api().get('/kiosk/settings');
          setKioskPin(kioskRes.data?.exit_pin || '1234');
        } catch (e) {
          console.error('Failed to load backups:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleOpenAdminModal = () => {
    loadAdminData();
    setAdminModalOpen(true);
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) return;
    try {
      await api().post('/admin/users', newUserForm);
      setNewUserForm({ username: '', password: '', role: 'STAFF' });
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add user');
    }
  };

  const handleResetPassword = async (username) => {
    const newPass = prompt(`Enter new password for ${username}:`);
    if (!newPass) return;
    try {
      await api().post(`/admin/users/${username}/reset-password`, null, { params: { new_password: newPass } });
      alert('Password reset successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleToggleUserActive = async (username, currentActive) => {
    try {
      await api().post(`/admin/users/${username}/toggle-active`, null, { params: { active: !currentActive } });
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleClearLoginAudit = async () => {
    if (!window.confirm('Clear all login audit logs? (Admin only)')) return;
    try {
      await api().delete('/admin/login-audit');
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed - Admin only');
    }
  };

  const handleClearSystemAudit = async () => {
    if (!window.confirm('Clear all system audit logs? (Admin only)')) return;
    try {
      await api().delete('/admin/system-audit');
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed - Admin only');
    }
  };

  // Data Management Functions (Admin only)
  const handleDeleteAllPatients = async () => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      const res = await api().post('/admin/data/delete-all-patients', { password: dataPassword });
      alert(`Deleted ${res.data.deleted_count} patients`);
      setDataConfirmAction(null);
      setDataPassword('');
      loadDashboardData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleDeleteAllVisits = async () => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      const res = await api().post('/admin/data/delete-all-visits', { password: dataPassword });
      alert(`Deleted ${res.data.deleted_count} visits`);
      setDataConfirmAction(null);
      setDataPassword('');
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleDeleteAllQueue = async () => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      const res = await api().post('/admin/data/delete-all-queue', { password: dataPassword });
      alert(`Deleted ${res.data.deleted_count} queue entries`);
      setDataConfirmAction(null);
      setDataPassword('');
      loadDashboardData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      const res = await api().post('/admin/backup', { password: dataPassword });
      alert(`Backup created: ${res.data.backup_id}\nPatients: ${res.data.counts.patients}, Visits: ${res.data.counts.visits}`);
      setDataPassword('');
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      const res = await api().post(`/admin/restore/${backupId}`, { password: dataPassword });
      alert(`Restored from backup ${backupId}:\nPatients: ${res.data.restored.patients}\nVisits: ${res.data.restored.visits}`);
      setDataConfirmAction(null);
      setDataPassword('');
      loadDashboardData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!dataPassword) return;
    setDataActionLoading(true);
    try {
      await api().delete(`/admin/backup/${backupId}`, { data: { password: dataPassword } });
      alert(`Backup ${backupId} deleted`);
      setDataPassword('');
      loadAdminData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error - check password');
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleUpdateKioskPin = async () => {
    if (!kioskPin || kioskPin.length < 4) {
      alert('PIN must be at least 4 characters');
      return;
    }
    try {
      await api().post('/kiosk/settings', { exit_pin: kioskPin });
      alert('Kiosk PIN updated successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update PIN');
    }
  };

  const goToHome = () => navigate('/');

  // Determine available roles for new user creation
  const availableRoles = isAdmin ? ['STAFF', 'MANAGER', 'ADMIN'] : ['STAFF', 'MANAGER'];

  return (
    <div data-testid="staff-portal" className="h-screen flex flex-col md:flex-row relative bg-slate-950">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-50 shrink-0 h-14">
        <div className="font-bold text-lg text-white">Just Vitality <span className="text-blue-500">Clinic</span></div>
        <div className="flex items-center gap-4">
          <button onClick={goToHome} className="text-slate-400 hover:text-white"><Home className="w-5 h-5" /></button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-2 border border-slate-700 rounded">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative top-14 md:top-0 bottom-0 left-0 w-full md:w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-transform duration-300`}>
        <div className="p-4 border-b border-slate-800">
          <div className="hidden md:flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Logged In As</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-blue-500">{user?.username}</span>
                <Badge variant="outline" className={`text-[10px] ${user?.role === 'ADMIN' ? 'border-violet-500 text-violet-400' : user?.role === 'MANAGER' ? 'border-emerald-500 text-emerald-400' : ''}`}>
                  {user?.role}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goToHome} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white" title="Home"><Home className="w-5 h-5" /></button>
              {(isAdmin || isManager) && (
                <button onClick={handleOpenAdminModal} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-violet-400" title={isAdmin ? "Admin Panel" : "Manager Panel"}>
                  {isAdmin ? <Shield className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
                </button>
              )}
              <button onClick={logout} className="p-2 rounded-full hover:bg-slate-800 text-red-400" title="Logout"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="md:hidden mb-4 p-2 bg-slate-800/50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">User: <span className="text-white font-bold">{user?.username}</span> ({user?.role})</span>
              <div className="flex gap-2">
                {(isAdmin || isManager) && <button onClick={handleOpenAdminModal} className="text-xs text-violet-400">{isAdmin ? 'Admin' : 'Manager'}</button>}
                <button onClick={logout} className="text-xs text-red-400">Sign Out</button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input placeholder="Search patients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-slate-950 border-slate-800 h-10" />
            </div>
            <Button variant="outline" size="icon" onClick={loadDashboardData} disabled={loading} className="border-slate-800">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Queue */}
        <div className="px-4 py-2 border-b border-slate-800 bg-blue-500/10 flex justify-between items-center">
          <h3 className="text-xs font-bold text-blue-500 uppercase">Waiting Room</h3>
          <Badge className="bg-blue-500 text-white text-[10px]">{filteredQueue.length}</Badge>
        </div>
        <ScrollArea className="flex-shrink-0 max-h-48 border-b border-slate-800">
          {filteredQueue.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No patients waiting</div>
          ) : (
            filteredQueue.map(p => (
              <div key={p.patient_id} onClick={() => handleSelectPatient(p)}
                className={`p-3 border-b border-slate-800 hover:bg-blue-500/10 cursor-pointer flex justify-between items-center ${selectedPatient?.patient_id === p.patient_id ? 'bg-blue-500/20' : ''}`}>
                <div>
                  <div className="font-bold text-sm uppercase text-white">{p.name}</div>
                  <div className="text-xs text-blue-500 truncate max-w-[200px]">{p.queue_reason}</div>
                </div>
                {p.is_new && <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-500">NEW</Badge>}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Database List */}
        <div onClick={() => setDbListOpen(!dbListOpen)} className="px-4 py-2 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center cursor-pointer hover:bg-slate-800/50">
          <h3 className="text-xs font-bold text-slate-400 uppercase">Database (A-Z)</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{filteredPatients.length}</Badge>
            {dbListOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </div>
        </div>
        {dbListOpen && (
          <ScrollArea className="flex-1">
            {filteredPatients.map(p => (
              <div key={p.patient_id} onClick={() => handleSelectPatient(p)}
                className={`p-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer flex justify-between items-center ${selectedPatient?.patient_id === p.patient_id ? 'bg-blue-500/20' : ''}`}>
                <div>
                  <div className="font-bold text-sm uppercase text-slate-200">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.dob}</div>
                </div>
                {p.is_new && <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-500">NEW</Badge>}
              </div>
            ))}
          </ScrollArea>
        )}

        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="text-[10px] text-slate-600 text-center">System by <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500">Kamil Dyczkowski</a> 2026</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden" onClick={() => setSidebarOpen(false)}>
        {!selectedPatient ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <User className="w-16 h-16 mb-4 opacity-30" />
            <p>Select a patient from the sidebar</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Patient Header */}
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-900/50 shrink-0">
              <div className="min-w-0 flex-shrink-0">
                <h1 className="text-xl md:text-2xl font-bold uppercase text-white truncate">{selectedPatient.name}</h1>
                <p className="text-xs text-slate-500 font-mono truncate">ID: {selectedPatient.patient_id}</p>
              </div>
              <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <div className="flex flex-nowrap md:flex-wrap gap-2 min-w-max md:min-w-0">
                  <Button size="sm" onClick={() => navigate('/kiosk')} className="bg-emerald-600 hover:bg-emerald-700 text-xs md:text-sm whitespace-nowrap"><Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">New</span> Patient</Button>
                  <Button size="sm" variant="outline" onClick={handleShowAudit} className="border-slate-700 text-xs md:text-sm whitespace-nowrap"><History className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Change</span> Log</Button>
                  <Button size="sm" variant="outline" onClick={handleShowConsents} className="border-slate-700 text-xs md:text-sm whitespace-nowrap"><FileSignature className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Consents</Button>
                  {(isAdmin || isManager) && (
                    <Button size="sm" variant="outline" onClick={() => setPdfModalOpen(true)} className="border-slate-700 text-xs md:text-sm whitespace-nowrap"><Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Export</span> PDF</Button>
                  )}
                  <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode(!editMode)} className={`text-xs md:text-sm whitespace-nowrap ${editMode ? "bg-emerald-600" : "border-slate-700"}`}>
                    <Edit className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> {editMode ? 'Editing' : 'Edit'}
                  </Button>
                  <Button size="sm" onClick={handleOpenVisitModal} className="bg-blue-600 hover:bg-blue-700 text-xs md:text-sm whitespace-nowrap"><Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">New</span> Visit</Button>
                </div>
              </div>
            </div>

            {/* Patient Content */}
            <ScrollArea className="flex-1 p-4 md:p-6">
              {/* Info Tiles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="glass-panel p-4 rounded-xl border-l-4 border-blue-500">
                  <h3 className="text-xs text-blue-500 font-bold uppercase mb-1">Reason</h3>
                  <p className="text-sm italic text-slate-300">{selectedPatient.queue_reason || selectedPatient.reason || 'No active visit.'}</p>
                </div>
                <div className={`glass-panel p-4 rounded-xl flex items-center justify-between ${selectedPatient.alerts ? 'border border-red-500 bg-red-500/10' : ''}`}>
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-400">Alerts (Today)</h3>
                    <p className={`text-sm ${selectedPatient.alerts ? 'text-red-500 font-bold' : 'text-slate-500'}`}>{selectedPatient.alerts || 'None.'}</p>
                  </div>
                  <AlertTriangle className={`w-6 h-6 ${selectedPatient.alerts ? 'text-red-500' : 'text-slate-700'}`} />
                </div>
                <div className="glass-panel p-4 rounded-xl border-l-4 border-red-500">
                  <h3 className="text-xs text-red-500 font-bold uppercase mb-1">Allergies</h3>
                  {editMode ? (
                    <Input value={editForm.allergies} onChange={(e) => setEditForm(prev => ({ ...prev, allergies: e.target.value }))} className="bg-slate-950 border-slate-800 h-10" />
                  ) : (
                    <p className="text-sm text-slate-300">{selectedPatient.allergies || 'NKDA'}</p>
                  )}
                </div>
              </div>

              {/* Medical Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col gap-4">
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block"><Pill className="w-3 h-3 inline mr-1" /> Medications</label>
                    {editMode ? <Textarea value={editForm.medications} onChange={(e) => setEditForm(prev => ({ ...prev, medications: e.target.value }))} className="bg-slate-950 border-slate-800 h-24" />
                      : <p className="text-sm text-slate-300">{selectedPatient.medications || '-'}</p>}
                  </div>
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Surgeries</label>
                    {editMode ? <Textarea value={editForm.surgeries} onChange={(e) => setEditForm(prev => ({ ...prev, surgeries: e.target.value }))} className="bg-slate-950 border-slate-800 h-24" />
                      : <p className="text-sm text-slate-300">{selectedPatient.surgeries || '-'}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block"><Heart className="w-3 h-3 inline mr-1" /> Conditions</label>
                    {editMode ? <Textarea value={editForm.conditions} onChange={(e) => setEditForm(prev => ({ ...prev, conditions: e.target.value }))} className="bg-slate-950 border-slate-800 h-24" />
                      : <p className="text-sm text-slate-300">{selectedPatient.conditions || '-'}</p>}
                  </div>
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-yellow-500 font-bold uppercase mb-1 block">IV History / Notes</label>
                    <Textarea value={editForm.procedures} onChange={(e) => setEditForm(prev => ({ ...prev, procedures: e.target.value }))} onBlur={handleSavePatient} placeholder="Type notes here..." className="bg-slate-950 border-slate-800 h-24 focus:border-yellow-500" />
                  </div>
                </div>
                {/* Contact Details */}
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs text-slate-400 font-bold uppercase mb-3">Contact Details</h3>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-slate-300"><Phone className="w-4 h-4 text-slate-500" /> {selectedPatient.phone || '-'}</p>
                    <p className="flex items-center gap-2 text-slate-300"><Mail className="w-4 h-4 text-slate-500" /> {selectedPatient.email || '-'}</p>
                    <p className="flex items-center gap-2 text-slate-300"><MapPin className="w-4 h-4 text-slate-500" /> {[selectedPatient.street, selectedPatient.city, selectedPatient.postcode].filter(Boolean).join(', ') || '-'}</p>
                    <p className="flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" /> {selectedPatient.emergency_name} {selectedPatient.emergency_phone}</p>
                  </div>
                  {editMode && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <Input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="bg-slate-950 border-slate-800" />
                      <Input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} className="bg-slate-950 border-slate-800" />
                      <Input placeholder="Street" value={editForm.street} onChange={(e) => setEditForm(prev => ({ ...prev, street: e.target.value }))} className="bg-slate-950 border-slate-800" />
                      <div className="flex gap-2">
                        <Input placeholder="City" value={editForm.city} onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))} className="bg-slate-950 border-slate-800 flex-1" />
                        <Input placeholder="Postcode" value={editForm.postcode} onChange={(e) => setEditForm(prev => ({ ...prev, postcode: e.target.value }))} className="bg-slate-950 border-slate-800 w-1/3" />
                      </div>
                      <label className="text-xs text-red-500 font-bold mt-2 block">Emergency Contact</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Name" value={editForm.emergency_name} onChange={(e) => setEditForm(prev => ({ ...prev, emergency_name: e.target.value }))} className="bg-slate-950 border-slate-800" />
                        <Input placeholder="Phone" value={editForm.emergency_phone} onChange={(e) => setEditForm(prev => ({ ...prev, emergency_phone: e.target.value }))} className="bg-slate-950 border-slate-800" />
                      </div>
                      <Button onClick={handleSavePatient} className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
                      {isManager && (
                        <div className="mt-6 pt-4 border-t border-slate-700">
                          <div className="p-4 border border-red-500/30 rounded-lg bg-red-900/10">
                            <h3 className="text-xs text-red-400 font-bold uppercase mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> {isAdmin ? 'Admin' : 'Manager'} Zone</h3>
                            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="w-full"><Trash2 className="w-4 h-4 mr-2" /> Delete Record</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Visit History */}
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 px-1">CONSULTATION HISTORY</h3>
              <div className="glass-panel rounded-xl overflow-hidden mb-10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
                    <tr><th className="p-3">Date</th><th className="p-3">Treatment</th><th className="p-3">Notes</th><th className="p-3">Consultant</th></tr>
                  </thead>
                  <tbody>
                    {visits.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">No history</td></tr>
                    ) : visits.map((v, i) => (
                      <tr key={v.visit_id || i} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="p-3 text-slate-400">{v.date?.slice(0, 10)}</td>
                        <td className="p-3 font-bold text-slate-200">{v.treatment}</td>
                        <td className="p-3 text-slate-400">{v.notes}</td>
                        <td className="p-3 text-slate-400">{v.consultant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        )}
      </main>

      {/* Visit Modal */}
      <Dialog open={visitModalOpen} onOpenChange={setVisitModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader><DialogTitle>New Consultation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-xs text-slate-400 uppercase">Treatment</label>
              <Input value={visitForm.treatment} onChange={(e) => setVisitForm(prev => ({ ...prev, treatment: e.target.value }))} placeholder="e.g., IV Vitamin Infusion" className="bg-slate-950 border-slate-800 mt-1" /></div>
            <div><label className="text-xs text-slate-400 uppercase">Notes</label>
              <Textarea value={visitForm.notes} onChange={(e) => setVisitForm(prev => ({ ...prev, notes: e.target.value }))} className="bg-slate-950 border-slate-800 mt-1 h-24" /></div>
            <div><label className="text-xs text-slate-400 uppercase">Consultant</label>
              <Input value={visitForm.consultant} readOnly className="bg-slate-950 border-slate-800 mt-1 text-slate-500" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitVisit} disabled={!visitForm.treatment} className="bg-blue-600 hover:bg-blue-700">Save Visit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Modal */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0"><DialogTitle>Change Log - {selectedPatient?.name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-400 uppercase sticky top-0"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Field</th><th className="p-2 text-left">Old</th><th className="p-2 text-left">New</th><th className="p-2 text-left">User</th></tr></thead>
              <tbody>
                {auditLogs.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">No changes</td></tr>
                  : auditLogs.map((log, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="p-2 text-slate-500">{log.timestamp?.slice(0, 16)}</td>
                      <td className="p-2 font-bold text-slate-200">{log.field}</td>
                      <td className="p-2 text-red-400">{log.old_value}</td>
                      <td className="p-2 text-emerald-400">{log.new_value}</td>
                      <td className="p-2 text-slate-400">{log.user}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="flex-shrink-0"><Button variant="outline" onClick={() => setAuditModalOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Export Modal - requires password */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader><DialogTitle>Export Patient PDF</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Enter your password to export patient record for <strong className="text-white">{selectedPatient?.name}</strong></p>
            <Input type="password" placeholder="Your password" value={pdfPassword} onChange={(e) => setPdfPassword(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPdfModalOpen(false); setPdfPassword(''); }}>Cancel</Button>
            <Button onClick={handleExportPDF} disabled={!pdfPassword || pdfLoading} className="bg-blue-600 hover:bg-blue-700">
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />} Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader><DialogTitle className="text-red-500">Delete Patient Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Permanently delete <strong className="text-white">{selectedPatient?.name}</strong> and all visit history.</p>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={deleteConsent} onChange={(e) => setDeleteConsent(e.target.checked)} className="w-4 h-4" />
              <label className="text-sm text-slate-400">I understand this is permanent</label>
            </div>
            <Input type="password" placeholder="Your password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setDeletePassword(''); setDeleteConsent(false); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePatient} disabled={!deleteConsent || !deletePassword || deleteLoading}>
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consents Modal - View patient signed consents and signatures */}
      <Dialog open={consentsModalOpen} onOpenChange={setConsentsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-500" />
              Signed Consents - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            {patientConsents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No consent records found for this patient</div>
            ) : (
              <div className="space-y-6">
                {patientConsents.map((consent, idx) => (
                  <div key={idx} className="glass-panel p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-white">Consent Record #{patientConsents.length - idx}</h4>
                        <p className="text-xs text-slate-500">{consent.timestamp?.replace('T', ' ').slice(0, 19)}</p>
                      </div>
                      <div className="flex gap-2">
                        {consent.consent_data_processing && <Badge className="bg-emerald-500/20 text-emerald-400">Data Processing</Badge>}
                        {consent.consent_medical_disclaimer && <Badge className="bg-blue-500/20 text-blue-400">Medical Disclaimer</Badge>}
                      </div>
                    </div>
                    
                    {/* Declared information at time of consent */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                      <div>
                        <span className="text-slate-500">Reason:</span>
                        <span className="text-slate-300 ml-2">{consent.reason_declared || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Alerts:</span>
                        <span className="text-red-400 ml-2">{consent.alerts_declared || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Conditions:</span>
                        <span className="text-slate-300 ml-2">{consent.conditions_declared || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Allergies:</span>
                        <span className="text-red-400 ml-2">{consent.allergies_declared || 'NKDA'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Medications:</span>
                        <span className="text-slate-300 ml-2">{consent.medications_declared || '-'}</span>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {consent.signature_data_processing && (
                        <div className="border border-slate-700 rounded-lg p-2">
                          <p className="text-xs text-emerald-400 mb-2">Data Processing Consent Signature:</p>
                          <img src={consent.signature_data_processing} alt="Data consent signature" className="w-full h-24 object-contain bg-slate-950 rounded" />
                        </div>
                      )}
                      {consent.signature_medical_disclaimer && (
                        <div className="border border-slate-700 rounded-lg p-2">
                          <p className="text-xs text-blue-400 mb-2">Medical Disclaimer Signature:</p>
                          <img src={consent.signature_medical_disclaimer} alt="Medical disclaimer signature" className="w-full h-24 object-contain bg-slate-950 rounded" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setConsentsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin/Manager Panel Modal */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAdmin ? <Shield className="w-5 h-5 text-violet-500" /> : <Crown className="w-5 h-5 text-emerald-500" />}
              {isAdmin ? 'Admin Panel' : 'Manager Panel'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="users" className="flex-1 overflow-hidden flex flex-col">
            <div className="overflow-x-auto mb-4 pb-2">
              <TabsList className="bg-slate-800 min-w-max">
                <TabsTrigger value="users" className="text-xs md:text-sm"><Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />Users</TabsTrigger>
                <TabsTrigger value="login-log" className="text-xs md:text-sm"><Key className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />Login</TabsTrigger>
                <TabsTrigger value="system-log" className="text-xs md:text-sm"><ClipboardList className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />Audit</TabsTrigger>
                {isAdmin && <TabsTrigger value="data" className="text-xs md:text-sm"><Database className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />Dane</TabsTrigger>}
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              {/* Users Tab */}
              <TabsContent value="users" className="mt-0">
                <div className="glass-panel p-3 md:p-4 mb-4 rounded-xl">
                  <h4 className="text-sm font-bold text-slate-300 mb-3">Add New User</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Input placeholder="Username" value={newUserForm.username} onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))} className="bg-slate-950 border-slate-800 w-32 md:w-40" />
                    <Input type="password" placeholder="Password" value={newUserForm.password} onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))} className="bg-slate-950 border-slate-800 w-32 md:w-40" />
                    <Select value={newUserForm.role} onValueChange={(v) => setNewUserForm(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger className="w-28 md:w-32 bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800">
                        {availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddUser} className="bg-emerald-600 hover:bg-emerald-700"><UserPlus className="w-4 h-4 mr-1 md:mr-2" /><span className="hidden md:inline">Add</span></Button>
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm" style={{ minWidth: '400px' }}>
                      <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-2 md:p-3 text-left">User</th><th className="p-2 md:p-3 text-left">Role</th><th className="p-2 md:p-3 text-left">Status</th><th className="p-2 md:p-3 text-left hidden md:table-cell">Last Login</th><th className="p-2 md:p-3 text-left">Actions</th></tr></thead>
                      <tbody>
                        {adminUsers.map((u, i) => (
                          <tr key={i} className="border-b border-slate-800">
                            <td className="p-2 md:p-3 font-bold text-slate-200">{u.username}</td>
                            <td className="p-2 md:p-3"><Badge variant="outline" className={`text-[10px] md:text-xs ${u.role === 'ADMIN' ? 'border-violet-500 text-violet-400' : u.role === 'MANAGER' ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>{u.role}</Badge></td>
                            <td className="p-2 md:p-3">{u.active ? <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] md:text-xs">Active</Badge> : <Badge className="bg-red-500/20 text-red-400 text-[10px] md:text-xs">Locked</Badge>}</td>
                            <td className="p-2 md:p-3 text-slate-500 text-xs hidden md:table-cell">{u.lastLogin || u.last_login || '-'}</td>
                            <td className="p-2 md:p-3">
                              {/* Managers cannot modify admins */}
                              {(isAdmin || u.role !== 'ADMIN') && (
                                <div className="flex gap-1 md:gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleResetPassword(u.username)} className="h-7 md:h-8 px-1.5 md:px-2"><Key className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => handleToggleUserActive(u.username, u.active)} className={`h-7 md:h-8 px-1.5 md:px-2 ${u.active ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {u.active ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Login Log Tab */}
              <TabsContent value="login-log" className="mt-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                  <h4 className="text-sm font-bold text-slate-300">Login Audit Log</h4>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => {
                          const csv = [
                            ['Timestamp', 'Username', 'Event', 'Details'].join(','),
                            ...loginAudit.map(log => [
                              log.ts || log.timestamp || '',
                              log.username || '',
                              log.event || '',
                              `"${(log.details || '').replace(/"/g, '""')}"`
                            ].join(','))
                          ].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `login_audit_${new Date().toISOString().slice(0,10)}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="w-3 h-3 mr-1" /><span className="hidden sm:inline">Export </span>CSV
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleClearLoginAudit}>
                          <Trash2 className="w-3 h-3 mr-1" /><span className="hidden sm:inline">Clear</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-xs" style={{ minWidth: '350px' }}>
                      <thead className="bg-slate-800/50 text-slate-400 uppercase sticky top-0 text-[10px] md:text-xs">
                        <tr>
                          <th className="p-2 text-left whitespace-nowrap">Time</th>
                          <th className="p-2 text-left whitespace-nowrap">User</th>
                          <th className="p-2 text-left whitespace-nowrap">Event</th>
                          <th className="p-2 text-left hidden sm:table-cell">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginAudit.map((log, i) => (
                          <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-2 text-slate-500 whitespace-nowrap text-[10px]">{(log.ts || log.timestamp)?.slice(5, 16).replace('T', ' ')}</td>
                            <td className="p-2 font-bold text-slate-300">{log.username}</td>
                            <td className="p-2"><Badge className={`text-[9px] md:text-[10px] ${log.event === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : log.event === 'FAIL' || log.event === 'LOCKED' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>{log.event}</Badge></td>
                            <td className="p-2 text-slate-500 hidden sm:table-cell text-[10px]">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[10px] md:text-xs text-slate-600 mt-2">Showing {loginAudit.length} records.</p>
              </TabsContent>

              {/* System Audit Tab - ALL OPERATIONS */}
              <TabsContent value="system-log" className="mt-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                  <h4 className="text-sm font-bold text-slate-300">System Audit Log</h4>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => {
                          const csv = [
                            ['Timestamp', 'Patient ID', 'Action', 'Field', 'Old Value', 'New Value', 'User'].join(','),
                            ...systemAudit.map(log => [
                              log.timestamp || '',
                              log.patient_id || '',
                              log.action || '',
                              log.field || '',
                              `"${(log.old_value || '').replace(/"/g, '""')}"`,
                              `"${(log.new_value || '').replace(/"/g, '""')}"`,
                              log.user || ''
                            ].join(','))
                          ].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `system_audit_${new Date().toISOString().slice(0,10)}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="w-3 h-3 mr-1" /><span className="hidden sm:inline">Export </span>CSV
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleClearSystemAudit}>
                          <Trash2 className="w-3 h-3 mr-1" /><span className="hidden sm:inline">Clear</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-xs" style={{ minWidth: '450px' }}>
                      <thead className="bg-slate-800/50 text-slate-400 uppercase sticky top-0 text-[10px]">
                        <tr>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap">Time</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap hidden md:table-cell">Patient</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap">Action</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap">Field</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap hidden sm:table-cell">Old</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap hidden sm:table-cell">New</th>
                          <th className="p-1.5 md:p-2 text-left whitespace-nowrap">User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemAudit.map((log, i) => (
                          <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-1.5 md:p-2 text-slate-500 whitespace-nowrap text-[10px]">{log.timestamp?.slice(5, 16).replace('T', ' ')}</td>
                            <td className="p-1.5 md:p-2 font-mono text-slate-400 text-[9px] hidden md:table-cell">{log.patient_id?.slice(0, 8)}...</td>
                            <td className="p-1.5 md:p-2"><Badge className={`text-[8px] md:text-[10px] ${
                              log.action === 'KIOSK_REGISTER' ? 'bg-emerald-500/20 text-emerald-400' :
                              log.action === 'NEW_VISIT' ? 'bg-blue-500/20 text-blue-400' :
                              log.action === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                              log.action === 'UPDATE' ? 'bg-yellow-500/20 text-yellow-400' :
                              log.action === 'CONSENT_SIGNED' ? 'bg-violet-500/20 text-violet-400' :
                              log.action === 'BACKUP_CREATE' ? 'bg-emerald-500/20 text-emerald-400' :
                              log.action === 'BACKUP_RESTORE' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>{log.action}</Badge></td>
                            <td className="p-1.5 md:p-2 text-slate-300 text-[10px]">{log.field}</td>
                            <td className="p-1.5 md:p-2 text-red-400 max-w-[80px] md:max-w-[120px] truncate hidden sm:table-cell text-[10px]" title={log.old_value}>{log.old_value}</td>
                            <td className="p-1.5 md:p-2 text-emerald-400 max-w-[80px] md:max-w-[120px] truncate hidden sm:table-cell text-[10px]" title={log.new_value}>{log.new_value}</td>
                            <td className="p-1.5 md:p-2 text-slate-500 whitespace-nowrap text-[10px]">{log.user}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[10px] md:text-xs text-slate-600 mt-2">Showing {systemAudit.length} records. <span className="hidden sm:inline">Scroll to see all columns.</span></p>
              </TabsContent>

              {/* Data Management Tab - ADMIN ONLY */}
              {isAdmin && (
                <TabsContent value="data" className="mt-0">
                  <div className="space-y-6">
                    {/* Password field for all actions */}
                    <div className="glass-panel p-4 rounded-xl border border-violet-500/30 bg-violet-900/10">
                      <h4 className="text-sm font-bold text-violet-400 mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Password Required for All Operations
                      </h4>
                      <Input 
                        type="password" 
                        placeholder="Your admin password" 
                        value={dataPassword} 
                        onChange={(e) => setDataPassword(e.target.value)} 
                        className="bg-slate-950 border-slate-800 max-w-xs" 
                      />
                    </div>

                    {/* Danger Zone - Delete Data */}
                    <div className="glass-panel p-4 rounded-xl border border-red-500/30 bg-red-900/10">
                      <h4 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Danger Zone - Delete Data
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Delete All Patients */}
                        <div className="p-3 border border-red-500/20 rounded-lg">
                          <h5 className="text-xs text-slate-400 uppercase mb-2">Patients</h5>
                          {dataConfirmAction === 'delete-patients' ? (
                            <div className="space-y-2">
                              <p className="text-xs text-red-400">Delete ALL patients?</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="destructive" onClick={handleDeleteAllPatients} disabled={!dataPassword || dataActionLoading}>
                                  {dataActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'YES'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDataConfirmAction(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => setDataConfirmAction('delete-patients')} className="w-full">
                              <Trash2 className="w-3 h-3 mr-2" /> Delete All Patients
                            </Button>
                          )}
                        </div>

                        {/* Delete All Visits */}
                        <div className="p-3 border border-red-500/20 rounded-lg">
                          <h5 className="text-xs text-slate-400 uppercase mb-2">Visits</h5>
                          {dataConfirmAction === 'delete-visits' ? (
                            <div className="space-y-2">
                              <p className="text-xs text-red-400">Delete ALL visits?</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="destructive" onClick={handleDeleteAllVisits} disabled={!dataPassword || dataActionLoading}>
                                  {dataActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'YES'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDataConfirmAction(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => setDataConfirmAction('delete-visits')} className="w-full">
                              <Trash2 className="w-3 h-3 mr-2" /> Delete All Visits
                            </Button>
                          )}
                        </div>

                        {/* Delete All Queue */}
                        <div className="p-3 border border-red-500/20 rounded-lg">
                          <h5 className="text-xs text-slate-400 uppercase mb-2">Queue</h5>
                          {dataConfirmAction === 'delete-queue' ? (
                            <div className="space-y-2">
                              <p className="text-xs text-red-400">Clear entire queue?</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="destructive" onClick={handleDeleteAllQueue} disabled={!dataPassword || dataActionLoading}>
                                  {dataActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'YES'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDataConfirmAction(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => setDataConfirmAction('delete-queue')} className="w-full">
                              <Trash2 className="w-3 h-3 mr-2" /> Clear Queue
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Backup Section */}
                    <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/10">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                          <HardDrive className="w-4 h-4" /> Backups
                        </h4>
                        <Button size="sm" onClick={handleCreateBackup} disabled={!dataPassword || dataActionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                          {dataActionLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Archive className="w-3 h-3 mr-2" />}
                          Create Backup
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Automatic backups run daily at 2:00 AM UTC (last 30 kept)</p>

                      {backups.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-4">No backups found</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
                              <tr>
                                <th className="p-2 text-left">Backup ID</th>
                                <th className="p-2 text-left">Created</th>
                                <th className="p-2 text-left">By</th>
                                <th className="p-2 text-left">Data</th>
                                <th className="p-2 text-left">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backups.map((b) => (
                                <tr key={b.backup_id} className="border-b border-slate-800">
                                  <td className="p-2 font-mono text-emerald-400 text-xs">{b.backup_id}</td>
                                  <td className="p-2 text-slate-400 whitespace-nowrap">{b.created_at?.slice(0, 16).replace('T', ' ')}</td>
                                  <td className="p-2 text-slate-400">{b.created_by}</td>
                                  <td className="p-2 text-slate-500 text-xs whitespace-nowrap">
                                    P:{b.counts?.patients || 0} V:{b.counts?.visits || 0}
                                  </td>
                                  <td className="p-2">
                                    {dataConfirmAction === `restore-${b.backup_id}` ? (
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleRestoreBackup(b.backup_id)} disabled={!dataPassword || dataActionLoading} className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2">
                                          {dataActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'YES'}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setDataConfirmAction(null)} className="h-7 px-2">No</Button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setDataConfirmAction(`restore-${b.backup_id}`)} className="h-7 px-2 text-emerald-400 border-emerald-500/50" title="Restore">
                                          <RotateCcw className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleDeleteBackup(b.backup_id)} disabled={!dataPassword || dataActionLoading} className="h-7 px-2 text-red-400 border-red-500/50" title="Delete">
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Kiosk Settings */}
                    <div className="glass-panel p-4 rounded-xl border border-blue-500/30 bg-blue-900/10">
                      <h4 className="text-sm font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Kiosk Mode Settings
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-xs">
                          <Label className="text-xs text-slate-400 mb-1 block">Exit PIN (for tablet kiosk mode)</Label>
                          <Input
                            type="text"
                            value={kioskPin}
                            onChange={(e) => setKioskPin(e.target.value)}
                            placeholder="1234"
                            className="bg-slate-950 border-slate-800"
                            maxLength={6}
                          />
                        </div>
                        <Button onClick={handleUpdateKioskPin} className="bg-blue-600 hover:bg-blue-700 mt-5">
                          Update PIN
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Tablet kiosk URL: <code className="text-blue-400">/kiosk?mode=locked</code>
                      </p>
                    </div>
                  </div>
                </TabsContent>
              )}
            </ScrollArea>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminModalOpen(false)}>Close</Button>
            <Button onClick={loadAdminData} disabled={adminLoading}>{adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Refresh</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPortal;
