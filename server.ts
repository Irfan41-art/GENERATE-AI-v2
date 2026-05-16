import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API routes go here FIRST
app.post("/api/generate-module", async (req, res) => {
  try {
    const { subject, className, phase, semester, topic, timeAllocation, cp } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
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

      Hasilkan konten edukasi yang mendalam dan relevan dalam format JSON dengan struktur berikut:
      {
        "pengetahuan_awal": "...",
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
          "indikator": ["Indikator 1", "Indikator 2", "Indikator 3", "Indikator 4"],
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
          "pertemuan_detail": "PERTEMUAN 1 (3 JP : 105 MENIT)",
          "topik": "...",
          "pendahuluan": {
            "durasi": "15 MENIT",
            "orientasi": "Salam, doa, dan presensi.",
            "apersepsi": "...",
            "motivasi": "...",
            "tujuan": "...",
            "asesmen_diag": "..."
          },
          "inti": {
            "durasi": "75 MENIT",
            "eksplorasi": "...",
            "eksperimen": "...",
            "diskusi": "..."
          },
          "penutup": {
            "durasi": "15 MENIT",
            "refleksi": "...",
            "tindak_lanjut": "...",
            "penutup_doa": "Doa dan salam."
          }
        },
        "asesmen": {
          "diagnostik": { "praktik": "...", "obs": "..." },
          "formatif": { "tugas": "...", "penilaian": "...", "obs": "..." },
          "sumatif": { 
            "tugas": "...", 
            "penilaian": "...", 
            "praktik_kinerja": "...", 
            "penilaian_kinerja": "...",
            "tes_tertulis": "..." 
          }
        }
      }

      PENTING:
      - Gunakan bahasa Indonesia yang formal, inspiratif dan sesuai standar kurikulum Merdeka.
      - Pastikan Bagian B (Identifikasi Kesiapan Murid) memiliki sub-poin Pengetahuan Awal, Minat (teks khusus), Latar Belakang (teks khusus), dan Kebutuhan Belajar (a, b, c).
      - Bagian G HARUS mengikuti struktur yang ketat: Pendahuluan (15 MENIT), Inti (75 MENIT), dan Penutup (15 MENIT).
      - Kembalikan HANYA JSON tanpa teks lain.
    `;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    let text = result.text || "";
    
    // Clean JSON if needed (remove markdown backticks)
    text = text.replace(/```json|```/g, "").trim();
    
    const moduleData = JSON.parse(text);
    res.json(moduleData);
  } catch (error) {
    console.error("Error generating module:", error);
    res.status(500).json({ error: "Failed to generate module content" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
