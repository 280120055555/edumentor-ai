"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertCircle,
  Loader2, Target, Zap, Activity, BarChart2, Network,
  ChevronRight, CheckCircle2, XCircle, Info
} from "lucide-react"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ScatterChart, Scatter, ZAxis, Cell,
  LineChart, Line, Legend, ReferenceLine
} from "recharts"

interface Subject {
  name: string; score: number; att1: number; att2: number;
  exam: number; credits: number; weak?: string[]; absences?: number; semester?: number
}

// ══════════════════════════════════════════════════════════════
// ML АЛГОРИТМЫ (с защитой от ошибок вычислений)
// ══════════════════════════════════════════════════════════════

// 1. Линейная регрессия (МНК) с защитой от деления на ноль
function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 }
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  
  const denominator = (n * sumX2 - sumX * sumX)
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  
  const meanY = sumY / n
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0)
  const ssRes = xs.reduce((s, x, i) => s + (ys[i] - (slope * x + intercept)) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

// 2. K-Means кластеризация
function kMeans(points: number[][], k: number, iters = 50) {
  let centroids = points.slice(0, k).map(p => [...p])
  let labels = new Array(points.length).fill(0)

  for (let it = 0; it < iters; it++) {
    labels = points.map(p => {
      let minDist = Infinity, best = 0
      centroids.forEach((c, ci) => {
        const d = Math.sqrt(p.reduce((s, x, i) => s + (x - c[i]) ** 2, 0))
        if (d < minDist) { minDist = d; best = ci }
      })
      return best
    })
    const newCentroids = Array.from({ length: k }, () => new Array(points[0].length).fill(0))
    const counts = new Array(k).fill(0)
    labels.forEach((l, i) => {
      points[i].forEach((x, j) => { newCentroids[l][j] += x })
      counts[l]++
    })
    centroids = newCentroids.map((c, ci) => c.map(v => counts[ci] > 0 ? v / counts[ci] : 0))
  }
  return { labels, centroids }
}

// 3. Нормализация данных (Z-score)
function zNormalize(data: number[]) {
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  const std = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / data.length) || 1
  return { normalized: data.map(x => (x - mean) / std), mean, std }
}

// 4. Экспоненциальное сглаживание (прогноз тренда)
function expSmoothing(data: number[], alpha = 0.4) {
  if (data.length === 0) return []
  const result = [data[0]]
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1])
  }
  const last = result[result.length - 1]
  const trend = data.length > 1 ? (data[data.length - 1] - data[0]) / data.length : 0
  result.push(Math.max(0, Math.min(100, last + trend)))
  return result
}

// 5. Оценка важности признаков с защитой от undefined
function featureImportance(subjects: Subject[]) {
  const features = [
    { name: "Аттестация 1", key: "att1" as keyof Subject, max: 30 },
    { name: "Аттестация 2", key: "att2" as keyof Subject, max: 30 },
    { name: "Экзамен",      key: "exam" as keyof Subject, max: 40 },
  ]
  return features.map(f => {
    const vals = subjects.map(s => Number(s[f.key] || 0) / f.max * 100)
    const scores = subjects.map(s => s.score || 0)
    const { r2 } = linearRegression(vals, scores)
    return { name: f.name, importance: Math.round(r2 * 100) }
  }).sort((a, b) => b.importance - a.importance)
}

// 6. Аномалии (IQR метод)
function detectAnomalies(data: number[]) {
  if (data.length < 4) return data.map(() => false)
  const sorted = [...data].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  return data.map(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr)
}

// 7. Персептрон (1-слойная нейросеть) с защитой от undefined
function trainPerceptron(subjects: Subject[]) {
  if (subjects.length < 3) return null

  const data = subjects.map(s => ({
    features: [(s.att1 || 0) / 30, (s.att2 || 0) / 30, (s.exam || 0) / 40, (s.score || 0) / 100],
    label: (s.score || 0) < 70 ? 1 : 0
  }))

  let w = [0.1, 0.2, 0.3, 0.15]
  let b = 0.1
  const lr = 0.1

  for (let epoch = 0; epoch < 100; epoch++) {
    data.forEach(({ features, label }) => {
      const pred = features.reduce((s, x, i) => s + x * w[i], b) > 0.5 ? 1 : 0
      const err = label - pred
      w = w.map((wi, i) => wi + lr * err * features[i])
      b += lr * err
    })
  }

  return (s: Subject) => {
    const f = [(s.att1 || 0) / 30, (s.att2 || 0) / 30, (s.exam || 0) / 40, (s.score || 0) / 100]
    const score = f.reduce((sum, x, i) => sum + x * w[i], b)
    return { risk: score > 0.5, confidence: Math.min(1, Math.abs(score - 0.5) * 2) }
  }
}

