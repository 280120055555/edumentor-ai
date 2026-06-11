"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  BookOpen, Target, TrendingUp, AlertCircle,
  CheckCircle2, Clock, Sparkles, GraduationCap
} from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY

// ─── Встроенный EduBot ────────────────────────────────────────────────────
const GREETINGS: Record<string, string> = {
  ru: "Привет! Нажми кнопку — дам реальный совет 🎓",
  kz: "Сәлем! Батырманы бас — нақты кеңес беремін 🎓",
  en: "Hi! Press a button — I'll give real advice 🎓",
}

const BTNS: Record<string, string[]> = {
  ru: ["💡 Совет", "🔥 Мотивация", "⚠️ Предупреди", "🎉 Похвали"],
  kz: ["💡 Кеңес", "🔥 Мотивация", "⚠️ Ескерт",    "🎉 Мақта"],
  en: ["💡 Tip",   "🔥 Motivate",   "⚠️ Warn me",  "🎉 Praise"],
}

function EduBot({ language = "ru", userName = "Студент", gpa = 0, weakSubject = "" }) {
  const [bubble, setBubble] = useState(GREETINGS[language] || GREETINGS.ru)
  const [loading, setLoading] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)

  useEffect(() => { setBubble(GREETINGS[language] || GREETINGS.ru) }, [language])

  const animateMouth = () => {
    let i = 0
    const iv = setInterval(() => {
      setMouthOpen(p => !p)
      i++
      if (i > 8) { clearInterval(iv); setMouthOpen(false) }
    }, 140)
  }

  const ask = async (idx: number) => {
    if (loading) return
    setLoading(true)
    const langName: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" }
    const ctx = [gpa ? `GPA: ${gpa}` : "", weakSubject ? `Слабый предмет: ${weakSubject}` : "", `Студент: ${userName}`].filter(Boolean).join(". ")
    const types = ["совет по учёбе", "мотивирующее сообщение", "главный риск который нужно срочно исправить", "похвала за старания"]
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 100,
          messages: [
            { role: "system", content: `Ты EduBot — мультяшный помощник студента. Отвечай ТОЛЬКО на ${langName[language] || "русском"} языке. Максимум 2 предложения. Без markdown.` },
            { role: "user", content: `Дай ${types[idx]} для студента. ${ctx}` }
          ]
        })
      })
      const data = await res.json()
      setBubble(data.choices?.[0]?.message?.content?.trim() || GREETINGS[language])
      animateMouth()
    } catch { setBubble(GREETINGS[language]) }
    finally { setLoading(false) }
  }

  const mouth = mouthOpen ? "M 48 64 Q 60 75 72 64" : "M 48 64 Q 60 70 72 64"
  const btns = BTNS[language] || BTNS.ru

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Пузырь */}
      <div className="relative bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 text-xs text-foreground w-full text-center leading-relaxed min-h-[52px] flex items-center justify-center">
        {loading ? <Loader2 size={14} className="animate-spin text-primary" /> : bubble}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary/20" />
      </div>

      {/* SVG персонаж */}
      <div style={{ animation: "eb-float 3s ease-in-out infinite" }}>
        <style>{`
          @keyframes eb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
          @keyframes eb-wave{0%,100%{transform:rotate(0deg)}30%{transform:rotate(24deg)}70%{transform:rotate(-8deg)}}
          @keyframes eb-blink{0%,85%,100%{transform:scaleY(1)}90%{transform:scaleY(0.08)}}
          .eb-arm{transform-origin:92px 88px;animation:eb-wave 1.8s ease-in-out infinite}
          .eb-eL{transform-origin:48px 50px;animation:eb-blink 4.2s ease-in-out infinite}
          .eb-eR{transform-origin:72px 50px;animation:eb-blink 4.2s ease-in-out infinite .3s}
        `}</style>
        <svg width="96" height="118" viewBox="0 0 120 140">
          <ellipse cx="60" cy="96" rx="28" ry="32" fill="#1d4ed8"/>
          <ellipse cx="60" cy="69" rx="22" ry="8" fill="#1e40af"/>
          <circle cx="60" cy="50" r="28" fill="#fde68a"/>
          <rect x="34" y="26" width="52" height="7" rx="3" fill="#1e293b"/>
          <rect x="44" y="14" width="32" height="14" rx="3" fill="#1e293b"/>
          <rect x="72" y="12" width="3" height="8" fill="#1e293b"/>
          <circle cx="73" cy="11" r="4" fill="#ef4444"/>
          <ellipse className="eb-eL" cx="48" cy="50" rx="5" ry="6" fill="white"/>
          <ellipse className="eb-eR" cx="72" cy="50" rx="5" ry="6" fill="white"/>
          <circle cx="49" cy="51" r="3" fill="#1e293b"/>
          <circle cx="73" cy="51" r="3" fill="#1e293b"/>
          <circle cx="50" cy="50" r="1" fill="white"/>
          <circle cx="74" cy="50" r="1" fill="white"/>
          <ellipse cx="60" cy="57" rx="3" ry="2" fill="#f59e0b"/>
          <path d={mouth} stroke="#92400e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="44" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.5"/>
          <ellipse cx="76" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.5"/>
          <ellipse cx="28" cy="91" rx="9" ry="18" fill="#1d4ed8" transform="rotate(-15 28 91)"/>
          <ellipse className="eb-arm" cx="92" cy="89" rx="9" ry="18" fill="#1d4ed8" transform="rotate(15 92 89)"/>
          <circle cx="22" cy="104" r="8" fill="#fde68a"/>
          <circle cx="98" cy="101" r="8" fill="#fde68a"/>
          <rect x="10" y="96" width="18" height="22" rx="2" fill="#ef4444"/>
          <line x1="10" y1="107" x2="28" y2="107" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          <line x1="10" y1="112" x2="28" y2="112" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          <rect x="44" y="123" width="14" height="13" rx="5" fill="#1e293b"/>
          <rect x="62" y="123" width="14" height="13" rx="5" fill="#1e293b"/>
        </svg>
      </div>

      {/* Кнопки */}
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {btns.map((label, i) => (
          <button
            key={i}
            onClick={() => ask(i)}
            disabled={loading}
            className="px-2 py-1.5 rounded-xl border border-primary/20 bg-background text-primary text-[11px] font-medium hover:bg-primary hover:text-white transition-all shadow-sm disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Типы ──────────────────────────────────────────────────────────────────
interface Subject { name: string; credits: number; score: number; grade: string; weak?: string[] }
interface Task { id: string; topic: string; time: string; subject: string; done: boolean }
interface DayPlan { day: string; date: string; tasks: Task[] }

// ─── Главный экран ─────────────────────────────────────────────────────────
export function DashboardScreen() {
  const { setScreen } = useNavigation()
  const { t, language } = useLanguage()
  const [userName, setUserName] = useState("Студент")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [studyPlan, setStudyPlan] = useState<DayPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid))
        if (snap.exists()) {
          const data = snap.data()
          if (data.firstName) setUserName(data.firstName)
          if (data.subjects) setSubjects(data.subjects.filter((s: any) => s && typeof s.name === "string"))
          if (data.studyPlan) setStudyPlan(data.studyPlan)
        }
      }
      setIsLoading(false)
    }
    fetchDashboardData()
  }, [])

  const averageScore   = subjects.length > 0 ? Math.round(subjects.reduce((a, s) => a + (s.score ?? 0), 0) / subjects.length) : 0
  const totalCredits   = subjects.reduce((a, s) => a + (s.credits ?? 0), 0)
  const allTasks       = studyPlan.flatMap(d => d.tasks)
  const completedTasks = allTasks.filter(t => t.done).length
  const taskProgress   = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0
  const allWeakTopics  = subjects.flatMap(s => s.weak || [])
  const upcomingTasks  = allTasks.filter(t => !t.done).slice(0, 4)
  const weakSubject    = subjects.length > 0 ? [...subjects].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]?.name : ""

  const chartData = subjects.filter(s => s?.name).map(s => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
    score: s.score ?? 0
  }))

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Sparkles className="animate-spin" size={20} /> {t("common.loading")}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-8">

      {/* Приветствие */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {t("dashboard.welcome")}, {userName}! <span className="animate-bounce inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjects.length === 0 ? t("dashboard.noSubjects") : t("dashboard.hasTasks")}
          </p>
        </div>
        <Button onClick={() => setScreen("ai-mentor")} className="gap-2 shadow-md shrink-0">
          <Sparkles size={16} /> {t("dashboard.askMentor")}
        </Button>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("dashboard.avgScore"), value: `${averageScore}%`, icon: GraduationCap, color: "primary" },
          { label: t("dashboard.weakTopicsCount"), value: allWeakTopics.length, icon: AlertCircle, color: "warning" },
          { label: t("dashboard.credits"), value: totalCredits, icon: BookOpen, color: "muted" },
        ].map((c, i) => (
          <Card key={i} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-${c.color}/10 text-${c.color}`}>
                <c.icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <h3 className="text-2xl font-bold text-foreground">{c.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <Target size={24} />
            </div>
            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.studyPlan")}</p>
                <span className="text-xs font-bold text-success">{taskProgress}%</span>
              </div>
              <Progress value={taskProgress} className="h-2 bg-success/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Нижняя сетка */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* График */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.chartTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                <Button variant="outline" size="sm" onClick={() => setScreen("subjects")}>
                  {t("subjects.importBtn")}
                </Button>
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}/>
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Правая колонка: EduBot + задачи */}
        <div className="flex flex-col gap-4">

          {/* EduBot */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                🤖 EduBot
                <Badge variant="secondary" className="text-[10px]">AI</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <EduBot
                language={language}
                userName={userName}
                gpa={averageScore}
                weakSubject={weakSubject}
              />
            </CardContent>
          </Card>

          {/* Ближайшие задачи */}
          <Card className="border-border/60 shadow-sm flex-1">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-primary"/> {t("dashboard.upcomingTasks")}
                </CardTitle>
                {upcomingTasks.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{upcomingTasks.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                  <p className="text-sm text-muted-foreground">{t("studyPlan.emptyTitle")}</p>
                  <Button variant="outline" size="sm" onClick={() => setScreen("study-plan")}>
                    {t("studyPlan.generateBtn")}
                  </Button>
                </div>
              ) : upcomingTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <CheckCircle2 size={28} className="text-success mb-2"/>
                  <p className="text-sm font-medium">{t("dashboard.allDone")}</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {upcomingTasks.map(task => (
                    <div key={task.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{task.topic}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{task.time}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-background">{task.subject}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {upcomingTasks.length > 0 && (
                <div className="p-3 border-t border-border/50">
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setScreen("study-plan")}>→</Button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
