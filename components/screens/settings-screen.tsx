"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge" 
import { Settings, Globe, Bell, User, Shield, Palette, Info, Loader2, Save, MailCheck } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { sendPasswordResetEmail, deleteUser } from "firebase/auth"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- 1. Подключили наш переводчик!

export function SettingsScreen() {
  const { setScreen, setIsLoggedIn } = useNavigation()
  const { t, language, setLanguage } = useLanguage() // <-- 2. Достали функцию t(), текущий язык и функцию его смены
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Стейты пользователя
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  
  // Стейты настроек (language убрали отсюда, он теперь глобальный)
  const [theme, setTheme] = useState("light")
  const [notifications, setNotifications] = useState({
    deadlines: true,
    aiTips: true,
    grades: true,
    materials: false,
    emails: false
  })

  useEffect(() => {
    const fetchSettings = async () => {
      if (auth.currentUser) {
        setEmail(auth.currentUser.email || "")
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        
        if (snap.exists()) {
          const data = snap.data()
          setFirstName(data.firstName || "")
          setLastName(data.lastName || "")
          
          if (data.settings) {
            setTheme(data.settings.theme || "light")
            if (data.settings.notifications) {
              setNotifications(data.settings.notifications)
            }
          }
        }
      }
      setIsLoading(false)
    }
    fetchSettings()
  }, [])

  // Применение темы
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        await updateDoc(docRef, {
          firstName,
          lastName,
          settings: { theme, language, notifications }
        })
        alert(t("common.success")) // <-- Уведомление из словаря
      }
    } catch (error) {
      console.error("Ошибка сохранения:", error)
      alert(t("common.error"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (email) {
      try {
        await sendPasswordResetEmail(auth, email)
        alert(t("common.success"))
      } catch (error) {
        alert(t("common.error"))
      }
    }
  }

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(t("settings.deleteDesc"))
    if (confirmDelete && auth.currentUser) {
      try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid))
        await deleteUser(auth.currentUser)
        setIsLoggedIn(false)
        setScreen("login")
      } catch (error: any) {
        alert(t("common.error"))
      }
    }
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
          </div>
        </div>
        <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2 shadow-sm shrink-0">
          {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t("settings.saveBtn")}
        </Button>
      </div>

      {/* О ПРОГРАММЕ И МЕТОДОЛОГИИ */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
            <Info className="h-5 w-5" />
            {t("settings.aboutTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-foreground/80 space-y-3 leading-relaxed">
            <p>
              <strong>EduMentor AI</strong> — интеллектуальная система управления обучением.
            </p>
            <p>
              <strong>Технологии:</strong> Llama 3.1 (8B) / Groq API / RAG.
            </p>
            <p>
              <strong>Стандарт оценки:</strong> <Badge variant="outline" className="px-1 py-0 text-[10px] mx-1">30 / 30 / 40</Badge>.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          
          {/* Учетная запись */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                {t("settings.accountTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">{t("settings.firstName")}</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-background" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">{t("settings.lastName")}</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} className="bg-background" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Email</Label>
                <Input value={email} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">{t("settings.changePassword")}</Label>
                </div>
                <Button onClick={handleResetPassword} variant="outline" size="sm" className="gap-2 shrink-0">
                  <MailCheck className="h-4 w-4" /> {t("settings.sendLink")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Theme & Language */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Palette className="h-4 w-4 text-muted-foreground" />
                {t("settings.themeTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold text-foreground">{t("settings.theme")}</Label>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Светлая</SelectItem>
                    <SelectItem value="dark">Тёмная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold text-foreground">{t("settings.language")}</Label>
                </div>
                {/* Вызываем setLanguage из контекста для мгновенной смены */}
                <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="kz">Қазақша</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="flex flex-col gap-6">
          
          {/* Notifications */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {t("settings.notifTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">{t("settings.notifDeadlines")}</Label>
                <Switch checked={notifications.deadlines} onCheckedChange={(v) => setNotifications({...notifications, deadlines: v})} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">{t("settings.notifAi")}</Label>
                <Switch checked={notifications.aiTips} onCheckedChange={(v) => setNotifications({...notifications, aiTips: v})} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">{t("settings.notifGrades")}</Label>
                <Switch checked={notifications.grades} onCheckedChange={(v) => setNotifications({...notifications, grades: v})} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">{t("settings.notifEmails")}</Label>
                <Switch checked={notifications.emails} onCheckedChange={(v) => setNotifications({...notifications, emails: v})} />
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
            <CardHeader className="pb-3 border-b border-destructive/20">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
                <Shield className="h-4 w-4" />
                {t("settings.dangerTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-semibold text-foreground">{t("settings.deleteAccount")}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("settings.deleteDesc")}</p>
                </div>
                <Button 
                  onClick={handleDeleteAccount}
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive hover:text-white transition-colors"
                >
                  {t("settings.deleteAccount")}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}