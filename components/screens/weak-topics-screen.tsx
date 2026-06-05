"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, ArrowRight, UserMinus, ShieldAlert, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ПЕРЕВОДЧИКА
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip 
} from "recharts"

interface Subject {
  name: string;
  score: number;
  weak?: string[];
  absences?: number; 
}

interface AnalyzedTopic {
  topic: string;
  subject: string;
  mastery: number;
  absences: number;
  difficultyKey: "diffHigh" | "diffMedium" | "diffLow"; // Заменили на ключи локализации
  details: string;
  recommended: string;
  isRetakeRisk: boolean;
}

export function WeakTopicsScreen() {
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
        <div className="h-16 w-16 bg-warning/10 text-warning rounded-full flex items-center justify-center mb-2">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold">{t("weakTopics.emptyTitle")}</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          {t("weakTopics.emptyDesc")}
        </p>
        <Button onClick={() => setScreen("subjects")}>{t("weakTopics.goToSubjects")}</Button>
      </div>
    )
  }

  let radarData = subjects.map(s => ({
    topic: s.name.length > 12 ? s.name.slice(0, 12) + "..." : s.name,
    mastery: s.score,
    fullMark: 100
  }))
  while (radarData.length < 3) {
    radarData.push({ topic: "---", mastery: 0, fullMark: 100 })
  }

  const analyzedTopics: AnalyzedTopic[] = subjects.map(sub => {
    const simulatedAbsences = sub.absences ?? (
      sub.score < 50 ? 25 : 
      sub.score < 70 ? 15 : 
      Math.floor(Math.random() * 10)
    );

    const difficultyKey: "diffHigh" | "diffMedium" | "diffLow" = sub.score < 60 ? "diffHigh" : sub.score < 80 ? "diffMedium" : "diffLow";
    
    const weakTopicName = sub.weak && sub.weak.length > 0 ? sub.weak[0] : t("weakTopics.defaultWeakTopic");

    return {
      topic: weakTopicName,
      subject: sub.name,
      mastery: sub.score,
      absences: simulatedAbsences,
      difficultyKey: difficultyKey,
      details: t("weakTopics.detailsText").replace("{score}", String(sub.score)),
      recommended: sub.score < 60 ? t("weakTopics.recHard") : t("weakTopics.recEasy"),
      isRetakeRisk: simulatedAbsences >= 20 || sub.score < 50 
    }
  }).sort((a, b) => a.mastery - b.mastery); 

  const criticalSubjects = analyzedTopics.filter(t => t.absences >= 20);

  const getDifficultyColor = (dKey: string) => {
    if (dKey === "diffHigh") return "bg-destructive/10 text-destructive border-destructive/20"
    if (dKey === "diffMedium") return "bg-warning/10 text-warning border-warning/20"
    return "bg-primary/10 text-primary border-primary/20"
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("weakTopics.title")}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Sparkles size={12} className="text-primary"/> {t("weakTopics.subtitle")}
          </p>
        </div>
      </div>

      {criticalSubjects.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
          <CardContent className="p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <ShieldAlert size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-destructive mb-1">
                {t("weakTopics.retakeWarning")}
              </h2>
              <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
                {t("weakTopics.retakeDesc")} <span className="font-bold text-destructive">{">"} 20%</span>
                <span className="font-semibold text-foreground"> {criticalSubjects.map(s => s.subject).join(", ")}</span>. 
                {" "}{t("weakTopics.retakePolicy")}
              </p>
              <div className="flex gap-3">
                <Button variant="destructive" size="sm" className="shadow-sm">
                  {t("weakTopics.writeExplain")}
                </Button>
                <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
                  {t("weakTopics.contactAdvisor")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-base font-semibold text-foreground">{t("weakTopics.radarTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar
                  name={t("weakTopics.radarMastery")}
                  dataKey="mastery"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-bold mb-4">{t("weakTopics.detailsTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analyzedTopics.map((topic, i) => (
            <Card key={i} className={`border-border/60 shadow-sm transition-all hover:shadow-md ${topic.isRetakeRisk ? 'border-destructive/30' : ''}`}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4">
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground leading-tight mb-1">{topic.topic}</h3>
                      <p className="text-xs font-medium text-primary">{topic.subject}</p>
                    </div>
                    <Badge variant="outline" className={getDifficultyColor(topic.difficultyKey)}>
                      {t("weakTopics.difficulty")}: {t(`weakTopics.${topic.difficultyKey}`)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-muted/10 p-3 rounded-lg border border-border/50">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">{t("weakTopics.mastery")}</span>
                        <span className={`text-xs font-bold ${topic.mastery < 60 ? 'text-destructive' : 'text-foreground'}`}>
                          {topic.mastery}%
                        </span>
                      </div>
                      <Progress value={topic.mastery} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                          <UserMinus size={10}/> {t("weakTopics.absences")}
                        </span>
                        <span className={`text-xs font-bold ${topic.absences >= 20 ? 'text-destructive' : 'text-foreground'}`}>
                          {topic.absences}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${topic.absences >= 20 ? 'bg-destructive' : topic.absences >= 10 ? 'bg-warning' : 'bg-success'}`} 
                          style={{ width: `${Math.min(topic.absences, 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      {topic.details}
                    </p>
                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                        {t("weakTopics.recommendation")} {topic.recommended}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-[10px] text-primary hover:bg-primary/10"
                        onClick={() => setScreen("study-plan")}
                      >
                        {t("weakTopics.addToPlan")} <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
    </div>
  )
}