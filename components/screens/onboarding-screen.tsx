"use client"

import { useState } from "react"
import { useNavigation } from "@/lib/navigation-context"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКОВ
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { GraduationCap, Loader2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export function OnboardingScreen() {
  const { setScreen } = useNavigation()
  const { t } = useLanguage() // <-- ДОСТАЕМ t()
  
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [major, setMajor] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName) return

    setIsLoading(true)
    try {
      const user = auth.currentUser
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          major: major.trim(),
          email: user.email,
          createdAt: new Date()
        })
        setScreen("dashboard")
      }
    } catch (error) {
      console.error("Ошибка при сохранении профиля:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t("onboarding.welcomeTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("onboarding.welcomeSubtitle")}</p>
        </div>

        <Card className="w-full border-border/60 bg-card/80 shadow-xl backdrop-blur-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="firstName">{t("onboarding.firstName")}</Label>
                  <Input 
                    id="firstName" 
                    placeholder={t("onboarding.firstNamePlaceholder")} 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lastName">{t("onboarding.lastName")}</Label>
                  <Input 
                    id="lastName" 
                    placeholder={t("onboarding.lastNamePlaceholder")} 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="major">{t("onboarding.major")}</Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    id="major" 
                    placeholder={t("onboarding.majorPlaceholder")} 
                    className="pl-10"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="mt-2 h-11 w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("onboarding.finishBtn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}