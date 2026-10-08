import * as React from "react"
import useWarehouseStore from "@/lib/store/useWarehouseStore"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { CategoryBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { CATEGORIES, UNITS, exportToCSV } from "@/lib/utils"
import { Plus, Search, Pencil, Trash2, Database, Info, Download } from "lucide-react"

const emptyForm = { id: "", name: "", description: "", category: "", unit: "PCS", reorderLevel: 10, openingStock: 0 }

export default function MaterialMaster() {
  const materials = useWarehouseStore(s => s.materialMasterBase ?? [])
  const locations = useWarehouseStore(s => s.locations ?? [])
  const inventory = useWarehouseStore(s => s.inventory ?? [])
  const addMaterial = useWarehouseStore(s => s.addMaterial)
  const updateMaterial = useWarehouseStore(s => s.updateMaterial)
  const deleteMaterial = useWarehouseStore(s => s.deleteMaterial)
  const { toast } = useToast()

  const [search, setSearch] = React.useState("")
  const [catFilter, setCatFilter] = React.useState("all")
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(null)
  const [viewLocationsId, setViewLocationsId] = React.useState(null)
  const [form, setForm] = React.useState(emptyForm)

  const uniqueCategories = React.useMemo(() => {
    const cats = new Set(materials.map(m => m.category).filter(Boolean))
    CATEGORIES.forEach(c => cats.add(c))
    return Array.from(cats).sort()
  }, [materials])

  const filtered = materials.filter(m => {
    const q = search.toLowerCase()
    return (!q || m.id.toLowerCase().includes(q) || (m.name || m.description || "").toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q)) &&
           (catFilter === "all" || m.category === catFilter)
  })

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (m) => { setEditing(m.id); setForm({ id: m.id, name: m.name || m.description, description: m.description, category: m.category, unit: m.unit, reorderLevel: m.reorderLevel, openingStock: 0 }); setOpen(true) }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!form.id || !form.name) { toast({ title: "ID and Name required", variant: "destructive" }); return }
    try {
      if (editing) {
        await updateMaterial(editing, { name: form.name, description: form.description, category: form.category, unit: form.unit, reorderLevel: Number(form.reorderLevel) })
        toast({ title: "Material updated", variant: "success" })
      } else {
        if (materials.find(m => m.id === form.id)) { toast({ title: "ID already exists", variant: "destructive" }); return }
        await addMaterial({ ...form, reorderLevel: Number(form.reorderLevel), openingStock: Number(form.openingStock) || 0 })
        toast({ title: "Material added", variant: "success" })
      }
      setOpen(false)
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id) => {
    const isAssigned = locations.some(l => l.materialId === id)
    if (isAssigned) {
      toast({ title: "Cannot delete material", description: "Material is assigned to a location or has stock.", variant: "destructive" })
      return
    }
    if (!confirm(`Delete material ${id}?`)) return
    try {
      await deleteMaterial(id)
      toast({ title: "Material deleted", variant: "warning" })
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const exportCSV = () => {
    const headers = [
      "Material ID",
      "Material Name",
      "Description",
      "Category",
      "Unit",
      "Reorder Level"
    ]
    const rows = filtered.map(m => [
      m.id,
      m.name || m.description || "",
      m.description || "",
      m.category || "",
      m.unit || "PCS",
      m.reorderLevel ?? 10
    ])
    const dateStr = new Date().toISOString().slice(0, 10)
    exportToCSV(`material_master_${dateStr}.csv`, headers, rows)
    toast({ title: "Materials exported", description: `${filtered.length} materials exported to CSV.`, variant: "success" })
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Database size={16} className="text-primary"/>
              Material Master ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" onClick={exportCSV} className="flex-1 sm:flex-none">
                <Download size={13}/> Export CSV
              </Button>
              <Button size="sm" onClick={openAdd} className="flex-1 sm:flex-none">
                <Plus size={15}/> Add Material
              </Button>
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID or name..." className="pl-9" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 no-scrollbar sm:flex-wrap">
              <button
                onClick={() => setCatFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all shrink-0 whitespace-nowrap ${catFilter === "all" ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >All</button>
              {uniqueCategories.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all shrink-0 whitespace-nowrap ${catFilter === c ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
                >{c}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="overflow-x-auto w-full">
            <table className="w-full wms-table min-w-[750px]">
              <thead>
                <tr>
                  <th className="text-left">Material ID</th>
                  <th className="text-left">Name</th>
                  <th className="text-left">Description</th>
                  <th>Category</th>
                  <th className="text-left">Rack Location</th>
                  <th className="text-center">Unit</th>
                  <th className="text-right">Reorder Level</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  // Get all locations assigned to or holding stock for this material
                  const matLocs = locations.filter(l => 
                    l.materialId === m.id || 
                    inventory.some(i => i.materialId === m.id && i.locationId === l.locationId && i.currentStock > 0)
                  )
                  
                  return (
                    <tr key={m.id}>
                      <td className="font-mono text-xs text-primary">{m.id}</td>
                      <td className="font-medium text-foreground">{m.name || m.description}</td>
                      <td className="text-muted-foreground max-w-[200px] truncate text-xs">{m.description}</td>
                      <td className="text-center"><CategoryBadge category={m.category} /></td>
                      <td>
                        {matLocs.length > 0 ? (
                          <div 
                            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setViewLocationsId(m.id)}
                          >
                            <span className="font-mono text-[11px] bg-secondary/50 px-2 py-0.5 rounded border border-border">
                              {matLocs[0].locationId}
                            </span>
                            {matLocs.length > 1 && (
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">
                                +{matLocs.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="text-center font-mono text-xs text-muted-foreground">{m.unit}</td>
                      <td className="text-right font-mono text-sm text-amber-400">{m.reorderLevel}</td>
                      <td className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="text-muted-foreground hover:text-primary p-1 transition-colors"><Pencil size={13}/></button>
                          <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Material" : "Add Material"}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing}` : "New material will be added to the Material Master."}
            </DialogDescription>
          </DialogHeader>
          <form id="material-form" onSubmit={handleSubmit} className="px-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center h-5">Material ID <span className="text-destructive ml-0.5">*</span></Label>
                <Input value={form.id} onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })}
                  placeholder="e.g. MAT050" disabled={!!editing} className="font-mono w-full" required />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center h-5">Unit</Label>
                <Combobox 
                  value={form.unit}
                  onChange={val => setForm(f => ({ ...f, unit: val.toUpperCase() }))}
                  options={UNITS}
                  placeholder="e.g. PCS"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Material Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="Material Name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional detailed description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center h-5">Category <span className="text-destructive ml-0.5">*</span></Label>
                <Combobox 
                  value={form.category}
                  onChange={val => setForm(f => ({ ...f, category: val.toUpperCase() }))}
                  options={CATEGORIES}
                  placeholder="Select or type Category"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 h-5">
                  <span>Reorder Level</span>
                  <div className="group relative flex items-center">
                    <Info size={14} className="text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full sm:left-1/2 sm:-translate-x-1/2 right-0 mb-2 hidden w-56 p-2 bg-popover text-popover-foreground text-xs rounded shadow-xl border border-border group-hover:block z-50 text-center">
                      Minimum stock threshold. When stock falls below this quantity, a "REORDER" alert will trigger on the dashboard.
                    </div>
                  </div>
                </Label>
                <Input type="number" min="0" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} className="w-full" />
              </div>
            </div>

            {!editing && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>Opening Stock</Label>
                  <Input type="number" min="0" value={form.openingStock} onChange={e => setForm({ ...form, openingStock: e.target.value })} className="w-full" placeholder="Initial quantity" />
                </div>
              </div>
            )}

          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="material-form">{editing ? "Save Changes" : "Add Material"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Locations Modal */}
      <Dialog open={!!viewLocationsId} onOpenChange={(val) => !val && setViewLocationsId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rack Locations</DialogTitle>
            <DialogDescription>
              All locations assigned to or holding stock for material <span className="font-mono font-bold text-primary">{viewLocationsId}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {viewLocationsId && (() => {
              const matLocs = locations.filter(l => 
                l.materialId === viewLocationsId || 
                inventory.some(i => i.materialId === viewLocationsId && i.locationId === l.locationId && i.currentStock > 0)
              )
              
              if (matLocs.length === 0) return <p className="text-sm text-muted-foreground italic text-center py-4">No locations found.</p>

              return matLocs.map(l => {
                const isPrimary = l.materialId === viewLocationsId
                const invItem = inventory.find(i => i.materialId === viewLocationsId && i.locationId === l.locationId)
                const stock = invItem ? invItem.currentStock : 0
                
                return (
                  <div key={l.locationId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <p className="font-mono text-sm font-bold">{l.locationId}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isPrimary ? "Primary Assigned" : "Secondary (Holds Stock)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-bold ${stock > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {stock} <span className="text-[10px] uppercase">{l.unit || "PCS"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">Current Stock</p>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" size="sm" onClick={() => setViewLocationsId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
