"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  CalendarClock, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  FlaskConical, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  Users 
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКА

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Task {
  id: string
  title: string
  subject: string
  type: "srs" | "srsp" | "lab" | "project" | "exam"
  dueDate: string
  dueInDays: number
  priority: "high" | "medium" | "low"
  done: boolean
}

interface Subject {
  name: string;
}

export function DeadlinesScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ t И language
  const [tasks, setTasks] = useState<Task[]>([])
  const [userSubjects, setUserSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const typeIcons = {
    srs: BookOpen,
    srsp: Users,
    lab: FlaskConical,
    project: FileText,
    exam: AlertCircle,
  }

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    low: "bg-primary/10 text-primary border-primary/20",
  }

  useEffect(() => {
    const fetchData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.subjects) setUserSubjects(data.subjects)
          if (data.deadlines) setTasks(data.deadlines)
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const saveTasksToDb = async (newTasks: Task[]) => {
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, { deadlines: newTasks })
    }
  }

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    saveTasksToDb(updated);
  }

  const handleGenerateDeadlines = async () => {
    setIsGenerating(true);
    
    let context = "Сгенерируй случайные дедлайны для студента IT специальности.";
    if (userSubjects.length > 0) {
      const subNames = userSubjects.map(s => s.name).join(", ");
      context = `У студента есть предметы: ${subNames}. Придумай для них задания.`;
    }

    try {
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language] || "русском";

      const systemPrompt = `Ты - академический помощник. Твоя задача сгенерировать список дедлайнов (заданий) для студента на ${promptLanguage} языке.
      Используй форматы: srs, srsp, lab, project, exam.
      
      ВЕРНИ ТОЛЬКО JSON МАССИВ. ПОЛЯ "title", "subject" и "dueDate" (например: 15 ${promptLanguage === "английском" ? "April" : "Апреля"}) ДОЛЖНЫ БЫТЬ НА ${promptLanguage.toUpperCase()} ЯЗЫКЕ:
      [
        {
          "id": "уникальный_id",
          "title": "Название задания на ${promptLanguage}",
          "subject": "Название предмета на ${promptLanguage}",
          "type": "srs/srsp/lab/project/exam",
          "dueDate": "Дата на ${promptLanguage}",
          "dueInDays": число 1-14,
          "priority": "high/medium/low",
          "done": false
        }
      ]
      Не пиши ничего кроме JSON! Контекст: ${context}`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }]
        })
      });

      if (!res.ok) throw new Error("Ошибка API");

      const data = await res.json();
      let rawJson = data.choices[0].message.content.trim();
      rawJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();

      const generatedTasks: Task[] = JSON.parse(rawJson);
      
      if (Array.isArray(generatedTasks) && generatedTasks.length > 0) {
        const activeOldTasks = tasks.filter(t => !t.done);
        const combined = [...activeOldTasks, ...generatedTasks];
        setTasks(combined);
        await saveTasksToDb(combined);
      }
    } catch (error) {
      console.error("Ошибка генерации:", error)
      alert(t("recommendations.errorApi"))
    } finally {
      setIsGenerating(false)
    }
  }

  const activeTasks = tasks.filter(t => !t.done).sort((a, b) => a.dueInDays - b.dueInDays)
  const completedTasks = tasks.filter(t => t.done)
  const urgentCount = activeTasks.filter(t => t.priority === "high").length
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedTasks.length / tasks.length) * 100);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <CalendarClock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("deadlines.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("deadlines.subtitle")}</p>
          </div>
        </div>
        <Button onClick={handleGenerateDeadlines} disabled={isGenerating} className="gap-2 shadow-sm shrink-0">
          {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {t("deadlines.generateBtn")}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-all">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("deadlines.urgent")}</p>
              <p className="text-2xl font-bold text-foreground">{urgentCount}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-all">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("deadlines.active")}</p>
              <p className="text-2xl font-bold text-foreground">{activeTasks.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-all">
          <CardContent className="flex flex-col justify-center p-5 gap-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t("deadlines.progress")}
              </p>
              <p className="text-sm font-bold text-success">{progressPercent}%</p>
            </div>
            <Progress value={progressPercent} className="h-2 bg-success/20" />
          </CardContent>
        </Card>
      </div>

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold">{t("deadlines.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("deadlines.emptyDesc")}
          </p>
          <Button onClick={handleGenerateDeadlines} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {t("deadlines.createBtn")}
          </Button>
        </Card>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="bg-muted">
            <TabsTrigger value="active" className="data-[state=active]:bg-background">
              {t("deadlines.tabActive")} <Badge variant="secondary" className="ml-2 bg-muted-foreground/20">{activeTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-background">
              {t("deadlines.tabCompleted")} <Badge variant="secondary" className="ml-2 bg-success/20 text-success">{completedTasks.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {activeTasks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">{t("deadlines.allDone")}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeTasks.map(task => {
                  const Icon = typeIcons[task.type] || FileText
                  return (
                    <Card key={task.id} className={`border-l-4 shadow-sm transition-all hover:shadow-md ${task.priority === 'high' ? 'border-l-destructive' : task.priority === 'medium' ? 'border-l-warning' : 'border-l-primary'}`}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask(task.id)}
                          className="h-5 w-5 rounded-sm"
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 pr-4">
                          <h3 className="text-sm font-bold text-foreground leading-tight">{task.title}</h3>
                          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <span className="text-primary">{task.subject}</span>
                            <span>•</span>
                            <span className="uppercase tracking-wider">{t(`deadlines.types.${task.type}`)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground font-mono">
                            {task.dueDate}
                          </Badge>
                          <Badge variant="secondary" className={`text-[10px] ${priorityColors[task.priority]}`}>
                            {t("deadlines.dueIn").replace("{days}", String(task.dueInDays))}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completedTasks.length === 0 ? (
              <Card className="border-border/60 bg-card shadow-sm border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("deadlines.noCompleted")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {completedTasks.map(task => {
                  const Icon = typeIcons[task.type] || FileText
                  return (
                    <Card key={task.id} className="border-border/60 bg-card shadow-sm opacity-60 bg-muted/10">
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox checked onCheckedChange={() => toggleTask(task.id)} className="h-5 w-5 rounded-sm data-[state=checked]:bg-success data-[state=checked]:border-success" />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <h3 className="text-sm font-semibold text-foreground line-through">{task.title}</h3>
                          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <span>{task.subject}</span>
                            <span>•</span>
                            <span>{t(`deadlines.types.${task.type}`)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}