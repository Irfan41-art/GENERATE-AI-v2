import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Download, 
  Copy, 
  Loader2, 
  CheckCircle2, 
  Info,
  ChevronDown,
  BookOpen,
  LogIn,
  LogOut,
  User as UserIcon,
  History
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  WidthType, 
  AlignmentType, 
  TextRun, 
  BorderStyle
} from 'docx';
import { auth, signInWithGoogle, db, handleFirestoreError, FirestoreOp } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit, doc, setDoc } from 'firebase/firestore';

const SUBJECTS = [
  "Pendidikan Agama Islam",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Ilmu Pengetahuan Alam dan Sosial",
  "Seni Rupa",
  "Pendidikan Jasmani, Olahraga dan Kesehatan",
  "Bahasa Inggris",
  "Pendidikan Kewirausahaan",
  "Koding dan Kecerdasan Artificial",
  "Muatan Lokal"
];

const CLASSES = [
  "Kelas 1",
  "Kelas 2",
  "Kelas 3",
  "Kelas 4",
  "Kelas 5",
  "Kelas 6"
];

const SEMESTERS = ["Semester 1", "Semester 2"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [recentModules, setRecentModules] = useState<any[]>([]);

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [className, setClassName] = useState(CLASSES[0]);
  const [phase, setPhase] = useState("Fase A");
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [topic, setTopic] = useState("");
  const [timeAllocation, setTimeAllocation] = useState("24 JP (8 pertemuan @3 JP)");
  const [cp, setCp] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user profile
        try {
          await setDoc(doc(db, 'users', u.uid), {
            displayName: u.displayName || 'No Name',
            email: u.email || '',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error("User profile sync failed:", err);
          // Not critical for general use, but good to log
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentModules([]);
      return;
    }

    const q = query(
      collection(db, 'modules'),
      where('userId', '==', user.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort locally to avoid "Missing Index" error
      docs.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setRecentModules(docs.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, FirestoreOp.LIST, 'modules');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (className === "Kelas 1" || className === "Kelas 2") {
      setPhase("Fase A");
    } else if (className === "Kelas 3" || className === "Kelas 4") {
      setPhase("Fase B");
    } else if (className === "Kelas 5" || className === "Kelas 6") {
      setPhase("Fase C");
    }
  }, [className]);

  const handleGenerate = async () => {
    if (!topic) {
      alert("Harap isi topik terlebih dahulu!");
      return;
    }

    setIsGenerating(true);
    setGeneratedData(null);

    try {
      const response = await fetch('/api/generate-module', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          className,
          phase,
          semester,
          topic,
          timeAllocation,
          cp
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generate failed');
      }
      
      const data = await response.json();
      setGeneratedData(data);

      // Save to Firebase if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'modules'), {
            userId: user.uid,
            subject,
            className,
            phase,
            semester,
            topic,
            timeAllocation,
            cp,
            content: data,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, FirestoreOp.CREATE, 'modules');
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(`Gagal generate modul: ${error.message || "Silakan coba lagi."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (!generatedData) return;
    
    const text = `MODUL AJAR DEEP LEARNING
MATA PELAJARAN : ${subject}
TOPIK : ${topic}

A. IDENTITAS MODUL
Nama Sekolah: ......................................................
Nama Penyusun: ......................................................
Mata Pelajaran: ${subject}
Kelas / Fase / Semester: ${className} / ${phase} / ${semester}
Alokasi Waktu: ${timeAllocation}

B. IDENTIFIKASI KESIAPAN PESERTA DIDIK
Pengetahuan Awal: ${generatedData.pengetahuan_awal}
Minat: Peserta didik memiliki minat yang tinggi dalam kegiatan membangun, merakit, dan berkreasi menggunakan berbagai media, termasuk barang-barang bekas.
Latar Belakang: Peserta didik memiliki pengalaman bermain dengan balok susun, lego, atau membuat hasta karya sederhana, sehingga memiliki pemahaman intuitif tentang keseimbangan dan konstruksi.

... (Lihat tabel selengkapnya di Preview)`;

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleDownloadDoc = async () => {
    if (!generatedData) return;

    const cellPadding = { top: 100, bottom: 100, left: 144, right: 144 };
    
    const BRAND_PRIMARY = "38BDF8"; // Sky 400
    const BORDER_COLOR = "BAE6FD"; // Sky 200

    const tableBorders = {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
    };

    const createHeaderRow = (title: string) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: title, bold: true, font: "Arial", size: 22, color: "FFFFFF" })],
            spacing: { before: 120, after: 120 }
          })],
          columnSpan: 2,
          shading: { fill: BRAND_PRIMARY, type: "solid", color: "auto" }
        })
      ]
    });

    const createDataRow = (label: string, value: string) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, font: "Arial", size: 22, color: "0369A1" })],
            spacing: { before: 80, after: 80 }
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          margins: cellPadding,
          shading: { fill: "F0F9FF" }
        }),
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.BOTH,
            children: [new TextRun({ text: value, font: "Arial", size: 22 })],
            spacing: { before: 80, after: 80 }
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
          margins: cellPadding
        })
      ]
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM", bold: true, font: "Arial", size: 32, color: "0284C7" }),
              new TextRun({ break: 1 }),
              new TextRun({ text: `MATA PELAJARAN : ${subject.toUpperCase()}`, bold: true, font: "Arial", size: 24, color: "0EA5E9" }),
              new TextRun({ break: 1 }),
              new TextRun({ text: `TOPIK: ${topic.toUpperCase()}`, bold: true, font: "Arial", size: 24, color: "0EA5E9" }),
              new TextRun({ break: 2 }),
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              createHeaderRow("A. IDENTITAS MODUL"),
              createDataRow("Nama Sekolah", "......................................................"),
              createDataRow("Nama Penyusun", "......................................................"),
              createDataRow("Mata Pelajaran", subject),
              createDataRow("Kelas / Fase / Semester", `${className} / ${phase} / ${semester}`),
              createDataRow("Alokasi Waktu", timeAllocation),

              createHeaderRow("B. IDENTIFIKASI KESIAPAN MURID"),
              createDataRow("1. Pengetahuan Awal", generatedData.pengetahuan_awal || "-"),
              createDataRow("2. Minat", generatedData.minat || "-"),
              createDataRow("3. Latar Belakang", generatedData.latar_belakang || "-"),
              createDataRow("4. Kebutuhan Belajar", 
                `a) Visual: ${generatedData.kebutuhan_belajar?.visual || "-"}\n` +
                `b) Auditori: ${generatedData.kebutuhan_belajar?.auditori || "-"}\n` +
                `c) Kinestetik: ${generatedData.kebutuhan_belajar?.kinestetik || "-"}`
              ),

              createHeaderRow("C. KARAKTERISTIK MATERI PELAJARAN"),
              createDataRow("1. Jenis Pengetahuan", generatedData.karakteristik_materi?.jenis_pengetahuan || "-"),
              createDataRow("2. Konseptual", generatedData.karakteristik_materi?.konseptual || "-"),
              createDataRow("3. Prosedural", generatedData.karakteristik_materi?.prosedural || "-"),
              createDataRow("4. Relevansi", generatedData.karakteristik_materi?.relevansi || "-"),
              createDataRow("5. Tingkat Kesulitan", generatedData.karakteristik_materi?.tingkat_kesulitan || "-"),
              createDataRow("6. Struktur Materi", generatedData.karakteristik_materi?.struktur_materi || "-"),
              createDataRow("7. Integrasi Nilai", generatedData.karakteristik_materi?.integrasi_nilai || "-"),

              createHeaderRow("D. DIMENSI PROFIL LULUSAN"),
              createDataRow("1. Iman & Takwa", generatedData.dimensi_profil?.iman || "-"),
              createDataRow("2. Kewargaan", generatedData.dimensi_profil?.kewargaan || "-"),
              createDataRow("3. Penalaran Kritis", generatedData.dimensi_profil?.nalar_kritis || "-"),
              createDataRow("4. Kreativitas", generatedData.dimensi_profil?.kreativitas || "-"),
              createDataRow("5. Kolaborasi", generatedData.dimensi_profil?.kolaborasi || "-"),
              createDataRow("6. Kemandirian", generatedData.dimensi_profil?.kemandirian || "-"),
              createDataRow("7. Kesehatan", generatedData.dimensi_profil?.kesehatan || "-"),
              createDataRow("8. Komunikasi", generatedData.dimensi_profil?.komunikasi || "-"),

              createHeaderRow("E. DESAIN PEMBELAJARAN"),
              createDataRow("1. CAPAIAN PEMBELAJARAN (CP)", cp || "-"),
              createDataRow("2. LINTAS DISIPLIN ILMU", generatedData.desain_pembelajaran?.lintas_disiplin || "-"),
              createDataRow("3. TUJUAN PEMBELAJARAN", generatedData.desain_pembelajaran?.tujuan_pembelajaran || "-"),
              createDataRow("4. INDIKATOR KETERCAPAIAN", (generatedData.desain_pembelajaran?.indikator || []).join(", ")),
              createDataRow("5. TOPIK KONTEKSTUAL", generatedData.desain_pembelajaran?.topik_kontekstual || "-"),

              createHeaderRow("F. KERANGKA PEMBELAJARAN"),
              createDataRow("1. Praktik Pedagogik", 
                `a. Model: Project-Based Learning\n` +
                `b. Pendekatan: Deep Learning\n` +
                `- Mindful: ${generatedData.kerangka_pembelajaran?.mindful || "-"}\n` +
                `- Meaningful: ${generatedData.kerangka_pembelajaran?.meaningful || "-"}\n` +
                `- Joyful: ${generatedData.kerangka_pembelajaran?.joyful || "-"}\n` +
                `c. Metode: ${generatedData.kerangka_pembelajaran?.metode || "-"}`
              ),
              createDataRow("Strategi Diferensiasi", 
                `- Konten: ${generatedData.kerangka_pembelajaran?.diferensiasi?.konten || "-"}\n` +
                `- Proses: ${generatedData.kerangka_pembelajaran?.diferensiasi?.proses || "-"}\n` +
                `- Produk: ${generatedData.kerangka_pembelajaran?.diferensiasi?.produk || "-"}`
              ),
              createDataRow("2. Kemitraan", 
                `- Sekolah: ${generatedData.kemitraan?.sekolah || "-"}\n` +
                `- Luar Sekolah: ${generatedData.kemitraan?.luar_sekolah || "-"}\n` +
                `- Digital: ${generatedData.kemitraan?.digital || "-"}`
              ),
              createDataRow("3. Lingkungan Belajar", 
                `- Fisik: ${generatedData.lingkungan?.fisik || "-"}\n` +
                `- Virtual: ${generatedData.lingkungan?.virtual || "-"}\n` +
                `- Budaya: ${generatedData.lingkungan?.budaya || "-"}`
              ),
              createDataRow("4. Pemanfaatan Digital", generatedData.pemanfaatan_digital || "-"),

              createHeaderRow("G. LANGKAH-LANGKAH PEMBELAJARAN BERDIFERENSIASI"),
              createDataRow("Kegiatan", generatedData.langkah_langkah?.pertemuan_detail || "-"),
              createDataRow("Topik", generatedData.langkah_langkah?.topik || "-"),
              createDataRow(`KEGIATAN PENDAHULUAN (${generatedData.langkah_langkah?.pendahuluan?.durasi || "15 MENIT"})`, 
                `1. Orientasi: ${generatedData.langkah_langkah?.pendahuluan?.orientasi || "-"}\n` +
                `2. Apersepsi (Joyful): ${generatedData.langkah_langkah?.pendahuluan?.apersepsi || "-"}\n` +
                `3. Motivasi: ${generatedData.langkah_langkah?.pendahuluan?.motivasi || "-"}\n` +
                `4. Penyampaian Tujuan: ${generatedData.langkah_langkah?.pendahuluan?.tujuan || "-"}\n` +
                `5. Asesmen Diagnostik: ${generatedData.langkah_langkah?.pendahuluan?.asesmen_diag || "-"}`
              ),
              createDataRow(`KEGIATAN INTI (${generatedData.langkah_langkah?.inti?.durasi || "75 MENIT"})`, 
                `1. Eksplorasi Bahan: ${generatedData.langkah_langkah?.inti?.eksplorasi || "-"}\n` +
                `2. Eksperimen Keseimbangan: ${generatedData.langkah_langkah?.inti?.eksperimen || "-"}\n` +
                `3. Diskusi: ${generatedData.langkah_langkah?.inti?.diskusi || "-"}`
              ),
              createDataRow(`KEGIATAN PENUTUP (${generatedData.langkah_langkah?.penutup?.durasi || "15 MENIT"})`, 
                `1. Refleksi: ${generatedData.langkah_langkah?.penutup?.refleksi || "-"}\n` +
                `2. Tindak Lanjut: ${generatedData.langkah_langkah?.penutup?.tindak_lanjut || "-"}\n` +
                `3. Penutup: ${generatedData.langkah_langkah?.penutup?.penutup_doa || "-"}`
              ),

              createHeaderRow("H. ASESMEN PEMBELAJARAN"),
              createDataRow("1. Diagnostik", `Praktik: ${generatedData.asesmen?.diagnostik?.praktik || "-"}\nObservasi: ${generatedData.asesmen?.diagnostik?.obs || "-"}`),
              createDataRow("2. Formatif", `Tugas: ${generatedData.asesmen?.formatif?.tugas || "-"}\nPenilaian: ${generatedData.asesmen?.formatif?.penilaian || "-"}\nObservasi: ${generatedData.asesmen?.formatif?.obs || "-"}`),
              createDataRow("3. Sumatif", `Tugas: ${generatedData.asesmen?.sumatif?.tugas || "-"}\nPenilaian: ${generatedData.asesmen?.sumatif?.penilaian || "-"}\nKinerja: ${generatedData.asesmen?.sumatif?.praktik_kinerja || "-"}\nTes Tertulis: ${generatedData.asesmen?.sumatif?.tes_tertulis || "-"}`),

            ]
          }),
          new Paragraph({ children: [new TextRun({ break: 4 })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Mengetahui,", font: "Arial", size: 22 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Kepala Sekolah", font: "Arial", size: 22 })] }),
                      new Paragraph({ children: [new TextRun({ break: 4 })] }),
                      new Paragraph({ children: [new TextRun({ text: "..........................................", font: "Arial", size: 22, bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: "NIP. ................................", font: "Arial", size: 22 })] }),
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `............, ......................... 20..`, font: "Arial", size: 22 })] }),
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Guru Mata Pelajaran", font: "Arial", size: 22 })] }),
                      new Paragraph({ children: [new TextRun({ break: 4 })] }),
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "..........................................", font: "Arial", size: 22, bold: true })] }),
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "NIP. ................................", font: "Arial", size: 22 })] }),
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Modul_Ajar_${topic}.docx`);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">GENERATOR RPM</h1>
            <p className="text-sm font-semibold text-slate-500 tracking-widest">By. IRFAN, S.Pd.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500">{user.email}</p>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="profile" className="w-10 h-10 rounded-full border-2 border-sky-100" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-sky-600" />
                  </div>
                )}
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    if (err.code !== 'auth/popup-closed-by-user') {
                      alert("Gagal masuk: " + (err.message || "Terjadi kesalahan tidak dikenal"));
                    }
                  }
                }}
                className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all text-sm shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Masuk dengan Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          {user && recentModules.length > 0 && (
            <div id="history-sidebar" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <History className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Riwayat Terakhir</h3>
              </div>
              <div className="space-y-2">
                {recentModules.map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => {
                      setSubject(m.subject);
                      setClassName(m.className);
                      setTopic(m.topic);
                      setTimeAllocation(m.timeAllocation);
                      setCp(m.cp || "");
                      setGeneratedData(m.content);
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-sky-50 border border-transparent hover:border-sky-100 transition-all group"
                  >
                    <p className="text-xs font-bold text-slate-900 group-hover:text-sky-700 truncate">{m.topic}</p>
                    <p className="text-[10px] text-slate-500">{m.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div id="input-form-card" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Mata Pelajaran</label>
              <div className="relative">
                <select 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Kelas</label>
                <div className="relative">
                  <select 
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Fase</label>
                <input 
                  type="text" 
                  value={phase} 
                  readOnly 
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 font-bold" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Semester</label>
              <div className="relative">
                <select 
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all"
                >
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Topik</label>
              <input 
                type="text" 
                placeholder="Contoh: Penjumlahan < 20"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Capaian Pembelajaran (CP)</label>
              <textarea 
                placeholder="Masukkan Capaian Pembelajaran..."
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Alokasi Waktu</label>
              <input 
                type="text" 
                value={timeAllocation}
                onChange={(e) => setTimeAllocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

          <button 
            id="generate-button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
              {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate'}
            </button>
            
            {isGenerating && (
              <p className="text-center text-sm font-medium text-blue-600 animate-pulse">Tunggu sebentar, dalam proses...</p>
            )}
          </div>
        </aside>

        <section className="lg:col-span-8 space-y-6">
          <div className="flex gap-3">
            <button 
              onClick={handleCopyText}
              disabled={!generatedData}
              className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {copySuccess ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              Salin Teks
            </button>
            <button 
              onClick={handleDownloadDoc}
              disabled={!generatedData}
              className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download .doc
            </button>
          </div>

          <div id="preview-container" className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[600px] overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-600 text-sm uppercase tracking-wider">Kolom Hasil</h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
            </div>

            <div className="p-10 overflow-x-auto">
              {generatedData ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-3xl mx-auto space-y-8 bg-white"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                  <div className="text-center font-bold mb-8">
                    <h2 className="text-3xl uppercase tracking-tight text-sky-700 mb-2">RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM</h2>
                    <p className="text-xl uppercase text-sky-600">MATA PELAJARAN : {subject}</p>
                    <p className="text-xl uppercase text-sky-600">TOPIK : {topic}</p>
                  </div>

                  <table className="w-full border-collapse border-4 border-sky-200">
                    <tbody className="text-[11pt]">
                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">A. IDENTITAS MODUL</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 w-1/3 font-bold bg-sky-50 text-sky-800">Nama Sekolah</td>
                        <td className="p-4 border-2 border-sky-100 italic">......................................................</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">Nama Penyusun</td>
                        <td className="p-4 border-2 border-sky-100 italic">......................................................</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">Mata Pelajaran</td>
                        <td className="p-4 border-2 border-sky-100">{subject}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">Kelas / Fase / Semester</td>
                        <td className="p-4 border-2 border-sky-100">{className} / {phase} / {semester}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">Alokasi Waktu</td>
                        <td className="p-4 border-2 border-sky-100">{timeAllocation}</td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">B. IDENTIFIKASI KESIAPAN MURID</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. Pengetahuan Awal</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.pengetahuan_awal || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. Minat</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.minat || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. Latar Belakang</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.latar_belakang || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">4. Kebutuhan Belajar</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">
                          <p><strong>a) Visual:</strong> {generatedData.kebutuhan_belajar?.visual || "-"}</p>
                          <p><strong>b) Auditori:</strong> {generatedData.kebutuhan_belajar?.auditori || "-"}</p>
                          <p><strong>c) Kinestetik:</strong> {generatedData.kebutuhan_belajar?.kinestetik || "-"}</p>
                        </td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">C. KARAKTERISTIK MATERI PELAJARAN</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. Jenis Pengetahuan</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.jenis_pengetahuan || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. Konseptual</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.konseptual || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. Prosedural</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.prosedural || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">4. Relevansi</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.relevansi || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">5. Tingkat Kesulitan</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.tingkat_kesulitan || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">6. Struktur Materi</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.struktur_materi || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">7. Integrasi Nilai</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">{generatedData.karakteristik_materi?.integrasi_nilai || "-"}</td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">D. DIMENSI PROFIL LULUSAN</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. Iman & Takwa</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.iman || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. Kewargaan</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.kewargaan || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. Penalaran Kritis</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.nalar_kritis || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">4. Kreativitas</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.kreativitas || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">5. Kolaborasi</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.kolaborasi || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">6. Kemandirian</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.kemandirian || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">7. Kesehatan</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.kesehatan || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">8. Komunikasi</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.dimensi_profil?.komunikasi || "-"}</td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">E. DESAIN PEMBELAJARAN</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. CAPAIAN PEMBELAJARAN (CP)</td>
                        <td className="p-4 border-2 border-sky-100 whitespace-pre-wrap">{cp || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. LINTAS DISIPLIN ILMU</td>
                        <td className="p-4 border-2 border-sky-100 text-justify">{generatedData.desain_pembelajaran?.lintas_disiplin || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. TUJUAN PEMBELAJARAN</td>
                        <td className="p-4 border-2 border-sky-100 text-justify">{generatedData.desain_pembelajaran?.tujuan_pembelajaran || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">4. INDIKATOR KETERCAPAIAN</td>
                        <td className="p-4 border-2 border-sky-100">
                          <ul className="list-decimal ml-5">
                            {(generatedData.desain_pembelajaran?.indikator || []).map((ind: string, i: number) => (
                              <li key={i}>{ind}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">5. TOPIK KONTEKSTUAL</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.desain_pembelajaran?.topik_kontekstual || "-"}</td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">F. KERANGKA PEMBELAJARAN</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. PRAKTIK PEDAGOGIK</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">
                          <p><strong>a. Model Pembelajaran:</strong> Project-Based Learning</p>
                          <p><strong>b. Pendekatan:</strong> Deep Learning</p>
                          <div className="ml-4">
                            <p>Mindful Learning: {generatedData.kerangka_pembelajaran?.mindful || "-"}</p>
                            <p>Meaningful Learning: {generatedData.kerangka_pembelajaran?.meaningful || "-"}</p>
                            <p>Joyful Learning: {generatedData.kerangka_pembelajaran?.joyful || "-"}</p>
                          </div>
                          <p><strong>c. Metode Pembelajaran:</strong> {generatedData.kerangka_pembelajaran?.metode || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">STRATEGI DIFERENSIASI</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">
                          <p><strong>Diferensiasi Konten:</strong> {generatedData.kerangka_pembelajaran?.diferensiasi?.konten || "-"}</p>
                          <p><strong>Diferensiasi Proses:</strong> {generatedData.kerangka_pembelajaran?.diferensiasi?.proses || "-"}</p>
                          <p><strong>Diferensiasi Produk:</strong> {generatedData.kerangka_pembelajaran?.diferensiasi?.produk || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. KEMITRAAN PEMBELAJARAN</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">
                          <p><strong>a. Sekolah:</strong> {generatedData.kemitraan?.sekolah || "-"}</p>
                          <p><strong>b. Luar Sekolah:</strong> {generatedData.kemitraan?.luar_sekolah || "-"}</p>
                          <p><strong>c. Mitra Digital:</strong> {generatedData.kemitraan?.digital || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. LINGKUNGAN BELAJAR</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed">
                          <p><strong>a. Ruang Fisik:</strong> {generatedData.lingkungan?.fisik || "-"}</p>
                          <p><strong>b. Ruang Virtual:</strong> {generatedData.lingkungan?.virtual || "-"}</p>
                          <p><strong>c. Budaya Belajar:</strong> {generatedData.lingkungan?.budaya || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">4. PEMANFAATAN DIGITAL</td>
                        <td className="p-4 border-2 border-sky-100">{generatedData.pemanfaatan_digital || "-"}</td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">G. LANGKAH-LANGKAH PEMBELAJARAN BERDIFERENSIASI</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800 font-mono text-[10pt] uppercase">{generatedData.langkah_langkah?.pertemuan_detail || "-"}</td>
                        <td className="p-4 border-2 border-sky-100 text-justify leading-relaxed space-y-4">
                          <p className="font-bold underline text-sky-700 mb-2">Topik: {generatedData.langkah_langkah?.topik || "-"}</p>
                          
                          <div>
                            <p className="font-bold text-sky-600 uppercase">KEGIATAN PENDAHULUAN ({generatedData.langkah_langkah?.pendahuluan?.durasi || "15 MENIT"})</p>
                            <div className="ml-2 space-y-1 mt-1 font-mono text-[10pt]">
                              <p>1. <strong>Orientasi:</strong> {generatedData.langkah_langkah?.pendahuluan?.orientasi || "-"}</p>
                              <p>2. <strong>Apersepsi (Joyful):</strong> {generatedData.langkah_langkah?.pendahuluan?.apersepsi || "-"}</p>
                              <p>3. <strong>Motivasi:</strong> {generatedData.langkah_langkah?.pendahuluan?.motivasi || "-"}</p>
                              <p>4. <strong>Penyampaian Tujuan:</strong> {generatedData.langkah_langkah?.pendahuluan?.tujuan || "-"}</p>
                              <p>5. <strong>Asesmen Diagnostik:</strong> {generatedData.langkah_langkah?.pendahuluan?.asesmen_diag || "-"}</p>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-sky-600 uppercase">KEGIATAN INTI ({generatedData.langkah_langkah?.inti?.durasi || "75 MENIT"})</p>
                            <div className="ml-2 space-y-1 mt-1 font-mono text-[10pt]">
                              <p>1. <strong>Eksplorasi Bahan:</strong> {generatedData.langkah_langkah?.inti?.eksplorasi || "-"}</p>
                              <p>2. <strong>Eksperimen Keseimbangan:</strong> {generatedData.langkah_langkah?.inti?.eksperimen || "-"}</p>
                              <p>3. <strong>Diskusi:</strong> {generatedData.langkah_langkah?.inti?.diskusi || "-"}</p>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-sky-600 uppercase">KEGIATAN PENUTUP ({generatedData.langkah_langkah?.penutup?.durasi || "15 MENIT"})</p>
                            <div className="ml-2 space-y-1 mt-1 font-mono text-[10pt]">
                              <p>1. <strong>Refleksi:</strong> {generatedData.langkah_langkah?.penutup?.refleksi || "-"}</p>
                              <p>2. <strong>Tindak Lanjut:</strong> {generatedData.langkah_langkah?.penutup?.tindak_lanjut || "-"}</p>
                              <p>3. <strong>Penutup:</strong> {generatedData.langkah_langkah?.penutup?.penutup_doa || "-"}</p>
                            </div>
                          </div>
                        </td>
                      </tr>

                      <tr className="bg-sky-500 text-white">
                        <td colSpan={2} className="p-4 border-2 border-sky-200 text-center font-black uppercase text-lg tracking-widest">H. ASESMEN PEMBELAJARAN</td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">1. ASESMEN DIAGNOSTIK</td>
                        <td className="p-4 border-2 border-sky-100">
                          <p><strong>a. Praktik:</strong> {generatedData.asesmen?.diagnostik?.praktik || "-"}</p>
                          <p><strong>b. Observasi:</strong> {generatedData.asesmen?.diagnostik?.obs || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">2. ASESMEN FORMATIF</td>
                        <td className="p-4 border-2 border-sky-100">
                          <p><strong>b. Tugas:</strong> {generatedData.asesmen?.formatif?.tugas || "-"}</p>
                          <p><strong>c. Penilaian:</strong> {generatedData.asesmen?.formatif?.penilaian || "-"}</p>
                          <p><strong>d. Observasi:</strong> {generatedData.asesmen?.formatif?.obs || "-"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-2 border-sky-100 font-bold bg-sky-50 text-sky-800">3. ASESMEN SUMATIF</td>
                        <td className="p-4 border-2 border-sky-100 grayscale-0">
                          <p><strong>a. Produk (Proyek):</strong> - </p>
                          <p><strong>b. Tugas:</strong> {generatedData.asesmen?.sumatif?.tugas || "-"}</p>
                          <p><strong>c. Penilaian:</strong> {generatedData.asesmen?.sumatif?.penilaian || "-"}</p>
                          <p><strong>d. Praktik (Kinerja):</strong> {generatedData.asesmen?.sumatif?.praktik_kinerja || "-"}</p>
                          <p><strong>e. Tugas:</strong> {generatedData.asesmen?.sumatif?.tugas || "-"}</p>
                          <p><strong>f. Penilaian:</strong> {generatedData.asesmen?.sumatif?.penilaian_kinerja || "-"}</p>
                          <p><strong>g. Tes Tertulis:</strong> {generatedData.asesmen?.sumatif?.tes_tertulis || "-"}</p>
                        </td>
                      </tr>

                    </tbody>
                  </table>

                  <div className="mt-24 flex justify-between px-8">
                    <div className="space-y-1">
                      <p>Mengetahui,</p>
                      <p>Kepala Sekolah</p>
                      <div className="h-24" />
                      <p className="font-bold">..........................................</p>
                      <p>NIP. ................................</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p>............, ......................... 20..</p>
                      <p>Guru Mata Pelajaran</p>
                      <div className="h-24" />
                      <p className="font-bold underline">..........................................</p>
                      <p>NIP. ................................</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20 px-10 text-center">
                  <div className="bg-slate-50 p-6 rounded-full mb-6">
                    <BookOpen className="w-12 h-12" />
                  </div>
                  <h4 className="text-slate-900 font-bold text-lg">Belum Ada Konten</h4>
                  <p className="text-sm max-w-xs mt-2 font-medium">Klik tombol <span className="text-blue-600 font-bold">Generate</span> di sebelah kiri untuk membuat modul pembelajaran baru.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
