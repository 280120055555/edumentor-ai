"use client"

import { useState, useEffect } from "react"
import { NavigationProvider, useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ПЕРЕВОДЧИКА
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Menu, Search, Bell, LogOut, Loader2 } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged, signOut } from "firebase/auth"

// Импорты экранов
import { LoginScreen } from "@/components/screens/login-screen"
import { OnboardingScreen } from "@/components/screens/onboarding-screen"
import { DashboardScreen } from "@/components/screens/dashboard-screen"
import { SubjectsScreen } from "@/components/screens/subjects-screen"
import { AIAnalysisScreen } from "@/components/screens/ai-analysis-screen"
import { WeakTopicsScreen } from "@/components/screens/weak-topics-screen"
import { StudyPlanScreen } from "@/components/screens/study-plan-screen"
import { RecommendationsScreen } from "@/components/screens/recommendations-screen"
import { AIMentorScreen } from "@/components/screens/ai-mentor-screen"
import { DeadlinesScreen } from "@/components/screens/deadlines-screen"
import { CalendarScreen } from "@/components/screens/calendar-screen"
import { AnalyticsScreen } from "@/components/screens/analytics-screen"
import { NotificationsScreen } from "@/components/screens/notifications-screen"
import { MaterialsScreen } from "@/components/screens/materials-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import { CampusMapScreen } from "@/components/screens/campus-map-screen"

function AppContent() {
  const { currentScreen, isLoggedIn, setScreen, setIsLoggedIn } = useNavigation()
  const { t } = useLanguage() // <-- ДОСТАЕМ t()
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userInitials, setUserInitials] = useState("??")
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true)
        if (currentScreen === "login") setScreen("dashboard")
        
        try {
          const docSnap = await getDoc(doc(db, "users", user.uid))
          if (docSnap.exists()) {
            const data = docSnap.data()
            const initials = `${data.firstName?.[0] || ""}${data.lastName?.[0] || ""}`.toUpperCase()
            setUserInitials(initials || "СТ")
          }
        } catch (error) {
          console.error("Ошибка загрузки профиля:", error)
        }
      } else {
        setIsLoggedIn(false)
        setScreen("login")
      }
      setIsAuthLoading(false)
    });
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    setIsLoggedIn(false)
    setScreen("login")
  }

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isLoggedIn || currentScreen === "login") return <LoginScreen />
  
  // ИСПРАВЛЕНИЕ ОШИБКИ: добавили "as string", чтобы TypeScript перестал ругаться
  if ((currentScreen as string) === "onboarding") return <OnboardingScreen />

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard": return <DashboardScreen />
      case "subjects": return <SubjectsScreen />
      case "ai-analysis": return <AIAnalysisScreen />
      case "weak-topics": return <WeakTopicsScreen />
      case "study-plan": return <StudyPlanScreen />
      case "recommendations": return <RecommendationsScreen />
      case "ai-mentor": return <AIMentorScreen />
      case "deadlines": return <DeadlinesScreen />
      case "calendar": return <CalendarScreen />
      case "analytics": return <AnalyticsScreen />
      case "notifications": return <NotificationsScreen />
      case "materials": return <MaterialsScreen />
      case "profile": return <ProfileScreen />
      case "settings": return <SettingsScreen />
      case "campus-map": return <CampusMapScreen />
      default: return <DashboardScreen />
    }
  }

  // ПЕРЕВОДИМ ШАПКУ ЧЕРЕЗ СЛОВАРЬ (Берет данные из JSON)
  const getScreenTitle = (screen: string) => {
    const titles: Record<string, string> = {
      "dashboard": t("nav.dashboard"),
      "subjects": t("nav.subjects"),
      "ai-analysis": t("nav.aiAnalysis"),
      "weak-topics": t("nav.weakTopics"),
      "study-plan": t("nav.studyPlan"),
      "recommendations": t("nav.recommendations"),
      "ai-mentor": t("nav.aiMentor"),
      "deadlines": t("nav.deadlines"),
      "calendar": t("nav.calendar"),
      "analytics": t("nav.analytics"),
      "notifications": t("nav.notifications"),
      "materials": t("nav.materials"),
      "profile": t("nav.profile"),
      "settings": t("nav.settings"),
      "campus-map": t("nav.campusMap"),
    }
    return titles[screen] || t("nav.dashboard")
  }

  // ОПРЕДЕЛЯЕМ: Это чат или обычная страница?
  const isChatScreen = currentScreen === "ai-mentor"

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        
        {/* ВЕРХНЯЯ ШАПКА */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="hidden sm:block">
              {/* Сюда подставляется переведенный заголовок! */}
              <h2 className="text-sm font-semibold text-foreground">{getScreenTitle(currentScreen as string)}</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setScreen("notifications")}>
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">5</span>
            </Button>
            
            <div 
              onClick={() => setScreen("profile")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary cursor-pointer hover:bg-primary/20 transition-colors"
            >
              {userInitials}
            </div>

            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* УМНЫЙ КОНТЕЙНЕР: Скролл для Дашборда, фиксация для Чата */}
        <div className={`flex-1 relative bg-muted/10 ${isChatScreen ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
           <main className={`flex flex-col ${isChatScreen ? 'h-full p-4' : 'min-h-full p-4 sm:p-6'}`}>
              {renderScreen()}
           </main>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  )
}