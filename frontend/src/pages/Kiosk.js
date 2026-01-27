import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Loader2,
  AlertTriangle,
  Pill,
  Heart,
  Thermometer,
  Clock,
  Eraser,
  PenTool
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Signature Pad Component
const SignaturePad = ({ onSignatureChange, label, signatureRef }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Expose canvas ref to parent
  useEffect(() => {
    if (signatureRef) {
      signatureRef.current = canvasRef.current;
    }
  }, [signatureRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
    onSignatureChange(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm text-slate-400 flex items-center gap-2">
          <PenTool className="w-4 h-4" /> {label}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSignature}
          className="text-slate-500 hover:text-white h-8"
        >
          <Eraser className="w-4 h-4 mr-1" /> Clear
        </Button>
      </div>
      <div className={`relative rounded-xl overflow-hidden border-2 ${hasSignature ? 'border-emerald-500' : 'border-slate-700'} transition-colors`}>
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-32 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-slate-600 text-sm">Sign here with finger or mouse</span>
          </div>
        )}
      </div>
      {hasSignature && (
        <p className="text-xs text-emerald-500 flex items-center gap-1">
          <Check className="w-3 h-3" /> Signature captured
        </p>
      )}
    </div>
  );
};

const Kiosk = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingPatient, setExistingPatient] = useState(null);
  const [showNewPatientConfirm, setShowNewPatientConfirm] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dob_day: '',
    dob_month: '',
    dob_year: '',
    postcode: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    emergency_name: '',
    emergency_phone: '',
    reason: '',
    medications: '',
    allergies: '',
    conditions: '',
    surgeries: '',
    alerts: []
  });

  const [consents, setConsents] = useState({
    dataProcessing: false,
    medicalDisclaimer: false
  });

  const [signatures, setSignatures] = useState({
    dataProcessing: false,
    medicalDisclaimer: false
  });

  // Refs for signature canvases
  const signatureDataRef = useRef(null);
  const signatureMedicalRef = useRef(null);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleAlert = (alert) => {
    setFormData(prev => ({
      ...prev,
      alerts: prev.alerts.includes(alert)
        ? prev.alerts.filter(a => a !== alert)
        : [...prev.alerts, alert]
    }));
  };

  const toggleCondition = (condition) => {
    const current = formData.conditions.split(', ').filter(c => c);
    const updated = current.includes(condition)
      ? current.filter(c => c !== condition)
      : [...current, condition];
    updateField('conditions', updated.join(', '));
  };

  // Step 1: Identification
  const handleIdentify = async () => {
    const { first_name, last_name, dob_day, dob_month, dob_year, postcode } = formData;
    
    if (!first_name || !last_name || !dob_day || !dob_month || !dob_year || !postcode) {
      setError('Please fill all identification fields');
      return;
    }

    const dob = `${dob_year}-${dob_month.padStart(2, '0')}-${dob_day.padStart(2, '0')}`;
    setLoading(true);

    try {
      const response = await axios.post(`${API}/kiosk/check`, null, {
        params: { first_name, last_name, dob, postcode }
      });

      if (response.data.status === 'SUCCESS') {
        setExistingPatient(response.data.data);
        const data = response.data.data;
        setFormData(prev => ({
          ...prev,
          phone: data.phone || '',
          email: data.email || '',
          street: data.street || '',
          city: data.city || '',
          emergency_name: data.emergency_name || '',
          emergency_phone: data.emergency_phone || '',
          medications: data.medications || '',
          allergies: data.allergies || '',
          conditions: data.conditions || ''
        }));
        setStep(2);
      } else if (response.data.status === 'PARTIAL_MATCH') {
        setError('Patient found but postcode does not match. Please verify your details.');
      } else {
        setShowNewPatientConfirm(true);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmNewPatient = () => {
    setShowNewPatientConfirm(false);
    setStep(2);
  };

  const isStep2Valid = () => {
    const { phone, email, street, city, emergency_name, emergency_phone, reason } = formData;
    return phone && email && street && city && emergency_name && emergency_phone && reason;
  };

  // Final submission - requires signatures
  const handleSubmit = async () => {
    if (!consents.dataProcessing || !consents.medicalDisclaimer) {
      setError('Please accept all consents to continue');
      return;
    }
    if (!signatures.dataProcessing || !signatures.medicalDisclaimer) {
      setError('Please sign both consent forms');
      return;
    }

    setLoading(true);
    const dob = `${formData.dob_year}-${formData.dob_month.padStart(2, '0')}-${formData.dob_day.padStart(2, '0')}`;

    try {
      await axios.post(`${API}/kiosk/register`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob,
        postcode: formData.postcode,
        phone: formData.phone,
        email: formData.email,
        street: formData.street,
        city: formData.city,
        emergency_name: formData.emergency_name,
        emergency_phone: formData.emergency_phone,
        reason: formData.reason,
        medications: formData.medications,
        allergies: formData.allergies || 'NKDA',
        conditions: formData.conditions,
        surgeries: formData.surgeries,
        alerts: formData.alerts.join(', '),
        skip_queue: false
      });

      setStep(4);
    } catch (err) {
      setError('Registration failed. Please try again or ask staff for help.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => navigate('/'), 5000);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  const alertOptions = [
    { value: 'Today: Fever/Flu/Inf', label: 'Fever, infection, flu-like symptoms?' },
    { value: 'Today: Dizzy/Faint', label: 'Dizzy or fainted in last 48h?' },
    { value: 'Today: Unwell', label: 'Feel unwell right now?' },
    { value: 'Recent: Alcohol <24h', label: 'Alcohol in last 24h' },
    { value: 'Recent: Drugs <72h', label: 'Recreational drugs in last 72h' },
    { value: 'Recent: No Food/Fluid <24h', label: 'No food/fluid in 24h' }
  ];

  const conditionOptions = [
    'High/Low BP', 'Diabetes', 'Asthma/Lung', 'Epilepsy', 
    'Heart Condition', 'Kidney Issues', 'Liver Issues', 'Immune Disorder'
  ];

  return (
    <div data-testid="kiosk-view" className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-emerald-500 tracking-wide">Patient Check-In</h1>
        <Button data-testid="kiosk-exit-btn" variant="ghost" onClick={() => navigate('/')} className="text-slate-500 hover:text-white">
          Exit
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Step 1: Identification */}
        {step === 1 && (
          <div data-testid="kiosk-step-1" className="flex flex-col items-center justify-center p-6 min-h-full animate-fade-in">
            <div className="w-full max-w-md space-y-8">
              <div className="text-center mb-10">
                <h2 className="text-lg md:text-xl font-medium text-slate-400 mb-1 tracking-wider uppercase">Welcome to</h2>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                  Just Vitality <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Clinic</span>
                </h1>
              </div>

              <div className="space-y-4">
                <p className="text-center text-slate-500 text-sm mb-2 uppercase tracking-wide">Please identify yourself</p>
                
                <Input data-testid="kiosk-first-name" placeholder="First Name" value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value.toUpperCase())} className="text-center text-xl uppercase bg-slate-900 p-6 border-slate-800 focus:border-blue-500 kiosk-touch" />
                <Input data-testid="kiosk-last-name" placeholder="Last Name" value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value.toUpperCase())} className="text-center text-xl uppercase bg-slate-900 p-6 border-slate-800 focus:border-blue-500 kiosk-touch" />

                <div className="pt-2">
                  <Label className="block text-xs text-slate-500 mb-2 text-center">DATE OF BIRTH</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Input data-testid="kiosk-dob-day" placeholder="DD" type="number" value={formData.dob_day} onChange={(e) => updateField('dob_day', e.target.value.slice(0, 2))} className="text-center text-xl bg-slate-900 p-6 border-slate-800 kiosk-touch" />
                    <Input data-testid="kiosk-dob-month" placeholder="MM" type="number" value={formData.dob_month} onChange={(e) => updateField('dob_month', e.target.value.slice(0, 2))} className="text-center text-xl bg-slate-900 p-6 border-slate-800 kiosk-touch" />
                    <Input data-testid="kiosk-dob-year" placeholder="YYYY" type="number" value={formData.dob_year} onChange={(e) => updateField('dob_year', e.target.value.slice(0, 4))} className="text-center text-xl bg-slate-900 p-6 border-slate-800 kiosk-touch" />
                  </div>
                </div>

                <Input data-testid="kiosk-postcode" placeholder="Postcode (e.g. SW1A 1AA)" value={formData.postcode} onChange={(e) => updateField('postcode', e.target.value.toUpperCase())} className="text-center text-xl uppercase bg-slate-900 p-6 border-slate-800 focus:border-blue-500 kiosk-touch mt-4" />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button data-testid="kiosk-step1-next" onClick={handleIdentify} disabled={loading} className="w-full py-6 text-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/40 kiosk-touch">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Next Step <ArrowRight className="ml-2" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* New Patient Confirmation Modal */}
        {showNewPatientConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-8 rounded-2xl max-w-md text-center">
              <h3 className="text-xl font-bold text-white mb-4">New Patient Registration</h3>
              <p className="text-slate-400 mb-6">We don't have a record for you yet. Would you like to register as a new patient?</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowNewPatientConfirm(false)} className="flex-1">Go Back</Button>
                <Button data-testid="kiosk-confirm-new" onClick={confirmNewPatient} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Yes, Register Me</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contact Info */}
        {step === 2 && (
          <div data-testid="kiosk-step-2" className="container mx-auto max-w-3xl p-4 md:p-6 pb-20 animate-fade-in">
            {existingPatient && (
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-xl mb-6">
                <h3 className="text-lg font-bold text-blue-400">Welcome Back, {existingPatient.first_name}!</h3>
                <p className="text-sm text-slate-400">Please verify your details below.</p>
              </div>
            )}

            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-slate-400 text-xs uppercase font-bold mb-4 tracking-wider">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input data-testid="kiosk-phone" placeholder="Phone Number" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                  <Input data-testid="kiosk-email" placeholder="Email Address" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                  <Input data-testid="kiosk-street" placeholder="Street Address" value={formData.street} onChange={(e) => updateField('street', e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                  <div className="flex gap-2">
                    <Input data-testid="kiosk-city" placeholder="City" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="bg-slate-950 border-slate-800 h-12 flex-1" />
                    <Input placeholder="Postcode" value={formData.postcode} readOnly className="bg-slate-950 border-slate-800 h-12 w-1/3 text-slate-500" />
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border-l-4 border-red-500">
                <h3 className="text-red-400 text-xs uppercase font-bold mb-4 tracking-wider">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input data-testid="kiosk-emergency-name" placeholder="Contact Name" value={formData.emergency_name} onChange={(e) => updateField('emergency_name', e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                  <Input data-testid="kiosk-emergency-phone" placeholder="Emergency Phone" value={formData.emergency_phone} onChange={(e) => updateField('emergency_phone', e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border-l-4 border-emerald-500">
                <Label className="block text-emerald-400 font-bold mb-2 text-lg">Reason for Today's Visit</Label>
                <Textarea data-testid="kiosk-reason" placeholder="Briefly describe why you are here..." value={formData.reason} onChange={(e) => updateField('reason', e.target.value)} className="bg-slate-950 border-slate-800 h-24 text-lg" />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-14"><ArrowLeft className="mr-2" /> Back</Button>
                <Button data-testid="kiosk-step2-next" onClick={() => setStep(3)} disabled={!isStep2Valid()} className="flex-1 h-14 bg-blue-600 hover:bg-blue-700">
                  Continue to Medical History <ArrowRight className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Medical History with Signatures */}
        {step === 3 && (
          <div data-testid="kiosk-step-3" className="container mx-auto max-w-4xl p-4 md:p-6 pb-24 animate-fade-in">
            {existingPatient && (
              <div className="bg-yellow-900/20 border border-yellow-800 p-4 rounded-xl mb-6">
                <h3 className="text-lg font-bold text-yellow-500">Medical History Review</h3>
                <p className="text-sm text-slate-400">Your previous history is pre-selected. Please confirm or update.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Today's Health */}
              <div className="glass-panel p-4 rounded-xl border-t-4 border-red-600">
                <h3 className="font-bold text-white mb-3 uppercase text-sm tracking-wider flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-red-500" /> How do you feel TODAY?
                </h3>
                <div className="space-y-2">
                  {alertOptions.slice(0, 3).map(opt => (
                    <label key={opt.value} className="flex items-center space-x-3 p-3 bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer kiosk-touch">
                      <Checkbox checked={formData.alerts.includes(opt.value)} onCheckedChange={() => toggleAlert(opt.value)} className="h-5 w-5" />
                      <span className="text-slate-300 text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Recent History */}
              <div className="glass-panel p-4 rounded-xl border-t-4 border-orange-500">
                <h3 className="font-bold text-white mb-3 uppercase text-sm tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" /> Last 24-72 Hours
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {alertOptions.slice(3).map(opt => (
                    <label key={opt.value} className="flex items-center p-3 bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer kiosk-touch">
                      <Checkbox checked={formData.alerts.includes(opt.value)} onCheckedChange={() => toggleAlert(opt.value)} className="mr-2 h-5 w-5" />
                      <span className="text-slate-300 text-xs">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Medical Conditions */}
              <div className="glass-panel p-4 rounded-xl border-t-4 border-yellow-500">
                <h3 className="font-bold text-white mb-3 uppercase text-sm tracking-wider flex items-center gap-2">
                  <Heart className="w-4 h-4 text-yellow-500" /> Chronic Medical Conditions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {conditionOptions.map(cond => (
                    <label key={cond} className="flex items-center p-3 bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer kiosk-touch">
                      <Checkbox checked={formData.conditions.includes(cond)} onCheckedChange={() => toggleCondition(cond)} className="mr-2 h-5 w-5" />
                      <span className="text-slate-300 text-xs">{cond}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Medications & Allergies */}
              <div className="glass-panel p-4 rounded-xl border-t-4 border-blue-500">
                <h3 className="font-bold text-white mb-3 uppercase text-sm tracking-wider flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-500" /> Medications & Allergies
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500">Current Medications</Label>
                    <Textarea data-testid="kiosk-medications" placeholder="List your current medications..." value={formData.medications} onChange={(e) => updateField('medications', e.target.value)} className="bg-slate-950 border-slate-800 h-20 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-red-400">Known Allergies</Label>
                    <Input data-testid="kiosk-allergies" placeholder="e.g., Penicillin, Latex (or NKDA)" value={formData.allergies} onChange={(e) => updateField('allergies', e.target.value)} className="bg-slate-950 border-slate-800 h-12 mt-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Consents with Signature Pads */}
            <div className="glass-panel p-6 rounded-xl mt-6 border-t-4 border-emerald-500">
              <h3 className="font-bold text-white mb-4 uppercase text-sm tracking-wider">Consent & Signature</h3>
              
              {/* Data Processing Consent */}
              <div className="space-y-4 mb-6 pb-6 border-b border-slate-800">
                <label className="flex items-start space-x-3 p-3 bg-slate-900 rounded-lg cursor-pointer">
                  <Checkbox
                    data-testid="kiosk-consent-data"
                    checked={consents.dataProcessing}
                    onCheckedChange={(checked) => setConsents(prev => ({ ...prev, dataProcessing: checked }))}
                    className="h-5 w-5 mt-0.5"
                  />
                  <span className="text-slate-300 text-sm">
                    I consent to the processing of my personal and health data for the purpose of my treatment at Just Vitality Clinic.
                  </span>
                </label>
                {consents.dataProcessing && (
                  <div className="ml-8 animate-fade-in">
                    <SignaturePad 
                      label="Sign to confirm data processing consent"
                      onSignatureChange={(signed) => setSignatures(prev => ({ ...prev, dataProcessing: signed }))}
                    />
                  </div>
                )}
              </div>

              {/* Medical Disclaimer Consent */}
              <div className="space-y-4">
                <label className="flex items-start space-x-3 p-3 bg-slate-900 rounded-lg cursor-pointer">
                  <Checkbox
                    data-testid="kiosk-consent-medical"
                    checked={consents.medicalDisclaimer}
                    onCheckedChange={(checked) => setConsents(prev => ({ ...prev, medicalDisclaimer: checked }))}
                    className="h-5 w-5 mt-0.5"
                  />
                  <span className="text-slate-300 text-sm">
                    I confirm the information provided is accurate to the best of my knowledge. I understand the treatment may carry risks and agree to proceed.
                  </span>
                </label>
                {consents.medicalDisclaimer && (
                  <div className="ml-8 animate-fade-in">
                    <SignaturePad 
                      label="Sign to confirm medical disclaimer"
                      onSignatureChange={(signed) => setSignatures(prev => ({ ...prev, medicalDisclaimer: signed }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mt-4">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-14"><ArrowLeft className="mr-2" /> Back</Button>
              <Button
                data-testid="kiosk-submit"
                onClick={handleSubmit}
                disabled={loading || !consents.dataProcessing || !consents.medicalDisclaimer || !signatures.dataProcessing || !signatures.medicalDisclaimer}
                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Submit & Check-In <Check className="ml-2" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div data-testid="kiosk-success" className="flex flex-col items-center justify-center p-6 min-h-full animate-fade-in">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Check-In Complete!</h2>
              <p className="text-slate-400 mb-8">
                Thank you, {formData.first_name}. Please take a seat and a member of our team will be with you shortly.
              </p>
              <p className="text-sm text-slate-500">Returning to home screen in 5 seconds...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Kiosk;
