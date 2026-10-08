import * as React from 'react'
import useWarehouseStore from '@/lib/store/useWarehouseStore'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { useToast } from '@/components/ui/toast'
import { Truck, Plus, Trash2, Save } from 'lucide-react'

export default function Shipments() {
  const materials = useWarehouseStore(s => s.materialMasterBase || [])
  const locations = useWarehouseStore(s => s.locations || [])
  const inventory = useWarehouseStore(s => s.inventory || [])
  const enrichedMovements = useWarehouseStore(s => s.enrichedMovements || [])
  const addBulkMovements = useWarehouseStore(s => s.addBulkMovements)
  const { toast } = useToast()

  const [type, setType] = React.useState('IN')
  const [reference, setReference] = React.useState('')
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [driver, setDriver] = React.useState('')
  const [items, setItems] = React.useState([{ id: 1, materialId: '', locationId: '', quantity: '' }])
  const [submitting, setSubmitting] = React.useState(false)

  const materialOptions = materials.map(m => ({
    value: `${m.id} - ${m.name || m.description}`,
    sub: m.category ? `Category: ${m.category}` : ''
  }))
  const locationOptionsIn = locations.map(l => ({ value: l.locationId, sub: l.materialId ? `Assigned to: ${l.materialId}` : 'Available' }))

  const recentShipments = React.useMemo(() => {
    return enrichedMovements
      .filter(m => m.notes && m.notes.includes('Bulk Truck'))
      .slice(0, 10)
  }, [enrichedMovements])

  // Extract material id helper
  const extractMaterialId = (val) => {
    if (!val) return ''
    return val.includes(' - ') ? val.split(' - ')[0] : val.includes(' (') ? val.split(' (')[0] : val
  }

  const addItem = () => setItems([...items, { id: Date.now(), materialId: '', locationId: '', quantity: '' }])

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        // If material changes on OUT, clear location
        if (field === 'materialId' && type === 'OUT') {
          return { ...item, [field]: value, locationId: '' }
        }
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const removeItem = (id) => {
    if (items.length === 1) return
    setItems(items.filter(item => item.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reference.trim()) { toast({ title: "Reference required", variant: "destructive" }); return }
    
    // Validate items
    const cleanItems = items.map(i => ({
      materialId: extractMaterialId(i.materialId),
      locationId: i.locationId,
      quantity: Number(i.quantity)
    })).filter(i => i.materialId && i.locationId && i.quantity > 0)

    if (cleanItems.length === 0) {
      toast({ title: "No valid items", description: "Please add at least one complete row.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      await addBulkMovements({
        type,
        reference,
        date,
        user: undefined,
        notes: driver ? `Driver: ${driver} | Bulk Truck ${type === 'IN' ? 'Receipt' : 'Dispatch'}` : `Bulk Truck ${type === 'IN' ? 'Receipt' : 'Dispatch'}`,
        items: cleanItems
      })
      toast({ title: "Shipment saved successfully!", variant: "success" })
      // Reset form
      setReference('')
      setDriver('')
      setItems([{ id: Date.now(), materialId: '', locationId: '', quantity: '' }])
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to process shipment", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card className="glass">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <Truck className="text-primary" size={18} />
            Truck Receipts & Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form id="bulk-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="flex bg-secondary/50 rounded-lg p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setType('IN')}
                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${type === 'IN' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Receive (IN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('OUT')}
                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${type === 'OUT' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Dispatch (OUT)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Vehicle No / Reference <span className="text-destructive">*</span></Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TRK-1234" required />
              </div>

              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label>Driver</Label>
                <Input value={driver} onChange={e => setDriver(e.target.value)} placeholder="Driver Name" />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus size={14} className="mr-1" /> Add Item
                </Button>
              </div>
              
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full wms-table">
                  <thead>
                    <tr>
                      <th className="w-2/5">Material</th>
                      <th className="w-2/5">Location</th>
                      <th className="w-1/5 text-right">Quantity</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const selectedMatId = extractMaterialId(item.materialId)
                      
                      // For OUTBOUND, filter locations that have stock for this material
                      let rowLocationOptions = locationOptionsIn
                      if (type === 'OUT' && selectedMatId) {
                        rowLocationOptions = inventory
                          .filter(i => i.materialId === selectedMatId && i.currentStock > 0)
                          .map(i => ({ value: i.locationId, sub: `Stock: ${i.currentStock}` }))
                      } else if (type === 'OUT') {
                        rowLocationOptions = [] // must select material first
                      } else if (type === 'IN' && selectedMatId) {
                        rowLocationOptions = locations.map(l => {
                          const isAssigned = l.materialId === selectedMatId
                          const invItem = inventory.find(i => i.locationId === l.locationId && i.materialId === selectedMatId)
                          const stock = invItem ? invItem.currentStock : 0
                          const isPrimary = isAssigned || stock > 0
                          
                          return {
                            value: l.locationId,
                            sub: isAssigned ? `★ Primary Assigned (Stock: ${stock})` : (stock > 0 ? `Active Stock: ${stock}` : (l.materialId ? `Assigned to ${l.materialId}` : 'Available')),
                            isPrimary
                          }
                        }).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                      }

                      return (
                        <tr key={item.id} className="group">
                          <td>
                            <Combobox 
                              options={materialOptions}
                              value={item.materialId}
                              onChange={val => updateItem(item.id, 'materialId', val)}
                              placeholder="Select Material"
                            />
                          </td>
                          <td>
                            <Combobox 
                              options={rowLocationOptions}
                              value={item.locationId}
                              onChange={val => updateItem(item.id, 'locationId', val)}
                              placeholder={type === 'OUT' && !selectedMatId ? "Select Material first" : "Select Location"}
                            />
                          </td>
                          <td>
                            <Input 
                              type="number" 
                              min="1" 
                              className="text-right" 
                              value={item.quantity} 
                              onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                              placeholder="Qty" 
                            />
                          </td>
                          <td className="text-center">
                            <button 
                              type="button" 
                              onClick={() => removeItem(item.id)}
                              disabled={items.length === 1}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </form>
        </CardContent>
        <CardFooter className="border-t border-border/50 pt-4 flex justify-end">
          <Button type="submit" form="bulk-form" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Saving...' : <><Save size={15} className="mr-2" /> Save Shipment</>}
          </Button>
        </CardFooter>
      </Card>

      <Card className="glass mt-4">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm">Recent Bulk Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full wms-table text-xs">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Reference</th>
                <th className="text-left">Material</th>
                <th className="text-left">Location</th>
                <th className="text-center">Type</th>
                <th className="text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {recentShipments.map(m => (
                <tr key={m.id}>
                  <td className="text-muted-foreground whitespace-nowrap">{m.date}</td>
                  <td className="font-mono text-muted-foreground">
                    {m.reference}
                    {m.notes?.startsWith('Driver: ') && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground/70">
                        ({m.notes.split(' | ')[0].replace('Driver: ', '')})
                      </span>
                    )}
                  </td>
                  <td>
                    <p className="font-medium text-foreground">{m.materialDesc || m.materialId}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{m.materialId}</p>
                  </td>
                  <td className="font-mono">{m.locationId}</td>
                  <td className="text-center">
                    <span className={m.type === 'IN' ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>
                      {m.type}
                    </span>
                  </td>
                  <td className="text-right font-mono font-medium">
                    {m.quantity} <span className="text-muted-foreground text-[10px] ml-0.5">{m.unit}</span>
                  </td>
                </tr>
              ))}
              {recentShipments.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground">No recent bulk shipments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
