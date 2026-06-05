"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Sparkles, TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

interface Subject {
  name: string;
  score: number;
  att1: number;
  att2: number;
  exam: number;
  weak?: string[];
  absences?: number;
}

interface Insight {
  type: "positive" | "warning" | "negative";
  title: string;
  text: string;
}

const getMasteryColor = (value: number) => {
  if (value >= 90) return "bg-success/80 text-success-foreground"
  if (value >= 75) return "bg-primary/60 text-primary-foreground"
  if (value >= 60) return "bg-warning/60 text-warning-foreground"
  return "bg-destructive/60 text-primary-foreground"
}

export function AIAnalysisScreen() {
  const { setScreen } = useNavigation()
  const { t } = useLanguage() // <-- ДОСТАЕМ t()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubjects = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists() && snap.data().subjects) {
          setSubjects(snap.data().subjects)
        }
      }
      setIsLoading(false)
    }
    fetchSubjects()
  }, [])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
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

  const gradeBreakdown = subjects.map(s => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "..." : s.name,
    att1: s.att1 || 0,
    att2: s.att2 || 0,
    exam: s.exam || 0,
  }))

  // УМНАЯ ЛОКАЛИЗАЦИЯ ИНСАЙТОВ
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];
    const sorted = [...subjects].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best) {
      insights.push({
        type: "positive",
        title: t("analysis.insBestTitle").replace("{name}", best.name),
        text: t("analysis.insBestText").replace("{score}", String(best.score)),
      });
    }

    const highAbsence = subjects.find(s => (s.absences || 0) >= 15);
    if (highAbsence) {
      insights.push({
        type: "negative",
        title: t("analysis.insAbsenceTitle").replace("{name}", highAbsence.name),
        text: t("analysis.insAbsenceText").replace("{abs}", String(highAbsence.absences)),
      });
    } else if (worst && worst.score < 70) {
      insights.push({
        type: "warning",
        title: t("analysis.insWorstTitle").replace("{name}", worst.name),
        text: t("analysis.insWorstText")
          .replace("{score}", String(worst.score))
          .replace("{topics}", worst.weak?.join(", ") || t("analysis.defaultWeak")),
      });
    }

    const lowAtt = subjects.filter(s => s.att1 < 15 || s.att2 < 15);
    if (lowAtt.length > 0) {
      insights.push({
        type: "warning",
        title: t("analysis.insExamRiskTitle"),
        text: t("analysis.insExamRiskText").replace("{count}", String(lowAtt.length)),
      });
    } else {
      insights.push({
        type: "positive",
        title: t("analysis.insStableTitle"),
        text: t("analysis.insStableText"),
      });
    }

    return insights.slice(0, 4);
  }
  const dynamicInsights = generateInsights();

  const generateHeatmap = () => {
    let mapData: { topic: string, mastery: number }[] = [];
    subjects.forEach(sub => {
      mapData.push({ 
        topic: sub.name.length > 12 ? sub.name.slice(0, 12) + "." : sub.name, 
        mastery: sub.score 
      });
      if (sub.weak) {
        sub.weak.forEach(w => {
          mapData.push({
            topic: w.length > 12 ? w.slice(0, 12) + "." : w,
            mastery: Math.max(40, sub.score - 20)
          });
        });
      }
    });
    return mapData.sort(() => 0.5 - Math.random()).slice(0, 12);
  }
  const dynamicHeatmap = generateHeatmap();

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10">
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("analysis.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("analysis.subtitle")}</p>
        </div>
      </div>

      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">{t("analysis.chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Bar dataKey="att1" stackId="a" name={t("analysis.att1")} fill="oklch(0.62 0.15 240)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="att2" stackId="a" name={t("analysis.att2")} fill="oklch(0.55 0.12 200)" />
                <Bar dataKey="exam" stackId="a" name={t("analysis.exam")} fill="oklch(0.70 0.14 160)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("analysis.insightsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4 flex-1">
            {dynamicInsights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 transition-colors hover:shadow-sm ${
                  insight.type === "positive" ? "border-success/30 bg-success/5" :
                  insight.type === "warning" ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {insight.type === "positive" ? <TrendingUp className="h-4 w-4 text-success" /> :
                   insight.type === "warning" ? <AlertCircle className="h-4 w-4 text-warning" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                  <span className="text-sm font-semibold text-foreground">{insight.title}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold text-foreground">{t("analysis.heatmapTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col">
            <div className="grid grid-cols-3 gap-2 flex-1">
              {dynamicHeatmap.map((item, i) => (
                <div key={i} className={`flex flex-col items-center justify-center rounded-lg p-3 transition-transform hover:scale-[1.02] cursor-pointer ${getMasteryColor(item.mastery)}`}>
                  <span className="text-xl font-bold tracking-tight">{item.mastery}%</span>
                  <span className="text-[10px] font-medium text-center uppercase tracking-wider opacity-90 mt-1">{item.topic}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground uppercase font-bold tracking-wider pt-4 border-t border-border/50">
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-success/80" /><span>{t("analysis.mastered")}</span></div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-primary/60" /><span>{t("analysis.good")}</span></div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-warning/60" /><span>{t("analysis.risk")}</span></div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-destructive/60" /><span>{t("analysis.weak")}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}