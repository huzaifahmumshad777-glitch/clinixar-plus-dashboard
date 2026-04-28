import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart3, 
  Users, 
  PlusCircle, 
  ClipboardList, 
  LineChart, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Menu,
  X,
  Stethoscope,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Edit2,
  Upload,
  Info,
  LogOut,
  FileText,
  Loader2,
  Pill,
  CreditCard,
  Receipt,
  History,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar,
  ReferenceLine
} from 'recharts';
import * as XLSX from 'xlsx';
import PrescriptionForm from './components/PrescriptionForm';
import InvoiceForm from './components/InvoiceForm';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType, testConnection } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { generateClinicReport } from './lib/gemini';
import { 
  Patient, 
  Prescription, 
  Invoice,
  Priority,
  PatientStatus,
  DailyStats
} from './types';
import { Timestamp } from 'firebase/firestore';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (dateStr: string) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

const robustParseDate = (dateVal: unknown): string => {
  if (!dateVal) return getLocalDateString();
  
  // If already a Date object (common in library imports)
  if (dateVal instanceof Date) {
    return getLocalDateString(dateVal);
  }

  // If Excel serial
  if (typeof dateVal === 'number') {
    return getLocalDateString(excelSerialToDate(dateVal));
  }
  
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return getLocalDateString();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    
    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1]);
      const m = parseInt(dmyMatch[2]);
      const y = parseInt(dmyMatch[3]);
      // Simple heuristic: if m > 12, it's likely DD/MM/YYYY. If d > 12, it's MM/DD/YYYY.
      // But DMY is more common globally. We'll try to validate.
      if (m > 12 && d <= 12) {
        // Must be MDY
        return `${y}-${d.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}`;
      }
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    
    return trimmed; 
  }
  
  return getLocalDateString();
};

const excelSerialToDate = (serial: number) => {
  // Excel base date is Dec 30, 1899
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info;
};

type View = 'dashboard' | 'add' | 'records' | 'analytics' | 'edit' | 'pharmacy' | 'billing' | 'patient-detail';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  trend: string;
  description: string;
  action: () => void;
  theme: 'light' | 'dark';
}

const StatCard = ({ icon: Icon, label, value, color, trend, description, action, theme }: StatCardProps) => {
  const colorMap: Record<string, { bg: string, text: string, darkBg: string, darkText: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', darkBg: 'bg-blue-900/20', darkText: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', darkBg: 'bg-emerald-900/20', darkText: 'text-emerald-400' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', darkBg: 'bg-amber-900/20', darkText: 'text-amber-400' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', darkBg: 'bg-indigo-900/20', darkText: 'text-indigo-400' },
  };
  const c = colorMap[color] || colorMap.blue;
  
  return (
    <button 
      onClick={action}
      className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 shadow-blue-900/5' : 'bg-white border-slate-200 hover:bg-slate-50'} p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all text-left group active:scale-[0.98] flex flex-col justify-between h-full min-h-[140px]`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2.5 rounded-xl ${theme === 'dark' ? c.darkBg : c.bg}`}>
          <Icon size={22} className={`${theme === 'dark' ? c.darkText : c.text} transition-transform group-hover:scale-110`} />
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}>
            {trend}
          </span>
        </div>
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} mb-1 group-hover:text-blue-500 transition-colors`}>{label}</p>
        <h3 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
        <p className={`text-[9px] font-bold ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'} mt-1 truncate`}>{description}</p>
      </div>
    </button>
  );
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatTimestamp = (timestamp: unknown): string => {
  if (!timestamp) return 'Just now';
  if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleString();
  if (timestamp instanceof Date) return timestamp.toLocaleString();
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate().toLocaleString();
  }
  const val = timestamp as string | number;
  return new Date(val).toLocaleString();
};

const formatTimestampDate = (timestamp: unknown): string => {
  if (!timestamp) return 'Today';
  if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleDateString();
  if (timestamp instanceof Date) return timestamp.toLocaleDateString();
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  const val = timestamp as string | number;
  return new Date(val).toLocaleDateString();
};

