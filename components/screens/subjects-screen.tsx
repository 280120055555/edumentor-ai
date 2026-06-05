"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Minus, BookOpen, Plus, Sparkles, Loader2, Trash2 } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Subject {
  code?: string;
  name: string;
  credits: number;
  att1: number;
  att2: number;
  exam: number;
  score: number;
  grade: string;
  trend: "up" | "down" | "stable";
  weak: string[];
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

export function SubjectsScreen() {
  const { t, language } = useLanguage()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  useEffect(() => {
    const fetchSubjects = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists() && snap.data().subjects) {
          const raw = snap.data().subjects
          setSubjects(raw.filter((s: any) => s && typeof s.name === "string"))
        }
      }
      setIsLoading(false)
    }
    fetchSubjects()
  }, [])

  const saveSubjectsToDb = async (newSubjects: Subject[]) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, { subjects: newSubjects })
      setSubjects(newSubjects)
    } catch (error) {
      console.error("Ошибка сохранения РУП:", error)
    }
  }

  const handleAiImport = async () => {
    if (!importText.trim()) return;
    setIsAiProcessing(true);

    try {
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language as keyof typeof langNames] || "русском";

      const systemPrompt = `Ты умный парсер академических данных. Пользователь пришлет текст (РУП или таблица оценок).
      
      ВАЖНО: ВЕРНИ ТОЛЬКО МАССИВ JSON строго по формату, и переведи значения "name" и "weak" на ${promptLanguage} язык:
      [
        {
          "code": "Очищенный код предмета (например CSE562)", 
          "name": "Название дисциплины на ${promptLanguage} языке", 
          "credits": Извлеки кредиты (если их нет в тексте, ставь случайное от 3 до 5),
          "att1": Извлеки балл за 1 Атт (макс 30). Если нет - сгенерируй от 15 до 30,
          "att2": Извлеки балл за 2 Атт (макс 30). Если нет - сгенерируй от 15 до 30,
          "exam": Извлеки балл за Экзамен (макс 40). Если нет - сгенерируй от 20 до 40,
          "score": Сумма att1 + att2 + exam,
          "grade": "Извлеки букву или рассчитай по score (90-100:A, 80-89:B, 70-79:C, ниже: F)",
          "trend": "выбери случайно: up, down или stable",
          "weak": ["сгенерируй 1-2 названия сложных тем по предмету на ${promptLanguage} языке"]
        }
      ]
      Очищай коды от мусора.
      Не пиши ничего кроме JSON массива!`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: importText }
          ]
        })
      });

      if (!res.ok) throw new Error("Ошибка API");

      const data = await res.json();
      let rawJson = data.choices[0].message.content.trim();
      rawJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();

      const parsedSubjects: Subject[] = JSON.parse(rawJson);

      if (Array.isArray(parsedSubjects) && parsedSubjects.length > 0) {
        const valid = parsedSubjects.filter((s: any) => s && typeof s.name === "string")
        const combined = [...subjects, ...valid];
        await saveSubjectsToDb(combined);
        setShowImportModal(false);
        setImportText("");
      } else {
        alert(t("subjects.errorEmpty"));
      }

    } catch (error) {
      console.error("Ошибка парсинга:", error)
      alert(t("subjects.errorApi"))
    } finally {
      setIsAiProcessing(false);
    }
  }

  const handleDelete = async (indexToDelete: number) => {
    const updated = subjects.filter((_, i) => i !== indexToDelete);
    await saveSubjectsToDb(updated);
  }

  const gradeChartData = subjects
    .filter(s => s && s.name)
    .map(s => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + "..." : s.name,
      score: s.score ?? 0
    }))

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 relative max-w-6xl mx-auto w-full pb-10">

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
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("subjects.emptyDesc")}
          </p>
          <Button onClick={() => setShowImportModal(true)} className="gap-2">
            <Plus size={16} /> {t("subjects.importBtn")}
          </Button>
        </Card>
      ) : (
        <>
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">{t("subjects.chartTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {gradeChartData.map((entry, index) => (
                        <Cell key={index} fill={getScoreColor(subjects[index].score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {subjects.map((subject, i) => (
              <Card key={i} className="border-border/60 bg-card shadow-sm transition-all hover:shadow-md group relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1 pr-4">
                      <div className="flex items-center gap-2">
                        {subject.code && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded uppercase">
                            {subject.code}
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-foreground leading-tight">{subject.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{subject.credits || 5} {t("subjects.credits")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <TrendIcon trend={subject.trend} />
                      <Badge
                        variant="secondary"
                        className={
                          subject.score >= 90 ? "bg-success/10 text-success" :
                          subject.score >= 80 ? "bg-primary/10 text-primary" :
                          subject.score >= 70 ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive"
                        }
                      >
                        {subject.grade} ({subject.score})
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 mb-3">
                    <div className="flex flex-col border border-border/50 rounded-lg p-2 text-center bg-muted/10">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t("subjects.att1")}</span>
                      <span className="text-xs font-bold text-foreground">{subject.att1 || 0} / 30</span>
                    </div>
                    <div className="flex flex-col border border-border/50 rounded-lg p-2 text-center bg-muted/10">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold">{t("subjects.att2")}</span>
                      <span className="text-xs font-bold text-foreground">{subject.att2 || 0} / 30</span>
                    </div>
                    <div className="flex flex-col border border-border/50 rounded-lg p-2 text-center bg-primary/5 border-primary/20">
                      <span className="text-[9px] text-primary uppercase font-semibold">{t("subjects.exam")}</span>
                      <span className="text-xs font-bold text-foreground">{subject.exam || 0} / 40</span>
                    </div>
                  </div>

                  <Progress value={subject.score} className="h-1.5" />

                  {subject.weak && subject.weak.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground mr-1 flex items-center">{t("subjects.weakTopics")}</span>
                      {subject.weak.map((topic, j) => (
                        <Badge key={j} variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive text-[10px] font-normal">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleDelete(i)}
                    className="absolute bottom-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t("subjects.deleteTitle")}
                  >
                    <Trash2 size={16} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-2xl p-6 shadow-2xl border-border/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="text-primary" size={20} /> {t("subjects.modalTitle")}
              </h2>
              <button onClick={() => setShowImportModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {t("subjects.modalDesc")}
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t("subjects.modalPlaceholder")}
              className="w-full h-48 p-3 rounded-lg border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary/50 text-sm resize-none outline-none transition-all font-mono"
              disabled={isAiProcessing}
            />

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowImportModal(false)} disabled={isAiProcessing}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAiImport} disabled={!importText.trim() || isAiProcessing} className="gap-2 w-48 shadow-md">
                {isAiProcessing ? (
                  <><Loader2 className="animate-spin" size={16} /> {t("subjects.modalParsing")}</>
                ) : (
                  <><Sparkles size={16} /> {t("subjects.importBtn")}</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}