"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, GraduationCap, Award, TrendingUp, BookOpen, Clock, Target, Star, Edit2, Loader2, Save, Camera } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ПЕРЕВОДЧИКА
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface UserProfile {
  firstName: string;
  lastName: string;
  course: string;
  specialty: string;
  group: string;
  funding: string;
  photoUrl: string;
}

export function ProfileScreen() {
  const { t } = useLanguage() // <-- ДОСТАЕМ t()
  
  const [profile, setProfile] = useState<UserProfile>({
    firstName: "Студент",
    lastName: "",
    course: "1",
    specialty: "",
    group: "",
    funding: "Грант",
    photoUrl: "",
  })
  
  const [stats, setStats] = useState({ credits: 0, avgScore: 0, planTasks: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<UserProfile>(profile)
  const [isSaving, setIsSaving] = useState(false)

  // Перенесли данные внутрь компонента, чтобы работал перевод
  const gpaHistory = [
    { semester: `1 ${t("profile.sem")}`, gpa: 3.1 },
    { semester: `2 ${t("profile.sem")}`, gpa: 3.3 },
    { semester: `3 ${t("profile.sem")}`, gpa: 3.5 },
    { semester: `4 ${t("profile.sem")}`, gpa: 3.4 },
    { semester: `5 ${t("profile.sem")}`, gpa: 3.6 },
    { semester: `6 ${t("profile.sem")}`, gpa: 3.72 },
  ]

  const achievements = [
    { title: t("profile.ach1Title"), description: t("profile.ach1Desc"), icon: Star, color: "bg-warning/10 text-warning" },
    { title: t("profile.ach2Title"), description: t("profile.ach2Desc"), icon: Target, color: "bg-success/10 text-success" },
    { title: t("profile.ach3Title"), description: t("profile.ach3Desc"), icon: TrendingUp, color: "bg-primary/10 text-primary" },
    { title: t("profile.ach4Title"), description: t("profile.ach4Desc"), icon: Clock, color: "bg-primary/10 text-primary" },
    { title: t("profile.ach5Title"), description: t("profile.ach5Desc"), icon: BookOpen, color: "bg-success/10 text-success" },
    { title: t("profile.ach6Title"), description: t("profile.ach6Desc"), icon: TrendingUp, color: "bg-warning/10 text-warning" },
  ]

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        
        if (snap.exists()) {
          const data = snap.data()
          
          const loadedProfile = {
            firstName: data.firstName || "Студент",
            lastName: data.lastName || "",
            course: data.course || "3",
            specialty: data.specialty || "",
            group: data.group || "",
            funding: data.funding || "Грант",
            photoUrl: data.photoUrl || "",
          }
          setProfile(loadedProfile)
          setEditForm(loadedProfile)

          let totalCredits = 0
          let totalScore = 0
          let subjectsCount = 0
          let tasksCount = 0

          if (data.subjects && data.subjects.length > 0) {
            data.subjects.forEach((s: any) => {
              totalCredits += (s.credits || 5)
              totalScore += (s.score || 0)
              subjectsCount++
            })
          }
          if (data.studyPlan) {
            data.studyPlan.forEach((day: any) => {
              tasksCount += day.tasks?.length || 0
            })
          }

          setStats({
            credits: totalCredits,
            avgScore: subjectsCount > 0 ? Math.round(totalScore / subjectsCount) : 0,
            planTasks: tasksCount
          })
        }
      }
      setIsLoading(false)
    }
    fetchUserData()
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    if (auth.currentUser) {
      try {
        const docRef = doc(db, "users", auth.currentUser.uid)
        await updateDoc(docRef, {
          course: editForm.course,
          specialty: editForm.specialty,
          group: editForm.group,
          funding: editForm.funding,
          photoUrl: editForm.photoUrl, 
        })
        setProfile(editForm)
        setIsEditing(false)
      } catch (error) {
        console.error("Ошибка сохранения профиля:", error)
        alert(t("common.error"))
      }
    }
    setIsSaving(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(t("profile.photoSizeError"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const initials = `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase() || "СТ"
  const currentGPA = stats.avgScore > 0 ? (stats.avgScore / 25).toFixed(2) : "0.00"

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("profile.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
          </div>
        </div>
        <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2 shrink-0 shadow-sm">
          <Edit2 className="h-4 w-4" /> {t("profile.editBtn")}
        </Button>
      </div>

      {/* Карточка профиля */}
      <Card className="border-border/60 bg-card shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-24 bg-primary/10" />
        <CardContent className="p-6 pt-12 relative z-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              {profile.photoUrl ? (
                <AvatarImage src={profile.photoUrl} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">{initials}</AvatarFallback>
              )}
            </Avatar>
            <div className="flex flex-1 flex-col gap-2 text-center sm:text-left mt-2">
              <h2 className="text-2xl font-bold text-foreground">{profile.firstName} {profile.lastName}</h2>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-2 py-1">
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                  {profile.course} {t("profile.course")}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground text-xs px-2 py-1">
                  {profile.specialty || t("profile.notSpecified")}
                </Badge>
                <Badge variant="secondary" className={`${profile.funding === 'Грант' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'} text-xs px-2 py-1`}>
                  {t("profile.fundingLabel")} {profile.funding === 'Грант' ? t("profile.grant") : profile.funding === 'Платное' ? t("profile.paid") : profile.funding}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground sm:justify-start mt-2">
                <span className="flex items-center gap-1.5"><strong className="text-foreground">{t("profile.groupLabel")}</strong> {profile.group || t("profile.notSpecified")}</span>
                <span className="flex items-center gap-1.5"><strong className="text-foreground">{t("profile.statusLabel")}</strong> {t("profile.statusActive")}</span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center bg-muted/30 p-4 rounded-xl min-w-[120px] mt-2 sm:mt-0">
              <span className="text-3xl font-bold text-primary">{currentGPA}</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">{t("profile.currentGpa")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("profile.statsCredits")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.credits}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("profile.statsAvg")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.avgScore}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("profile.statsTasks")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.planTasks}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col items-center p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("profile.statsAi")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">12</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GPA History */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-base font-semibold text-foreground">{t("profile.history")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gpaHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="semester" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[2.5, 4.0]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="gpa" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Достижения */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Award className="h-4 w-4 text-warning" />
              {t("profile.achievements")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((a, i) => {
                const Icon = a.icon
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground">{a.title}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{a.description}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md p-6 shadow-2xl border-border/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit2 className="text-primary h-5 w-5"/> {t("profile.editModalTitle")}
              </h2>
              <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="flex flex-col gap-4">
              
              {/* Загрузка фото */}
              <div className="flex flex-col items-center gap-3 mb-2">
                <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
                  {editForm.photoUrl ? (
                    <AvatarImage src={editForm.photoUrl} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{initials}</AvatarFallback>
                  )}
                </Avatar>
                <label className="cursor-pointer group flex items-center gap-1">
                  <Camera className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors underline-offset-4 group-hover:underline">
                    {t("profile.changePhoto")}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload} 
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("profile.courseLabel")}</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("profile.fundingLabel")}</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.funding}
                    onChange={(e) => setEditForm({ ...editForm, funding: e.target.value })}
                  >
                    <option value="Грант">{t("profile.grant")}</option>
                    <option value="Платное">{t("profile.paid")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("profile.specialtyLabel")}</label>
                <Input 
                  placeholder={t("profile.specialtyPlaceholder")}
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("profile.groupLabel").replace(":", "")}</label>
                <Input 
                  placeholder={t("profile.groupPlaceholder")}
                  value={editForm.group}
                  onChange={(e) => setEditForm({ ...editForm, group: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}