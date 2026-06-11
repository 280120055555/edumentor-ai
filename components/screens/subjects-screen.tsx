"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, TrendingDown, Minus, BookOpen,
  Plus, Sparkles, Loader2, Trash2, FileUp, FileText, X
} from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY

interface Subject {
  code?: string
  name: string
  credits: number
  att1: number
  att2: number
  exam: number
  score: number
  grade: string
  trend: "up" | "down" | "stable"
  weak: string[]
  semester?: number
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

const getScoreColor = (score: number) => {
  if (score >= 90) return "oklch(0.65 0.17 145)"
  if (score >= 80) return "oklch(0.62 0.15 240)"
  if (score >= 70) return "oklch(0.75 0.15 70)"
  return "oklch(0.577 0.245 27.325)"
}

// ─── Загружаем скрипт динамически ─────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`))
    document.head.appendChild(script)
  })
}

// ─── Читаем PDF через pdf.js (CDN) ────────────────────────────────────────
async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
        if (!(window as any).pdfjsLib) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js")
          ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
        }
        const pdfjsLib = (window as any).pdfjsLib
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
        let fullText = ""
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items.map((item: any) => item.str).join(" ") + "\n"
        }
        resolve(fullText.trim())
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── Читаем PPTX через JSZip (CDN) ────────────────────────────────────────
async function extractTextFromPPTX(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        if (!(window as any).JSZip) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")
        }
        const JSZip = (window as any).JSZip
        const zip = await JSZip.loadAsync(e.target?.result as ArrayBuffer)

        // Слайды хранятся в ppt/slides/slide1.xml, slide2.xml и т.д.
        const slideFiles = Object.keys(zip.files)
          .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
          .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)?.[0] || "0")
            const nb = parseInt(b.match(/\d+/)?.[0] || "0")
            return na - nb
          })

        let fullText = ""
        for (const slideFile of slideFiles) {
          const xml = await zip.files[slideFile].async("string")
          // Извлекаем текст из тегов <a:t>...</a:t>
          const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || []
          const slideText = matches
            .map((m: string) => m.replace(/<[^>]+>/g, ""))
            .join(" ")
          fullText += slideText + "\n"
        }

        resolve(fullText.trim())
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function SubjectsScreen() {
  const { t, language } = useLanguage()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileStatus, setFileStatus] = useState("")
  const [selectedSemester, setSelectedSemester] = useState<number | "all">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSubjects = async () => {
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid))
        if (snap.exists() && snap.data().subjects) {
          setSubjects(snap.data().subjects.filter((s: any) => s && typeof s.name === "string"))
        }
      }
      setIsLoading(false)
    }
    fetchSubjects()
  }, [])

  const saveSubjectsToDb = async (newSubjects: Subject[]) => {
    if (!auth.currentUser) return
    await updateDoc(doc(db, "users", auth.currentUser.uid), { subjects: newSubjects })
    setSubjects(newSubjects)
  }

  // ─── Загрузка файла (PDF или PPTX) ───────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf")
    const isPptx = file.name.endsWith(".pptx") || file.type.includes("presentationml")

    if (!isPdf && !isPptx) {
      alert("Поддерживаются только PDF и PPTX файлы")
      return
    }

    setUploadedFile(file)
    setFileStatus(isPptx ? "Читаю презентацию..." : "Читаю PDF...")

    try {
      const text = isPptx
        ? await extractTextFromPPTX(file)
        : await extractTextFromPDF(file)

      if (text.length < 50) {
        setFileStatus("⚠️ Файл не содержит текста. Скопируйте текст вручную.")
        return
      }

      setImportText(text.slice(0, 8000))
      setFileStatus(`✅ Прочитано ${file.name} (${Math.round(text.length / 1000)}к символов)`)
    } catch (err) {
      setFileStatus("❌ Ошибка чтения файла. Попробуйте скопировать текст вручную.")
      console.error(err)
    }
  }

  // ─── AI парсинг ───────────────────────────────────────────────────────────
  const handleAiImport = async () => {
    if (!importText.trim()) return
    setIsAiProcessing(true)

    const langNames: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" }
    const promptLanguage = langNames[language] || "русском"

    const systemPrompt = `Ты умный парсер учебного плана Satbayev University (Казахстан).
    
Пользователь пришлёт текст из РУП (учебного плана) или ИУП (индивидуального плана с оценками).

ЗАДАЧА: Извлеки все учебные дисциплины и верни ТОЛЬКО JSON массив.

Если это РУП (нет оценок) — сгенерируй реалистичные баллы для студента.
Если это ИУП (есть оценки) — используй реальные баллы из документа.

ВЕРНИ ТОЛЬКО МАССИВ JSON (без markdown, без объяснений):
[
  {
    "code": "CSE178",
    "name": "Название на ${promptLanguage} языке",
    "credits": 5,
    "semester": 1,
    "att1": 25,
    "att2": 24,
    "exam": 36,
    "score": 85,
    "grade": "B",
    "trend": "up",
    "weak": ["сложная тема 1 на ${promptLanguage}"]
  }
]

Правила оценок: A=90-100, B=80-89, C+=75-79, C=70-74, D+=65-69, D=60-64, F<60
att1 макс 30, att2 макс 30, exam макс 40
trend: up/down/stable случайно
weak: 1-2 реальные сложные темы по предмету на ${promptLanguage} языке`

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 4000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Вот текст учебного плана:\n\n${importText}` },
          ],
        }),
      })

      if (!res.ok) throw new Error("Ошибка API")

      const data = await res.json()
      let raw = data.choices[0].message.content.trim()
      raw = raw.replace(/```json/g, "").replace(/```/g, "").trim()

      const startIdx = raw.indexOf("[")
      const endIdx = raw.lastIndexOf("]")
      if (startIdx !== -1 && endIdx !== -1) {
        raw = raw.slice(startIdx, endIdx + 1)
      }

      const parsed: Subject[] = JSON.parse(raw)

      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((s: any) => s && typeof s.name === "string")
        await saveSubjectsToDb([...subjects, ...valid])
        setShowImportModal(false)
        setImportText("")
        setUploadedFile(null)
        setFileStatus("")
      } else {
        alert(t("subjects.errorEmpty"))
      }
    } catch (err) {
      console.error(err)
      alert(t("subjects.errorApi"))
    } finally {
      setIsAiProcessing(false)
    }
  }

  const handleDelete = async (idx: number) => {
    await saveSubjectsToDb(subjects.filter((_, i) => i !== idx))
  }

  const closeModal = () => {
    setShowImportModal(false)
    setUploadedFile(null)
    setFileStatus("")
    setImportText("")
  }

  // ─── Фильтрация по семестру ───────────────────────────────────────────────
  const semesters = [...new Set(subjects.map(s => s.semester).filter(Boolean))].sort() as number[]
  const filteredSubjects = selectedSemester === "all"
    ? subjects
    : subjects.filter(s => s.semester === selectedSemester)

  const chartData = filteredSubjects.filter(s => s?.name).map(s => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name,
    score: s.score ?? 0,
  }))

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10">

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("subjects.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subjects.subtitle")}</p>
        </div>
        <Button onClick={() => setShowImportModal(true)} className="gap-2 shadow-md">
          <Sparkles size={16} /> {t("subjects.aiImportBtn")}
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} />
          </div>
          <h3 className="text-lg font-bold">{t("subjects.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">{t("subjects.emptyDesc")}</p>
          <Button onClick={() => setShowImportModal(true)} className="gap-2">
            <Plus size={16} /> {t("subjects.importBtn")}
          </Button>
        </Card>
      ) : (
        <>
          {/* Фильтр по семестру */}
          {semesters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSemester("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedSemester === "all" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                Все семестры
              </button>
              {semesters.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSemester(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedSemester === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  {s} семестр
                </button>
              ))}
            </div>
          )}

          {/* График */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{t("subjects.chartTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={getScoreColor(filteredSubjects[i]?.score ?? 0)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Карточки предметов */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredSubjects.map((subject, i) => (
              <Card key={i} className="border-border/60 bg-card shadow-sm hover:shadow-md group relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {subject.code && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded uppercase">{subject.code}</span>
                        )}
                        {subject.semester && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">{subject.semester} сем.</span>
                        )}
                        <h3 className="text-sm font-bold text-foreground leading-tight">{subject.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{subject.credits || 5} {t("subjects.credits")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <TrendIcon trend={subject.trend} />
                      <Badge variant="secondary" className={
                        subject.score >= 90 ? "bg-success/10 text-success" :
                        subject.score >= 80 ? "bg-primary/10 text-primary" :
                        subject.score >= 70 ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }>
                        {subject.grade} ({subject.score})
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 mb-3">
                    {[
                      { label: t("subjects.att1"), val: subject.att1, max: 30 },
                      { label: t("subjects.att2"), val: subject.att2, max: 30 },
                      { label: t("subjects.exam"), val: subject.exam, max: 40, highlight: true },
                    ].map((item, j) => (
                      <div key={j} className={`flex flex-col border rounded-lg p-2 text-center ${item.highlight ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border/50"}`}>
                        <span className={`text-[9px] uppercase font-semibold ${item.highlight ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                        <span className="text-xs font-bold text-foreground">{item.val || 0} / {item.max}</span>
                      </div>
                    ))}
                  </div>

                  <Progress value={subject.score} className="h-1.5" />

                  {subject.weak?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground mr-1">{t("subjects.weakTopics")}</span>
                      {subject.weak.map((topic, j) => (
                        <Badge key={j} variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive text-[10px] font-normal">{topic}</Badge>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleDelete(subjects.indexOf(subject))}
                    className="absolute bottom-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Удалить предмет"
                  >
                    <Trash2 size={16} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ─── Модальное окно импорта ──────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-2xl p-6 shadow-2xl border-border/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="text-primary" size={20} /> {t("subjects.modalTitle")}
              </h2>
              <button onClick={closeModal} aria-label="Закрыть">
                <X size={20} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Загрузка файла */}
            <div
              className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all mb-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx"
                className="hidden"
                onChange={handleFileSelect}
                aria-label="Загрузить PDF или PPTX файл"
              />
              {uploadedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={24} className="text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fileStatus}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileUp size={28} className="text-primary/60" />
                  <p className="text-sm font-semibold text-foreground">Загрузить РУП или ИУП</p>
                  <p className="text-xs text-muted-foreground">Нажмите или перетащите файл сюда</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">PDF</Badge>
                    <Badge variant="outline" className="text-[10px]">PPTX</Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">или вставьте текст вручную</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <p className="text-sm text-muted-foreground mb-3">{t("subjects.modalDesc")}</p>

            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={t("subjects.modalPlaceholder")}
              className="w-full h-36 p-3 rounded-lg border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary/50 text-sm resize-none outline-none font-mono"
              disabled={isAiProcessing}
            />

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={closeModal} disabled={isAiProcessing}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAiImport} disabled={!importText.trim() || isAiProcessing} className="gap-2 min-w-40 shadow-md">
                {isAiProcessing
                  ? <><Loader2 className="animate-spin" size={16} /> {t("subjects.modalParsing")}</>
                  : <><Sparkles size={16} /> {t("subjects.importBtn")}</>}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
