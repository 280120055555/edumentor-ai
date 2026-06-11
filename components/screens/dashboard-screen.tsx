"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  BookOpen, Target, AlertCircle,
  CheckCircle2, Clock, Sparkles, GraduationCap,
  TrendingUp, Zap, Brain
} from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY

// ─── Animated counter ────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const step = Math.ceil(value / 30)
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(start)
    }, 30)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}{suffix}</span>
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const score = payload[0].value
    const color = score >= 90 ? "#22c55e" : score >= 75 ? "#3b82f6" : score >= 60 ? "#f59e0b" : "#ef4444"
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs">
        <p className="font-bold text-foreground mb-1">{label}</p>
        <p style={{ color }} className="font-semibold text-sm">{score} баллов</p>
        <p className="text-muted-foreground mt-0.5">
          {score >= 90 ? "🏆 Отлично" : score >= 75 ? "✅ Хорошо" : score >= 60 ? "⚠️ Удовл." : "❌ Риск"}
        </p>
      </div>
    )
  }
  return null
}

// ─── EduBot ───────────────────────────────────────────────────────────────
const GREETINGS: Record<string, string> = {
  ru: "Привет! Нажми кнопку — дам реальный совет 🎓",
  kz: "Сәлем! Батырманы бас — нақты кеңес беремін 🎓",
  en: "Hi! Press a button — I'll give real advice 🎓",
}

const BTNS: Record<string, string[]> = {
  ru: ["💡 Совет", "🔥 Мотивация", "⚠️ Предупреди", "🎉 Похвали"],
  kz: ["💡 Кеңес", "🔥 Мотивация", "⚠️ Ескерт", "🎉 Мақта"],
  en: ["💡 Tip", "🔥 Motivate", "⚠️ Warn me", "🎉 Praise"],
}

const MOODS = ["😊", "🤔", "😤", "🎉", "😮", "🧐", "😄"]

