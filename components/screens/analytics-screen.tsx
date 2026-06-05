"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКОВ
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface Subject {
  name: string;
  score: number;
  att1: number;
  att2: number;
  exam: number;
}

interface Task {
  id: string;
  subject: string;
  done: boolean;
}

interface DayPlan {
  tasks: Task[];
}

const COLORS = [
  "oklch(0.62 0.15 240)", // primary
  "oklch(0.65 0.17 145)", // success
  "oklch(0.75 0.15 70)",  // warning
  "oklch(0.55 0.12 200)", 
  "oklch(0.70 0.14 160)",
  "oklch(0.50 0.20 27)",  // destructive
]

export function AnalyticsScreen() {
  const { setScreen } = useNavigation()
  const { t } = useLanguage() // <-- ДОСТАЕМ t()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [studyPlan, setStudyPlan] = useState<DayPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        
        if (snap.exists()) {
          const data = snap.data()
          if (data.subjects) setSubjects(data.subjects)
          if (data.studyPlan) setStudyPlan(data.studyPlan)
        }
      }
      setIsLoading(false)
    }
    fetchAnalyticsData()
  }, [])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center text-center gap-4">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
          <BarChart3 size={32} />
        </div>
        <h2 className="text-xl font-bold">{t("analytics.emptyTitle")}</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          {t("analytics.emptyDesc")}
        </p>
        <Button onClick={() => setScreen("subjects")}>{t("analytics.addSubjectsBtn")}</Button>
      </div>
    )
  }

  const averageScore = Math.round(subjects.reduce((acc, s) => acc + s.score, 0) / subjects.length);
  const estimatedGPA = (averageScore / 25).toFixed(2);
  
  const totalTasks = studyPlan.reduce((acc, day) => acc + day.tasks.length, 0);
  const estimatedStudyHours = Math.round(totalTasks * 1.5);

  const subjectTaskCounts: Record<string, number> = {};
  studyPlan.forEach(day => {
    day.tasks.forEach(t => {
      subjectTaskCounts[t.subject] = (subjectTaskCounts[t.subject] || 0) + 1;
    });
  });

  const subjectDistribution = Object.entries(subjectTaskCounts).map(([name, count], index) => ({
    name: name.length > 10 ? name.slice(0, 10) + "." : name,
    value: count,
    color: COLORS[index % COLORS.length]
  }));

  const defaultDistribution = subjects.map((s, index) => ({
    name: s.name.length > 10 ? s.name.slice(0, 10) + "." : s.name,
    value: s.score,
    color: COLORS[index % COLORS.length]
  }));
  const pieData = subjectDistribution.length > 0 ? subjectDistribution : defaultDistribution;

  const performanceByComponent = subjects.map(s => ({
    name: s.name.length > 8 ? s.name.slice(0, 8) + ".." : s.name,
    att1: Math.round((s.att1 / 30) * 100) || 0,
    att2: Math.round((s.att2 / 30) * 100) || 0,
    exam: Math.round((s.exam / 40) * 100) || 0,
  }));

  const monthlyProgress = [
    { month: t("analytics.months.sep"), score: Math.max(0, averageScore - 15) },
    { month: t("analytics.months.oct"), score: Math.max(0, averageScore - 10) },
    { month: t("analytics.months.nov"), score: Math.max(0, averageScore - 5) },
    { month: t("analytics.months.dec"), score: Math.max(0, averageScore - 8) },
    { month: t("analytics.months.jan"), score: Math.max(0, averageScore - 2) },
    { month: t("analytics.months.feb"), score: averageScore }, 
  ];

  const activityHours = [
    { week: t("analytics.weeks.w1"), hours: 15, target: 20 },
    { week: t("analytics.weeks.w2"), hours: 18, target: 20 },
    { week: t("analytics.weeks.w3"), hours: 25, target: 20 },
    { week: t("analytics.weeks.w4"), hours: Math.max(10, estimatedStudyHours - 5), target: 20 },
    { week: t("analytics.weeks.w5"), hours: estimatedStudyHours, target: 20 },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10">
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: t("analytics.estGpa"), value: estimatedGPA, change: "+0.12" },
          { label: t("analytics.avgScore"), value: `${averageScore}%`, change: "+3%" },
          { label: t("analytics.tasksPlan"), value: totalTasks, change: t("analytics.active") },
          { label: t("analytics.subjectsCount"), value: subjects.length, change: t("analytics.rup") },
        ].map((stat, i) => (
          <Card key={i} className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <Badge variant="secondary" className="bg-success/10 text-success text-[10px] px-1.5 py-0.5">
                  {stat.change.includes('+') && <TrendingUp className="h-3 w-3 mr-1" />}
                  {stat.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* GPA History (LineChart) */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-base font-semibold text-foreground">{t("analytics.gpaHistoryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="score" name={t("analytics.scoreLabel")} stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Study Hours (AreaChart) */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-base font-semibold text-foreground">{t("analytics.activityTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="hours" name={t("analytics.hoursLabel")} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#hoursGradient)" />
                  <Line type="monotone" dataKey="target" name={t("analytics.targetLabel")} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Subject distribution (PieChart) */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-semibold text-foreground">{t("analytics.distributionTitle")}</CardTitle>
              {subjectDistribution.length === 0 && <AlertCircle size={14} className="text-warning" />}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    dataKey="value"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} 
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: '500' }}>{value}</span>}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Performance by component (BarChart) */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-base font-semibold text-foreground">{t("analytics.performanceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceByComponent} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: "hsl(var(--muted)/0.3)"}}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} 
                  />
                  <Bar dataKey="att1" name={t("analytics.att1")} fill="oklch(0.62 0.15 240)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="att2" name={t("analytics.att2")} fill="oklch(0.55 0.12 200)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="exam" name={t("analytics.exam")} fill="oklch(0.70 0.14 160)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}