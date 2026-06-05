"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Sparkles, User, Loader2, Bot, Clock, Mic, MicOff, Volume2, VolumeX } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

// ─── Типы для Web Speech API ───────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

// Маппинг языка приложения → код для распознавания речи
const SPEECH_LANG_MAP: Record<string, string> = {
  ru: "ru-RU",
  kz: "kk-KZ",
  en: "en-US",
}

export function AIMentorScreen() {
  const { t, language } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userName, setUserName] = useState("Студент")

  // ─── Голосовой режим ──────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)       // микрофон активен?
  const [isSpeaking, setIsSpeaking] = useState(false)         // AI сейчас говорит?
  const [voiceEnabled, setVoiceEnabled] = useState(true)      // автоозвучка ответов
  const [voiceSupported, setVoiceSupported] = useState(false) // браузер поддерживает?
  const recognitionRef = useRef<any>(null)

  // Проверяем поддержку браузером при монтировании
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
    }
  }, [])

  // При смене языка обновляем язык распознавания
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = SPEECH_LANG_MAP[language] || "ru-RU"
    }
  }, [language])

  // Начать/остановить запись голоса
  const toggleListening = () => {
    if (!voiceSupported || !recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    // Останавливаем озвучку если AI говорит
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    recognitionRef.current.lang = SPEECH_LANG_MAP[language] || "ru-RU"

    recognitionRef.current.onstart = () => setIsListening(true)

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInputValue(transcript)
      // Автоматически отправляем после распознавания
      setTimeout(() => handleSend(transcript), 300)
    }

    recognitionRef.current.onerror = () => setIsListening(false)
    recognitionRef.current.onend = () => setIsListening(false)

    try {
      recognitionRef.current.start()
    } catch (e) {
      setIsListening(false)
    }
  }

  // Озвучить текст через синтез речи
  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return

    // Убираем markdown разметку перед озвучкой
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/`(.*?)`/g, "$1")
      .slice(0, 500) // Ограничиваем длину для быстрого ответа

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = SPEECH_LANG_MAP[language] || "ru-RU"
    utterance.rate = 0.95
    utterance.pitch = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // Остановить озвучку
  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  // ─── Остальная логика (без изменений) ────────────────────────────────────
  const initialSuggestions = [
    t("aiMentor.sug1"),
    t("aiMentor.sug2"),
    t("aiMentor.sug3"),
    t("aiMentor.sug4"),
  ]
  const [suggestions, setSuggestions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSuggestions(initialSuggestions)
  }, [language])

  useEffect(() => {
    const initChat = async () => {
      let name = "Студент"
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid))
        if (snap.exists()) name = snap.data().firstName || "Студент"
      }
      setUserName(name)
      const greetingMsg = t("aiMentor.greeting").replace("{name}", name)
      setMessages([{
        id: "1",
        role: "assistant",
        content: greetingMsg,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      }])
    }
    initChat()
  }, [language])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages, isLoading])

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputValue
    if (!textToSend.trim() || isLoading) return

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages(prev => [...prev, userMsg])
    setInputValue("")
    setIsLoading(true)

    try {
      const chatHistory = messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }))

      const langNames = { ru: "русском", kz: "казахском", en: "английском" }
      const promptLanguage = langNames[language as keyof typeof langNames] || "русском"

      const systemPrompt = `Ты профессиональный академический ментор для студента ${userName}. 
      ОБЯЗАТЕЛЬНО отвечай ТОЛЬКО в формате JSON по следующей структуре:
      {
        "answer": "твой подробный ответ в формате Markdown на ${promptLanguage} языке",
        "suggestions": ["вопрос 1", "вопрос 2", "вопрос 3"]
      }
      В массиве suggestions напиши 3 коротких вопроса по теме на ${promptLanguage} языке.`

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            { role: "user", content: textToSend }
          ]
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || `Ошибка сервера: ${res.status}`)
      }

      const data = await res.json()
      const rawText = data.choices[0].message.content

      let botAnswer = rawText
      let newSuggestions: string[] = []

      try {
        const parsed = JSON.parse(rawText)
        if (parsed.answer) botAnswer = parsed.answer
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          newSuggestions = parsed.suggestions
        }
      } catch (e) {
        console.error("Не удалось прочитать JSON:", e)
      }

      const aiMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: botAnswer,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      }

      setMessages(prev => [...prev, aiMsg])
      if (newSuggestions.length > 0) setSuggestions(newSuggestions)

      // 🔊 Озвучиваем ответ AI если включена автоозвучка
      speakText(botAnswer)

    } catch (error: any) {
      console.error("Пойманная ошибка:", error)
      let errorReason = t("aiMentor.errorGeneric")
      if (error.message === "Failed to fetch") errorReason = t("aiMentor.errorCors")
      else if (error.message) errorReason = `${t("aiMentor.errorApi")} ${error.message}`

      setMessages(prev => [...prev, {
        id: "err" + Date.now(),
        role: "assistant",
        content: errorReason,
        timestamp: "Error"
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto gap-4 overflow-hidden">
      {/* Заголовок */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("aiMentor.title")}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles size={10} className="text-primary" /> Llama 3.1 (Groq API)
            </p>
          </div>
        </div>

        {/* 🎤 Панель управления голосом */}
        {voiceSupported && (
          <div className="flex items-center gap-2">
            {/* Кнопка вкл/выкл автоозвучки */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setVoiceEnabled(!voiceEnabled)
                if (isSpeaking) stopSpeaking()
              }}
              className={`h-9 w-9 rounded-xl ${voiceEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
              title={voiceEnabled ? "Отключить озвучку" : "Включить озвучку"}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </Button>

            {/* Кнопка остановки озвучки */}
            {isSpeaking && (
              <Button
                variant="ghost"
                size="sm"
                onClick={stopSpeaking}
                className="h-9 px-3 rounded-xl text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/30 animate-pulse"
              >
                Стоп
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Главное окно чата */}
        <Card className="flex flex-1 flex-col h-full border-border/60 bg-card shadow-lg overflow-hidden rounded-2xl">
          <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
            <div className="flex flex-col gap-5 pb-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ${
                    msg.role === "assistant" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {msg.role === "assistant" ? <Sparkles size={16} /> : <User size={16} />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                    msg.role === "assistant" ? "bg-muted/40 text-foreground" : "bg-primary text-primary-foreground"
                  }`}>
                    <div className="whitespace-pre-line">{msg.content}</div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-[9px] font-medium opacity-60 uppercase tracking-tighter">
                        {msg.timestamp}
                      </span>
                      {/* Кнопка переслушать конкретное сообщение */}
                      {msg.role === "assistant" && voiceSupported && (
                        <button
                          onClick={() => speakText(msg.content)}
                          className="opacity-40 hover:opacity-80 transition-opacity"
                          title="Прослушать"
                        >
                          <Volume2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 items-center animate-pulse">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Loader2 size={16} className="text-primary animate-spin" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t("aiMentor.analyzing")}</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Быстрые вопросы */}
          <div className="shrink-0 flex gap-2 overflow-x-auto border-t border-border/50 px-4 py-3 bg-muted/5">
            {suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="shrink-0 rounded-full border border-border/60 bg-background px-4 py-2 text-[12px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Поле ввода + кнопка микрофона */}
          <div className="shrink-0 p-4 border-t border-border/50 bg-background">
            <div className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder={
                  isListening
                    ? "🎤 Говорите..."
                    : t("aiMentor.inputPlaceholder")
                }
                className={`h-12 border-muted-foreground/20 focus-visible:ring-primary transition-all ${
                  isListening ? "border-red-400 bg-red-50 dark:bg-red-950/20 placeholder:text-red-400" : ""
                }`}
                disabled={isLoading}
              />

              {/* 🎤 Кнопка микрофона */}
              {voiceSupported && (
                <Button
                  onClick={toggleListening}
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  disabled={isLoading}
                  className={`h-12 w-12 shrink-0 rounded-xl transition-all ${
                    isListening ? "animate-pulse shadow-lg shadow-red-200 dark:shadow-red-900" : ""
                  }`}
                  title={isListening ? "Остановить запись" : "Говорить голосом"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </Button>
              )}

              <Button
                onClick={() => handleSend()}
                size="icon"
                disabled={isLoading}
                className="h-12 w-12 shrink-0 shadow-md active:scale-95 transition-transform rounded-xl"
              >
                <Send size={18} />
              </Button>
            </div>

            {/* Подсказка про голос (только если поддерживается) */}
            {voiceSupported && (
              <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
                {isListening
                  ? "Слушаю... нажмите ещё раз чтобы остановить"
                  : "🎤 Нажмите на микрофон чтобы говорить голосом"}
              </p>
            )}
          </div>
        </Card>

        {/* Правая панель статистики */}
        <Card className="hidden w-72 shrink-0 border-border/60 bg-card shadow-lg lg:flex lg:flex-col rounded-2xl overflow-hidden h-full">
          <div className="shrink-0 border-b border-border/50 p-4 bg-muted/20">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Clock size={14} className="text-primary" /> {t("aiMentor.statsTitle")}
            </h3>
          </div>
          <ScrollArea className="flex-1 p-5">
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>{t("aiMentor.topicProgress")}</span>
                  <span>65%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden border">
                  <div className="h-full bg-primary w-[65%] rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("aiMentor.keyConcepts")}</p>
                <div className="flex flex-wrap gap-2">
                  {[t("aiMentor.concept1"), t("aiMentor.concept2"), t("aiMentor.concept3"), t("aiMentor.concept4")].map(concept => (
                    <span key={concept} className="px-2 py-1 bg-primary/5 border border-primary/20 rounded text-[10px] text-primary font-bold">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>

              {/* 🎤 Статус голосового режима в боковой панели */}
              {voiceSupported && (
                <div className="pt-4 border-t border-dashed border-border/50 space-y-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Голосовой режим
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Автоозвучка</span>
                    <button
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        voiceEnabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {voiceEnabled ? "ВКЛ" : "ВЫКЛ"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Язык речи</span>
                    <span className="text-primary font-bold">
                      {SPEECH_LANG_MAP[language] || "ru-RU"}
                    </span>
                  </div>
                  {isSpeaking && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      AI говорит...
                    </div>
                  )}
                  {isListening && (
                    <div className="flex items-center gap-2 text-[11px] text-red-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Запись...
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-dashed border-border/50">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {t("aiMentor.infoText")}
                </p>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  )
}
