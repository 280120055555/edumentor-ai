"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lightbulb, Play, BookOpen, Dumbbell, ExternalLink, Star, Clock, Sparkles, Loader2, Library } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТ ЯЗЫКА

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Video {
  title: string; channel: string; duration: string; rating: number; views: string; topic: string; url: string;
}
interface Course {
  title: string; platform: string; lessons: number; rating: number; price: string; topic: string; url: string;
}
interface Book {
  title: string; author: string; pages: number; topic: string; url: string;
}
interface Exercise {
  title: string; difficultyKey: "diffHigh" | "diffMedium" | "diffLow"; estimated: string; topic: string; url?: string;
}

interface RecommendationsData {
  videos: Video[];
  courses: Course[];
  books: Book[];
  exercises: Exercise[];
}

export function RecommendationsScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ t И language
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [userSubjects, setUserSubjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const dbData = snap.data()
          if (dbData.subjects) setUserSubjects(dbData.subjects)
          if (dbData.recommendations) setData(dbData.recommendations)
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    
    let context = "Сгенерируй рекомендации для IT-студента.";
    if (userSubjects.length > 0) {
      const weaknesses = userSubjects
        .filter(s => s.weak && s.weak.length > 0)
        .map(s => `${s.name} (слабые темы: ${s.weak.join(", ")})`)
        .join("; ");
      
      context = weaknesses 
        ? `Студенту нужно подтянуть следующие предметы и темы: ${weaknesses}.`
        : `У студента хорошие оценки, предложи углубленные материалы по его предметам: ${userSubjects.map(s => s.name).join(", ")}.`;
    }

    try {
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language] || "русском";

      const systemPrompt = `Ты - образовательный куратор университета. Твоя задача подобрать учебные материалы для студента на основе его предметов и слабых тем.
      Подбирай реально существующие YouTube каналы, курсы (Coursera, Stepik) и классические учебники.

      ВАЖНО: ЗНАЧЕНИЯ ПОЛЕЙ "title", "channel", "topic", "price", "author", "difficultyKey" и "estimated" ПЕРЕВЕДИ НА ${promptLanguage} ЯЗЫК.
      
      ДЛЯ ПОЛЯ "difficultyKey" используй ТОЛЬКО значения: "diffHigh", "diffMedium" или "diffLow".

      ВЕРНИ ТОЛЬКО JSON строго в таком формате:
      {
        "videos": [
          { "title": "Название на ${promptLanguage}", "channel": "Канал", "duration": "45 мин", "rating": 4.9, "views": "120K", "topic": "Предмет", "url": "поисковая ссылка youtube" }
        ],
        "courses": [
          { "title": "Название курса", "platform": "Stepik / Coursera", "lessons": 20, "rating": 4.8, "price": "Бесплатно", "topic": "Предмет", "url": "ссылка" }
        ],
        "books": [
          { "title": "Название книги", "author": "Автор", "pages": 400, "topic": "Предмет", "url": "ссылка" }
        ],
        "exercises": [
          { "title": "Название задачи", "difficultyKey": "diffMedium", "estimated": "2 часа", "topic": "Предмет", "url": "ссылка" }
        ]
      }
      Сгенерируй по 4-5 элементов в каждый массив.
      Контекст: ${context}`;

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

      const responseData = await res.json();
      let rawJson = responseData.choices[0].message.content.trim();
      
      const parsedData: RecommendationsData = JSON.parse(rawJson);
      
      if (parsedData.videos && parsedData.courses) {
        setData(parsedData);
        if (auth.currentUser) {
          const docRef = doc(db, "users", auth.currentUser.uid)
          await updateDoc(docRef, { recommendations: parsedData })
        }
      } else {
        alert(t("recommendations.errorGenerate"));
      }
    } catch (error) {
      console.error("Ошибка ИИ генерации:", error)
      alert(t("recommendations.errorApi"))
    } finally {
      setIsGenerating(false)
    }
  }

  const openLink = (url?: string) => {
    if (url) window.open(url, '_blank');
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("recommendations.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("recommendations.subtitle")}</p>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2 shadow-sm shrink-0">
          {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {data ? t("recommendations.updateBtn") : t("recommendations.generateBtn")}
        </Button>
      </div>

      {!data ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Library size={32} />
          </div>
          <h3 className="text-lg font-bold">{t("recommendations.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("recommendations.emptyDesc")}
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {t("recommendations.createBtn")}
          </Button>
        </Card>
      ) : (
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="w-full justify-start bg-muted overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger value="videos" className="gap-2 shrink-0"><Play className="h-3.5 w-3.5" /> {t("recommendations.tabVideos")}</TabsTrigger>
            <TabsTrigger value="courses" className="gap-2 shrink-0"><BookOpen className="h-3.5 w-3.5" /> {t("recommendations.tabCourses")}</TabsTrigger>
            <TabsTrigger value="books" className="gap-2 shrink-0"><Library className="h-3.5 w-3.5" /> {t("recommendations.tabBooks")}</TabsTrigger>
            <TabsTrigger value="exercises" className="gap-2 shrink-0"><Dumbbell className="h-3.5 w-3.5" /> {t("recommendations.tabExercises")}</TabsTrigger>
          </TabsList>

          {/* ВИДЕО */}
          <TabsContent value="videos" className="mt-4">
            <div className="flex flex-col gap-3">
              {data.videos.map((v, i) => (
                <Card 
                  key={i} 
                  className="border-border/60 bg-card shadow-sm hover:border-destructive/30 transition-colors cursor-pointer group"
                  onClick={() => openLink(v.url)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 group-hover:bg-destructive group-hover:text-white transition-colors">
                        <Play className="h-5 w-5 text-destructive group-hover:text-white" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-destructive transition-colors">{v.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{v.channel}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{v.duration}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{v.rating}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{v.views} {t("recommendations.views")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] hidden sm:inline-flex">{v.topic}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* КУРСЫ */}
          <TabsContent value="courses" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.courses.map((c, i) => (
                <Card key={i} className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] uppercase tracking-wider">{c.topic}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${c.price.toLowerCase().includes('бесплат') || c.price.toLowerCase().includes('тегін') || c.price.toLowerCase().includes('free') ? 'border-success/30 text-success' : 'border-border text-muted-foreground'}`}>
                          {c.price}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{c.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground/70">{c.platform}</span>
                        <span>•</span>
                        <span>{c.lessons} {t("recommendations.lessons")}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{c.rating}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-1 gap-2 text-primary border-primary/30 hover:bg-primary/10 w-full sm:w-auto"
                        onClick={() => openLink(c.url)}
                      >
                        {t("recommendations.viewProgram")} <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* КНИГИ */}
          <TabsContent value="books" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.books.map((b, i) => (
                <Card 
                  key={i} 
                  className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => openLink(b.url)}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary transition-colors">
                      <BookOpen className="h-6 w-6 text-primary group-hover:text-white" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <h3 className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{b.title}</h3>
                      <p className="text-xs text-muted-foreground">{b.author}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">{b.pages} {t("recommendations.pages")}</Badge>
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">{b.topic}</Badge>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ЗАДАЧИ */}
          <TabsContent value="exercises" className="mt-4">
            <div className="flex flex-col gap-3">
              {data.exercises.map((e, i) => (
                <Card 
                  key={i} 
                  className="border-border/60 bg-card shadow-sm hover:border-warning/30 transition-colors cursor-pointer group"
                  onClick={() => openLink(e.url)}
                >
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 group-hover:bg-warning group-hover:text-white transition-colors">
                        <Dumbbell className="h-5 w-5 text-warning group-hover:text-white" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-warning transition-colors">{e.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.estimated}</span>
                          <Badge
                            variant="secondary"
                            className={
                              e.difficultyKey === "diffHigh"
                                ? "bg-destructive/10 text-destructive text-[10px]"
                                : e.difficultyKey === "diffMedium"
                                  ? "bg-warning/10 text-warning text-[10px]"
                                  : "bg-success/10 text-success text-[10px]"
                            }
                          >
                            {t("recommendations.difficulty")}: {t(`recommendations.${e.difficultyKey}`)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] shrink-0">{e.topic}</Badge>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}