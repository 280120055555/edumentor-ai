"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

interface Subject {
  name: string;
  credits: number;
  score: number;
  grade: string;
  weak?: string[];
}

interface Task {
  id: string;
  topic: string;
  time: string;
  subject: string;
  done: boolean;
}

interface DayPlan {
  day: string;
  date: string;
  tasks: Task[];
}

export function DashboardScreen() {
  const { setScreen } = useNavigation()
  const { t } = useLanguage()
  const [userName, setUserName] = useState("Студент")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [studyPlan, setStudyPlan] = useState<DayPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.firstName) setUserName(data.firstName)
          if (data.subjects) {
            // ✅ Фильтруем битые объекты
            setSubjects(data.subjects.filter((s: any) => s && typeof s.name === "string"))
          }
          if (data.studyPlan) setStudyPlan(data.studyPlan)
        }
      }
      setIsLoading(false)
    }
    fetchDashboardData()
  }, [])

  const averageScore = subjects.length > 0
    ? Math.round(subjects.reduce((acc, s) => acc + (s.score ?? 0), 0) / subjects.length)
    : 0

  const totalCredits = subjects.reduce((acc, s) => acc + (s.credits ?? 0), 0)
  const allTasks = studyPlan.flatMap(day => day.tasks)
  const completedTasks = allTasks.filter(t => t.done).length
  const taskProgress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0
  const allWeakTopics = subjects.flatMap(s => s.weak || [])
  const upcomingTasks = allTasks.filter(t => !t.done).slice(0, 4)

  // ✅ Защита от битых данных
  const chartData = subjects
    .filter(s => s && s.name)
    .map(s => ({
      name: s.name.length > 10 ? s.name.slice(0, 10) + "..." : s.name,
      score: s.score ?? 0
    }))

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center animate-pulse gap-2 text-muted-foreground">
        <Sparkles className="animate-spin" size={20} /> {t("common.loading")}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-8">

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("dashboard.avgScore")}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-foreground">{averageScore}%</h3>
                {averageScore > 0 && <span className="text-xs text-success flex items-center"><TrendingUp size={12}/></span>}
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("dashboard.weakTopicsCount")}</p>
              <h3 className="text-2xl font-bold text-foreground">{allWeakTopics.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("dashboard.credits")}</p>
              <h3 className="text-2xl font-bold text-foreground">{totalCredits}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.chartTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                <Button variant="outline" size="sm" onClick={() => setScreen("subjects")}>
                  {t("subjects.addBtn")}
                </Button>
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock size={16} className="text-primary"/> {t("dashboard.upcomingTasks")}
              </CardTitle>
              {upcomingTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">{upcomingTasks.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {allTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
                <p className="text-sm text-muted-foreground">{t("studyPlan.emptyTitle")}</p>
                <Button variant="outline" size="sm" onClick={() => setScreen("study-plan")}>{t("studyPlan.generateBtn")}</Button>
              </div>
            ) : upcomingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <CheckCircle2 size={32} className="text-success mb-2" />
                <p className="text-sm font-medium">{t("dashboard.allDone")}</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/50">
                {upcomingTasks.map(task => (
                  <div key={task.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{task.topic}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{task.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-background">{task.subject}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {upcomingTasks.length > 0 && (
            <div className="p-3 border-t border-border/50">
              <Button variant="ghost" className="w-full text-xs" onClick={() => setScreen("study-plan")}>→</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}