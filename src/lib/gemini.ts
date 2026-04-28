import { GoogleGenAI } from "@google/genai";
import { Patient, Stats } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined");
}
const ai = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const generateClinicReport = async (stats: Stats, patients: Patient[], focusDate: string) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert medical administrator. Generate a concise, professional clinical performance report based on the following data for focus date ${focusDate}:
    
    Snapshot for ${focusDate}:
    - New Appointments on this date: ${stats.patientsToday}
    - Revenue generated on this date: ₹${stats.revenueToday}
    
    Overall Stats:
    - Total Revenue to date: ₹${stats.totalRevenue}
    - Total Appointments in Database: ${stats.appointmentsCount}
    - Average Consultation Fee: ₹${stats.avgConsultationFee}
    
    Recent Patient Profiles:
    ${patients.slice(0, 10).map(p => `- ${p.patient_name}: ${p.doctor_specialty} (${p.status}) on ${p.appointment_date}`).join('\n')}
    
    Instructions:
    1. Summarize the workload for the focus date.
    2. Analyze the revenue trajectory compared to the overall average.
    3. Suggest one strategic focus based on patient specialties.
    4. Keep it under 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate AI report at this time.";
  }
};
