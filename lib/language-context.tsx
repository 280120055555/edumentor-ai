"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"

import ru from "@/components/locales/ru.json"
import kz from "@/components/locales/kz.json"
import en from "@/components/locales/en.json"

const dictionaries: any = { ru, kz, en }

type Language = "ru" | "kz" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru")

  useEffect(() => {
    if (!auth.currentUser) return
    
    // Следим за сменой языка в базе в реальном времени
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
      if (doc.exists() && doc.data().settings?.language) {
        setLanguageState(doc.data().settings.language as Language)
      }
    })
    return () => unsub()
  }, [])

  // Функция для смены языка, которая сразу пишет в Firebase
  const setLanguage = async (newLang: Language) => {
    setLanguageState(newLang)
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, {
        "settings.language": newLang
      })
    }
  }

  const t = (path: string): string => {
    const keys = path.split(".")
    let current = dictionaries[language]
    for (const key of keys) {
      if (current[key] === undefined) return path
      current = current[key]
    }
    return current
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}