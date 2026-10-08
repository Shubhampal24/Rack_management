// backend/routes/locations.js
import { Router } from 'express'
import Location from '../models/Location.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function computeLocationId(rack, bay, level, slot) {
  if (!rack || !bay || !level || !slot) return ''
  return `${rack}-B${String(bay).padStart(2, '0')}-${level}-${slot}`
}

/**
 * GET /api/locations
 * Returns all locations (raw base data — derived fields computed in frontend)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rack } = req.query
    const filter = rack ? { rack: rack.toUpperCase() } : {}
    const locations = await Location.find({ ...filter, isDeleted: { $ne: true } }).sort({ rack: 1, bay: 1, level: 1, slot: 1 }).lean()
    res.json(locations)
  } catch (err) { next(err) }
})

/**
 * POST /api/locations
 * Manually add a single location
 * Body: { rack, bay, level, slot, materialId, batch, expiryDate, notes }
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { rack, bay, level, slot, materialId, batch, expiryDate, notes } = req.body

    if (!rack || !bay || !level || !slot) {
      return res.status(400).json({ error: 'Rack, Bay, Level, and Slot are all required.' })
    }

    const locationId = computeLocationId(rack.toUpperCase(), bay, level.toUpperCase(), slot.toUpperCase())

    const existing = await Location.findOne({ locationId })
    let location
    if (existing) {
      if (existing.isDeleted) {
        existing.isDeleted = false
        existing.materialId = materialId || ''
        existing.batch = batch || ''
        existing.expiryDate = expiryDate || ''
        existing.notes = notes || ''
        location = existing
      } else {
        return res.status(409).json({ error: `Location ${locationId} already exists.` })
      }
    } else {
      location = new Location({
        rack: rack.toUpperCase(),
        bay: Number(bay),
        level: level.toUpperCase(),
        slot: slot.toUpperCase(),
        locationId,
        materialId: materialId || '',
        batch: batch || '',
        expiryDate: expiryDate || '',
        notes: notes || '',
      })
    }

    await location.save()
    res.status(201).json(location)
  } catch (err) { next(err) }
})

/**
 * PATCH /api/locations/:locationId/assign
 * Assign or unassign a material to a location
 * Body: { materialId, quantity, expiryDate, batch, notes }  (empty string to unassign)
 */
