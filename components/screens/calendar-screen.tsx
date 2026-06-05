"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, Loader2, Trash2 } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useLanguage } from "@/lib/language-context" // <-- ИМПОРТИРУЕМ ЯЗЫК

interface CalendarEvent {
  id: string
  title: string
  time: string
  type: "lecture" | "exam" | "assignment" | "study"
  subject: string
}

interface Subject {
  name: string;
}

const typeColors: Record<string, string> = {
  lecture: "bg-primary/10 text-primary border-primary/20",
  exam: "bg-destructive/10 text-destructive border-destructive/20",
  assignment: "bg-warning/10 text-warning border-warning/20",
  study: "bg-success/10 text-success border-success/20",
}

export function CalendarScreen() {
  const { t, language } = useLanguage() // <-- ДОСТАЕМ ФУНКЦИИ ПЕРЕВОДА

  // Локализованные дни и месяцы напрямую в компоненте
  const getDaysOfWeek = () => {
    if (language === "en") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    if (language === "kz") return ["Дс", "Сс", "Ср", "Бс", "Жм", "Сн", "Жк"]
    return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  }

  const getMonthNames = () => {
    if (language === "en") return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    if (language === "kz") return ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"]
    return ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
  }

  const daysOfWeek = getDaysOfWeek()
  const monthNames = getMonthNames()

  // Навигация по датам
  const [baseDate, setBaseDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  
  // Данные
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({})
  const [userSubjects, setUserSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Модальное окно
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    type: "lecture",
    title: "",
    time: "",
    subject: ""
  })

  // Расчет сетки календаря
  const currentYear = baseDate.getFullYear()
  const currentMonth = baseDate.getMonth()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
  const firstDayOffset = (firstDayIndex + 6) % 7 // Смещение для Пн-Вс

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDayOffset; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  // Форматирование ключа даты (YYYY-MM-DD)
  const getDateKey = (day: number) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedDateKey = getDateKey(selectedDay);
  const selectedEvents = events[selectedDateKey] || [];

  // Загрузка данных
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.subjects) {
            setUserSubjects(data.subjects)
            if (data.subjects.length > 0) {
              setNewEvent(prev => ({ ...prev, subject: data.subjects[0].name }))
            }
          }
          if (data.myCalendar) setEvents(data.myCalendar)
        }
      }
      setIsLoading(false)
    }
    fetchCalendarData()
  }, [])

  // Сохранение в базу
  const saveEventsToDb = async (newEvents: Record<string, CalendarEvent[]>) => {
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(docRef, { myCalendar: newEvents })
    }
  }

  // Навигация
  const handlePrevMonth = () => {
    setBaseDate(new Date(currentYear, currentMonth - 1, 1))
    setSelectedDay(1)
  }
  
  const handleNextMonth = () => {
    setBaseDate(new Date(currentYear, currentMonth + 1, 1))
    setSelectedDay(1)
  }
  
  const handleToday = () => {
    const now = new Date()
    setBaseDate(now)
    setSelectedDay(now.getDate())
  }

  // Добавление события
  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.time || !newEvent.subject) {
      alert(language === "en" ? "Please fill in all fields" : language === "kz" ? "Барлық өрістерді толтырыңыз" : "Пожалуйста, заполните все поля");
      return;
    }

    const eventToAdd: CalendarEvent = {
      id: Date.now().toString(),
      title: newEvent.title,
      time: newEvent.time,
      type: newEvent.type as any,
      subject: newEvent.subject
    };

    const updatedEvents = { ...events };
    if (!updatedEvents[selectedDateKey]) {
      updatedEvents[selectedDateKey] = [];
    }
    updatedEvents[selectedDateKey].push(eventToAdd);
    
    // Сортируем по времени
    updatedEvents[selectedDateKey].sort((a, b) => a.time.localeCompare(b.time));

    setEvents(updatedEvents);
    await saveEventsToDb(updatedEvents);
    
    setIsModalOpen(false);
    setNewEvent(prev => ({ ...prev, title: "", time: "" }));
  }

  // Удаление события
  const handleDeleteEvent = async (eventId: string) => {
    const updatedEvents = { ...events };
    updatedEvents[selectedDateKey] = updatedEvents[selectedDateKey].filter(e => e.id !== eventId);
    
    if (updatedEvents[selectedDateKey].length === 0) {
      delete updatedEvents[selectedDateKey];
    }

    setEvents(updatedEvents);
    await saveEventsToDb(updatedEvents);
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10 relative">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("calendar.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* КАЛЕНДАРЬ */}
        <Card className="border-border/60 bg-card shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
            <CardTitle className="text-base font-bold text-foreground">
              {monthNames[currentMonth]} {currentYear}
            </CardTitle>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleToday} className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
                {t("common.today")}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map((d, i) => (
                <div key={d} className={`text-center text-xs font-bold py-2 ${i >= 5 ? 'text-destructive/70' : 'text-muted-foreground'}`}>
                  {d}
                </div>
              ))}
            </div>
            {/* Сетка дней */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="min-h-[60px]" />
                
                const dateKey = getDateKey(day);
                const dayEvents = events[dateKey] || []
                const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
                const isSelected = day === selectedDay;
                
                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 min-h-[65px] border transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                        : isToday
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-foreground bg-background border-border/50 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <span className={`text-sm ${isToday || isSelected ? 'font-bold' : 'font-medium'}`}>{day}</span>
                    
                    {/* Точки событий */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1 mt-auto">
                        {dayEvents.slice(0, 4).map((e, j) => (
                          <div
                            key={j}
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected
                                ? "bg-primary-foreground"
                                : e.type === "exam"
                                  ? "bg-destructive"
                                  : e.type === "assignment"
                                    ? "bg-warning"
                                    : e.type === "study"
                                      ? "bg-success"
                                      : "bg-primary"
                            }`}
                          />
                        ))}
                        {dayEvents.length > 4 && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ПРАВАЯ ПАНЕЛЬ: События выбранного дня */}
        <Card className="border-border/60 bg-card shadow-sm h-fit flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {selectedDay} {monthNames[currentMonth].toLowerCase()}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4 flex-1">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
                <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("calendar.emptyDay")}</p>
              </div>
            ) : (
              selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg border p-3.5 transition-all hover:shadow-sm group relative overflow-hidden ${typeColors[event.type]}`}
                >
                  <div className="flex items-start justify-between mb-2 pr-6">
                    <Badge variant="secondary" className="text-[10px] bg-background/60 text-foreground font-semibold uppercase tracking-wider">
                      {t(`calendar.types.${event.type}`)}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs font-bold opacity-90 bg-background/50 px-2 py-0.5 rounded-md">
                      <Clock className="h-3 w-3" />
                      <span>{event.time}</span>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold leading-tight text-foreground pr-6">{event.title}</h4>
                  <p className="text-xs opacity-80 mt-1 font-medium">{event.subject}</p>
                  
                  {/* Кнопка удаления */}
                  <button 
                    onClick={() => handleDeleteEvent(event.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}

            {/* Кнопка добавления внизу списка */}
            <Button 
              onClick={() => setIsModalOpen(true)} 
              className="w-full mt-2 gap-2 border-dashed bg-muted/20 text-foreground hover:bg-primary hover:text-white transition-colors" 
              variant="outline"
            >
              <Plus size={16} /> {t("calendar.addEvent")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ДОБАВЛЕНИЯ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md p-6 shadow-2xl border-border/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {t("calendar.modalTitle")} {selectedDay} {monthNames[currentMonth].toLowerCase()}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Тип события */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("calendar.eventType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {["lecture", "exam", "assignment", "study"].map((key) => (
                    <button
                      key={key}
                      onClick={() => setNewEvent({ ...newEvent, type: key as any })}
                      className={`text-xs py-2 px-3 rounded-lg border font-medium transition-colors ${
                        newEvent.type === key 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-muted/30 text-foreground hover:bg-muted"
                      }`}
                    >
                      {t(`calendar.types.${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Предмет */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("calendar.subject")}</label>
                {userSubjects.length > 0 ? (
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newEvent.subject}
                    onChange={(e) => setNewEvent({ ...newEvent, subject: e.target.value })}
                  >
                    {userSubjects.map((sub, i) => (
                      <option key={i} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input 
                    placeholder={t("calendar.subject")}
                    value={newEvent.subject}
                    onChange={(e) => setNewEvent({ ...newEvent, subject: e.target.value })}
                  />
                )}
              </div>

              {/* Название и Время */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("calendar.eventName")}</label>
                  <Input 
                    placeholder="Пр. on-line 200" 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{t("calendar.time")}</label>
                  <Input 
                    placeholder="10:00-10:50" 
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  />
                </div>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleAddEvent}>
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