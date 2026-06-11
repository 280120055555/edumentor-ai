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

      {/* Персонаж */}
      <div style={{ animation: "edubot-float 3s ease-in-out infinite" }}>
        <style>{`
          @keyframes edubot-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
          @keyframes edubot-wave  { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(24deg)} 70%{transform:rotate(-8deg)} }
          @keyframes edubot-blink { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.08)} }
          .eb-arm { transform-origin:92px 88px; animation:edubot-wave 1.8s ease-in-out infinite; }
          .eb-eyeL { transform-origin:48px 50px; animation:edubot-blink 4.2s ease-in-out infinite; }
          .eb-eyeR { transform-origin:72px 50px; animation:edubot-blink 4.2s ease-in-out infinite 0.3s; }
        `}</style>
        <svg width="100" height="125" viewBox="0 0 120 140">
          {/* Тело */}
          <ellipse cx="60" cy="96" rx="28" ry="32" fill="#1d4ed8"/>
          <ellipse cx="60" cy="69" rx="22" ry="8" fill="#1e40af"/>
          {/* Голова */}
          <circle cx="60" cy="50" r="28" fill="#fde68a"/>
          {/* Шапка */}
          <rect x="34" y="26" width="52" height="7" rx="3" fill="#1e293b"/>
          <rect x="44" y="14" width="32" height="14" rx="3" fill="#1e293b"/>
          <rect x="72" y="12" width="3" height="8" fill="#1e293b"/>
          <circle cx="73" cy="11" r="4" fill="#ef4444"/>
          {/* Глаза */}
          <ellipse className="eb-eyeL" cx="48" cy="50" rx="5" ry="6" fill="white"/>
          <ellipse className="eb-eyeR" cx="72" cy="50" rx="5" ry="6" fill="white"/>
          <circle cx="49" cy="51" r="3" fill="#1e293b"/>
          <circle cx="73" cy="51" r="3" fill="#1e293b"/>
          <circle cx="50" cy="50" r="1" fill="white"/>
          <circle cx="74" cy="50" r="1" fill="white"/>
          {/* Нос */}
          <ellipse cx="60" cy="57" rx="3" ry="2" fill="#f59e0b"/>
          {/* Рот */}
          <path d={mouth} stroke="#92400e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          {/* Румянец */}
          <ellipse cx="44" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.5"/>
          <ellipse cx="76" cy="63" rx="6" ry="4" fill="#fca5a5" opacity="0.5"/>
          {/* Руки */}
          <ellipse cx="28" cy="91" rx="9" ry="18" fill="#1d4ed8" transform="rotate(-15 28 91)"/>
          <ellipse className="eb-arm" cx="92" cy="89" rx="9" ry="18" fill="#1d4ed8" transform="rotate(15 92 89)"/>
          {/* Кисти */}
          <circle cx="22" cy="104" r="8" fill="#fde68a"/>
          <circle cx="98" cy="101" r="8" fill="#fde68a"/>
          {/* Книга */}
          <rect x="10" y="96" width="18" height="22" rx="2" fill="#ef4444"/>
          <rect x="11" y="97" width="8" height="20" rx="1" fill="#fca5a5" opacity="0.35"/>
          <line x1="10" y1="107" x2="28" y2="107" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          <line x1="10" y1="112" x2="28" y2="112" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          {/* Ноги */}
          <rect x="44" y="123" width="14" height="13" rx="5" fill="#1e293b"/>
          <rect x="62" y="123" width="14" height="13" rx="5" fill="#1e293b"/>
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
