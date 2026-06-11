"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/language-context"
import { MapPin, Navigation, Building2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export function CampusMapScreen() {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const buildings = [
    { id: "nk", name: "НК", full: t("campus.nk"), x: 230, y: 60, w: 70, h: 44, color: "#1e40af", text: "#fff", type: "study", icon: "⭐" },
    { id: "gmk", name: "ГМК", full: t("campus.gmk"), x: 200, y: 110, w: 80, h: 50, color: "#1d4ed8", text: "#fff", type: "study", icon: "🏛" },
    { id: "gmk2", name: "ГМК", full: t("campus.gmk2"), x: 310, y: 110, w: 80, h: 50, color: "#1d4ed8", text: "#fff", type: "study", icon: "🏛" },
    { id: "gmk3", name: "ГМК", full: t("campus.gmk3"), x: 230, y: 230, w: 140, h: 50, color: "#1d4ed8", text: "#fff", type: "study", icon: "🏛" },
    { id: "guk", name: "ГУК", full: t("campus.guk"), x: 130, y: 160, w: 60, h: 180, color: "#1e40af", text: "#fff", type: "study", icon: "🏫" },
    { id: "ttk", name: "ТТК", full: t("campus.ttk"), x: 240, y: 320, w: 80, h: 50, color: "#4c1d95", text: "#fff", type: "institute", icon: "⚙️" },
    { id: "upz", name: "УПЦ", full: t("campus.upz"), x: 200, y: 300, w: 60, h: 40, color: "#5b21b6", text: "#fff", type: "institute", icon: "🔧" },
    { id: "technopark", name: "Технопарк", full: t("campus.technopark"), x: 350, y: 320, w: 100, h: 50, color: "#6d28d9", text: "#fff", type: "institute", icon: "💡" },
    { id: "kolizey", name: "Колизей", full: t("campus.kolizey"), x: 230, y: 170, w: 70, h: 50, color: "#bfdbfe", text: "#1e3a8a", type: "hall", icon: "🎭", dashed: true },
    { id: "depo", name: "ДЕПО", full: t("campus.depo"), x: 310, y: 170, w: 60, h: 50, color: "#bfdbfe", text: "#1e3a8a", type: "hall", icon: "🎪", dashed: true },
    { id: "msk", name: "МСК", full: t("campus.msk"), x: 544, y: 60, w: 60, h: 44, color: "#1d4ed8", text: "#fff", type: "study", icon: "🏃" },
    { id: "muk", name: "МУК", full: t("campus.muk"), x: 614, y: 60, w: 60, h: 44, color: "#1d4ed8", text: "#fff", type: "study", icon: "📚" },
    { id: "ims", name: "ИМС", full: t("campus.ims"), x: 544, y: 114, w: 60, h: 44, color: "#1e40af", text: "#fff", type: "study", icon: "⚙️" },
    { id: "pol", name: "ПОЛ", full: t("campus.pol"), x: 614, y: 114, w: 40, h: 44, color: "#2563eb", text: "#fff", type: "study", icon: "🔬" },
    { id: "kts", name: "КЦ", full: t("campus.kts"), x: 660, y: 114, w: 44, h: 44, color: "#1e3a8a", text: "#fff", type: "hall", icon: "🎨" },
    { id: "fablab", name: "FabLab", full: t("campus.fablab"), x: 544, y: 168, w: 70, h: 44, color: "#065f46", text: "#fff", type: "lab", icon: "🖨️" },
    { id: "dorm1", name: "Общ.1", full: t("campus.dorm1"), x: 544, y: 260, w: 75, h: 44, color: "#92400e", text: "#fff", type: "dorm", icon: "🏠" },
    { id: "dorm2", name: "Общ.2", full: t("campus.dorm2"), x: 629, y: 260, w: 75, h: 44, color: "#92400e", text: "#fff", type: "dorm", icon: "🏠" },
    { id: "dorm3", name: "Общ.3", full: t("campus.dorm3"), x: 544, y: 314, w: 75, h: 44, color: "#b45309", text: "#fff", type: "dorm", icon: "🏠" },
    { id: "dorm4", name: "Общ.4", full: t("campus.dorm4"), x: 629, y: 314, w: 75, h: 44, color: "#b45309", text: "#fff", type: "dorm", icon: "🏠" },
  ]

  const legend = [
    { color: "#1d4ed8", label: t("campus.typeStudy"), type: "study" },
    { color: "#5b21b6", label: t("campus.typeInstitute"), type: "institute" },
    { color: "#065f46", label: t("campus.typeLab"), type: "lab" },
    { color: "#92400e", label: t("campus.typeDorm"), type: "dorm" },
    { color: "#bfdbfe", label: t("campus.typeHall"), type: "hall" },
  ]

  const filtered = buildings.filter(b => {
    const matchFilter = filter === "all" || b.type === filter
    const matchSearch = search === "" || b.name.toLowerCase().includes(search.toLowerCase()) || b.full.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full pb-10">

      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-5 rounded-2xl border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-md">
            <MapPin size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("nav.campusMap")}</h1>
            <p className="text-sm text-muted-foreground">{t("campus.subtitle")}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
          {t("campus.filterAll")}
        </button>
        {legend.map(l => (
          <button key={l.type} onClick={() => setFilter(l.type)} className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === l.type ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{backgroundColor: l.color}}/>
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Карта */}
        <div className="flex-1 rounded-2xl border border-border overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="px-4 py-2 border-b border-border bg-card/80 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"/>
              <div className="w-3 h-3 rounded-full bg-yellow-400"/>
              <div className="w-3 h-3 rounded-full bg-green-400"/>
            </div>
            <span className="text-xs text-muted-foreground ml-2">Satbayev University Campus</span>
          </div>
          <svg viewBox="0 0 720 400" xmlns="http://www.w3.org/2000/svg" style={{width:"100%"}}>
            <defs>
              <filter id="shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15"/>
              </filter>
            </defs>

            {/* Небо/фон */}
            <rect width="720" height="400" fill="transparent"/>

            {/* Улица */}
            <rect x="0" y="0" width="720" height="38" fill="#d1fae5" rx="0"/>
            <line x1="0" y1="38" x2="720" y2="38" stroke="#6ee7b7" strokeWidth="1"/>
            <text x="360" y="24" textAnchor="middle" fontSize="12" fontWeight="600" fill="#065f46">{t("campus.street")}</text>

            {/* Парк */}
            <rect x="8" y="44" width="104" height="172" fill="#d1fae5" rx="10" stroke="#6ee7b7" strokeWidth="1"/>
            <text x="60" y="118" textAnchor="middle" fontSize="13">🌳</text>
            <text x="60" y="136" textAnchor="middle" fontSize="11" fill="#065f46" fontWeight="500">{t("campus.park")}</text>

            {/* Дорожка */}
            <rect x="512" y="44" width="14" height="328" fill="#e2e8f0" rx="2"/>
            <line x1="519" y1="44" x2="519" y2="372" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="6,4"/>

            {/* Левый кампус */}
            <rect x="118" y="42" width="388" height="330" fill="white" rx="12" stroke="#bfdbfe" strokeWidth="1.5" filter="url(#shadow)" fillOpacity="0.6"/>

            {/* Правый кампус */}
            <rect x="530" y="42" width="182" height="330" fill="white" rx="12" stroke="#bfdbfe" strokeWidth="1.5" filter="url(#shadow)" fillOpacity="0.6"/>

            {/* Институт ГиН */}
            <rect x="128" y="50" width="64" height="100" fill="#14532d" rx="6" filter="url(#shadow)"/>
            <text x="160" y="93" textAnchor="middle" fontSize="10" fill="#bbf7d0" fontWeight="500">Ин-т</text>
            <text x="160" y="107" textAnchor="middle" fontSize="10" fill="#bbf7d0" fontWeight="500">ГиН</text>

            {/* Корпуса */}
            {buildings.map(b => {
              const isSelected = selected?.id === b.id
              const isInFiltered = filtered.find(f => f.id === b.id)
              const opacity = isInFiltered ? 1 : 0.2
              return (
                <g key={b.id} onClick={() => setSelected(isSelected ? null : b)} style={{cursor:"pointer"}} opacity={opacity}>
                  <rect
                    x={b.x} y={b.y} width={b.w} height={b.h}
                    fill={b.color} rx="6"
                    stroke={isSelected ? "#f59e0b" : "transparent"}
                    strokeWidth={isSelected ? 3 : 0}
                    filter="url(#shadow)"
                    strokeDasharray={(b as any).dashed ? "5,3" : "none"}
                  />
                  {isSelected && <rect x={b.x-2} y={b.y-2} width={b.w+4} height={b.h+4} fill="none" rx="8" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,2" opacity="0.6"/>}
                  <text x={b.x + b.w/2} y={b.y + b.h/2 + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={b.text}>
                    {b.name}
                  </text>
                </g>
              )
            })}

            {/* Маркер "Вы" */}
            <circle cx="265" cy="82" r="11" fill="#ef4444" opacity="0.2"/>
            <circle cx="265" cy="82" r="7" fill="#ef4444"/>
            <circle cx="265" cy="82" r="3" fill="white"/>
            <text x="265" y="68" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ef4444">{t("campus.you")}</text>
          </svg>
        </div>

        {/* Правая панель */}
        <div className="w-full lg:w-72 flex flex-col gap-3">

          {/* Инфо */}
          {selected ? (
            <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {selected.icon}
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{selected.full}</p>
                </div>
              </div>
              <Badge className="w-fit text-xs" style={{backgroundColor: selected.color + "20", color: selected.color, border: `1px solid ${selected.color}40`}}>
                {legend.find(l => l.type === selected.type)?.label}
              </Badge>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors border-t border-border pt-2 text-left"
              >
                ← {t("campus.clickHint")}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/5 p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
              <div className="text-4xl">🗺️</div>
              <p className="text-sm text-muted-foreground">{t("campus.selectHint")}</p>
            </div>
          )}

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-primary">20</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("campus.typeStudy")}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-purple-500">4</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("campus.typeDorm")}</p>
            </div>
          </div>

          {/* Легенда */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2 shadow-sm">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("campus.legend")}</p>
            {legend.map(l => (
              <button
                key={l.type}
                onClick={() => setFilter(filter === l.type ? "all" : l.type)}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity text-left"
              >
                <div className="w-3 h-3 rounded shrink-0" style={{backgroundColor: l.color}}/>
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border">
              <div className="w-3 h-3 rounded-full shrink-0 bg-red-500"/>
              <span className="text-xs text-muted-foreground">{t("campus.youAreHere")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}