import React, { useState } from 'react';
import { Pill, Plus, X, Save } from 'lucide-react';
import { motion } from 'motion/react';

import { Medicine, Prescription } from '../types';

interface PrescriptionFormProps {
  patient: { id: string, name: string };
  onSave: (data: Omit<Prescription, 'ownerId' | 'date'>) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export default function PrescriptionForm({ patient, onSave, onClose, theme }: PrescriptionFormProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([
    { name: '', dosage: '', frequency: 'Once a day', duration: '5 days' }
  ]);
  const [instructions, setInstructions] = useState('');

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: 'Once a day', duration: '5 days' }]);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index: number, field: keyof Medicine, value: string) => {
    const newMeds = [...medicines];
    newMeds[index][field] = value;
    setMedicines(newMeds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validMeds = medicines.filter(m => m.name.trim());
    if (validMeds.length === 0) return;

    onSave({
      patientId: patient.id,
      patientName: patient.name,
      medicines: validMeds,
      instructions
    });
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl`}
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                <Pill size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Clinical Prescription</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient: {patient.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
              {medicines.map((med, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 relative group">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Medicine Name</label>
                      <input 
                        required
                        type="text"
                        placeholder="e.g. Paracetamol 500mg"
                        value={med.name}
                        onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold placeholder:text-slate-300 focus:ring-0 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dosage</label>
                        <input 
                          type="text"
                          placeholder="1 tab"
                          value={med.dosage}
                          onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-[11px] font-bold placeholder:text-slate-300 focus:ring-0 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Freq.</label>
                        <select 
                          value={med.frequency}
                          onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-[11px] font-bold focus:ring-0 appearance-none text-slate-900 dark:text-white cursor-pointer"
                        >
                          <option>Once a day</option>
                          <option>Twice a day</option>
                          <option>Thrice a day</option>
                          <option>Every 4 hours</option>
                          <option>Before meals</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</label>
                        <input 
                          type="text"
                          placeholder="5 days"
                          value={med.duration}
                          onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-[11px] font-bold placeholder:text-slate-300 focus:ring-0 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                  {medicines.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeMedicine(index)}
                      className="absolute -right-2 -top-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 p-1.5 rounded-full shadow-sm hover:scale-110 transition-all z-10"
                      title="Remove Medicine"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={addMedicine}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Add Another Medicine
            </button>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Additional Clinical Instructions</label>
              <textarea 
                rows={3}
                placeholder="Dietary precautions, follow-up advice..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className={`w-full p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} text-sm outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Discard
              </button>
              <button 
                type="submit"
                className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Authorize & Save
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
