"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY

interface EduBotProps {
  language?: string
  userName?: string
  gpa?: number          // передайте реальный GPA студента
  weakSubject?: string  // передайте слабый предмет
}

const BUTTON_LABELS: Record<string, { tip: string; motive: string; warn: string; praise: string }> = {
  ru: { tip: "💡 Совет", motive: "🔥 Мотивация", warn: "⚠️ Предупреди", praise: "🎉 Похвали" },
  kz: { tip: "💡 Кеңес", motive: "🔥 Мотивация", warn: "⚠️ Ескерт",    praise: "🎉 Мақта"  },
  en: { tip: "💡 Tip",   motive: "🔥 Motivate",   warn: "⚠️ Warn me",  praise: "🎉 Praise" },
}

const GREETINGS: Record<string, string> = {
  ru: "Привет! Нажми кнопку — дам реальный совет 🎓",
  kz: "Сәлем! Батырманы бас — нақты кеңес беремін 🎓",
  en: "Hi! Press a button — I'll give you real advice 🎓",
}

export function EduBot({ language = "ru", userName = "Студент", gpa, weakSubject }: EduBotProps) {
  const [bubble, setBubble] = useState(GREETINGS[language] || GREETINGS.ru)
  const [loading, setLoading] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)

  useEffect(() => {
    setBubble(GREETINGS[language] || GREETINGS.ru)
  }, [language])

  const animateMouth = () => {
    let i = 0
    const iv = setInterval(() => {
      setMouthOpen(p => !p)
      i++
      if (i > 8) { clearInterval(iv); setMouthOpen(false) }
    }, 140)
  }

  const ask = async (type: "tip" | "motive" | "warn" | "praise") => {
    if (loading) return
    setLoading(true)

    const langName: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" }
    const context = [
      gpa ? `GPA студента: ${gpa}` : "",
      weakSubject ? `Слабый предмет: ${weakSubject}` : "",
      `Имя студента: ${userName}`,
    ].filter(Boolean).join(". ")

    const prompts: Record<string, string> = {
      tip:    `Дай 1 конкретный практический совет по учёбе для студента. ${context}. Совет должен быть actionable и конкретным, 2-3 предложения.`,
      motive: `Дай мотивирующее сообщение студенту учитывая его ситуацию. ${context}. Искренне и по делу, 2-3 предложения.`,
      warn:   `Укажи на 1 главный риск или проблему которую студент должен срочно исправить. ${context}. Конкретно и честно, 2-3 предложения.`,
      praise: `Похвали студента за его старания, найди что-то конкретное за что можно похвалить. ${context}. Тепло и искренне, 2-3 предложения.`,
    }

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 120,
          messages: [
            {
              role: "system",
              content: `Ты дружелюбный мультяшный персонаж EduBot — помощник студента. Отвечай ТОЛЬКО на ${langName[language] || "русском"} языке. Отвечай коротко — максимум 2-3 предложения. Без markdown, без звёздочек, просто текст.`,
            },
            { role: "user", content: prompts[type] },
          ],
        }),
      })

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim() || GREETINGS[language]
      setBubble(text)
      animateMouth()
    } catch {
      setBubble(GREETINGS[language])
    } finally {
      setLoading(false)
    }
  }

  const mouth = mouthOpen ? "M 48 64 Q 60 75 72 64" : "M 48 64 Q 60 70 72 64"
  const btns = BUTTON_LABELS[language] || BUTTON_LABELS.ru

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Пузырь речи */}
      <div className="relative bg-white border border-blue-100 rounded-2xl px-4 py-3 text-xs text-slate-700 w-full text-center shadow-sm leading-relaxed min-h-[52px] flex items-center justify-center">
        {loading
          ? <Loader2 size={14} className="animate-spin text-primary" />
          : bubble}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-white" />
      </div>

      {/* Персонаж (Жаңартылған заманауи дизайн) */}
      <div className="relative flex justify-center items-center my-2">
        <style>{`
          @keyframes edubot-float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
          @keyframes edubot-wave  { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(25deg)} 70%{transform:rotate(-10deg)} }
          @keyframes edubot-blink { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.1)} }
          .eb-body { animation: edubot-float 3.5s ease-in-out infinite; }
          .eb-arm { transform-origin: 90px 75px; animation: edubot-wave 2s ease-in-out infinite; }
          .eb-eyeL { transform-origin: 46px 56px; animation: edubot-blink 4s ease-in-out infinite; }
          .eb-eyeR { transform-origin: 74px 56px; animation: edubot-blink 4s ease-in-out infinite 0.2s; }
        `}</style>
        
        {/* Артқы голографиялық жарық (Glow effect) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-violet-500/20 dark:bg-violet-500/30 blur-2xl rounded-full" />

        <svg width="110" height="130" viewBox="0 0 120 140" className="eb-body z-10 relative">
          {/* Астындағы көлеңкесі */}
          <ellipse cx="60" cy="130" rx="22" ry="5" fill="currentColor" className="text-slate-200 dark:text-slate-800" />

          {/* Негізгі денесі (Төменгі бөлігі) */}
          <path d="M 40 85 C 40 110, 80 110, 80 85 Z" fill="url(#bodyGrad)" />
          <rect x="42" y="75" width="36" height="20" rx="6" fill="url(#bodyGrad)" />

          {/* Оң қол (Қозғалмайтын) */}
          <g>
            <path d="M 38 80 Q 25 85 22 100" fill="none" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" />
            <circle cx="22" cy="100" r="4.5" fill="#c4b5fd" />
          </g>

          {/* Сол қол (Бұлғаңдайтын) */}
          <g className="eb-arm">
            <path d="M 82 80 Q 95 70 100 55" fill="none" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" />
            <circle cx="100" cy="55" r="4.5" fill="#c4b5fd" />
          </g>

          {/* Басы (Ақ/қара корпус) */}
          <rect x="25" y="35" width="70" height="48" rx="18" fill="#ffffff" className="dark:fill-slate-800" stroke="#8b5cf6" strokeWidth="2" />
          
          {/* Басындағы экран (Қара түсті) */}
          <rect x="31" y="41" width="58" height="36" rx="12" fill="#0f172a" />

          {/* Көздері (Неон түсті көк) */}
          <g className="eb-eyeL">
            <rect x="40" y="49" width="12" height="14" rx="5" fill="#2dd4bf" />
            <circle cx="43" cy="53" r="2.5" fill="#ccfbf1" />
          </g>
          <g className="eb-eyeR">
            <rect x="68" y="49" width="12" height="14" rx="5" fill="#2dd4bf" />
            <circle cx="71" cy="53" r="2.5" fill="#ccfbf1" />
          </g>

          {/* Сөйлеп тұрғандағы ауыз анимациясы (Аудио толқын) */}
          {mouthOpen ? (
            <g className="animate-pulse">
              <rect x="52" y="66" width="16" height="3" rx="1.5" fill="#2dd4bf" />
              <rect x="55" y="62" width="10" height="3" rx="1.5" fill="#2dd4bf" />
              <rect x="55" y="70" width="10" height="3" rx="1.5" fill="#2dd4bf" />
            </g>
          ) : (
            <rect x="56" y="67" width="8" height="2.5" rx="1" fill="#2dd4bf" opacity="0.6" />
          )}

          {/* Академиялық қалпақ (Graduation Cap) */}
          <path d="M 20 25 L 60 12 L 100 25 L 60 38 Z" fill="#6d28d9" />
          <rect x="46" y="32" width="28" height="8" fill="#5b21b6" />
          {/* Қалпақтың шашағы (Алтын түсті) */}
          <path d="M 60 25 Q 85 28 90 42" fill="none" stroke="#f59e0b" strokeWidth="2" />
          <circle cx="90" cy="44" r="3.5" fill="#f59e0b" />

          {/* Денесіне арналған градиент бояу */}
          <defs>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#6d28d9" />
            </linearGradient>
          </defs>
        </svg>
      </div>  

      {/* Кнопки */}
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {([["tip", btns.tip], ["motive", btns.motive], ["warn", btns.warn], ["praise", btns.praise]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => ask(key)}
            disabled={loading}
            className="px-2 py-1.5 rounded-xl border border-blue-200 bg-white text-blue-700 text-[11px] font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