router.patch('/:locationId/assign', requireAuth, async (req, res, next) => {
  try {
    const { locationId } = req.params
    const { materialId, quantity, expiryDate, batch, notes } = req.body

    const location = await Location.findOne({ locationId, isDeleted: { $ne: true } })
    if (!location) return res.status(404).json({ error: `Location ${locationId} not found.` })

    // Clean materialId (strip display suffix like " - Description")
    const rawId = (materialId || '').trim()
    const cleanId = rawId.includes(' - ')
      ? rawId.split(' - ')[0].trim()
      : rawId.includes(' (')
      ? rawId.split(' (')[0].trim()
      : rawId

    // If assigning a new material, ensure there is no stock of ANY OTHER material in this location
    if (cleanId && location.materialId !== cleanId.toUpperCase()) {
      const Movement = (await import('../models/Movement.js')).default
      const [stockRes] = await Movement.aggregate([
        { $match: { locationId, materialId: { $ne: cleanId.toUpperCase() }, isDeleted: { $ne: true } } },
        { $group: {
            _id: null,
            totalStock: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } }
        }}
      ])
      const currentStock = stockRes ? stockRes.totalStock : 0
      if (currentStock > 0) {
        return res.status(400).json({ error: `Cannot assign location to ${cleanId}. It currently holds ${currentStock} units of another material.` })
      }
    }

    // If unassigning, ensure no active stock remains
    if (!cleanId && location.materialId) {
      const Movement = (await import('../models/Movement.js')).default
      const [stockRes] = await Movement.aggregate([
        { $match: { locationId, isDeleted: { $ne: true } } },
        { $group: {
            _id: null,
            totalStock: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } }
        }}
      ])
      const currentStock = stockRes ? stockRes.totalStock : 0
      if (currentStock > 0) {
        return res.status(400).json({ error: `Cannot unassign location. It currently holds ${currentStock} units of stock. Clear stock with stock OUT movement first.` })
      }
    }

    location.materialId = cleanId ? cleanId.toUpperCase() : ''
    if (expiryDate !== undefined) location.expiryDate = expiryDate || ''
    if (batch !== undefined) location.batch = batch || ''
    if (notes !== undefined) location.notes = notes || ''

    if (!cleanId) {
      location.expiryDate = ''
      location.batch = ''
    }

    await location.save()

    if (cleanId) {
      const Material = (await import('../models/Material.js')).default
      const material = await Material.findOne({ id: cleanId.toUpperCase() })
      const numQty = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : null

      if (numQty !== null && numQty > 0) {
        const Movement = (await import('../models/Movement.js')).default
        const assignMov = new Movement({
          id: `MOV${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          materialId: cleanId.toUpperCase(),
          locationId: locationId,
          type: 'IN',
          quantity: numQty,
          unit: material?.unit || 'PCS',
          expiryDate: expiryDate || '',
          batch: batch || '',
          reference: 'INITIAL ASSIGNMENT',
          user: req.user?.name || 'Warehouse Manager',
          notes: notes || 'Assigned to rack location'
        })
        await assignMov.save()
        if (material && material.openingStock > 0 && !material.openingStockAdded) {
          material.openingStockAdded = true
          await material.save()
        }
      } else if (material && material.openingStock > 0 && !material.openingStockAdded) {
        const Movement = (await import('../models/Movement.js')).default
        const openingMov = new Movement({
          id: `MOV${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          materialId: cleanId.toUpperCase(),
          locationId: locationId,
          type: 'IN',
          quantity: material.openingStock,
          unit: material.unit || 'PCS',
          expiryDate: expiryDate || '',
          batch: batch || '',
          reference: 'OPENING STOCK',
          user: req.user?.name || 'Warehouse Manager',
          notes: notes || 'Automatic opening stock addition'
        })
        await openingMov.save()
        material.openingStockAdded = true
        await material.save()
      }
    }

    res.json(location)
  } catch (err) { next(err) }
})

/**
 * PUT /api/locations/:locationId
 * Update notes/batch/expiryDate for a location
 */
router.put('/:locationId', requireAuth, async (req, res, next) => {
  try {
    const { locationId } = req.params
    const { batch, expiryDate, notes, materialId } = req.body

    const location = await Location.findOne({ locationId, isDeleted: { $ne: true } })
    if (!location) return res.status(404).json({ error: `Location ${locationId} not found.` })

    if (batch !== undefined) location.batch = batch
    if (expiryDate !== undefined) location.expiryDate = expiryDate
    if (notes !== undefined) location.notes = notes
    if (materialId !== undefined) location.materialId = materialId

    await location.save()
    res.json(location)
  } catch (err) { next(err) }
})

/**
 * DELETE /api/locations/:locationId
 * Only if unassigned
 */
router.delete('/:locationId', requireAuth, async (req, res, next) => {
  try {
    const { locationId } = req.params
    const location = await Location.findOne({ locationId, isDeleted: { $ne: true } })
    if (!location) return res.status(404).json({ error: `Location ${locationId} not found.` })

    if (location.materialId) {
      return res.status(400).json({ error: 'Cannot delete an assigned location. Unassign the material first.' })
    }

    const Movement = (await import('../models/Movement.js')).default
    const [stockRes] = await Movement.aggregate([
      { $match: { locationId, isDeleted: { $ne: true } } },
      { $group: {
          _id: null,
          totalStock: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } }
      }}
    ])
    
    if (stockRes && stockRes.totalStock > 0) {
      return res.status(400).json({ error: `Cannot delete location. It currently holds ${stockRes.totalStock} units of active stock.` })
    }

    await Location.updateOne({ locationId }, { isDeleted: true })
    res.json({ message: `Location ${locationId} deleted.` })
  } catch (err) { next(err) }
})

export default router
