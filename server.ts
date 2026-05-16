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
      Buatlah RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM (Deep Learning) berdasarkan data berikut:
      Mata Pelajaran: ${subject}
      Kelas: ${className}
      Fase: ${phase}
      Semester: ${semester}
      Topik: ${topic}
      Alokasi Waktu: ${timeAllocation}
      Capaian Pembelajaran (CP): ${cp || "-"}

      Gunakan skema JSON berikut:
      {
        "pengetahuan_awal": "...",
        "minat": "...",
        "latar_belakang": "...",
        "kebutuhan_belajar": {
          "visual": "...",
          "auditori": "...",
          "kinestetik": "..."
        },
        "karakteristik_materi": {
          "jenis_pengetahuan": "...",
          "konseptual": "...",
          "prosedural": "...",
          "relevansi": "...",
          "tingkat_kesulitan": "...",
          "struktur_materi": "...",
          "integrasi_nilai": "..."
        },
        "dimensi_profil": {
          "iman": "...",
          "kewargaan": "...",
          "nalar_kritis": "...",
          "kreativitas": "...",
          "kolaborasi": "...",
          "kemandirian": "...",
          "kesehatan": "...",
          "komunikasi": "..."
        },
        "desain_pembelajaran": {
          "lintas_disiplin": "...",
          "tujuan_pembelajaran": "...",
          "indikator": ["...", "..."],
          "topik_kontekstual": "..."
        },
        "kerangka_pembelajaran": {
          "mindful": "...",
          "meaningful": "...",
          "joyful": "...",
          "metode": "...",
          "diferensiasi": {
            "konten": "...",
            "proses": "...",
            "produk": "..."
          }
        },
        "kemitraan": {
          "sekolah": "...",
          "luar_sekolah": "...",
          "digital": "..."
        },
        "lingkungan": {
          "fisik": "...",
          "virtual": "...",
          "budaya": "..."
        },
        "pemanfaatan_digital": "...",
        "langkah_langkah": {
          "pertemuan_detail": "...",
          "topik": "...",
          "pendahuluan": { "durasi": "15 MENIT", "orientasi": "...", "apersepsi": "...", "motivasi": "...", "tujuan": "...", "asesmen_diag": "..." },
          "inti": { "durasi": "75 MENIT", "eksplorasi": "...", "eksperimen": "...", "diskusi": "..." },
          "penutup": { "durasi": "15 MENIT", "refleksi": "...", "tindak_lanjut": "...", "penutup_doa": "..." }
        },
        "asesmen": {
          "diagnostik": { "praktik": "...", "obs": "..." },
          "formatif": { "tugas": "...", "penilaian": "...", "obs": "..." },
          "sumatif": { "tugas": "...", "penilaian": "...", "praktik_kinerja": "...", "penilaian_kinerja": "...", "tes_tertulis": "..." }
        }
      }
    `;

    // Using responseMimeType to guarantee valid JSON
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Anda adalah asisten ahli kurikulum Merdeka. Hasilkan rencana pembelajaran mendalam (Mindful, Meaningful, Joyful) dalam format JSON. Isi SEMUA field dengan konten yang detail, inspiratif, dan relevan. Jangan biarkan field kosong.",
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