function EduBot({ language = "ru", userName = "Студент", gpa = 0, weakSubject = "" }) {
  const [bubble, setBubble] = useState(GREETINGS[language] || GREETINGS.ru)
  const [displayBubble, setDisplayBubble] = useState(GREETINGS[language] || GREETINGS.ru)
  const [loading, setLoading] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const [mood, setMood] = useState("😊")
  const [isTyping, setIsTyping] = useState(false)
  const [bounce, setBounce] = useState(false)

  useEffect(() => { setBubble(GREETINGS[language] || GREETINGS.ru) }, [language])

  // Побуквенная анимация текста
  useEffect(() => {
    if (!bubble) return
    setIsTyping(true)
    setDisplayBubble("")
    let i = 0
    const timer = setInterval(() => {
      setDisplayBubble(bubble.slice(0, i + 1))
      i++
      if (i >= bubble.length) { clearInterval(timer); setIsTyping(false) }
    }, 18)
    return () => clearInterval(timer)
  }, [bubble])

  const animateMouth = () => {
    let i = 0
    const iv = setInterval(() => {
      setMouthOpen(p => !p)
      i++
      if (i > 12) { clearInterval(iv); setMouthOpen(false) }
    }, 120)
  }

  const triggerBounce = () => {
    setBounce(true)
    setTimeout(() => setBounce(false), 600)
  }

  const ask = async (idx: number) => {
    if (loading) return
    setLoading(true)
    setMood(MOODS[Math.floor(Math.random() * MOODS.length)])
    triggerBounce()

    const langName: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" }
    const ctx = [
      gpa ? `GPA: ${gpa}` : "",
      weakSubject ? `Слабый предмет: ${weakSubject}` : "",
      `Студент: ${userName}`
    ].filter(Boolean).join(". ")

    const types = [
      "конкретный практический совет по учёбе",
      "мотивирующее сообщение",
      "главный риск который нужно срочно исправить",
      "искреннюю похвалу за старания"
    ]

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 120,
          messages: [
            {
              role: "system",
              content: `Ты EduBot — живой мультяшный помощник студента. Отвечай ТОЛЬКО на ${langName[language] || "русском"} языке. Максимум 2 предложения. Без markdown. Будь конкретным и живым.`
            },
            { role: "user", content: `Дай ${types[idx]} для студента. ${ctx}` }
          ]
        })
      })
      const data = await res.json()
      setBubble(data.choices?.[0]?.message?.content?.trim() || GREETINGS[language])
      animateMouth()
    } catch {
      setBubble(GREETINGS[language])
    } finally {
      setLoading(false)
    }
  }

  const mouth = mouthOpen ? "M 46 64 Q 60 78 74 64" : "M 48 64 Q 60 71 72 64"
  const btns = BTNS[language] || BTNS.ru

  const botStyle: React.CSSProperties = {
    animation: bounce
      ? "eb-bounce 0.5s ease"
      : "eb-float 3s ease-in-out infinite",
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes eb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes eb-bounce{0%{transform:scale(1)}30%{transform:scale(1.15) rotate(-5deg)}60%{transform:scale(0.95)}100%{transform:scale(1)}}
        @keyframes eb-wave{0%,100%{transform:rotate(0deg)}30%{transform:rotate(28deg)}70%{transform:rotate(-10deg)}}
        @keyframes eb-blink{0%,82%,100%{transform:scaleY(1)}88%{transform:scaleY(0.06)}}
        @keyframes eb-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .eb-arm{transform-origin:92px 88px;animation:eb-wave 1.6s ease-in-out infinite}
        .eb-eL{transform-origin:48px 50px;animation:eb-blink 3.8s ease-in-out infinite}
        .eb-eR{transform-origin:72px 50px;animation:eb-blink 3.8s ease-in-out infinite .4s}
      `}</style>

      {/* Настроение */}
      <div className="text-lg">{mood}</div>

      {/* Пузырь */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3 text-xs text-foreground w-full text-center leading-relaxed min-h-[56px] flex items-center justify-center shadow-sm">
        {loading
          ? <div className="flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-primary" />
              <span className="text-muted-foreground">Думаю...</span>
            </div>
          : <span>{displayBubble}{isTyping && <span className="animate-pulse">|</span>}</span>
        }
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-200 dark:border-t-blue-800" />
      </div>

      {/* SVG персонаж */}
      <div style={botStyle}>
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
          <ellipse cx="44" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.6"/>
          <ellipse cx="76" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.6"/>
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
            className="px-2 py-2 rounded-xl border border-primary/20 bg-background text-primary text-[11px] font-medium hover:bg-primary hover:text-white hover:scale-105 transition-all shadow-sm disabled:opacity-40 active:scale-95"
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

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, suffix = "", icon: Icon, gradient, trend
}: {
  label: string; value: number; suffix?: string
  icon: any; gradient: string; trend?: string
}) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden">
      <CardContent className="p-0">
        <div className={`h-1.5 w-full ${gradient}`} />
        <div className="p-5 flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${gradient} bg-opacity-10`}>
            <Icon size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <h3 className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={value} suffix={suffix} />
            </h3>
            {trend && <p className="text-[10px] text-muted-foreground mt-0.5">{trend}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Главный экран ─────────────────────────────────────────────────────────
export function DashboardScreen() {
  const { setScreen } = useNavigation()
  const { t, language } = useLanguage()
  const [userName, setUserName] = useState("Студент")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [studyPlan, setStudyPlan] = useState<DayPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeBar, setActiveBar] = useState<number | null>(null)

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
  const topSubject     = subjects.length > 0 ? [...subjects].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] : null

  const getBarColor = (score: number) => {
    if (score >= 90) return "#22c55e"
    if (score >= 75) return "#3b82f6"
    if (score >= 60) return "#f59e0b"
    return "#ef4444"
  }

  const chartData = subjects.filter(s => s?.name).map(s => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
    score: s.score ?? 0,
    fill: getBarColor(s.score ?? 0),
  }))

  const gradeDistribution = [
    { grade: "A (90+)", count: subjects.filter(s => s.score >= 90).length, color: "#22c55e" },
    { grade: "B (80-89)", count: subjects.filter(s => s.score >= 80 && s.score < 90).length, color: "#3b82f6" },
    { grade: "C (60-79)", count: subjects.filter(s => s.score >= 60 && s.score < 80).length, color: "#f59e0b" },
    { grade: "F (<60)", count: subjects.filter(s => s.score < 60).length, color: "#ef4444" },
  ].filter(g => g.count > 0)

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
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20">
        <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute right-16 bottom-0 w-20 h-20 bg-primary/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {t("dashboard.welcome")}, {userName}! <span className="animate-bounce inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjects.length === 0 ? t("dashboard.noSubjects") : t("dashboard.hasTasks")}
          </p>
          {averageScore > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
                averageScore >= 85 ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" :
                averageScore >= 70 ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" :
                "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}>
                {averageScore >= 85 ? "🏆 Отличный результат!" : averageScore >= 70 ? "📈 Хороший прогресс" : "💪 Есть куда расти"}
              </div>
            </div>
          )}
        </div>
        <Button onClick={() => setScreen("ai-mentor")} className="gap-2 shadow-md shrink-0 relative">
          <Sparkles size={16} /> {t("dashboard.askMentor")}
        </Button>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.avgScore")}
          value={averageScore}
          suffix="%"
          icon={GraduationCap}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          trend={averageScore >= 85 ? "↑ Выше среднего" : "→ Средний уровень"}
        />
        <StatCard
          label={t("dashboard.weakTopicsCount")}
          value={allWeakTopics.length}
          icon={AlertCircle}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          trend={allWeakTopics.length > 0 ? `По ${subjects.filter(s => s.weak?.length).length} предметам` : "Всё под контролем"}
        />
        <StatCard
          label={t("dashboard.credits")}
          value={totalCredits}
          icon={BookOpen}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          trend={`${subjects.length} дисциплин`}
        />
        <Card className="border-border/60 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden">
          <CardContent className="p-0">
            <div className="h-1.5 w-full bg-gradient-to-br from-emerald-500 to-teal-600" />
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Target size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("dashboard.studyPlan")}</p>
                  <p className="text-2xl font-bold text-foreground"><AnimatedNumber value={taskProgress} suffix="%" /></p>
                </div>
              </div>
              <Progress value={taskProgress} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{completedTasks}/{allTasks.length} задач</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Нижняя сетка */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* График + распределение */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Основной график */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  {t("dashboard.chartTitle")}
                </CardTitle>
                {topSubject && (
                  <span className="text-xs text-muted-foreground">
                    🏆 Лучший: <span className="text-primary font-medium">{topSubject.name.slice(0, 15)}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? (
                <div className="h-[220px] flex flex-col items-center justify-center text-center gap-3">
                  <Brain size={36} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                  <Button variant="outline" size="sm" onClick={() => setScreen("subjects")}>
                    {t("subjects.importBtn")}
                  </Button>
                </div>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onMouseLeave={() => setActiveBar(null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                      <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}
                        onMouseEnter={(_, idx) => setActiveBar(idx)}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.fill}
                            opacity={activeBar === null || activeBar === i ? 1 : 0.5}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Распределение оценок */}
          {gradeDistribution.length > 0 && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-primary" /> Распределение оценок
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {gradeDistribution.map((g, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div
                        className="w-full rounded-lg py-3 mb-1 text-white font-bold text-sm"
                        style={{ backgroundColor: g.color }}
                      >
                        {g.count}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{g.grade}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Правая колонка */}
        <div className="flex flex-col gap-4">

          {/* EduBot */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                🤖 EduBot
                <Badge variant="secondary" className="text-[10px]">AI</Badge>
                <span className="ml-auto text-[10px] text-muted-foreground">Groq</span>
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
                  <Clock size={14} className="text-primary" /> {t("dashboard.upcomingTasks")}
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
                  <CheckCircle2 size={28} className="text-success mb-2" />
                  <p className="text-sm font-medium">{t("dashboard.allDone")}</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {upcomingTasks.map((task, idx) => (
                    <div key={task.id}
                      className="px-4 py-3 hover:bg-muted/30 transition-colors"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
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
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setScreen("study-plan")}>
                    Посмотреть все →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
