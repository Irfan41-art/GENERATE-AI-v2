import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const app = express();
const PORT = 3000;

app.use(express.json());

// API routes go here FIRST
app.post("/api/generate-module", async (req, res) => {
  try {
    const { subject, className, phase, semester, topic, timeAllocation, cp } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing in environment variables");
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in Vercel dashboard" });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `
      Anda adalah ahli kurikulum "Deep Learning" (Mindful, Meaningful, Joyful Learning) untuk kurikulum Merdeka di Indonesia. 
      Tugas Anda adalah membuat RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM berdasarkan data berikut:
      Mata Pelajaran: ${subject}
      Kelas: ${className}
      Fase: ${phase}
      Semester: ${semester}
      Topik: ${topic}
      Alokasi Waktu: ${timeAllocation}
      Capaian Pembelajaran (CP): ${cp || "-"}

      Hasilkan konten edukasi yang mendalam dan relevan.
      
      PENTING:
      - Gunakan bahasa Indonesia yang formal, inspiratif dan sesuai standar kurikulum Merdeka.
      - Pastikan Bagian B (Identifikasi Kesiapan Murid) memiliki sub-poin Pengetahuan Awal, Minat, Latar Belakang, dan Kebutuhan Belajar.
      - Bagian G HARUS mengikuti struktur yang ketat: Pendahuluan (15 MENIT), Inti (75 MENIT), dan Penutup (15 MENIT).
    `;

    // Using responseMimeType to guarantee valid JSON
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Anda adalah asisten ahli kurikulum yang hanya merespon dalam format JSON sesuai skema yang diminta. Jangan memberikan teks penjelasan di luar JSON.",
      }
    });
    
    const text = result.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }
    
    try {
      const moduleData = JSON.parse(text);
      res.json(moduleData);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", text);
      res.status(500).json({ error: "Invalid JSON format received from AI" });
    }
  } catch (error) {
    console.error("Error generating module:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    res.status(500).json({ error: `Gagal generate modul: ${errorMessage}` });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if this file is run directly
  if (import.meta.url === `file://${process.argv[1]}` || process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
