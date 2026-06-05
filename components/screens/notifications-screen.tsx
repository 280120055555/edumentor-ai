"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, CalendarClock, Brain, BookOpen, AlertTriangle, CheckCircle2, Clock, Sparkles, Loader2, Trash2, BellOff, BellRing } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context"

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

// ─── Отправить реальное браузерное уведомление ────────────────────────────
const sendBrowserNotification = (title: string, body: string, type: string) => {
  if (typeof window === "undefined") return
  if (Notification.permission !== "granted") return

  const icons: Record<string, string> = {
    deadline: "⏰",
    ai: "🤖",
    assignment: "📚",
    grade: "✅",
    system: "⚠️",
  }

  new Notification(title, {
    body,
    icon: "/favicon.ico",       // иконка вашего сайта
    badge: "/favicon.ico",
    tag: type,                  // группирует уведомления одного типа
    requireInteraction: false,  // не держит уведомление — само исчезнет
  })
}

export function NotificationsScreen() {
  const { t, language } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // ─── Статус разрешения браузера ───────────────────────────────────────────
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default")

  // Проверяем текущий статус при загрузке
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission)
    }
  }, [])

  // ─── Запросить разрешение у пользователя ─────────────────────────────────
  const requestPermission = async () => {
    if (!("Notification" in window)) {
      alert("Ваш браузер не поддерживает уведомления")
      return
    }
    const result = await Notification.requestPermission()
    setPermissionStatus(result)

    if (result === "granted") {
      // Сразу показываем тестовое уведомление чтобы убедиться что работает
      sendBrowserNotification(
        "EduMentor AI 🎓",
        "Уведомления включены! Теперь вы будете получать напоминания о дедлайнах и рекомендации.",
        "system"
      )
    }
  }

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

    let context = "Обычный студент IT-специальности."
    if (userData) {
      const subjects = userData.subjects
        ? userData.subjects.map((s: any) => s.name).join(", ")
        : "Нет данных"
      const deadlines = userData.deadlines
        ? userData.deadlines.filter((d: any) => !d.done).map((d: any) => d.title).join(", ")
        : "Нет горящих дедлайнов"
      context = `Изучаемые предметы: ${subjects}. Текущие невыполненные дедлайны: ${deadlines}.`
    }

    try {
      const langNames: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" }
      const promptLanguage = langNames[language] || "русском"

      const systemPrompt = `Ты - интеллектуальная система университета. Сгенерируй 5-7 реалистичных уведомлений для студента на ${promptLanguage} языке.
      
      ВЕРНИ ТОЛЬКО ЧИСТЫЙ JSON МАССИВ (без markdown, без \`\`\`):
      [
        {
          "id": "уникальный_id",
          "title": "Заголовок на ${promptLanguage}",
          "description": "Описание на ${promptLanguage}",
          "type": "deadline",
          "time": "5 мин назад",
          "read": false
        }
      ]
      Типы: deadline, ai, assignment, grade, system.
      Контекст студента: ${context}`

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
      })

      if (!res.ok) throw new Error("Ошибка API")

      const data = await res.json()
      let rawJson = data.choices[0].message.content.trim()
      rawJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim()

      // Groq с json_object оборачивает в объект — достаём массив
      let parsed = JSON.parse(rawJson)
      const generatedNotifs: Notification[] = Array.isArray(parsed)
        ? parsed
        : parsed.notifications || parsed.data || Object.values(parsed)[0] as Notification[]

      if (Array.isArray(generatedNotifs)) {
        const combined = [...generatedNotifs, ...notifications].slice(0, 20)
        setNotifications(combined)
        await saveNotifications(combined)

        // ─── Показываем реальные браузерные уведомления ───────────────────
        if (Notification.permission === "granted") {
          // Небольшая задержка между уведомлениями чтобы браузер не склеил их
          generatedNotifs.slice(0, 3).forEach((n, index) => {
            setTimeout(() => {
              sendBrowserNotification(n.title, n.description, n.type)
            }, index * 800)
          })
        }
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
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">

      {/* Заголовок */}
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
          <Button
            onClick={handleGenerateNotifications}
            disabled={isGenerating}
            variant="outline"
            className="gap-2 shadow-sm"
          >
            {isGenerating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4 text-primary" />}
            <span className="hidden sm:inline">{t("notifications.generateBtn")}</span>
          </Button>

          {unreadCount > 0 && (
            <Button size="sm" onClick={markAllRead} className="h-10 px-4 shadow-sm">
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Баннер разрешения на уведомления ──────────────────────────────── */}
      {"Notification" in window && permissionStatus !== "granted" && (
        <Card className={`border-2 ${
          permissionStatus === "denied"
            ? "border-destructive/30 bg-destructive/5"
            : "border-primary/30 bg-primary/5"
        }`}>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                permissionStatus === "denied" ? "bg-destructive/10" : "bg-primary/10"
              }`}>
                {permissionStatus === "denied"
                  ? <BellOff className="h-5 w-5 text-destructive" />
                  : <BellRing className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {permissionStatus === "denied"
                    ? "Уведомления заблокированы"
                    : "Включите реальные уведомления"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {permissionStatus === "denied"
                    ? "Разрешите уведомления вручную: в адресной строке браузера нажмите на иконку замка → Уведомления → Разрешить"
                    : "Нажмите кнопку — и уведомления о дедлайнах будут приходить даже когда вкладка свёрнута"}
                </p>
              </div>
            </div>

            {permissionStatus !== "denied" && (
              <Button
                onClick={requestPermission}
                className="gap-2 shrink-0"
                size="sm"
              >
                <BellRing className="h-4 w-4" />
                Разрешить уведомления
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Статус — уведомления разрешены */}
      {permissionStatus === "granted" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Браузерные уведомления включены — они будут приходить даже когда сайт свёрнут
        </div>
      )}

      {/* Список уведомлений */}
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
            {isGenerating
              ? <Loader2 className="animate-spin h-4 w-4" />
              : <Sparkles className="h-4 w-4" />}
            {t("notifications.generateBtnMobile")}
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 relative">
          {notifications.length > 0 && notifications.every(n => n.read) && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-destructive gap-1 h-7"
              >
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
                    : "bg-card shadow-sm"
                }`}
                onClick={() => markRead(n.id)}
              >
                {!n.read && (
                  <div className="absolute left-0 top-0 w-1 h-full bg-primary" />
                )}
                <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${typeColors[n.type]} ${n.read ? "opacity-60" : ""}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className={`text-sm sm:text-base font-semibold leading-tight ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                        {n.title}
                      </h3>
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />
                        {n.time}
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm leading-relaxed ${n.read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
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
