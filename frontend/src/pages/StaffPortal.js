import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Home,
  Search,
  RefreshCw,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Pill,
  Heart,
  History,
  Plus,
  Edit,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Shield
} from 'lucide-react';

const StaffPortal = () => {
  const navigate = useNavigate();
  const { user, logout, isManager } = useAuth();
  const { 
    patients, 
    queue, 
    selectedPatient, 
    setSelectedPatient,
    loading,
    loadDashboardData,
    loadPatient,
    updatePatient,
    deletePatient,
    getPatientVisits,
    createVisit,
    getPatientAudit
  } = useClinic();

  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbListOpen, setDbListOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  
  // Modals
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  // Visit history & audit
  const [visits, setVisits] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Edit form
  const [editForm, setEditForm] = useState({});
  
  // Visit form
  const [visitForm, setVisitForm] = useState({
    treatment: '',
    notes: '',
    consultant: ''
  });
  
  // Delete form
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConsent, setDeleteConsent] = useState(false);

  // Filter patients by search
  const filteredPatients = patients.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || 
           p.patient_id?.toLowerCase().includes(term) ||
           p.dob?.includes(term);
  });

  const filteredQueue = queue.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || 
           p.patient_id?.toLowerCase().includes(term);
  });

  // Select patient
  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setSidebarOpen(false);
    setEditMode(false);
    
    // Load visits
    const patientVisits = await getPatientVisits(patient.patient_id);
    setVisits(patientVisits);
    
    // Set edit form
    setEditForm({
      phone: patient.phone || '',
      email: patient.email || '',
      street: patient.street || '',
      city: patient.city || '',
      postcode: patient.postcode || '',
      emergency_name: patient.emergency_name || '',
      emergency_phone: patient.emergency_phone || '',
      medications: patient.medications || '',
      allergies: patient.allergies || '',
      conditions: patient.conditions || '',
      surgeries: patient.surgeries || '',
      procedures: patient.procedures || ''
    });
  };

  // Save patient edits
  const handleSavePatient = async () => {
    const result = await updatePatient(selectedPatient.patient_id, editForm);
    if (result.success) {
      setEditMode(false);
      // Reload patient data
      const updated = await loadPatient(selectedPatient.patient_id);
      if (updated) {
        setSelectedPatient({ ...selectedPatient, ...updated });
      }
    }
  };

  // Open visit modal
  const handleOpenVisitModal = () => {
    setVisitForm({
      treatment: '',
      notes: selectedPatient?.queue_reason || selectedPatient?.reason || '',
      consultant: user?.username || ''
    });
    setVisitModalOpen(true);
  };

  // Submit visit
  const handleSubmitVisit = async () => {
    const result = await createVisit({
      patient_id: selectedPatient.patient_id,
      treatment: visitForm.treatment,
      notes: visitForm.notes,
      consultant: visitForm.consultant
    });
    if (result.success) {
      setVisitModalOpen(false);
      // Reload visits
      const patientVisits = await getPatientVisits(selectedPatient.patient_id);
      setVisits(patientVisits);
      // Update selected patient to clear reason
      setSelectedPatient(prev => ({ ...prev, queue_reason: '', reason: '' }));
    }
  };

  // Show audit logs
  const handleShowAudit = async () => {
    const logs = await getPatientAudit(selectedPatient.patient_id);
    setAuditLogs(logs);
    setAuditModalOpen(true);
  };

  // Delete patient
  const handleDeletePatient = async () => {
    const result = await deletePatient(selectedPatient.patient_id, deletePassword);
    if (result.success) {
      setDeleteModalOpen(false);
      setSelectedPatient(null);
      setDeletePassword('');
      setDeleteConsent(false);
    }
  };

  // Navigate to kiosk for new patient registration
  const handleNewPatient = () => {
    navigate('/kiosk');
  };

  return (
    <div data-testid="staff-portal" className="h-screen flex flex-col md:flex-row relative bg-slate-950">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-50 shrink-0 h-14">
        <div className="font-bold text-lg text-white">
          Just Vitality <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Clinic</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white">
            <Home className="w-5 h-5" />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-2 border border-slate-700 rounded hover:bg-slate-800">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside 
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:relative top-14 md:top-0 bottom-0 left-0 
          w-full md:w-[340px] 
          bg-slate-900 border-r border-slate-800 
          flex flex-col z-40 
          transition-transform duration-300
        `}
      >
        {/* User Info */}
        <div className="p-4 border-b border-slate-800">
          <div className="hidden md:flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Logged In As</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-blue-500">{user?.username}</span>
                <Badge variant="outline" className="text-[10px]">{user?.role}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-slate-800 transition text-slate-400 hover:text-white">
                <Home className="w-5 h-5" />
              </button>
              <button onClick={logout} className="p-2 rounded-full hover:bg-slate-800 transition text-red-400 hover:text-red-300">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile user info */}
          <div className="md:hidden mb-4 p-2 bg-slate-800/50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">User: <span className="text-white font-bold">{user?.username}</span></span>
              <button onClick={logout} className="text-xs text-red-400">Sign Out</button>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                data-testid="staff-search"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-800 h-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={loadDashboardData}
              disabled={loading}
              className="border-slate-800 hover:bg-slate-800"
            >
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
              <div
                key={p.patient_id}
                data-testid={`queue-patient-${p.patient_id}`}
                onClick={() => handleSelectPatient(p)}
                className={`p-3 border-b border-slate-800 hover:bg-blue-500/10 cursor-pointer flex justify-between items-center ${
                  selectedPatient?.patient_id === p.patient_id ? 'bg-blue-500/20' : ''
                }`}
              >
                <div>
                  <div className="font-bold text-sm uppercase text-white">{p.name}</div>
                  <div className="text-xs text-blue-500 truncate max-w-[200px]">{p.queue_reason}</div>
                </div>
                {p.is_new && (
                  <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-500">NEW</Badge>
                )}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Database List */}
        <div 
          onClick={() => setDbListOpen(!dbListOpen)}
          className="px-4 py-2 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center cursor-pointer hover:bg-slate-800/50"
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase">Database (A-Z)</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{filteredPatients.length}</Badge>
            {dbListOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </div>
        </div>
        {dbListOpen && (
          <ScrollArea className="flex-1">
            {filteredPatients.map(p => (
              <div
                key={p.patient_id}
                data-testid={`patient-${p.patient_id}`}
                onClick={() => handleSelectPatient(p)}
                className={`p-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer flex justify-between items-center ${
                  selectedPatient?.patient_id === p.patient_id ? 'bg-blue-500/20' : ''
                }`}
              >
                <div>
                  <div className="font-bold text-sm uppercase text-slate-200">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.dob}</div>
                </div>
                {p.is_new && (
                  <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-500">NEW</Badge>
                )}
              </div>
            ))}
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="text-[10px] text-slate-600 text-center">
            System by <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500 hover:underline">Kamil Dyczkowski</a> 2026
          </div>
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
          <div data-testid="patient-dashboard" className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Patient Header */}
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-900/50 shrink-0">
              <div>
                <h1 className="text-2xl font-bold uppercase text-white">{selectedPatient.name}</h1>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedPatient.patient_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="new-patient-btn"
                  onClick={handleNewPatient}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Patient
                </Button>
                <Button
                  data-testid="audit-btn"
                  variant="outline"
                  onClick={handleShowAudit}
                  className="border-slate-700"
                >
                  <History className="w-4 h-4 mr-2" /> Change Log
                </Button>
                <Button
                  data-testid="edit-btn"
                  variant={editMode ? "default" : "outline"}
                  onClick={() => setEditMode(!editMode)}
                  className={editMode ? "bg-emerald-600" : "border-slate-700"}
                >
                  <Edit className="w-4 h-4 mr-2" /> {editMode ? 'Editing...' : 'Edit Profile'}
                </Button>
                <Button
                  data-testid="new-visit-btn"
                  onClick={handleOpenVisitModal}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Visit
                </Button>
              </div>
            </div>

            {/* Patient Content */}
            <ScrollArea className="flex-1 p-4 md:p-6">
              {/* Info Tiles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Reason */}
                <div className="glass-panel p-4 rounded-xl border-l-4 border-blue-500">
                  <h3 className="text-xs text-blue-500 font-bold uppercase mb-1">Reason</h3>
                  <p className="text-sm italic text-slate-300">
                    {selectedPatient.queue_reason || selectedPatient.reason || 'No active visit.'}
                  </p>
                </div>

                {/* Alerts */}
                <div className={`glass-panel p-4 rounded-xl flex items-center justify-between ${
                  selectedPatient.alerts ? 'border border-red-500 bg-red-500/10' : ''
                }`}>
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-400">Alerts (Today)</h3>
                    <p className={`text-sm ${selectedPatient.alerts ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                      {selectedPatient.alerts || 'None.'}
                    </p>
                  </div>
                  <AlertTriangle className={`w-6 h-6 ${selectedPatient.alerts ? 'text-red-500' : 'text-slate-700'}`} />
                </div>

                {/* Allergies */}
                <div className="glass-panel p-4 rounded-xl border-l-4 border-red-500">
                  <h3 className="text-xs text-red-500 font-bold uppercase mb-1">Allergies</h3>
                  {editMode ? (
                    <Input
                      value={editForm.allergies}
                      onChange={(e) => setEditForm(prev => ({ ...prev, allergies: e.target.value }))}
                      className="bg-slate-950 border-slate-800 h-10"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{selectedPatient.allergies || 'NKDA'}</p>
                  )}
                </div>
              </div>

              {/* Medical Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col gap-4">
                  {/* Medications */}
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">
                      <Pill className="w-3 h-3 inline mr-1" /> Medications
                    </label>
                    {editMode ? (
                      <Textarea
                        value={editForm.medications}
                        onChange={(e) => setEditForm(prev => ({ ...prev, medications: e.target.value }))}
                        className="bg-slate-950 border-slate-800 h-24"
                      />
                    ) : (
                      <p className="text-sm text-slate-300">{selectedPatient.medications || '-'}</p>
                    )}
                  </div>

                  {/* Surgeries */}
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Surgeries</label>
                    {editMode ? (
                      <Textarea
                        value={editForm.surgeries}
                        onChange={(e) => setEditForm(prev => ({ ...prev, surgeries: e.target.value }))}
                        className="bg-slate-950 border-slate-800 h-24"
                      />
                    ) : (
                      <p className="text-sm text-slate-300">{selectedPatient.surgeries || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Conditions */}
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">
                      <Heart className="w-3 h-3 inline mr-1" /> Conditions
                    </label>
                    {editMode ? (
                      <Textarea
                        value={editForm.conditions}
                        onChange={(e) => setEditForm(prev => ({ ...prev, conditions: e.target.value }))}
                        className="bg-slate-950 border-slate-800 h-24"
                      />
                    ) : (
                      <p className="text-sm text-slate-300">{selectedPatient.conditions || '-'}</p>
                    )}
                  </div>

                  {/* IV History / Notes */}
                  <div className="glass-panel p-4 rounded-xl flex-1">
                    <label className="text-xs text-yellow-500 font-bold uppercase mb-1 block">IV History / Notes</label>
                    <Textarea
                      value={editForm.procedures}
                      onChange={(e) => setEditForm(prev => ({ ...prev, procedures: e.target.value }))}
                      onBlur={handleSavePatient}
                      placeholder="Type notes here (Auto-saved)..."
                      className="bg-slate-950 border-slate-800 h-24 focus:border-yellow-500"
                    />
                  </div>
                </div>

                {/* Contact Details */}
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs text-slate-400 font-bold uppercase mb-3">Contact Details</h3>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-4 h-4 text-slate-500" /> {selectedPatient.phone || '-'}
                    </p>
                    <p className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-4 h-4 text-slate-500" /> {selectedPatient.email || '-'}
                    </p>
                    <p className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-slate-500" /> 
                      {[selectedPatient.street, selectedPatient.city, selectedPatient.postcode].filter(Boolean).join(', ') || '-'}
                    </p>
                    <p className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" /> 
                      {selectedPatient.emergency_name} {selectedPatient.emergency_phone}
                    </p>
                  </div>

                  {/* Edit Contact Form */}
                  {editMode && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <Input
                        placeholder="Phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="bg-slate-950 border-slate-800"
                      />
                      <Input
                        placeholder="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-slate-950 border-slate-800"
                      />
                      <Input
                        placeholder="Street"
                        value={editForm.street}
                        onChange={(e) => setEditForm(prev => ({ ...prev, street: e.target.value }))}
                        className="bg-slate-950 border-slate-800"
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="City"
                          value={editForm.city}
                          onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                          className="bg-slate-950 border-slate-800 flex-1"
                        />
                        <Input
                          placeholder="Postcode"
                          value={editForm.postcode}
                          onChange={(e) => setEditForm(prev => ({ ...prev, postcode: e.target.value }))}
                          className="bg-slate-950 border-slate-800 w-1/3"
                        />
                      </div>
                      <label className="text-xs text-red-500 font-bold mt-2 block">Emergency Contact</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Name"
                          value={editForm.emergency_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, emergency_name: e.target.value }))}
                          className="bg-slate-950 border-slate-800"
                        />
                        <Input
                          placeholder="Phone"
                          value={editForm.emergency_phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, emergency_phone: e.target.value }))}
                          className="bg-slate-950 border-slate-800"
                        />
                      </div>
                      <Button onClick={handleSavePatient} className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700">
                        Save Changes
                      </Button>

                      {/* Manager Zone */}
                      {isManager && (
                        <div className="mt-6 pt-4 border-t border-slate-700">
                          <div className="p-4 border border-red-500/30 rounded-lg bg-red-900/10">
                            <h3 className="text-xs text-red-400 font-bold uppercase mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4" /> Manager Zone
                            </h3>
                            <Button
                              data-testid="delete-patient-btn"
                              variant="destructive"
                              onClick={() => setDeleteModalOpen(true)}
                              className="w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete Record
                            </Button>
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
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Treatment</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3">Consultant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No history</td>
                      </tr>
                    ) : (
                      visits.map((v, i) => (
                        <tr key={v.visit_id || i} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="p-3 text-slate-400">{v.date?.slice(0, 10)}</td>
                          <td className="p-3 font-bold text-slate-200">{v.treatment}</td>
                          <td className="p-3 text-slate-400">{v.notes}</td>
                          <td className="p-3 text-slate-400">{v.consultant}</td>
                        </tr>
                      ))
                    )}
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
          <DialogHeader>
            <DialogTitle>New Consultation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase">Treatment</label>
              <Input
                data-testid="visit-treatment"
                value={visitForm.treatment}
                onChange={(e) => setVisitForm(prev => ({ ...prev, treatment: e.target.value }))}
                placeholder="e.g., IV Vitamin Infusion"
                className="bg-slate-950 border-slate-800 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">Notes</label>
              <Textarea
                data-testid="visit-notes"
                value={visitForm.notes}
                onChange={(e) => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-slate-950 border-slate-800 mt-1 h-24"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">Consultant</label>
              <Input
                value={visitForm.consultant}
                readOnly
                className="bg-slate-950 border-slate-800 mt-1 text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitModalOpen(false)}>Cancel</Button>
            <Button 
              data-testid="visit-submit"
              onClick={handleSubmitVisit}
              disabled={!visitForm.treatment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Modal */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change Log - {selectedPatient?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-400 uppercase">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Field</th>
                  <th className="p-2 text-left">Old Value</th>
                  <th className="p-2 text-left">New Value</th>
                  <th className="p-2 text-left">User</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">No changes recorded</td>
                  </tr>
                ) : (
                  auditLogs.map((log, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="p-2 text-slate-400">{log.timestamp?.slice(0, 16)}</td>
                      <td className="p-2 font-bold text-slate-200">{log.field}</td>
                      <td className="p-2 text-red-400">{log.old_value}</td>
                      <td className="p-2 text-emerald-400">{log.new_value}</td>
                      <td className="p-2 text-slate-400">{log.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete Patient Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              This will permanently delete <strong className="text-white">{selectedPatient?.name}</strong> and all their visit history. This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deleteConsent}
                onChange={(e) => setDeleteConsent(e.target.checked)}
                className="w-4 h-4"
              />
              <label className="text-sm text-slate-400">I understand this action is permanent</label>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">Enter your password to confirm</label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="bg-slate-950 border-slate-800 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleDeletePatient}
              disabled={!deleteConsent || !deletePassword}
            >
              Delete Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPortal;
