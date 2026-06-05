"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FolderOpen, FileText, Download, Search, Upload, 
  File, Image as ImageIcon, Table, Sparkles, Loader2, Trash2 
} from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТИРУЕМ ЯЗЫК

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

interface Material {
  id: string;
  name: string;
  subject: string;
  type: "pdf" | "docx" | "pptx" | "xlsx" | "png";
  size: string;
  date: string;
  category: "notes" | "assignments" | "other";
}

interface Subject {
  name: string;
}

const typeIcons: Record<string, any> = {
  pdf: FileText,
  docx: File,
  pptx: FileText,
  xlsx: Table,
  png: ImageIcon,
}

const typeColors: Record<string, string> = {
  pdf: "bg-destructive/10 text-destructive",
  docx: "bg-primary/10 text-primary",
  pptx: "bg-warning/10 text-warning",
  xlsx: "bg-success/10 text-success",
  png: "bg-primary/10 text-primary",
}

export function MaterialsScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ t И language
  const [materials, setMaterials] = useState<Material[]>([])
  const [userSubjects, setUserSubjects] = useState<Subject[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [newFile, setNewFile] = useState<Partial<Material>>({
    type: "pdf",
    category: "notes",
    subject: "",
    name: ""
  })

  useEffect(() => {
    const fetchData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.subjects) {
            setUserSubjects(data.subjects)
            if (data.subjects.length > 0) {
              setNewFile(prev => ({ ...prev, subject: data.subjects[0].name }))
            }
          }
          if (data.materials) setMaterials(data.materials)
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const saveMaterialsToDb = async (newMaterials: Material[]) => {
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, { materials: newMaterials })
    }
  }

  const handleGenerateMaterials = async () => {
    setIsGenerating(true)
    
    let context = "У студента нет предметов. Сгенерируй базовые IT-материалы."
    if (userSubjects.length > 0) {
      context = `Предметы студента: ${userSubjects.map(s => s.name).join(", ")}.`
    }

    try {
      const langNames = { ru: "русском", kz: "казахском", en: "английском" };
      const promptLanguage = langNames[language] || "русском";

      const systemPrompt = `Ты - академический ассистент. Сгенерируй список полезных учебных файлов (шпаргалки, конспекты, шаблоны лаб) для студента по его предметам.
      
      ВЕРНИ ТОЛЬКО МАССИВ JSON. ПОЛЯ "name" и "date" (Сегодня/Today/Бүгін) ПЕРЕВЕДИ НА ${promptLanguage} ЯЗЫК:
      [
        {
          "id": "сгенерируй_уникальный_id",
          "name": "Название файла на ${promptLanguage} (например: Шпаргалка по формулам, Шаблон отчета)",
          "subject": "Название предмета из списка студента (оставь как есть)",
          "type": "выбери: pdf, docx, pptx, xlsx или png",
          "size": "Сгенерируй размер (например: 2.4 MB)",
          "date": "Текущая дата на ${promptLanguage} (например: Сегодня)",
          "category": "выбери: notes, assignments или other"
        }
      ]
      Сгенерируй 5-7 реалистичных файлов. Не пиши ничего кроме JSON массива!
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

      const data = await res.json();
      let rawJson = data.choices[0].message.content.trim();
      rawJson = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();

      const generatedFiles: Material[] = JSON.parse(rawJson);
      
      if (Array.isArray(generatedFiles)) {
        const combined = [...materials, ...generatedFiles];
        setMaterials(combined);
        await saveMaterialsToDb(combined);
      }
    } catch (error) {
      console.error("Ошибка ИИ:", error)
      alert(t("materials.errorGenerate"))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpload = async () => {
    if (!newFile.name || !newFile.subject) {
      alert(t("materials.errorEmpty"));
      return;
    }

    const fileToAdd: Material = {
      id: Date.now().toString(),
      name: newFile.name,
      subject: newFile.subject,
      type: newFile.type as any,
      category: newFile.category as any,
      size: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)} MB`,
      date: "New"
    }

    const updated = [fileToAdd, ...materials];
    setMaterials(updated);
    await saveMaterialsToDb(updated);
    
    setIsUploadModalOpen(false);
    setNewFile({ ...newFile, name: "" }); 
  }

  const handleDelete = async (id: string) => {
    const updated = materials.filter(m => m.id !== id);
    setMaterials(updated);
    await saveMaterialsToDb(updated);
  }

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("materials.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("materials.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleGenerateMaterials} disabled={isGenerating} variant="outline" className="gap-2 flex-1 sm:flex-none">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            <span className="hidden sm:inline">{t("materials.generateBtn")}</span>
          </Button>
          <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2 bg-primary text-primary-foreground flex-1 sm:flex-none">
            <Upload className="h-4 w-4" />
            {t("materials.uploadBtn")}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t("materials.searchPlaceholder")}
          className="pl-10 bg-card border-border/60 shadow-sm"
        />
      </div>

      {materials.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed bg-muted/10 text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <FolderOpen size={32} />
          </div>
          <h3 className="text-lg font-bold">{t("materials.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
            {t("materials.emptyDesc")}
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="bg-muted overflow-x-auto flex-nowrap scrollbar-hide w-full sm:w-auto justify-start">
            <TabsTrigger value="all" className="shrink-0">{t("materials.tabAll")} ({materials.length})</TabsTrigger>
            <TabsTrigger value="notes" className="shrink-0">{t("materials.tabNotes")} ({materials.filter(m => m.category === "notes").length})</TabsTrigger>
            <TabsTrigger value="assignments" className="shrink-0">{t("materials.tabAssignments")} ({materials.filter(m => m.category === "assignments").length})</TabsTrigger>
            <TabsTrigger value="other" className="shrink-0">{t("materials.tabOther")} ({materials.filter(m => m.category === "other").length})</TabsTrigger>
          </TabsList>

          {["all", "notes", "assignments", "other"].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="flex flex-col gap-3">
                {(tab === "all" ? filtered : filtered.filter(m => m.category === tab)).map((m) => {
                  const Icon = typeIcons[m.type] || FileText
                  return (
                    <Card key={m.id} className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow group">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${typeColors[m.type] || "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 pr-2">
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{m.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <span className="text-primary">{m.subject}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{m.size}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{m.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] uppercase border-border text-muted-foreground hidden sm:flex">
                            {m.type}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(m.id)}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">{t("common.noData")}</div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md p-6 shadow-2xl border-border/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Upload className="text-primary h-5 w-5"/> {t("materials.modalTitle")}
              </h2>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("materials.fileNameLabel")}</label>
                <Input 
                  placeholder={t("materials.fileNamePlaceholder")} 
                  value={newFile.name}
                  onChange={(e) => setNewFile({ ...newFile, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("materials.subjectLabel")}</label>
                {userSubjects.length > 0 ? (
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFile.subject}
                    onChange={(e) => setNewFile({ ...newFile, subject: e.target.value })}
                  >
                    {userSubjects.map((sub, i) => (
                      <option key={i} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input 
                    placeholder={t("materials.subjectPlaceholder")} 
                    value={newFile.subject}
                    onChange={(e) => setNewFile({ ...newFile, subject: e.target.value })}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("materials.fileTypeLabel")}</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFile.type}
                    onChange={(e) => setNewFile({ ...newFile, type: e.target.value as any })}
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">Word (DOCX)</option>
                    <option value="pptx">PowerPoint</option>
                    <option value="xlsx">Excel (XLSX)</option>
                    <option value="png">{t("materials.imageType")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("materials.categoryLabel")}</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFile.category}
                    onChange={(e) => setNewFile({ ...newFile, category: e.target.value as any })}
                  >
                    <option value="notes">{t("materials.tabNotes")}</option>
                    <option value="assignments">{t("materials.tabAssignments")}</option>
                    <option value="other">{t("materials.tabOther")}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleUpload}>
                  {t("materials.addFileBtn")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}