// ══════════════════════════════════════════════════════════════
// КОМПОНЕНТЫ
// ══════════════════════════════════════════════════════════════

const CLUSTER_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"]
const CLUSTER_LABELS = ["Отличники", "Хорошисты", "Средние", "В зоне риска"]

function MLBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      <Brain size={9} /> {label}
    </span>
  )
}

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ГЛАВНЫЙ ЭКРАН
// ══════════════════════════════════════════════════════════════

export function AIAnalysisScreen() {
  const { setScreen } = useNavigation()
  const { t } = useLanguage()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mlReady, setMlReady] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "ml" | "predict" | "neural">("overview")

  useEffect(() => {
    const fetch = async () => {
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid))
        if (snap.exists() && snap.data().subjects) {
          setSubjects(snap.data().subjects.filter((s: any) => s && s.name))
        }
      }
      setIsLoading(false)
      setTimeout(() => setMlReady(true), 800)
    }
    fetch()
  }, [])

  // ── Вычисления ML ──────────────────────────────────────────
  const scores = subjects.map(s => s.score || 0)
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  // Линейная регрессия: att1+att2 → итоговый балл
  const attSums = subjects.map(s => (s.att1 || 0) + (s.att2 || 0))
  const reg = linearRegression(attSums, scores)

  // Прогнозируемый балл если улучшить аттестации
  const predictedScore = Math.min(100, Math.max(0, Math.round(reg.slope * (attSums.reduce((a,b)=>a+b,0)/subjects.length * 1.1) + reg.intercept)))

  // K-Means кластеризация предметов (att, score)
  const clusterPoints = subjects.map(s => [
    ((s.att1 || 0) + (s.att2 || 0)) / 60 * 100,
    s.score || 0
  ])
  
  // Корректный выбор K для K-Means
  const k = Math.max(1, Math.min(subjects.length, 3))
  const { labels: clusterLabels } = clusterPoints.length >= k
    ? kMeans(clusterPoints, k)
    : { labels: clusterPoints.map(() => 0) }

  // Важность признаков
  const importance = subjects.length >= 3 ? featureImportance(subjects) : []

  // Аномалии
  const anomalies = detectAnomalies(scores)

  // Тренд
  const trendData = expSmoothing(scores)

  // Нейросеть — перцептрон
  const perceptron = subjects.length >= 3 ? trainPerceptron(subjects) : null
  const riskMap = perceptron ? subjects.map(s => perceptron(s)) : subjects.map(s => ({ risk: (s.score || 0) < 70, confidence: 0.5 }))

  // Данные для scatter plot (кластеры)
  const scatterData = subjects.map((s, i) => ({
    x: ((s.att1 || 0) + (s.att2 || 0)) / 60 * 100,
    y: s.score || 0,
    z: s.credits || 5,
    name: s.name.slice(0, 14),
    cluster: clusterLabels[i] || 0,
  }))

  // Радарный профиль (безопасный reduce)
  const radarData = [
    { subject: "Аттестация 1", A: subjects.length ? subjects.reduce((a,s)=>a+(s.att1 || 0),0)/subjects.length/30*100 : 0 },
    { subject: "Аттестация 2", A: subjects.length ? subjects.reduce((a,s)=>a+(s.att2 || 0),0)/subjects.length/30*100 : 0 },
    { subject: "Экзамены",     A: subjects.length ? subjects.reduce((a,s)=>a+(s.exam || 0),0)/subjects.length/40*100 : 0 },
    { subject: "Стабильность", A: scores.length > 1 ? Math.max(0, 100 - (Math.max(...scores)-Math.min(...scores))) : 0 },
    { subject: "Успеваемость", A: Math.round(avgScore) },
  ]

  // Прогноз по семестрам
  const semesterData = subjects.reduce((acc, s) => {
    const sem = s.semester || 1
    if (!acc[sem]) acc[sem] = { sem, scores: [] }
    acc[sem].scores.push(s.score || 0)
    return acc
  }, {} as Record<number, { sem: number; scores: number[] }>)

  const semesterTrend = Object.values(semesterData).map(d => ({
    name: `${d.sem} сем.`,
    avg: Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length),
    predicted: Math.min(100, Math.max(0, Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length * (1 + reg.slope * 0.01))))
  })).sort((a,b) => parseInt(a.name) - parseInt(b.name))

  // Оценка качества модели
  const modelAccuracy = Math.round(reg.r2 * 100)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground">
        <Brain size={36} className="animate-pulse text-primary" />
        <p className="text-sm font-medium">Инициализация ML моделей...</p>
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center text-center gap-4">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
          <Brain size={32} />
        </div>
        <h2 className="text-xl font-bold">{t("analysis.emptyTitle")}</h2>
        <p className="text-muted-foreground text-sm max-w-md">{t("analysis.emptyDesc")}</p>
        <Button onClick={() => setScreen("subjects")}>{t("analysis.loadBtn")}</Button>
      </div>
    )
  }

  const tabs = [
    { id: "overview", label: "Обзор", icon: BarChart2 },
    { id: "ml",       label: "ML Кластеры", icon: Network },
    { id: "predict",  label: "Прогноз", icon: TrendingUp },
    { id: "neural",   label: "Нейросеть", icon: Brain },
  ] as const

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10">

      {/* Заголовок */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {t("analysis.title")}
              {mlReady && <MLBadge label="ML Ready" />}
            </h1>
            <p className="text-sm text-muted-foreground">{t("analysis.subtitle")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Точность модели</p>
          <p className="text-2xl font-bold text-primary">{modelAccuracy}%</p>
          <p className="text-[10px] text-muted-foreground">R² = {reg.r2.toFixed(3)}</p>
        </div>
      </div>

      {/* ML статус */}
      {mlReady && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Линейная регрессия", status: "Обучена", color: "#22c55e", val: `R²=${reg.r2.toFixed(2)}` },
            { label: `K-Means (k=${k})`, status: "Кластеризовано", color: "#3b82f6", val: `${subjects.length} точек` },
            { label: "Перцептрон", status: subjects.length >= 3 ? "Обучен" : "Мало данных", color: subjects.length >= 3 ? "#8b5cf6" : "#f59e0b", val: "100 эпох" },
            { label: "Аномалии (IQR)", status: `${anomalies.filter(Boolean).length} найдено`, color: "#f59e0b", val: "Q1-Q3 метод" },
          ].map((m, i) => (
            <Card key={i} className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: m.color }} />
                  <p className="text-[11px] font-bold text-foreground">{m.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{m.status}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{m.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ТАБ 1: ОБЗОР ──────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">

          {/* Стековый барчарт */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart2 size={15} className="text-primary" />
                {t("analysis.chartTitle")}
                <MLBadge label="Визуализация" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjects.map(s => ({
                    name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
                    att1: s.att1 || 0, att2: s.att2 || 0, exam: s.exam || 0
                  }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend />
                    <Bar dataKey="att1" stackId="a" name="Атт. 1" fill="#3b82f6" radius={[0,0,4,4]} />
                    <Bar dataKey="att2" stackId="a" name="Атт. 2" fill="#6366f1" />
                    <Bar dataKey="exam" stackId="a" name="Экзамен" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Радарный профиль */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-primary" /> Профиль студента
                  <MLBadge label="Radar" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="Студент" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Важность признаков */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-primary" /> Важность признаков
                  <MLBadge label="Feature Importance" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {importance.length > 0 ? (
                  <div className="flex flex-col gap-4 mt-2">
                    {importance.map((f, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="text-foreground">{f.name}</span>
                          <span className="text-primary font-bold">{f.importance}%</span>
                        </div>
                        <ConfidenceBar value={f.importance} color={i === 0 ? "#22c55e" : i === 1 ? "#3b82f6" : "#f59e0b"} />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Коэффициент R² показывает корреляцию каждого компонента с итоговым баллом
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Нужно минимум 3 предмета</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Инсайты */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={14} className="text-primary" /> {t("analysis.insightsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(() => {
              const sorted = [...subjects].sort((a, b) => (b.score || 0) - (a.score || 0))
              const best = sorted[0]; const worst = sorted[sorted.length - 1]
              const anomalySubjects = subjects.filter((_, i) => anomalies[i])
              
              // 1. Создаем строгий тип для TypeScript
              type InsightType = { type: "positive" | "warning" | "negative"; title: string; text: string };
              
              // 2. Указываем 'as InsightType[]' в конце
              const insights = ([
                best ? { type: "positive", title: `🏆 ${best.name.slice(0,20)}`, text: `Лучший результат: ${best.score} баллов. Продолжайте в том же духе!` } : null,
                worst && (worst.score || 0) < 75 ? { type: "warning", title: `⚠️ ${worst.name.slice(0,20)}`, text: `Балл ${worst.score} — ниже среднего. Слабые темы: ${worst.weak?.slice(0,2).join(", ") || "не указаны"}` } : null,
                anomalySubjects.length > 0 ? { type: "negative", title: "🔴 Статистическая аномалия", text: `Обнаружены выбросы в предметах: ${anomalySubjects.map(s=>s.name.slice(0,12)).join(", ")}` } : null,
                { type: "positive", title: "📊 Корреляция аттестаций", text: `R²=${reg.r2.toFixed(2)} — аттестационные баллы ${reg.r2 > 0.5 ? "сильно" : "умеренно"} влияют на итог` },
              ]).filter(Boolean) as InsightType[];

              return insights.map((ins, i) => (
                // 3. Теперь мы убрали восклицательные знаки (ins!), так как TS точно знает тип
                <div key={i} className={`rounded-xl p-4 border ${
                  ins.type === "positive" ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" :
                  ins.type === "warning" ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" :
                  "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                }`}>
                  <p className="text-xs font-bold text-foreground mb-1">{ins.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.text}</p>
                </div>
              ))
            })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ТАБ 2: ML КЛАСТЕРЫ ────────────────────────────────── */}
      {activeTab === "ml" && (
        <div className="flex flex-col gap-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Network size={15} className="text-primary" />
                K-Means кластеризация предметов
                <MLBadge label={`k=${k}`} />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Оси: X — суммарные аттестационные баллы (%), Y — итоговый балл. Размер — кредиты.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" dataKey="x" domain={[0, 100]} name="Аттестации" tick={{ fontSize: 10 }} label={{ value: "Аттестации %", position: "bottom", fontSize: 10 }} />
                    <YAxis type="number" dataKey="y" domain={[0, 100]} name="Итог" tick={{ fontSize: 10 }} label={{ value: "Итог %", angle: -90, position: "insideLeft", fontSize: 10 }} />
                    <ZAxis type="number" dataKey="z" range={[40, 160]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-card border border-border rounded-xl p-3 text-xs shadow-lg">
                          <p className="font-bold mb-1">{d.name}</p>
                          <p>Аттестации: <span className="text-primary font-bold">{d.x.toFixed(0)}%</span></p>
                          <p>Итог: <span className="text-primary font-bold">{d.y}%</span></p>
                          <p className="text-muted-foreground">Кластер: {CLUSTER_LABELS[d.cluster] || `#${d.cluster}`}</p>
                        </div>
                      )
                    }} />
                    <Scatter data={scatterData} shape={(props: any) => {
                      const { cx, cy, payload } = props
                      return <circle cx={cx} cy={cy} r={8} fill={CLUSTER_COLORS[payload.cluster] || "#888"} opacity={0.8} stroke="white" strokeWidth={1.5} />
                    }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Легенда кластеров */}
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/50">
                {Array.from({ length: k }).map((_, ci) => {
                  const clusterSubjects = subjects.filter((_, i) => clusterLabels[i] === ci)
                  return (
                    <div key={ci} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[ci] }} />
                      <span className="text-xs text-muted-foreground">{CLUSTER_LABELS[ci]} ({clusterSubjects.length})</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Таблица кластеров */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Распределение по кластерам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {subjects.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CLUSTER_COLORS[clusterLabels[i]] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{CLUSTER_LABELS[clusterLabels[i]] || "Кластер"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {anomalies[i] && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600">аномалия</Badge>}
                      <span className="text-sm font-bold" style={{ color: CLUSTER_COLORS[clusterLabels[i]] }}>{s.score || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ТАБ 3: ПРОГНОЗ ───────────────────────────────────── */}
      {activeTab === "predict" && (
        <div className="flex flex-col gap-6">

          {/* Регрессия */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                Линейная регрессия: прогноз баллов
                <MLBadge label="МНК" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={subjects.map((s, i) => ({
                    name: s.name.slice(0, 10),
                    actual: s.score || 0,
                    predicted: Math.min(100, Math.max(0, Math.round(reg.slope * attSums[i] + reg.intercept))),
                    trend: trendData[i] ? Math.round(trendData[i]) : (s.score || 0),
                  }))} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
                    <Legend />
                    <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} label={{ value: "Минимум", fontSize: 9 }} />
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Факт" />
                    <Line type="monotone" dataKey="predicted" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Регрессия" />
                    <Line type="monotone" dataKey="trend" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Сглаживание" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Наклон регрессии</p>
                  <p className="text-xl font-bold text-primary">{reg.slope.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">баллов/ед. атт.</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Качество модели R²</p>
                  <p className="text-xl font-bold text-primary">{reg.r2.toFixed(3)}</p>
                  <p className="text-[10px] text-muted-foreground">{reg.r2 > 0.7 ? "Хорошая модель" : "Умеренная"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Прогноз +10% атт.</p>
                  <p className="text-xl font-bold text-green-600">+{Math.max(0, predictedScore - Math.round(avgScore))}%</p>
                  <p className="text-[10px] text-muted-foreground">потенциал роста</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Семестровый тренд */}
          {semesterTrend.length > 1 && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target size={14} className="text-primary" /> Динамика по семестрам
                  <MLBadge label="Exp. Smoothing" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={semesterTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "8px" }} />
                      <Bar dataKey="avg" fill="#3b82f6" radius={[4,4,0,0]} name="Средний балл">
                        {semesterTrend.map((_, i) => (
                          <Cell key={i} fill={i === semesterTrend.length - 1 ? "#8b5cf6" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Индивидуальные прогнозы */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Прогноз по каждому предмету</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {subjects.map((s, i) => {
                  const score = s.score || 0
                  const predicted = Math.min(100, Math.max(0, Math.round(reg.slope * attSums[i] + reg.intercept)))
                  const diff = predicted - score
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 p-3 rounded-xl border border-border/50">
                      <div>
                        <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                        <Progress value={score} className="h-1 mt-1" />
                      </div>
                      <span className="text-sm font-bold text-foreground">{score}</span>
                      <span className="text-sm font-bold text-muted-foreground">→</span>
                      <span className={`text-sm font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {predicted} {diff !== 0 && `(${diff > 0 ? "+" : ""}${diff})`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ТАБ 4: НЕЙРОСЕТЬ ─────────────────────────────────── */}
      {activeTab === "neural" && (
        <div className="flex flex-col gap-6">

          {/* Архитектура перцептрона */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/10 to-purple-500/5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Brain size={15} className="text-violet-500" />
                Однослойный перцептрон (классификация риска)
                <MLBadge label="Neural Net" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">4 входа → активация → бинарная классификация: «в риске» / «всё ОК»</p>
            </CardHeader>
            <CardContent className="pt-4">

              {/* Визуализация архитектуры */}
              <div className="flex items-center justify-center gap-6 my-4 py-4 bg-muted/20 rounded-xl">
                {/* Входной слой */}
                <div className="flex flex-col gap-2 items-center">
                  <p className="text-[10px] text-muted-foreground font-bold mb-1">INPUT</p>
                  {["Атт.1/30", "Атт.2/30", "Экз./40", "Балл/100"].map((label, i) => (
                    <div key={i} className="w-16 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 border border-blue-300 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Связи */}
                <div className="flex flex-col items-center gap-1">
                  {Array.from({length:4}).map((_,i) => (
                    <div key={i} className="w-12 h-px bg-gradient-to-r from-blue-400 to-violet-500 opacity-60" />
                  ))}
                </div>

                {/* Нейрон */}
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold mb-1">NEURON</p>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-[9px] font-bold text-white text-center">Σw·x+b<br/>sigmoid</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">lr=0.1, 100 эпох</p>
                </div>

                {/* Выход */}
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] text-muted-foreground font-bold mb-1">OUTPUT</p>
                  <div className="w-16 h-8 rounded-lg bg-green-100 dark:bg-green-950 border border-green-300 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-green-700">✅ ОК</span>
                  </div>
                  <div className="w-16 h-8 rounded-lg bg-red-100 dark:bg-red-950 border border-red-300 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-red-700">⚠️ Риск</span>
                  </div>
                </div>
              </div>

              {/* Результаты классификации */}
              <div className="flex flex-col gap-2 mt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Результаты классификации</p>
                {subjects.map((s, i) => {
                  const result = riskMap[i]
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                      result.risk
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                        : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
                    }`}>
                      {result.risk
                        ? <XCircle size={16} className="text-red-500 shrink-0" />
                        : <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <ConfidenceBar value={result.confidence * 100} color={result.risk ? "#ef4444" : "#22c55e"} />
                          <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(result.confidence * 100)}%</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${
                        result.risk ? "border-red-300 text-red-600" : "border-green-300 text-green-600"
                      }`}>
                        {result.risk ? "В зоне риска" : "Стабильно"}
                      </Badge>
                    </div>
                  )
                })}
              </div>

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{riskMap.filter(r => !r.risk).length}</p>
                  <p className="text-xs text-muted-foreground">Стабильных</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{riskMap.filter(r => r.risk).length}</p>
                  <p className="text-xs text-muted-foreground">В зоне риска</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{Math.round(riskMap.reduce((a,r)=>a+r.confidence,0)/riskMap.length*100)}%</p>
                  <p className="text-xs text-muted-foreground">Ср. уверенность</p>
                </div>
              </div>

              {!perceptron && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 flex items-start gap-2">
                  <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Для обучения перцептрона нужно минимум 3 предмета. Сейчас используется правило-эвристика (score &lt; 70).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}