const SidebarItem = ({ icon: Icon, label, id, currentView, setView, isMobile, setIsSidebarOpen }: { 
  icon: React.ElementType, 
  label: string, 
  id: View, 
  currentView: View, 
  setView: (v: View) => void,
  isMobile: boolean,
  setIsSidebarOpen: (b: boolean) => void
}) => (
  <button
    onClick={() => {
      setView(id);
      if (isMobile) setIsSidebarOpen(false);
    }}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      currentView === id
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400'
    }`}
  >
    <Icon size={20} className={currentView === id ? 'text-white' : 'group-hover:text-blue-500'} />
    <span className="text-sm font-bold tracking-tight">{label}</span>
  </button>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [today, setToday] = useState(getLocalDateString());
  const [submitting, setSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterClinic, setFilterClinic] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [dbConnected, setDbConnected] = useState<'checking' | 'connected' | 'error'>('checking');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  const [toasts, setToasts] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' }[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Form State
  const [formData, setFormData] = useState({
    patient_name: '',
    clinic_name: '',
    age: '',
    gender: 'Male',
    phone_number: '',
    email: '',
    priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Urgent',
    doctor_specialty: '',
    reason_for_visit: '',
    visit_type: 'OPD',
    appointment_date: today,
    consultation_fee: '',
    notes: '',
    status: 'Pending' as 'Pending' | 'Completed' | 'Cancelled'
  });

  // Effects
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    const interval = setInterval(() => {
      const current = getLocalDateString();
      if (current !== today) {
        setToday(current);
        if (!editingPatient) {
          setFormData(prev => ({ ...prev, appointment_date: current }));
        }
      }
    }, 30000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [today, editingPatient]);

  const clinics = useMemo(() => {
    const set = new Set<string>();
    patients.forEach(p => {
      if (p.clinic_name) set.add(p.clinic_name);
    });
    return Array.from(set).sort();
  }, [patients]);

  useEffect(() => {
    void (async () => {
      const isConnected = await testConnection();
      setDbConnected(isConnected ? 'connected' : 'error');
    })();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Patients Listener
    const qPatients = query(
      collection(db, 'patients'),
      where('ownerId', '==', user.uid),
      orderBy('appointment_date', 'desc')
    );
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
    });

    // Prescriptions Listener
    const qPrescriptions = query(
      collection(db, 'prescriptions'),
      where('ownerId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubscribePrescriptions = onSnapshot(qPrescriptions, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Prescription[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'prescriptions');
    });

    // Invoices Listener
    const qInvoices = query(
      collection(db, 'invoices'),
      where('ownerId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubscribeInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });

    return () => {
      unsubscribePatients();
      unsubscribePrescriptions();
      unsubscribeInvoices();
    };
  }, [user]);

  // Memoized stats calculation for performance
  const statsMemo = useMemo(() => {
    try {
      const relevantPatients = filterClinic 
        ? patients.filter(p => p.clinic_name === filterClinic)
        : patients;

      if (relevantPatients.length === 0) return null;
    
    const activeToday = today;
    const dayPatients = relevantPatients.filter(p => (p.appointment_date || '').trim() === activeToday);
    const completed = relevantPatients.filter(p => p.status === 'Completed');
    const completedTodayCount = completed.filter(p => p.appointment_date === activeToday).length;
    const revenueTodayValue = completed.filter(p => p.appointment_date === activeToday).reduce((sum, p) => sum + (p.consultation_fee || 0), 0);
    const totalRevenueValue = completed.reduce((sum, p) => sum + (p.consultation_fee || 0), 0);
    const appointmentsCountValue = relevantPatients.length;
    const avgConsultationFeeValue = appointmentsCountValue > 0 
      ? Math.round(relevantPatients.reduce((sum, p) => sum + (p.consultation_fee || 0), 0) / appointmentsCountValue)
      : 0;

    const revenueBySpecialtyData = Object.entries(
      completed.reduce((acc: Record<string, number>, p) => {
        const specialty = p.doctor_specialty || 'General';
        acc[specialty] = (acc[specialty] || 0) + (p.consultation_fee || 0);
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    const focusDate = parseDateString(activeToday);
    const startDate = new Date(focusDate.getTime() - (10 * 24 * 60 * 60 * 1000));
    const endDate = new Date(focusDate.getTime() + (3 * 24 * 60 * 60 * 1000));

    const dailyStatsData: DailyStats[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = getLocalDateString(current);
      const dayData = relevantPatients.filter(p => p.appointment_date === dateStr);
      const dayRev = dayData
        .filter(p => p.status === 'Completed')
        .reduce((sum, p) => sum + (p.consultation_fee || 0), 0);
      
      dailyStatsData.push({
        date: dateStr.split('-').slice(1).join('/'),
        patients: dayData.length,
        revenue: dayRev
      });
      current.setDate(current.getDate() + 1);
    }

      return {
        patientsToday: dayPatients.length,
        completedToday: completedTodayCount,
        revenueToday: revenueTodayValue,
        totalRevenue: totalRevenueValue,
        appointmentsCount: appointmentsCountValue,
        avgConsultationFee: avgConsultationFeeValue,
        revenueBySpecialty: revenueBySpecialtyData,
        dailyStats: dailyStatsData
      };
    } catch (e) {
      console.error("Stats calculation error:", e);
      return null;
    }
  }, [patients, today, filterClinic]);

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const data = {
        patient_name: formData.patient_name || '',
        clinic_name: formData.clinic_name || 'Main Clinic',
        age: parseInt(formData.age) || 0,
        gender: formData.gender || 'Male',
        phone_number: formData.phone_number || '',
        email: formData.email || '',
        priority: formData.priority || 'Normal',
        doctor_specialty: formData.doctor_specialty || '',
        reason_for_visit: formData.reason_for_visit || '',
        visit_type: formData.visit_type || 'OPD',
        appointment_date: formData.appointment_date || getLocalDateString(),
        consultation_fee: parseFloat(formData.consultation_fee) || 0,
        notes: formData.notes || '',
        status: formData.status || 'Pending',
        ownerId: user.uid,
        updated_at: serverTimestamp()
      };

      // Optimistic UI behavior: Switch view and reset form immediately if not editing
      // or at least clear form early to feel fast.
      const isNew = !editingPatient?.id;
      
      const patientId = editingPatient?.id;
      const firestoreAction = (isNew || !patientId)
        ? addDoc(collection(db, 'patients'), { ...data, created_at: serverTimestamp() })
        : updateDoc(doc(db, 'patients', patientId), data);

      // We still want to handle errors, so we don't await BEFORE clearing if we want ultimate speed
      // But for total responsiveness, we'll wait just for the promise start
      
      setFormData({
        patient_name: '', clinic_name: '', age: '', gender: 'Male', phone_number: '',
        email: '', priority: 'Normal',
        doctor_specialty: '', reason_for_visit: '', visit_type: 'OPD',
        appointment_date: getLocalDateString(),
        consultation_fee: '', notes: '', status: 'Pending'
      });
      setEditingPatient(null);
      setView('records');
      
      await firestoreAction;
      addToast(isNew ? 'New patient added' : 'Record updated', 'success');
    } catch (err) {
      console.error('Error saving patient:', err);
      addToast('An unexpected error occurred', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePrescription = async (pData: Omit<Prescription, 'ownerId' | 'date'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'prescriptions'), {
        ...pData,
        ownerId: user.uid,
        date: serverTimestamp()
      });
      addToast('Prescription recorded', 'success');
      setView('pharmacy');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'prescriptions');
      addToast('Failed to record prescription', 'error');
    }
  };

  const handleSaveInvoice = async (iData: Omit<Invoice, 'ownerId' | 'date'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'invoices'), {
        ...iData,
        ownerId: user.uid,
        date: serverTimestamp()
      });
      addToast('Invoice generated', 'success');
      setView('billing');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'invoices');
      addToast('Failed to generate invoice', 'error');
    }
  };

  const handleEdit = (p: Patient) => {
    setEditingPatient(p);
    setFormData({
      patient_name: p.patient_name ?? '',
      clinic_name: p.clinic_name ?? '',
      age: p.age?.toString() ?? '',
      gender: p.gender ?? 'Male',
      phone_number: p.phone_number ?? '',
      email: p.email ?? '',
      priority: p.priority ?? 'Normal',
      doctor_specialty: p.doctor_specialty ?? '',
      reason_for_visit: p.reason_for_visit ?? '',
      visit_type: p.visit_type ?? 'OPD',
      appointment_date: p.appointment_date ?? getLocalDateString(),
      consultation_fee: p.consultation_fee?.toString() ?? '',
      notes: p.notes ?? '',
      status: p.status ?? 'Pending'
    });
    setView('edit');
  };

  const updateStatus = async (id: string, status: 'Pending' | 'Completed' | 'Cancelled') => {
    try {
      await updateDoc(doc(db, 'patients', id), { 
        status,
        updated_at: serverTimestamp()
      });
      addToast(`Status updated to ${status}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${id}`);
      addToast('Failed to update status', 'error');
    }
  };

  const deletePatient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'patients', id));
      addToast('Record deleted forever', 'info');
      // If we were viewing this patient's details, go back
      if (selectedPatient?.id === id) {
        setSelectedPatient(null);
        setView('dashboard');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `patients/${id}`);
      addToast('Deletion failed', 'error');
    }
  };

  const deletePrescription = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'prescriptions', id));
      addToast('Prescription removed', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `prescriptions/${id}`);
      addToast('Failed to delete prescription', 'error');
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
      addToast('Invoice removed', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invoices/${id}`);
      addToast('Failed to delete invoice', 'error');
    }
  };

  const clearAllData = async () => {
    if (!user) return;
    try {
      setIsDeleting(true);
      
      const allDeletions: { path: string, id: string }[] = [];
      patients.forEach(p => p.id && allDeletions.push({ path: 'patients', id: p.id }));
      prescriptions.forEach(p => p.id && allDeletions.push({ path: 'prescriptions', id: p.id }));
      invoices.forEach(i => i.id && allDeletions.push({ path: 'invoices', id: i.id }));

      const BATCH_LIMIT = 500;
      for (let i = 0; i < allDeletions.length; i += BATCH_LIMIT) {
        const chunk = allDeletions.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.delete(doc(db, item.path, item.id));
        });
        await batch.commit();
      }

      setSelectedPatient(null);
      setView('dashboard');
      addToast('Clinic data reset successfully', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clinic/reset-all');
      addToast('Failed to reset clinic data', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAiReport = async () => {
    if (!statsMemo || patients.length === 0) return;
    setGeneratingReport(true);
    try {
      const report = await generateClinicReport(statsMemo, patients, today);
      setAiReport(report ?? 'No report generated');
      addToast('AI Report generated', 'success');
    } catch {
      addToast('AI Analysis failed', 'error');
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        patient_name: 'John Doe',
        clinic_name: 'City Central Clinic',
        age: 45,
        gender: 'Male',
        phone_number: '1234567890',
        email: 'john@example.com',
        priority: 'Normal',
        doctor_specialty: 'Cardiology',
        reason_for_visit: 'Regular checkup',
        visit_type: 'OPD',
        appointment_date: getLocalDateString(),
        consultation_fee: 500,
        notes: 'Has mild hypertension'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'clinic_import_template.xlsx');
    addToast('Template downloaded! Use this format for 1000+ records.', 'info');
  };
  const handleBulkCompletePayments = async () => {
    const pendingPatients = filteredPatients.filter(p => p.status === 'Pending');
    if (pendingPatients.length === 0) {
      addToast('No pending payments to collect', 'info');
      return;
    }

    if (!window.confirm(`Mark all ${pendingPatients.length} pending payments as completed?`)) return;

    try {
      setSubmitting(true);
      const BATCH_LIMIT = 500;
      for (let i = 0; i < pendingPatients.length; i += BATCH_LIMIT) {
        const chunk = pendingPatients.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach(p => {
          if (p.id) {
            batch.update(doc(db, 'patients', p.id), { 
              status: 'Completed',
              updated_at: serverTimestamp()
            });
          }
        });
        await batch.commit();
      }
      addToast(`Successfully completed ${pendingPatients.length} payments`, 'success');
    } catch (err) {
      console.error('Bulk completion error:', err);
      addToast('Failed to process bulk payments', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkVoidRecords = async () => {
    const activeRecords = filteredPatients.filter(p => p.status !== 'Cancelled');
    if (activeRecords.length === 0) {
      addToast('No active records to void', 'info');
      return;
    }

    if (!window.confirm(`Void all ${activeRecords.length} currently filtered active records? This will cancel all sessions.`)) return;

    try {
      setSubmitting(true);
      const BATCH_LIMIT = 500;
      for (let i = 0; i < activeRecords.length; i += BATCH_LIMIT) {
        const chunk = activeRecords.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach(p => {
          if (p.id) {
            batch.update(doc(db, 'patients', p.id), { 
              status: 'Cancelled',
              updated_at: serverTimestamp()
            });
          }
        });
        await batch.commit();
      }
      addToast(`Successfully voided ${activeRecords.length} records`, 'success');
    } catch (err) {
      console.error('Bulk void error:', err);
      addToast('Failed to void records', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setSubmitting(true);
        const dataBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          addToast('No records found in file', 'error');
          return;
        }

        // Chunk the data into batches of 500 (Firestore maximum)
        const CHUNK_SIZE = 500;
        const totalRecords = data.length;
        let importedCount = 0;

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE) as Record<string, unknown>[];
          const batch = writeBatch(db);

          for (const row of chunk) {
            const newDocRef = doc(collection(db, 'patients'));
            const importDate = robustParseDate(row.appointment_date ?? row.Date);

            // Safer number parsing
            const ageVal = row.age !== undefined ? Number(row.age) : (row.Age !== undefined ? Number(row.Age) : 30);
            const feeVal = row.consultation_fee !== undefined ? Number(row.consultation_fee) : (row.Fee !== undefined ? Number(row.Fee) : 0);

            // Valid enums according to rules
            const priorities = ['Low', 'Normal', 'High', 'Urgent'];
            const visitTypes = ['OPD', 'Emergency', 'Follow-up', 'Surgery'];
            const genders = ['Male', 'Female', 'Other'];

            const getString = (val: unknown, fallback: string): string => {
              if (typeof val === 'string') return val;
              if (typeof val === 'number') return String(val);
              return fallback;
            };

            const rawPriority = getString(row.priority ?? row.Priority, 'Normal').trim();
            const priorityVal = priorities.find(p => p.toLowerCase() === rawPriority.toLowerCase()) ?? 'Normal';

            const rawVisitType = getString(row.visit_type ?? row.Type, 'OPD').trim();
            const visitTypeVal = visitTypes.find(v => v.toLowerCase() === rawVisitType.toLowerCase()) ?? 'OPD';

            const rawGender = getString(row.gender ?? row.Gender, 'Male').trim();
            const genderVal = genders.find(g => g.toLowerCase() === rawGender.toLowerCase()) ?? 'Male';

            batch.set(newDocRef, {
              patient_name: getString(row.patient_name ?? row.Name, 'Imported Patient').trim().substring(0, 200),
              clinic_name: getString(row.clinic_name ?? row.Clinic ?? row.Organization, 'Main Clinic').trim().substring(0, 200),
              age: isNaN(ageVal) ? 30 : Math.min(150, Math.max(0, ageVal)),
              gender: genderVal,
              phone_number: getString(row.phone_number ?? row.Phone, '').trim().substring(0, 20),
              email: getString(row.email ?? row.Email, '').trim().substring(0, 200),
              priority: priorityVal,
              doctor_specialty: getString(row.doctor_specialty ?? row.Specialty, 'General').trim().substring(0, 100),
              reason_for_visit: getString(row.reason_for_visit ?? row.Reason, 'Imported').trim().substring(0, 1000),
              visit_type: visitTypeVal,
              appointment_date: importDate.substring(0, 20),
              consultation_fee: isNaN(feeVal) ? 0 : Math.max(0, feeVal),
              notes: getString(row.notes ?? row.Notes, '').trim().substring(0, 5000),
              status: 'Pending',
              ownerId: user.uid,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });
          }

          try {
            await batch.commit();
            importedCount += chunk.length;
            if (totalRecords > CHUNK_SIZE) {
              addToast(`Importing... ${importedCount}/${totalRecords}`, 'info');
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `patients/batch-import-chunk-${i}`);
            throw new Error(`Failed to commit batch starting at index ${i}`, { cause: error });
          }
        }
        
        addToast(`Successfully imported ${totalRecords} records!`, 'success');
      } catch (error) {
        console.error('Import failed:', error);
        addToast('Import failed. Please check file format.', 'error');
      } finally {
        setSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportToExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(patients);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Patients");
      XLSX.writeFile(wb, `Clinic_Records_${getLocalDateString()}.xlsx`);
      addToast('Data exported successfully', 'success');
    } catch {
      addToast('Export failed', 'error');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleCount(50);
    }, 0);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const s = search.toLowerCase();
      
      const matchesPatient = (p.patient_name?.toLowerCase().includes(s) ?? false) || 
                           (p.phone_number?.includes(search) ?? false) ||
                           (p.email?.toLowerCase().includes(s) ?? false) ||
                           (p.clinic_name?.toLowerCase().includes(s) ?? false) ||
                           (p.reason_for_visit?.toLowerCase().includes(s) ?? false) ||
                           (p.doctor_specialty?.toLowerCase().includes(s) ?? false) ||
                           (p.notes?.toLowerCase().includes(s) ?? false);
      
      const matchesPrescriptions = prescriptions.some(pr => 
        pr.patientId === p.id && (
          pr.medicines.some(m => m.name.toLowerCase().includes(s)) ||
          pr.instructions.toLowerCase().includes(s)
        )
      );

      const matchesInvoices = invoices.some(inv => 
        inv.patientId === p.id && (
          inv.items.some(item => item.description.toLowerCase().includes(s)) ||
          inv.status.toLowerCase().includes(s)
        )
      );

      const matchesSearch = matchesPatient || matchesPrescriptions || matchesInvoices;
      const matchesSpecialty = !filterSpecialty || p.doctor_specialty === filterSpecialty;
      const matchesClinic = !filterClinic || p.clinic_name === filterClinic;
      const matchesDate = !filterDate || p.appointment_date === filterDate;
      
      return matchesSearch && matchesSpecialty && matchesClinic && matchesDate;
    });
  }, [patients, search, filterSpecialty, filterClinic, filterDate, prescriptions, invoices]);

  const filteredPrescriptions = useMemo(() => {
    const s = search.toLowerCase();
    return prescriptions.filter(p => {
      return p.patientName.toLowerCase().includes(s) || 
             p.medicines.some(m => m.name.toLowerCase().includes(s)) ||
             p.instructions.toLowerCase().includes(s);
    });
  }, [prescriptions, search]);

  const filteredInvoices = useMemo(() => {
    const s = search.toLowerCase();
    return invoices.filter(i => {
      return (i.patientName?.toLowerCase().includes(s) ?? false) || 
             i.items.some(item => item.description.toLowerCase().includes(s)) ||
             (i.status?.toLowerCase().includes(s) ?? false) ||
             i.totalAmount.toString().includes(search);
    });
  }, [invoices, search]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      console.error('Login error:', err);
      const error = err as { code?: string, message?: string };
      if (error?.code === 'auth/configuration-not-found') {
        addToast('Firebase Auth error: Configuration not found. Please check API Key and Authorized Domains.', 'error');
      } else {
        addToast(error?.message ?? 'Login failed', 'error');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="text-blue-500 animate-spin" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <Stethoscope size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">ClinicFlow</h1>
          <p className="text-slate-500 mb-8 text-sm">Professional dashboard for your clinic. Securely manage appointments and analytics.</p>
          <button 
            onClick={() => void handleLogin()}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          <p className="mt-6 text-[10px] text-slate-400 uppercase tracking-widest font-bold">Secure Cloud Identity</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex font-sans relative transition-colors duration-300`}>
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-xl flex items-center gap-3 min-w-[280px] border ${
                toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
                toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
                'bg-blue-600 border-blue-500 text-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle size={20} /> : 
               toast.type === 'error' ? <XCircle size={20} /> : <Info size={20} />}
              <p className="text-sm font-bold tracking-tight">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto p-1 hover:bg-white/20 rounded"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
          bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300 flex flex-col
          ${isSidebarOpen ? 'w-64 translate-x-0' : (isMobile ? '-translate-x-full' : 'w-20 translate-x-0')}
        `}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white font-bold shrink-0">
              <Stethoscope size={20} />
            </div>
            {(isSidebarOpen || isMobile) && <span className="text-xl font-semibold text-white tracking-tight truncate">CareDash</span>}
          </div>
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="px-4 mb-4">
          {(isSidebarOpen || isMobile) && (
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Find Record..."
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  // Context-aware search: stay in specific views if already there
                  if (val && !['records', 'pharmacy', 'billing', 'patient-detail'].includes(view)) {
                    setView('records');
                  }
                }}
                className={`w-full text-[10px] font-bold py-2 pl-9 pr-8 rounded-lg bg-slate-800 border border-slate-700 text-white outline-none focus:ring-1 focus:ring-blue-500/50 transition-all ${!isSidebarOpen && !isMobile ? 'hidden' : ''}`}
              />
              {search && (isSidebarOpen || isMobile) && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <SidebarItem icon={BarChart3} label="Dashboard" id="dashboard" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
          <SidebarItem icon={PlusCircle} label="Add Patient" id="add" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
          <SidebarItem icon={ClipboardList} label="Records" id="records" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
          <SidebarItem icon={Pill} label="Pharmacy" id="pharmacy" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
          <SidebarItem icon={CreditCard} label="Finances" id="billing" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
          <SidebarItem icon={LineChart} label="Analytics" id="analytics" currentView={view} setView={setView} isMobile={isMobile} setIsSidebarOpen={setIsSidebarOpen} />
        </nav>

        <div className="p-4 space-y-3 mt-auto">
          <button 
            onClick={() => void logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              {dbConnected === 'checking' ? (
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Connecting...</span>
                </div>
              ) : dbConnected === 'connected' ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Live & Secure</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Offline Mode</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {dbConnected === 'connected' 
                ? 'Using individual user database isolation.' 
                : 'Connection issue detected. Re-checking...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className={`h-16 lg:h-20 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-b px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 transition-colors`}>
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} rounded-lg transition-colors`}
            >
              <Menu size={20} />
            </button>
            <h2 className={`text-[10px] md:text-sm font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest truncate`}>{view}</h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => { void handleAiReport(); }}
                disabled={generatingReport}
                className="flex items-center gap-2 px-3 py-2 border border-blue-200 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                title="AI Final Report"
              >
                {generatingReport ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                <span className="hidden lg:inline">AI Final Report</span>
              </button>
              
              <button 
                id="clear-all-btn"
                onClick={() => { void clearAllData(); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-medium ${isDeleting ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'} shadow-sm active:scale-95 transition-all`}
                title="Clear All Records (Instant)"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span className="hidden lg:inline">{isDeleting ? 'Cleaning...' : 'Purge Data'}</span>
              </button>

              <button 
                onClick={downloadTemplate}
                className="hidden lg:flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                title="Download spreadsheet template"
              >
                <ClipboardList size={14} />
                <span>Template</span>
              </button>

              <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv,.xlsx,.xls" />
              <button 
                id="import-btn"
                onClick={() => fileInputRef.current?.click()}
                className="hidden md:flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
              >
                <Upload size={14} />
                <span className="hidden lg:inline">Import</span>
              </button>
              <button 
                id="export-btn"
                onClick={() => void exportToExcel()}
                className="hidden md:flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
              >
                <Download size={14} />
                <span className="hidden lg:inline">Export</span>
              </button>
            </div>

            <button 
              onClick={() => {
                setEditingPatient(null);
                setFormData({
                  patient_name: '', age: '', gender: 'Male', phone_number: '', 
                  email: '', priority: 'Normal',
                  doctor_specialty: '', reason_for_visit: '', visit_type: 'OPD', 
                  appointment_date: getLocalDateString(), consultation_fee: '', notes: '', status: 'Pending'
                });
                setView('add');
              }}
              className="bg-blue-600 text-white p-2 md:px-4 md:py-2 rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <PlusCircle size={16} />
              <span className="hidden sm:inline">New Appointment</span>
            </button>
            <div className="flex items-center gap-2 ml-2 md:ml-4 pl-2 md:pl-4 border-l border-slate-200 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[100px]">{user.displayName}</p>
              </div>
              {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-slate-200" alt="Profile" />}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-6">

        {aiReport && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-600 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles size={120} />
            </div>
            <button onClick={() => setAiReport(null)} className="absolute top-4 right-4 hover:bg-white/20 p-1 rounded">
              <X size={16} />
            </button>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles size={18} />
              AI Clinical Report
            </h3>
            <div className="markdown-body prose prose-slate prose-invert max-w-3xl">
              <Markdown>{aiReport}</Markdown>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Clinic Performance Dashboard
                  </h1>
                  <div className="flex items-center gap-3">
                    <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest mt-1`}>
                      Insight for {new Date(today).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700 mt-1" />
                    <select 
                      value={filterClinic}
                      onChange={(e) => setFilterClinic(e.target.value)}
                      className={`mt-1 bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      <option value="" className="text-slate-900">All Enterprise Locations</option>
                      {clinics.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm transition-all group hover:border-blue-500/50`}>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-blue-500 leading-none mb-1 tracking-tighter">Operating Context</span>
                    <input 
                      type="date" 
                      value={today}
                      onChange={(e) => setToday(e.target.value)}
                      className={`bg-transparent outline-none text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'} cursor-pointer uppercase`}
                      style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                    />
                  </div>
                  <Clock size={16} className="text-blue-500 animate-pulse" />
                </div>
              </div>

              {/* High Priority Alerts (New Feature) */}
              {patients.filter(p => (p.priority === 'Urgent' || p.priority === 'High') && p.status === 'Pending').length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'} flex items-center justify-between shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-red-600 rounded-xl text-white shadow-lg shadow-red-600/20">
                        <Info size={20} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-black tracking-tight ${theme === 'dark' ? 'text-red-400' : 'text-red-800'}`}>Priority Triage Alert</h4>
                        <p className={`text-[11px] font-bold ${theme === 'dark' ? 'text-red-300/60' : 'text-red-600/70'}`}>
                          {patients.filter(p => (p.priority === 'Urgent' || p.priority === 'High') && p.status === 'Pending').length} pending high-priority cases detected.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSearch('High');
                        setView('records');
                      }}
                      className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-red-900/40 text-red-100 hover:bg-red-900/60' : 'bg-white text-red-600 shadow-sm hover:shadow-md hover:bg-red-50'}`}
                    >
                      Audit
                    </button>
                  </motion.div>

                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-blue-900/10 border-blue-900/30' : 'bg-blue-50 border-blue-100'} flex items-center justify-between shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-black tracking-tight ${theme === 'dark' ? 'text-blue-400' : 'text-blue-800'}`}>Revenue Pipeline</h4>
                        <p className={`text-[11px] font-bold ${theme === 'dark' ? 'text-blue-300/60' : 'text-blue-600/70'}`}>
                          Expected collection for pending visits: ₹{(patients.filter(p => p.status === 'Pending' && p.appointment_date === today).reduce((sum, p) => sum + p.consultation_fee, 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className={`text-[9px] font-black tracking-widest px-4 py-2 bg-blue-600/10 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl uppercase`}>
                      Forecast
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Stats Grid */}
              <div id="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <StatCard 
                      icon={Users} 
                      label="Daily Volume" 
                      value={statsMemo?.patientsToday ?? 0} 
                      color="blue" 
                      trend="+12%" 
                      description="Appointments for this specific date"
                      theme={theme}
                      action={() => {
                        setFilterDate(today);
                        setView('records');
                      }}
                    />
                    <StatCard 
                      icon={CheckCircle} 
                      label="Service rate" 
                      value={statsMemo?.completedToday ?? 0} 
                      color="emerald" 
                      trend="Real-time" 
                      description="Successfully processed today"
                      theme={theme}
                      action={() => setView('analytics')}
                    />
                    <StatCard 
                      icon={BarChart3} 
                      label="Daily Liquid" 
                      value={formatCurrency(statsMemo?.revenueToday ?? 0)} 
                      color="amber" 
                      trend="Verified" 
                      description="Revenue from completed visits"
                      theme={theme}
                      action={() => setView('analytics')}
                    />
                    <StatCard 
                      icon={TrendingUp} 
                      label="Gross Revenue" 
                      value={(statsMemo?.totalRevenue ?? 0) >= 1000000 
                        ? `₹${((statsMemo?.totalRevenue ?? 0) / 1000000).toFixed(2)}M` 
                        : formatCurrency(statsMemo?.totalRevenue ?? 0)} 
                      color="indigo" 
                      trend="Total" 
                      description="Lifetime clinic earnings"
                      theme={theme}
                      action={() => setView('analytics')}
                    />
              </div>

              {/* Unified Intelligence View */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Appointment Stream */}
                <div className={`lg:col-span-2 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-blue-900/5' : 'bg-white border-slate-200 shadow-slate-200/50'} shadow-sm overflow-hidden flex flex-col transition-colors`}>
                  <div className={`px-6 py-5 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-50'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
                        <ClipboardList size={16} />
                      </div>
                      <h3 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                        Recent Clinical Log
                      </h3>
                    </div>
                    <button 
                      onClick={() => setView('records')} 
                      className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} flex items-center gap-1 transition-colors`}
                    >
                      Full Ledger <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className={`${theme === 'dark' ? 'bg-slate-800/30 text-slate-500' : 'bg-slate-50/50 text-slate-400'} text-[10px] font-bold uppercase tracking-wider`}>
                        <tr>
                          <th className="px-6 py-4">Patient Identity</th>
                          <th className="px-6 py-4">Medical Unit</th>
                          <th className="px-6 py-4">Appointment</th>
                          <th className="px-6 py-4">Clinical State</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'} text-sm`}>
                        {patients
                          .sort((a, b) => {
                            if (a.appointment_date === today && b.appointment_date !== today) return -1;
                            if (a.appointment_date !== today && b.appointment_date === today) return 1;
                            return b.appointment_date.localeCompare(a.appointment_date);
                          })
                          .slice(0, 8)
                          .map((p) => (
                          <tr key={p.id} className={`${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'} transition-all group border-b border-slate-100 dark:border-slate-800`}>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => { setSelectedPatient(p); setView('patient-detail'); }}>
                              <div className="flex flex-col">
                                <span className={`font-black tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'} group-hover:text-blue-500 transition-colors`}>{p.patient_name}</span>
                                <span className="text-[10px] font-bold text-slate-500">{p.age}y • {p.gender}</span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} font-medium`}>{p.doctor_specialty}</td>
                            <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'} text-xs font-mono`}>
                              {p.appointment_date === today ? (
                                <span className="text-blue-600 font-black bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded text-[9px] uppercase tracking-tighter">Today</span>
                              ) : p.appointment_date}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                p.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); void handleEdit(p); }}
                                  className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); void deletePatient(p.id ?? ''); }}
                                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <ChevronRight size={16} className="text-slate-300 self-center" />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {patients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-16 text-center text-slate-400 italic">
                               <div className="flex flex-col items-center gap-3 opacity-30">
                                <ClipboardList size={32} />
                                <span className="text-sm font-black uppercase tracking-widest">Workspace is empty</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Insights Card */}
                <div className={`rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm overflow-hidden flex flex-col`}>
                  <div className={`p-5 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-50'} flex items-center justify-between`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} flex items-center gap-2`}>
                      <Sparkles className="text-blue-500" size={14} />
                      Clinic IQ Analysis
                    </h3>
                    {!aiReport && (
                      <button 
                        onClick={() => void handleAiReport()}
                        disabled={generatingReport}
                        className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'} hover:scale-105 transition-all disabled:opacity-50`}
                      >
                        {generatingReport ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      </button>
                    )}
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                    {generatingReport ? (
                      <div className="space-y-4 animate-pulse">
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                      </div>
                    ) : aiReport ? (
                      <div className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} font-medium italic`}>
                        <div className="markdown-body">
                          <Markdown>{aiReport}</Markdown>
                        </div>
                        <button 
                          onClick={() => setAiReport(null)}
                          className="block mt-6 text-[10px] font-black uppercase text-blue-500 hover:tracking-widest transition-all mb-4"
                        >
                          Refresh analysis
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-blue-50'} text-blue-500 mb-4 shadow-inner`}>
                          <Sparkles size={28} />
                        </div>
                        <p className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'} mb-2`}>Neuro-Clinical Engine</p>
                        <p className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-700' : 'text-slate-300'} px-4`}>
                          Initialize the AI core to generate actionable clinical performance benchmarks.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(view === 'add' || view === 'edit') && (
            <motion.div 
              key={view}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto"
            >
              <div className={`rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-xl p-6 md:p-10 transition-colors`}>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'} mb-8 flex items-center gap-3`}>
                  {view === 'add' ? <PlusCircle className="text-blue-500" size={24} /> : <Edit2 className="text-blue-500" size={24} />}
                  {view === 'add' ? 'Advanced Patient Registration' : `Full Record Audit: ${editingPatient?.patient_name}`}
                </h2>
                
                <form onSubmit={(e) => void handleSavePatient(e)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Patient Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.patient_name || ''}
                      onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
                      className={`w-full text-base font-medium rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border shadow-sm`}
                      placeholder="e.g. Johnathan Quincy"
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Organization / Clinic Name</label>
                    <input 
                      type="text" 
                      list="clinic-list"
                      value={formData.clinic_name || ''}
                      onChange={(e) => setFormData({...formData, clinic_name: e.target.value})}
                      className={`w-full text-base font-bold rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border shadow-sm`}
                      placeholder="e.g. City Central Clinic"
                    />
                    <datalist id="clinic-list">
                      {clinics.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Clinical Priority</label>
                    <select 
                      value={formData.priority || 'Normal'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                      className={`w-full text-base font-bold rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border shadow-sm appearance-none cursor-pointer`}
                    >
                      <option className="text-slate-400">Low</option>
                      <option className="text-slate-900 font-bold">Normal</option>
                      <option className="text-orange-600 font-bold">High</option>
                      <option className="text-red-600 font-bold">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Phone Link</label>
                    <input 
                      required
                      type="tel" 
                      value={formData.phone_number || ''}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border`}
                      placeholder="+91-000-000-0000"
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Secure Email</label>
                    <input 
                      type="email" 
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border`}
                      placeholder="patient@medical.link"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Age</label>
                      <input 
                        required
                        type="number" 
                        value={formData.age || ''}
                        onChange={(e) => setFormData({...formData, age: e.target.value})}
                        className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border focus:ring-2 focus:ring-blue-500/20`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Gender</label>
                      <select 
                        value={formData.gender || 'Male'}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border`}
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-1">
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Doctor Specialty</label>
                    <input 
                      required
                      type="text" 
                      value={formData.doctor_specialty || ''}
                      onChange={(e) => setFormData({...formData, doctor_specialty: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border`}
                      placeholder="e.g. Cardiology"
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Appointment Date</label>
                    <input 
                      required
                      type="date" 
                      value={formData.appointment_date || ''}
                      onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Consultation Fee (₹)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.consultation_fee || ''}
                      onChange={(e) => setFormData({...formData, consultation_fee: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border`}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Visit Type</label>
                      <div className="flex gap-2">
                        {['OPD', 'Emergency', 'Follow-up', 'Surgery'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({...formData, visit_type: type})}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${
                              formData.visit_type === type 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                : `${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    {view === 'edit' && (
                    <div>
                        <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Status Control</label>
                        <div className="flex gap-2">
                          {['Pending', 'Completed', 'Cancelled'].map(status => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setFormData({...formData, status: status as PatientStatus})}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${
                                formData.status === status 
                                  ? (status === 'Completed' ? 'bg-emerald-600 border-emerald-600 text-white' : status === 'Cancelled' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-600 border-amber-600 text-white')
                                  : `${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Reason for Visit</label>
                    <input 
                      required
                      type="text" 
                      value={formData.reason_for_visit || ''}
                      onChange={(e) => setFormData({...formData, reason_for_visit: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border focus:ring-2 focus:ring-blue-500/20`}
                      placeholder="Symptoms or primary concern"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} block mb-2 tracking-widest`}>Advanced Clinical Notes</label>
                    <textarea 
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className={`w-full text-sm rounded-xl px-4 py-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} outline-none border h-32 resize-none shadow-inner`}
                      placeholder="Document detailed medical history, allergies, medications, or post-visit recommendations here..."
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end gap-3 pt-8 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setView('dashboard')}
                      className={`px-8 py-3 rounded-xl text-sm font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'} transition-all`}
                    >
                      Dismiss
                    </button>
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="bg-blue-600 text-white px-10 py-3 rounded-xl text-sm font-black hover:bg-blue-700 hover:scale-[1.02] transition-all shadow-xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 flex items-center gap-3 relative overflow-hidden"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>{view === 'add' ? 'Confirm Record' : 'Apply Changes'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'records' && (
            <motion.div 
              key="records"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  Clinic Ledger
                  {patients.length > 500 && (
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-widest animate-pulse shadow-lg shadow-blue-500/20">
                      High capacity mode
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Unlimited Enterprise Storage: {patients.length} records Active</p>
                </div>
              </div>
              {/* Toolbar */}
              <div className="bg-white dark:bg-slate-900 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-3 md:gap-4 items-stretch lg:items-center justify-between transition-colors">
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Smart Search: Type anything (medicines, invoices, or symptoms)..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 text-xs md:text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all shadow-inner font-medium placeholder:text-slate-400"
                    />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <select 
                      value={filterClinic}
                      onChange={(e) => {
                        setFilterClinic(e.target.value);
                        setVisibleCount(100);
                      }}
                      className="pl-9 pr-8 py-2.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 text-xs md:text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 appearance-none bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium truncate transition-all shadow-inner"
                    >
                      <option value="">All Organizations</option>
                      {clinics.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <select 
                      value={filterSpecialty}
                      onChange={(e) => {
                        setFilterSpecialty(e.target.value);
                        setVisibleCount(100);
                      }}
                      className="pl-9 pr-8 py-2.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 text-xs md:text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 appearance-none bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium truncate transition-all shadow-inner"
                    >
                      <option value="">All Specialties</option>
                      {Array.from(new Set(patients.map(p => p.doctor_specialty))).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <input 
                    type="date"
                    value={filterDate}
                    onChange={(e) => {
                      setFilterDate(e.target.value);
                      setVisibleCount(50);
                    }}
                    className="px-3 py-2 flex-1 min-w-0 rounded-lg border border-slate-200 text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 font-medium"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Upload size={14} />
                    <span>Import</span>
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Download size={14} />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Smart Search Banner */}
              {search && (filteredPrescriptions.length > 0 || filteredInvoices.length > 0) && (
                <div className="flex flex-wrap gap-3 items-center p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Sparkles size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Global Insights</span>
                  </div>
                  <div className="h-4 w-[1px] bg-blue-200 dark:bg-blue-800" />
                  <div className="flex flex-wrap gap-2">
                    {filteredPrescriptions.length > 0 && (
                      <button 
                        onClick={() => setView('pharmacy')}
                        className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        <Pill size={12} />
                        {filteredPrescriptions.length} matched prescriptions
                      </button>
                    )}
                    {filteredInvoices.length > 0 && (
                      <button 
                        onClick={() => setView('billing')}
                        className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        <CreditCard size={12} />
                        {filteredInvoices.length} matched invoices
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className={`rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} overflow-hidden shadow-xl transition-colors`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className={`${theme === 'dark' ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-50 text-slate-500'} text-[10px] font-black uppercase tracking-widest border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                      <tr>
                        <th className="px-6 py-5">Identified Patient</th>
                        <th className="px-6 py-5">Clinic / Org</th>
                        <th className="px-6 py-5">Contact Details</th>
                        <th className="px-6 py-5">Visit Context</th>
                        <th className="px-6 py-5">Clinical Status</th>
                        <th className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-3 translate-x-1">
                            <span className="hidden sm:inline">Bulk</span>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-200 dark:border-slate-600 shadow-inner scale-90 origin-right">
                              <button 
                                onClick={() => void handleBulkCompletePayments()}
                                disabled={submitting || filteredPatients.filter(p => p.status === 'Pending').length === 0}
                                className={`p-1.5 rounded-md transition-all ${submitting || filteredPatients.filter(p => p.status === 'Pending').length === 0 ? 'opacity-20' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                                title="Mark all Pending as Completed"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button 
                                onClick={() => void handleBulkVoidRecords()}
                                disabled={submitting || filteredPatients.filter(p => p.status !== 'Cancelled').length === 0}
                                className={`p-1.5 rounded-md transition-all ${submitting || filteredPatients.filter(p => p.status !== 'Cancelled').length === 0 ? 'opacity-20' : 'text-red-500 hover:bg-red-500/10'}`}
                                title="Mark all as Cancelled"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'} text-sm`}>
                      {filteredPatients.slice(0, visibleCount).map((p) => (
                        <tr key={p.id} className={`${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'} transition-all group`}>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span 
                                onClick={() => { setSelectedPatient(p); setView('patient-detail'); }}
                                className={`font-black tracking-tight cursor-pointer hover:text-blue-500 transition-colors ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}
                              >
                                {p.patient_name}
                              </span>
                              <span className={`text-[11px] font-bold ${search && (p.age.toString().includes(search) || p.gender.toLowerCase().includes(search.toLowerCase())) ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 rounded' : theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {p.age}y • {p.gender}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                <Activity size={12} />
                              </div>
                              <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                {p.clinic_name ?? 'Main Clinic'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <span className={`text-[11px] font-black ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{p.phone_number}</span>
                              <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>{p.email || 'NO_SECURE_MAIL'}</span>
                              <div className="mt-1 flex gap-1">
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${
                                  p.priority === 'Urgent' ? 'bg-red-500 text-white' :
                                  p.priority === 'High' ? 'bg-orange-500 text-white' :
                                  'bg-slate-500 text-white opacity-40'
                                }`}>
                                  {p.priority || 'NORMAL'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className={`font-bold text-[11px] ${search && p.doctor_specialty.toLowerCase().includes(search.toLowerCase()) ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 rounded' : theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                {p.doctor_specialty}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{p.visit_type}</span>
                                <span className={`text-[9px] font-black tracking-tighter ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{p.appointment_date}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${
                                  p.status === 'Completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                  p.status === 'Cancelled' ? 'bg-red-500' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                }`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                  p.status === 'Completed' ? 'text-emerald-500' :
                                  p.status === 'Cancelled' ? 'text-red-500' : 'text-amber-500'
                                }`}>
                                  {p.status}
                                </span>
                              </div>
                              <span className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>{formatCurrency(p.consultation_fee)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); setView('patient-detail'); }}
                                className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                title="View Comprehensive Analytics"
                              >
                                <Activity size={16} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                                className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                title="Edit Comprehensive Record"
                              >
                                <Edit2 size={16} />
                              </button>
                              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
                              <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); void updateStatus(p.id ?? '', 'Completed'); }}
                                  disabled={p.status === 'Completed'}
                                  className={`p-1.5 rounded-md transition-all ${p.status === 'Completed' ? 'opacity-20 translate-y-1' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                                  title="Mark as Completed"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); void updateStatus(p.id ?? '', 'Cancelled'); }}
                                  disabled={p.status === 'Cancelled'}
                                  className={`p-1.5 rounded-md transition-all ${p.status === 'Cancelled' ? 'opacity-20 translate-y-1' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                  title="Void record"
                                >
                                  <XCircle size={16} />
                                </button>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); void deletePatient(p.id ?? ''); }}
                                className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'text-red-400 bg-red-900/10 border border-red-900/20 hover:bg-red-900/20' : 'text-red-600 bg-red-50 border border-red-100 hover:bg-red-100'}`}
                                title="Delete Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < filteredPatients.length && (
                  <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} text-center`}>
                    <button 
                      onClick={() => void setVisibleCount(prev => prev + 100)}
                      className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-800/30 shadow-lg shadow-blue-900/20' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30'}`}
                    >
                      Stream Next {Math.min(100, filteredPatients.length - visibleCount)} Advanced Records
                    </button>
                    <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enterprise Cloud View: {visibleCount} of {filteredPatients.length} synchronized entries</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'pharmacy' && (
            <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tight">Pharmacy Center</h2>
                  <select 
                    value={filterClinic}
                    onChange={(e) => setFilterClinic(e.target.value)}
                    className={`bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <option value="" className="text-slate-900">All Enterprise Locations</option>
                    {clinics.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                    {(search ? filteredPrescriptions : (filterClinic ? prescriptions.filter(p => !p.id || patients.find(pat => pat.id === p.patientId)?.clinic_name === filterClinic) : prescriptions)).length} Active Prescriptions
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(search ? filteredPrescriptions : prescriptions).map((pres) => (
                  <div key={pres.id} className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 rounded-2xl border shadow-sm`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                          <Pill size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white capitalize">{pres.patientName}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatTimestampDate(pres.date)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); void deletePrescription(pres.id ?? ''); }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                        title="Delete Prescription"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {pres.medicines.map((m, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100">{m.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{m.dosage} • {m.frequency} • {m.duration}</p>
                        </div>
                      ))}
                    </div>
                    {pres.instructions && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <p className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 mb-1 tracking-widest">Special Instructions</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">&ldquo;{pres.instructions}&rdquo;</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {prescriptions.length === 0 && (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Pill size={40} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">No prescriptions found. Records will appear here after clinical visits.</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'billing' && (
            <motion.div key="billing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tight">Financial Ledger</h2>
                  <select 
                    value={filterClinic}
                    onChange={(e) => setFilterClinic(e.target.value)}
                    className={`bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <option value="" className="text-slate-900">All Enterprise Locations</option>
                    {clinics.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">₹{invoices.filter(inv => !filterClinic || patients.find(p => p.id === inv.patientId)?.clinic_name === filterClinic).reduce((s, i) => s + (i.status === 'Paid' ? i.totalAmount : 0), 0).toLocaleString()} Collected</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(search ? filteredInvoices : invoices).map((inv) => (
                  <div key={inv.id} className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-5 rounded-2xl border shadow-sm`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                          inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {inv.status}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); void deleteInvoice(inv.id ?? ''); }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{formatTimestampDate(inv.date)}</span>
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white mb-1 truncate capitalize">{inv.patientName}</h4>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mb-4">{formatCurrency(inv.totalAmount)}</p>
                    <div className="space-y-2 border-t pt-4 border-slate-100 dark:border-slate-800">
                      {inv.items.map((item, id) => (
                        <div key={id} className="flex justify-between text-[11px]">
                          <span className="text-slate-500">{item.description}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'patient-detail' && selectedPatient && (
            <motion.div key="patient-detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
              <div className="flex items-center gap-4 mb-2">
                 <button 
                   onClick={() => setView('records')}
                   className={`p-2 rounded-xl border ${theme === 'dark' ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                 >
                   <ChevronRight className="rotate-180" size={20} />
                 </button>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-400">Back to Patient Ledger</span>
              </div>
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Profile Card */}
                <div className="lg:w-1/3 space-y-6">
                  <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-8 rounded-3xl border shadow-xl`}>
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <Users size={32} />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => void handleEdit(selectedPatient)}
                          className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-800 text-blue-400 hover:bg-slate-800' : 'border-slate-200 text-blue-600 hover:bg-slate-100'} shadow-sm transition-all`}
                          title="Edit Basic Details"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => void deletePatient(selectedPatient.id ?? '')}
                          className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-800 text-red-400 hover:bg-red-900/20' : 'border-red-100 text-red-600 hover:bg-red-50'} shadow-sm transition-all`}
                          title="Delete Record"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">{selectedPatient.patient_name}</h2>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">{selectedPatient.age} Years</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">{selectedPatient.gender}</span>
                      <span className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400">{selectedPatient.visit_type}</span>
                    </div>
                    <div className="space-y-4 border-t pt-6 border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Contact Info</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedPatient.phone_number}</p>
                        <p className="text-sm text-slate-500">{selectedPatient.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Medical History Notes</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">{selectedPatient.notes || 'No historical clinical notes documented.'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Dashboard */}
                <div className="flex-1 space-y-8">
                   {/* Actions Grid */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => setShowPrescriptionForm(true)}
                        className="bg-indigo-600 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                      >
                        <Pill size={24} />
                        <span className="font-black uppercase tracking-widest text-[11px]">Write Prescription</span>
                      </button>
                      <button 
                        onClick={() => setShowInvoiceForm(true)}
                        className="bg-emerald-600 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                      >
                        <Receipt size={24} />
                        <span className="font-black uppercase tracking-widest text-[11px]">Generate Invoice</span>
                      </button>
                   </div>

                   {/* Activity Timeline */}
                   <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <History size={14} />
                        Patient Medical & Financial Timeline
                      </h3>
                      <div className="space-y-3">
                        {prescriptions.filter(p => p.patientId === selectedPatient.id).map(pres => (
                          <div key={pres.id} className="group bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center transition-all hover:shadow-md">
                            <div className="flex items-center gap-4">
                              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Pill size={18} /></div>
                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-white">Prescription issued • {pres.medicines.length} Medicines</p>
                                <p className="text-[10px] text-slate-500 font-bold">{formatTimestamp(pres.date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); void deletePrescription(pres.id ?? ''); }}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-all shadow-sm"
                                title="Delete Prescription"
                              >
                                <Trash2 size={14} />
                              </button>
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-white dark:bg-slate-800 px-3 py-1 rounded-full">Official Record</span>
                            </div>
                          </div>
                        ))}
                        {invoices.filter(i => i.patientId === selectedPatient.id).map(inv => (
                          <div key={inv.id} className="group bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-indigo-900/30 flex justify-between items-center transition-all hover:shadow-md">
                            <div className="flex items-center gap-4">
                              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><CreditCard size={18} /></div>
                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-white">Invoice generated • {formatCurrency(inv.totalAmount)}</p>
                                <p className="text-[10px] text-slate-500 font-bold">{inv.status} • {formatTimestamp(inv.date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); void deleteInvoice(inv.id ?? ''); }}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-all shadow-sm"
                                title="Delete Invoice"
                              >
                                <Trash2 size={14} />
                              </button>
                              <Receipt size={18} className="text-emerald-300" />
                            </div>
                          </div>
                        ))}
                        {prescriptions.filter(p => p.patientId === selectedPatient.id).length === 0 && 
                         invoices.filter(i => i.patientId === selectedPatient.id).length === 0 && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
                            <Activity className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-400 text-xs font-medium">No activity history for this patient yet.</p>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tight uppercase">Advanced Clinical Intel</h2>
                  <select 
                    value={filterClinic}
                    onChange={(e) => setFilterClinic(e.target.value)}
                    className={`bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <option value="" className="text-slate-900">All Enterprise Locations</option>
                    {clinics.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Graphs Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-blue-900/10' : 'bg-white border-slate-200 shadow-slate-200'} p-6 rounded-xl border shadow-sm h-[400px] flex flex-col transition-colors`}>
                  <h3 className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                    <PlusCircle className="text-blue-600" size={16} />
                    Patient Flow (Timeline)
                  </h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsMemo?.dailyStats ?? []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="date" 
                          fontSize={10} 
                          axisLine={false} 
                          tickLine={false} 
                          stroke={theme === 'dark' ? '#64748b' : '#94a3b8'} 
                          label={{ value: 'Timeline', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }}
                        />
                        <YAxis 
                          fontSize={10} 
                          axisLine={false} 
                          tickLine={false} 
                          stroke={theme === 'dark' ? '#64748b' : '#94a3b8'}
                          label={{ value: 'Patient Count', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
                            color: theme === 'dark' ? '#fff' : '#000'
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <ReferenceLine 
                          y={(statsMemo?.dailyStats ?? []).reduce((acc, curr) => acc + curr.patients, 0) / (statsMemo?.dailyStats?.length ?? 1)} 
                          stroke="#ef4444" 
                          strokeDasharray="3 3" 
                          label={{ value: 'Avg', position: 'right', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} 
                        />
                        <Bar 
                          dataKey="patients" 
                          fill="#3b82f6" 
                          radius={[6, 6, 0, 0]} 
                          name="Total Patients"
                          activeBar={{ fill: '#2563eb', stroke: '#60a5fa', strokeWidth: 2 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-emerald-900/10' : 'bg-white border-slate-200 shadow-slate-200'} p-6 rounded-xl border shadow-sm h-[400px] flex flex-col transition-colors`}>
                  <h3 className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                    <TrendingUp className="text-emerald-600" size={16} />
                    Revenue Velocity (₹)
                  </h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={statsMemo?.dailyStats ?? []} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="date" 
                          fontSize={9} 
                          axisLine={false} 
                          tickLine={false} 
                          stroke={theme === 'dark' ? '#64748b' : '#94a3b8'}
                          label={{ value: 'Date Index', position: 'insideBottom', offset: -5, fontSize: 9, fill: '#64748b' }}
                        />
                        <YAxis 
                          fontSize={9} 
                          axisLine={false} 
                          tickLine={false} 
                          stroke={theme === 'dark' ? '#64748b' : '#94a3b8'}
                          tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                        />
                        <Tooltip 
                           contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '12px 12px 24px rgba(0,0,0,0.2)',
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
                            color: theme === 'dark' ? '#fff' : '#000'
                          }}
                          formatter={(value: unknown) => [`₹${(Number(value)).toLocaleString()}`, 'Net Revenue']}
                        />
                        <ReferenceLine 
                          y={(statsMemo?.dailyStats ?? []).reduce((acc, curr) => acc + curr.revenue, 0) / (statsMemo?.dailyStats?.length ?? 1)} 
                          stroke="#3b82f6" 
                          strokeDasharray="5 5" 
                          label={{ value: 'Mean Revenue', position: 'insideTopRight', fill: '#3b82f6', fontSize: 9, fontWeight: 'bold' }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorRev)" 
                          name="Net Revenue"
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-8 rounded-xl border shadow-sm transition-colors`}>
                  <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                    <Sparkles className="text-blue-600" size={18} />
                    Revenue Productivity Index
                  </h3>
                  <div className="space-y-6">
                    {statsMemo?.revenueBySpecialty.sort((a, b) => b.value - a.value).map((item, i) => (
                      <div key={item.name}>
                        <div className="flex justify-between text-xs mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'][i % 4]}`} />
                            <span className={`font-black tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{item.name}</span>
                          </div>
                          <span className={`font-black ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(item.value)}</span>
                        </div>
                        <div className={`w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} rounded-full h-2 overflow-hidden`}>
                          <motion.div 
                            className={`h-full ${['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'][i % 4]}`} 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.value / (statsMemo.totalRevenue || 1)) * 100}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-8 rounded-xl border shadow-sm flex flex-col items-center justify-center text-center transition-colors`}>
                  <div className={`w-16 h-16 rounded-2xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-blue-50'} flex items-center justify-center mb-4 text-blue-600`}>
                    <TrendingUp size={32} />
                  </div>
                  <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white border-blue-900' : 'text-slate-900 border-blue-100'} border-b pb-2 mb-4`}>
                    Analytics Suite
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} max-w-xs leading-relaxed`}>
                    Enterprise-grade telemetry for clinic growth. Track high-priority cases and revenue velocity directly from the cloud.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mt-8">
                    <button 
                      onClick={() => void exportToExcel()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                      Export XLS
                    </button>
                    <button 
                      onClick={() => void handleAiReport()}
                      disabled={generatingReport}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                      {generatingReport ? <Loader2 className="animate-spin" size={16} /> : <Sparkles className="text-blue-500" size={16} />}
                      AI Analysis
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPrescriptionForm && selectedPatient && (
            <PrescriptionForm 
              theme={theme}
              patient={{ id: selectedPatient.id ?? '', name: selectedPatient.patient_name ?? 'Patient' }}
              onClose={() => setShowPrescriptionForm(false)}
              onSave={(data) => void handleSavePrescription(data)}
            />
          )}
          {showInvoiceForm && selectedPatient && (
            <InvoiceForm 
              theme={theme}
              patient={{ id: selectedPatient.id ?? '', name: selectedPatient.patient_name ?? 'Patient' }}
              onClose={() => setShowInvoiceForm(false)}
              onSave={(data) => void handleSaveInvoice(data)}
            />
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
