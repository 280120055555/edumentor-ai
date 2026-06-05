"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Route, Clock, Target, CheckCircle2, Sparkles, Loader2 } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКОВ

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Task {
  id: string
  topic: string
  time: string
  subject: string
  done: boolean
}

interface DayPlan {
  day: string
  date: string
  tasks: Task[]
}

interface Subject {
  name: string;
  weak?: string[];
}

export function StudyPlanScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ t И language
  const [tasks, setTasks] = useState<DayPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [userSubjects, setUserSubjects] = useState<Subject[]>([])

  useEffect(() => {
    const fetchPlanAndSubjects = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.subjects) setUserSubjects(data.subjects)
          if (data.studyPlan) {
            setTasks(data.studyPlan)
          }
        }
      }
      setIsLoading(false)
    }
    fetchPlanAndSubjects()
  }, [])

  const savePlanToDb = async (newPlan: DayPlan[]) => {
    if (auth.currentUser) {
      try {
        const docRef = doc(db, "users", auth.currentUser.uid)
        await updateDoc(docRef, { studyPlan: newPlan })
      } catch (error) {
        console.error("Ошибка сохранения плана:", error)
      }
    }
  }

  const toggleTask = (dayIndex: number, taskId: string) => {
    const newPlan = tasks.map((day, di) =>
      di === dayIndex
        ? {
            ...day,
            tasks: day.tasks.map(t =>
              t.id === taskId ? { ...t, done: !t.done } : t
            ),
          }
        : day
    )
    setTasks(newPlan)
    savePlanToDb(newPlan)
  }

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    
    let context = "У студента пока нет списка предметов. Придумай базовый план для IT-специальности."
    if (userSubjects.length > 0) {
      const subjectsInfo = userSubjects.map(s => 
        `- ${s.name} (слабые темы: ${s.weak ? s.weak.join(", ") : "нет"})`
      ).join("\n")
      context = `Составь расписание для изучения следующих предметов студента:\n${subjectsInfo}`
    }

    try {
      // ИИ должен отвечать на выбранном языке
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language] || "русском";

      const systemPrompt = `Ты - AI академический планировщик. Твоя задача составить расписание учебы на 5 дней (с Понедельника по Пятницу).
      Расписание должно базироваться на предметах и слабых темах студента.
      
      ВЕРНИ ТОЛЬКО МАССИВ JSON строго в таком формате. 
      ЗНАЧЕНИЯ ПОЛЕЙ "day", "date", "topic" и "subject" ПЕРЕВЕДИ НА ${promptLanguage} ЯЗЫК:
      [
        {
          "day": "День недели (например, Понедельник)",
          "date": "Завтра (или дата)",
          "tasks": [
            { "id": "уникальный_id", "topic": "Тема для изучения", "time": "09:00-10:30", "subject": "Предмет", "done": false }
          ]
        }
      ]
      Сгенерируй по 2-3 задачи на каждый день. Не пиши ничего кроме JSON массива!
      
      Контекст студента:
      ${context}`;

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

      const generatedPlan: DayPlan[] = JSON.parse(rawJson);
      
      if (Array.isArray(generatedPlan) && generatedPlan.length > 0) {
        setTasks(generatedPlan);
        await savePlanToDb(generatedPlan);
      } else {
        alert(t("studyPlan.errorGenerate"));
      }
    } catch (error) {
      console.error("Ошибка генерации плана:", error)
      alert(t("studyPlan.errorApi"))
    } finally {
      setIsGenerating(false)
    }
  }

  const totalDone = tasks.reduce((acc, d) => acc + d.tasks.filter(t => t.done).length, 0)
  const totalTasks = tasks.reduce((acc, d) => acc + d.tasks.length, 0)
  const progressPercent = totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("studyPlan.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("studyPlan.subtitle")}</p>
          </div>
        </div>
        
        <Button onClick={handleGeneratePlan} disabled={isGenerating} className="gap-2 shadow-sm">
          {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {tasks.length > 0 ? t("studyPlan.updateBtn") : t("studyPlan.generateBtn")}
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Route size={32} />
          </div>
          <h3 className="text-lg font-bold">{t("studyPlan.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("studyPlan.emptyDesc")}
          </p>
          <Button onClick={handleGeneratePlan} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {t("studyPlan.generateBtn")}
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("studyPlan.done")}</p>
                  <p className="text-xl font-bold text-foreground">{totalDone} / {totalTasks}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("studyPlan.totalTasks")}</p>
                  <p className="text-xl font-bold text-foreground">{totalTasks} {t("studyPlan.pieces")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("studyPlan.progress")}</p>
                  <p className="text-xl font-bold text-foreground">{progressPercent}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Progress value={progressPercent} className="h-2" />

          <div className="flex flex-col gap-4 pb-10">
            {tasks.map((day, dayIndex) => (
              <Card key={dayIndex} className="border-border/60 bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-base font-semibold text-foreground">{day.day}, {day.date}</span>
                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                      {day.tasks.filter(t => t.done).length}/{day.tasks.length} {t("studyPlan.tasksWord")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {day.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 rounded-lg border border-border p-3 transition-colors ${
                        task.done ? "bg-muted/30" : "bg-background hover:border-primary/30"
                      }`}
                    >
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={() => toggleTask(dayIndex, task.id)}
                        className="h-5 w-5"
                      />
                      <div className="flex flex-1 items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-sm font-medium ${task.done ? "line-through text-muted-foreground opacity-70" : "text-foreground"}`}>
                            {task.topic}
                          </span>
                          <span className="text-xs text-muted-foreground">{task.subject}</span>
                        </div>
                        <Badge variant="outline" className={`text-[11px] ${task.done ? "border-muted text-muted-foreground" : "border-border text-foreground"}`}>
                          {task.time}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}