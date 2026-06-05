"use client"

import { useState } from "react"
import { GraduationCap, Globe, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

// Firebase импорты
import { auth, db } from "@/lib/firebase"
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,     // <-- ДОБАВИЛИ ПРОВАЙДЕР
  signInWithPopup         // <-- ДОБАВИЛИ ПОПАП
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

export function LoginScreen() {
  const { setScreen, setIsLoggedIn } = useNavigation()
  const { t, language, setLanguage } = useLanguage()
  const [showPassword, setShowPassword] = useState(false)
  
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError("")

    if (!username || password.length < 6) {
      setError(t("login.errorLength"))
      return
    }

    setIsLoading(true)

    const fullEmail = `${username.trim()}@stud.satbayev.university`

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, fullEmail, password)
      } catch (err) {
        userCredential = await createUserWithEmailAndPassword(auth, fullEmail, password)
      }

      const user = userCredential.user
      const docRef = doc(db, "users", user.uid)
      const docSnap = await getDoc(docRef)

      setIsLoggedIn(true)

      if (docSnap.exists() && docSnap.data().firstName) {
        setScreen("dashboard")
      } else {
        setScreen("onboarding" as any)
      }

    } catch (err: any) {
      setError(t("login.errorAuth"))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError("")
    if (!username) {
      setError(t("login.errorEmptyLogin"))
      return
    }
    
    setIsLoading(true)
    const fullEmail = `${username.trim()}@stud.satbayev.university`
    
    try {
      await sendPasswordResetEmail(auth, fullEmail)
      alert(t("login.resetSent"))
    } catch (err: any) {
      setError(t("login.errorReset"))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // --- НОВАЯ ФУНКЦИЯ ДЛЯ ВХОДА ЧЕРЕЗ GOOGLE (SSO) ---
  const handleGoogleLogin = async () => {
    setError("")
    setIsLoading(true)
    
    try {
      const provider = new GoogleAuthProvider()
      // Вызываем всплывающее окно авторизации Google
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Проверяем, есть ли у этого юзера профиль в базе
      const docRef = doc(db, "users", user.uid)
      const docSnap = await getDoc(docRef)

      setIsLoggedIn(true)

      // Если профиль заполнен - на Дашборд, иначе - на заполнение имени
      if (docSnap.exists() && docSnap.data().firstName) {
        setScreen("dashboard")
      } else {
        setScreen("onboarding" as any)
      }

    } catch (err: any) {
      console.error("Ошибка SSO:", err)
      // Ошибка auth/popup-closed-by-user возникает, если юзер сам закрыл окно, ее можно не показывать
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(t("login.errorAuth"))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-[460px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("login.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
            <SelectTrigger className="h-8 w-[100px] border-border bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">{t("login.langRu")}</SelectItem>
              <SelectItem value="kz">{t("login.langKz")}</SelectItem>
              <SelectItem value="en">{t("login.langEn")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="w-full border-border/60 bg-card/80 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold">{t("login.cardTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("login.cardSubtitle")}</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username" className="text-sm">{t("login.loginLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      placeholder={t("login.loginPlaceholder")}
                      className="h-11 bg-background flex-[1.5]"
                      required
                    />
                    <div className="flex h-11 items-center rounded-md border border-input bg-muted/50 px-3 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      @stud.satbayev.university
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm">{t("login.passwordLabel")}</Label>
                    <button 
                      type="button" 
                      onClick={handleResetPassword}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("login.forgotPassword")}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder={t("login.passwordPlaceholder")}
                      className="h-11 bg-background pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center p-2 bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="h-11 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 mt-2 font-bold"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {t("login.signInBtn")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t("login.or")}</span>
                <Separator className="flex-1" />
              </div>

              {/* Кнопка входа через Google */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="h-11 w-full gap-2 border-border"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t("login.ssoBtn")} Google
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}