import * as React from "react"
import useWarehouseStore from "@/lib/store/useWarehouseStore"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { StockBadge, CategoryBadge, LocationBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { CATEGORIES, exportToCSV } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { Search, Download, Filter, Package } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Inventory() {
  const inventory = useWarehouseStore(s => s.inventory ?? [])
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = React.useState("")
  const [catFilter, setCatFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [sortBy, setSortBy] = React.useState("materialId")

  const uniqueCategories = React.useMemo(() => {
    const cats = new Set(inventory.map(m => m.category).filter(Boolean))
    CATEGORIES.forEach(c => cats.add(c))
    return Array.from(cats).sort()
  }, [inventory])

  const filtered = React.useMemo(() => {
    return inventory
      .filter(i => {
        const q = search.toLowerCase()
        const matchSearch = !q || i.materialId?.toLowerCase().includes(q) || i.materialDesc?.toLowerCase().includes(q) || i.locationId?.toLowerCase().includes(q)
        const matchCat = catFilter === "all" || i.category === catFilter
        const matchStatus = statusFilter === "all" || i.status === statusFilter
        return matchSearch && matchCat && matchStatus
      })
      .sort((a, b) => {
        if (sortBy === "stock") return b.currentStock - a.currentStock
        if (sortBy === "status") return a.status.localeCompare(b.status)
        return a.materialId.localeCompare(b.materialId)
      })
  }, [inventory, search, catFilter, statusFilter, sortBy])

  const exportCSV = () => {
    const headers = [
       "Material ID",
       "Material Description",
       "Category",
       "Location ID",
       "Opening Stock",
       "Current Stock",
       "Stock IN",
       "Stock OUT",
       "Unit",
       "Reorder Level",
       "Status"
    ]
    const rows = filtered.map(i => [
      i.materialId,
      i.materialDesc || "",
      i.category || "",
      i.locationId || "",
      i.openingStock ?? 0,
      Number(i.currentStock ?? 0).toFixed(2),
      i.stockIn ?? 0,
      i.stockOut ?? 0,
      i.unit || "PCS",
      i.reorderLevel ?? 0,
      i.status || "OK"
    ])
    const dateStr = new Date().toISOString().slice(0, 10)
    exportToCSV(`inventory_export_${dateStr}.csv`, headers, rows)
    toast({ title: "Inventory exported", description: `${filtered.length} items exported to CSV.`, variant: "success" })
  }

  const stats = React.useMemo(() => ({
    ok: inventory.filter(i => i.status === "OK").length,
    reorder: inventory.filter(i => i.status === "REORDER").length,
    empty: inventory.filter(i => i.status === "EMPTY").length,
  }), [inventory])

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "OK",      count: stats.ok,      activeBg: "bg-emerald-500/15 border-emerald-500/40", numColor: "text-emerald-600 dark:text-emerald-400" },
          { label: "REORDER", count: stats.reorder,  activeBg: "bg-amber-500/15 border-amber-500/40",   numColor: "text-amber-600 dark:text-amber-400"   },
          { label: "EMPTY",   count: stats.empty,    activeBg: "bg-red-500/15 border-red-500/40",       numColor: "text-red-600 dark:text-red-400"       },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(statusFilter === s.label ? "all" : s.label)}
            className={`rounded-xl border p-3 text-left transition-all ${statusFilter === s.label ? s.activeBg : "glass border-border hover:border-primary/30"}`}
          >
            <p className={`text-2xl font-bold ${s.numColor}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              Inventory ({filtered.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={exportCSV} className="w-full sm:w-auto"><Download size={13}/> Export CSV</Button>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search material, ID, location..." className="pl-9" />
            </div>
            <div className="w-40">
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                  <SelectItem value="REORDER">REORDER</SelectItem>
                  <SelectItem value="EMPTY">EMPTY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="materialId">Sort: ID</SelectItem>
                  <SelectItem value="stock">Sort: Stock</SelectItem>
                  <SelectItem value="status">Sort: Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="overflow-x-auto w-full">
            <table className="w-full wms-table min-w-[800px]">
              <thead>
                <tr>
                  <th className="text-left">Material</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Location</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">Stock IN</th>
                  <th className="text-right">Stock OUT</th>
                  <th className="text-right">Reorder At</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={`${item.materialId}-${item.locationId}`} className="cursor-pointer" onClick={() => navigate("/movements", { state: { materialId: item.materialId } })}>
                    <td>
                      <p className="font-medium text-foreground">{item.materialDesc}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{item.materialId}</p>
                    </td>
                    <td><CategoryBadge category={item.category} /></td>
                    <td><LocationBadge locationId={item.locationId} /></td>
                    <td className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm">
                        <span className="font-mono text-sm">{Number(item.currentStock).toFixed(2)}</span>
                        <span className="text-[10px] uppercase ml-1 opacity-80">{item.unit}</span>
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-medium border border-emerald-500/20">
                        {item.stockIn}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs font-medium border border-red-500/20">
                        {item.stockOut}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground font-mono text-xs font-medium border border-border">
                        {item.reorderLevel} <span className="text-[10px] uppercase ml-1 opacity-70">{item.unit}</span>
                      </span>
                    </td>
                    <td className="text-center"><StockBadge status={item.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No items match your filters</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/20">
                    <td colSpan={3} className="py-3 px-4 text-xs font-semibold text-muted-foreground">TOTALS ({filtered.length} items)</td>
                    <td className="text-right py-3 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm">
                        <span className="font-mono text-sm">
                          {filtered.reduce((s, i) => s + (i.currentStock ?? 0), 0).toFixed(2)}
                        </span>
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-sm font-bold border border-emerald-500/20">
                        {filtered.reduce((s, i) => s + (i.stockIn ?? 0), 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-sm font-bold border border-red-500/20">
                        {filtered.reduce((s, i) => s + (i.stockOut ?? 0), 0).toFixed(0)}
                      </span>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
