import React, { useState } from 'react';
import { Receipt, Plus, X, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { InvoiceItem, Invoice } from '../types';

interface InvoiceFormProps {
  patient: { id: string, name: string };
  onSave: (data: Omit<Invoice, 'ownerId' | 'date'>) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export default function InvoiceForm({ patient, onSave, onClose, theme }: InvoiceFormProps) {
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: 'Consultation Fee', price: 0 }
  ]);
  const [status, setStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [dueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const addItem = () => {
    setItems([...items, { description: '', price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    if (field === 'price') {
      newItems[index][field] = parseFloat(value) || 0;
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.description.trim() && i.price >= 0);
    if (validItems.length === 0) return;

    onSave({
      patientId: patient.id,
      patientName: patient.name,
      totalAmount: total,
      status,
      items: validItems,
      dueDate
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
        className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl`}
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-3 rounded-2xl text-white">
                <Receipt size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Billing Invoice</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient: {patient.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Line Items</label>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setStatus('Unpaid')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${status === 'Unpaid' ? 'bg-red-500 border-red-500 text-white' : 'border-slate-200 text-slate-400'}`}
                  >
                    Unpaid
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStatus('Paid')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${status === 'Paid' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-slate-400'}`}
                  >
                    Paid
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-center group">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                      <input 
                        required
                        type="text"
                        placeholder="Item Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold placeholder:text-slate-300 focus:ring-0 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="w-24 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-1">
                      <span className="text-[10px] font-black text-slate-400">₹</span>
                      <input 
                        required
                        type="number"
                        placeholder="0"
                        value={item.price || ''}
                        onChange={(e) => updateItem(index, 'price', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-black focus:ring-0 text-slate-900 dark:text-white"
                      />
                    </div>
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeItem(index)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Remove Item"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button 
                type="button" 
                onClick={addItem}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-bold hover:border-emerald-300 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Add Line Item
              </button>
            </div>

            <div className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-900'} p-6 rounded-3xl text-white`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Payable</p>
                  <h3 className="text-3xl font-black tracking-tighter">₹{total.toLocaleString()}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Status</p>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${status === 'Paid' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {status}
                  </span>
                </div>
              </div>
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
                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Generate & Post
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
