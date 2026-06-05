"use client"

import { useState, useEffect } from "react" // Добавили хуки
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  AlertTriangle,
  Route,
  Lightbulb,
  MessageSquare,
  CalendarClock,
  Calendar,
  BarChart3,
  Bell,
  FolderOpen,
  User,
  Settings,
  GraduationCap,
  LogOut,
} from "lucide-react"
import { useNavigation, type Screen } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { auth, db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore" // Используем onSnapshot для автообновления
import { signOut } from "firebase/auth"

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const { currentScreen, setScreen, setIsLoggedIn } = useNavigation()
  const { t } = useLanguage()
  
  // СОСТОЯНИЯ ДЛЯ СЧЕТЧИКОВ
  const [deadlineCount, setDeadlineCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)

  // СЛУШАЕМ ИЗМЕНЕНИЯ В FIREBASE
  useEffect(() => {
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      
      // onSnapshot будет обновлять цифры мгновенно, как только ты добавишь или удалишь что-то в БД
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          
          // Считаем только невыполненные дедлайны
          const activeDeadlines = data.deadlines?.filter((d: any) => !d.done).length || 0
          setDeadlineCount(activeDeadlines)
          
          // Считаем только непрочитанные уведомления
          const unreadNotifs = data.notifications?.filter((n: any) => !n.read).length || 0
          setNotifCount(unreadNotifs)
        }
      })

      return () => unsubscribe()
    }
  }, [])

  const navItems: { label: string; icon: any; screen: Screen; badge?: number }[] = [
    { label: t("nav.dashboard"), icon: LayoutDashboard, screen: "dashboard" },
    { label: t("nav.subjects"), icon: BookOpen, screen: "subjects" },
    { label: t("nav.aiAnalysis"), icon: Brain, screen: "ai-analysis" },
    { label: t("nav.weakTopics"), icon: AlertTriangle, screen: "weak-topics" },
    { label: t("nav.studyPlan"), icon: Route, screen: "study-plan" },
    { label: t("nav.recommendations"), icon: Lightbulb, screen: "recommendations" },
    { label: t("nav.aiMentor"), icon: MessageSquare, screen: "ai-mentor" },
    // ТЕПЕРЬ ЦИФРЫ ДИНАМИЧЕСКИЕ
    { label: t("nav.deadlines"), icon: CalendarClock, screen: "deadlines", badge: deadlineCount },
    { label: t("nav.calendar"), icon: Calendar, screen: "calendar" },
    { label: t("nav.analytics"), icon: BarChart3, screen: "analytics" },
    { label: t("nav.notifications"), icon: Bell, screen: "notifications", badge: notifCount },
    { label: t("nav.materials"), icon: FolderOpen, screen: "materials" },
    { label: t("nav.profile"), icon: User, screen: "profile" },
    { label: t("nav.settings"), icon: Settings, screen: "settings" },
  ]

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setIsLoggedIn(false)
      setScreen("login")
    } catch (error) {
      console.error("Ошибка при выходе:", error)
    }
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">EduMentor AI</span>
            <span className="text-[11px] text-muted-foreground">EdTech Platform</span>
          </div>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.screen
            
            return (
              <button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {/* ПОКАЗЫВАЕМ БЭЙДЖ ТОЛЬКО ЕСЛИ ЦИФРА БОЛЬШЕ 0 */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 justify-center bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>{t("nav.logout")}</span>}
        </button>
      </div>
    </aside>
  )
}