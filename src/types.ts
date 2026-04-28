import { FieldValue, Timestamp } from 'firebase/firestore';

export type Gender = 'Male' | 'Female' | 'Other';
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type VisitType = 'OPD' | 'Emergency' | 'Follow-up' | 'Surgery';
export type PatientStatus = 'Pending' | 'Completed' | 'Cancelled';
export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Overdue';

export interface Patient {
  id?: string;
  patient_name: string;
  clinic_name?: string;
  age: number;
  gender: Gender; // Partial matches allowed during lenient import then sanitized
  phone_number: string;
  email: string;
  priority: Priority;
  doctor_specialty: string;
  reason_for_visit: string;
  visit_type: VisitType;
  appointment_date: string; // YYYY-MM-DD
  consultation_fee: number;
  notes: string;
  status: PatientStatus;
  ownerId: string;
  created_at: FieldValue | Timestamp | Date;
  updated_at: FieldValue | Timestamp | Date;
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  id?: string;
  patientId: string;
  patientName: string;
  medicines: Medicine[];
  instructions: string;
  date: FieldValue | Timestamp | Date;
  ownerId: string;
}

export interface InvoiceItem {
  description: string;
  price: number;
}

export interface Invoice {
  id?: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
  dueDate: string;
  ownerId: string;
  date: FieldValue | Timestamp | Date;
}

export interface DailyStats {
  date: string;
  patients: number;
  revenue: number;
}

export interface Stats {
  patientsToday: number;
  completedToday: number;
  revenueToday: number;
  totalRevenue: number;
  appointmentsCount: number;
  avgConsultationFee: number;
  revenueBySpecialty: { name: string, value: number }[];
  dailyStats: DailyStats[];
}
