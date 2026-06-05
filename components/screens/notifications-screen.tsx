"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, CalendarClock, Brain, BookOpen, AlertTriangle, CheckCircle2, Clock, Sparkles, Loader2, Trash2 } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКА

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Notification {
  id: string
  title: string
  description: string
  type: "deadline" | "ai" | "assignment" | "grade" | "system"
  time: string
  read: boolean
}

const typeIcons: Record<string, any> = {
  deadline: CalendarClock,
  ai: Brain,
  assignment: BookOpen,
  grade: CheckCircle2,
  system: AlertTriangle,
}

const typeColors: Record<string, string> = {
  deadline: "bg-warning/10 text-warning border-warning/20",
  ai: "bg-primary/10 text-primary border-primary/20",
  assignment: "bg-muted text-muted-foreground border-border/50",
  grade: "bg-success/10 text-success border-success/20",
  system: "bg-destructive/10 text-destructive border-destructive/20",
}

export function NotificationsScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ t И language
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          setUserData(data)
          if (data.notifications) {
            setNotifications(data.notifications)
          }
        }
      }
      setIsLoading(false)
    }
    fetchNotifications()
  }, [])

  const saveNotifications = async (newNotifs: Notification[]) => {
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, { notifications: newNotifs })
    }
  }

  const handleGenerateNotifications = async () => {
    setIsGenerating(true)
    
    let context = "Обычный студент IT-специальности.";
    if (userData) {
      const subjects = userData.subjects ? userData.subjects.map((s: any) => s.name).join(", ") : "Нет данных";
      const deadlines = userData.deadlines ? userData.deadlines.filter((d:any) => !d.done).map((d: any) => d.title).join(", ") : "Нет горящих дедлайнов";
      context = `Изучаемые предметы: ${subjects}. Текущие невыполненные дедлайны: ${deadlines}.`;
    }

    try {
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language] || "русском";

      const systemPrompt = `Ты - интеллектуальная система университета. Твоя задача сгенерировать 5-7 реалистичных уведомлений для студента на ${promptLanguage} языке.
      
      ВАЖНО: Формат времени (time) делай на ${promptLanguage} языке (например: "10 мин ${t("notifications.timePrefix")}", "${t("notifications.yesterday")}", "${t("notifications.justNow")}").
      
      ВЕРНИ ТОЛЬКО JSON МАССИВ. Поля "title" и "description" должны быть на ${promptLanguage} языке:
      [
        {
          "id": "уникальный_id",
          "title": "Заголовок на ${promptLanguage}",
          "description": "Описание на ${promptLanguage}",
          "type": "deadline",
          "time": "время на ${promptLanguage}",
          "read": false
        }
      ]
      Ссылайся на контекст студента: ${context}`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: systemPrompt }]
        })
      });

      if (!res.ok) throw new Error("Ошибка API");

      const data = await res.json();
      let rawJson = data.choices[0].message.content.trim();
      rawJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();

      const generatedNotifs: Notification[] = JSON.parse(rawJson);
      
      if (Array.isArray(generatedNotifs)) {
        const combined = [...generatedNotifs, ...notifications].slice(0, 20);
        setNotifications(combined);
        await saveNotifications(combined);
      }
    } catch (error) {
      console.error("Ошибка ИИ:", error)
      alert(t("notifications.errorGenerate"))
    } finally {
      setIsGenerating(false)
    }
  }

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    saveNotifications(updated)
  }

  const markRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifications(updated)
    saveNotifications(updated)
  }

  const clearAll = () => {
    setNotifications([])
    saveNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 relative">
            <Bell className="h-5 w-5 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm border-2 border-background">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("notifications.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("notifications.subtitle")}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleGenerateNotifications} disabled={isGenerating} variant="outline" className="gap-2 shadow-sm">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            <span className="hidden sm:inline">{t("notifications.generateBtn")}</span>
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={markAllRead} className="h-10 px-4 shadow-sm">
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Bell size={32} className="opacity-50" />
          </div>
          <h3 className="text-lg font-bold">{t("notifications.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("notifications.emptyDesc")}
          </p>
          <Button onClick={handleGenerateNotifications} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {t("notifications.generateBtnMobile")}
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 relative">
          {notifications.length > 0 && notifications.every(n => n.read) && (
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive gap-1 h-7">
                <Trash2 className="h-3 w-3" /> {t("notifications.clearHistory")}
              </Button>
            </div>
          )}

          {notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell
            return (
              <Card
                key={n.id}
                className={`border transition-all hover:shadow-md cursor-pointer group overflow-hidden relative ${
                  n.read 
                    ? "bg-card/50 border-border/50 opacity-80" 
                    : `bg-card shadow-sm`
                }`}
                onClick={() => markRead(n.id)}
              >
                {!n.read && (
                  <div className={`absolute left-0 top-0 w-1 h-full bg-primary`} />
                )}
                <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${typeColors[n.type]} ${n.read ? 'opacity-60' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className={`text-sm sm:text-base font-semibold leading-tight ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </h3>
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />
                        {n.time}
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm leading-relaxed ${n.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                      {n.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}