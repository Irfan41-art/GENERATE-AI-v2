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

    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    
    if (!key || key === "REPLACE_WITH_YOUR_GEMINI_API_KEY" || key.length < 10) {
      console.error("GEMINI_API_KEY is missing, too short, or using placeholder value");
      return res.status(500).json({ 
        error: "GEMINI_API_KEY belum dikonfigurasi dengan benar. \n\n" +
               "Jika di Vercel: Pergi ke Settings > Environment Variables, tambahkan GEMINI_API_KEY dengan nilai API Key dari Google AI Studio.\n" +
               "Jika di AI Studio: Pastikan API Key valid di bagian Settings." 
      });
    }

    // Informative logging (keeping key secret)
    console.log(`Attempting Gemini API call. Key length: ${key.length}, Starts with: ${key.substring(0, 7)}...`);

    const ai = new GoogleGenAI({
      apiKey: key,
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
  } catch (error: any) {
    console.error("Error generating module:", error);
    
    let message = "Terjadi kesalahan internal.";
    
    // Check for common Gemini API errors
    if (error.message?.includes("API key not valid")) {
      message = "API Key tidak valid. Pastikan GEMINI_API_KEY sudah benar di konfigurasi Vercel/AI Studio.";
    } else if (error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      message = "Kuota API Gemini telah habis atau limit tercapai. \n\n" +
                "Saran: \n" +
                "1. Tunggu beberapa saat dan coba lagi.\n" +
                "2. Jika terus berlanjut, Anda bisa masuk ke 'Settings > Secrets' dan pilih API Key yang memiliki penagihan aktif (billing enabled) untuk kuota yang lebih besar.";
    } else if (error.message) {
      // Try to extract useful info from a JSON error message if it's a string
      try {
        const parsed = JSON.parse(error.message);
        message = parsed.error?.message || message;
      } catch {
        message = error.message;
      }
    }

    res.status(500).json({ error: message });
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
