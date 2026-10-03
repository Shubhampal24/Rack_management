// backend/routes/racks.js
import { Router } from 'express'
import Rack from '../models/Rack.js'
import Location from '../models/Location.js'
import Movement from '../models/Movement.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

/** Helper: compute locationId like the Excel formula */
function computeLocationId(rack, bay, level, slot) {
  if (!rack || !bay || !level || !slot) return ''
  return `${rack}-B${String(bay).padStart(2, '0')}-${level}-${slot}`
}

/** Helper: generate all locations for a rack config */
function generateLocations(rackId, bayCount, levels, slots) {
  const locs = []
  for (let bay = 1; bay <= bayCount; bay++) {
    for (const level of levels) {
      if (!level) continue
      for (const slot of slots) {
        if (!slot) continue
        const locationId = computeLocationId(rackId, bay, level, slot)
        locs.push({ rack: rackId, bay, level, slot, locationId })
      }
    }
  }
  return locs
}

/**
 * GET /api/racks
 * Returns all racks
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const racks = await Rack.find({ isDeleted: { $ne: true } }).sort({ id: 1 }).lean()
    res.json(racks)
  } catch (err) { next(err) }
})

/**
 * POST /api/racks
 * Body: { id, type, description, bayCount, levels, slots, side, notes }
 * Also auto-generates location entries
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id, type, description, bayCount, levels, slots, side, notes } = req.body

    if (!id) return res.status(400).json({ error: 'Rack ID is required.' })

    // Normalize arrays
    const levelsArr = Array.isArray(levels)
      ? levels.map(l => l.trim()).filter(Boolean)
      : (levels || '').split(',').map(l => l.trim()).filter(Boolean)

    const slotsArr = Array.isArray(slots)
      ? slots.map(s => s.trim()).filter(Boolean)
      : (slots || 'A').split(',').map(s => s.trim()).filter(Boolean)

    const existing = await Rack.findOne({ id: id.toUpperCase() })
    let rack
    if (existing) {
      if (existing.isDeleted) {
        existing.isDeleted = false
        existing.type = type || 'Pallet Rack'
        existing.description = description || ''
        existing.bayCount = Number(bayCount) || 1
        existing.levels = levelsArr
        existing.slots = slotsArr
        existing.side = side || 'Single-sided'
        existing.notes = notes || ''
        rack = existing
      } else {
        return res.status(409).json({ error: `Rack ID "${id.toUpperCase()}" already exists.` })
      }
    } else {
      rack = new Rack({
        id: id.toUpperCase(),
        type: type || 'Pallet Rack',
        description: description || '',
        bayCount: Number(bayCount) || 1,
        levels: levelsArr,
        slots: slotsArr,
        side: side || 'Single-sided',
        notes: notes || '',
      })
    }

    await rack.save()

    // Auto-generate locations
    const locDocs = generateLocations(rack.id, rack.bayCount, levelsArr, slotsArr)
    if (locDocs.length > 0) {
      await Location.insertMany(
        locDocs.map(l => ({ ...l, materialId: '', batch: '', notes: '' })),
        { ordered: false }
      ).catch(() => {}) // ignore duplicate key errors (locations already exist)
      
      // Undelete any existing locations that fall within bounds (in case it was previously soft-deleted)
      await Location.updateMany(
        { rack: rack.id, isDeleted: true },
        { isDeleted: false }
      )
    }

    res.status(201).json(rack)
  } catch (err) { next(err) }
})

/**
 * PUT /api/racks/:id
 * Updates rack and prunes/expands locations to match new bounds
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { description, type, bayCount, levels, slots, side, status, notes } = req.body
    const rackId = req.params.id.toUpperCase()

    const rack = await Rack.findOne({ id: rackId })
    if (!rack) return res.status(404).json({ error: `Rack ${rackId} not found.` })

    // Normalize arrays
    const levelsArr = levels
      ? (Array.isArray(levels) ? levels : (levels || '').split(',')).map(l => l.trim()).filter(Boolean)
      : rack.levels

    const slotsArr = slots
      ? (Array.isArray(slots) ? slots : (slots || '').split(',')).map(s => s.trim()).filter(Boolean)
      : rack.slots

    const newBayCount = bayCount !== undefined ? Number(bayCount) : rack.bayCount

    // Find locations with active stock
    const activeMovements = await Movement.aggregate([
      { $match: { locationId: { $regex: `^${rackId}-` }, isDeleted: { $ne: true } } },
      { $group: {
          _id: "$locationId",
          total: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } }
      }},
      { $match: { total: { $gt: 0 } } }
    ])
    const locationsWithStock = activeMovements.map(m => m._id)

    // Validate that we aren't removing bays, levels, or slots that are currently in use
    const occupiedLocations = await Location.find({
      rack: rackId,
      isDeleted: { $ne: true },
      $or: [
        { materialId: { $ne: '' } },
        { locationId: { $in: locationsWithStock } }
      ]
    })

    // Check bays
    const maxOccupiedBay = occupiedLocations.reduce((m, l) => Math.max(m, l.bay), 0)
    if (newBayCount < maxOccupiedBay) {
      return res.status(400).json({
        error: `Cannot reduce bays below ${maxOccupiedBay}. Bay ${maxOccupiedBay} is currently holding stock or assigned to a material.`
      })
    }

    // Check levels
    const removedLevels = rack.levels.filter(lvl => !levelsArr.includes(lvl))
    for (const lvl of removedLevels) {
      if (occupiedLocations.some(loc => loc.level === lvl)) {
        return res.status(400).json({
          error: `Cannot remove level '${lvl}' because it is currently holding stock or assigned to a material. Please empty and unassign it first.`
        })
      }
    }

    // Check slots
    const removedSlots = rack.slots.filter(s => !slotsArr.includes(s))
    for (const slot of removedSlots) {
      if (occupiedLocations.some(loc => loc.slot === slot)) {
        return res.status(400).json({
          error: `Cannot remove slot '${slot}' because it is currently holding stock or assigned to a material. Please empty and unassign it first.`
        })
      }
    }

    // Update rack
    rack.description = description !== undefined ? description : rack.description
    rack.type = type !== undefined ? type : rack.type
    rack.bayCount = newBayCount
    rack.levels = levelsArr
    rack.slots = slotsArr
    rack.side = side !== undefined ? side : rack.side
    rack.status = status !== undefined ? status : rack.status
    rack.notes = notes !== undefined ? notes : rack.notes
    await rack.save()

    // Prune empty locations that fall outside new bounds
    await Location.updateMany({
      rack: rackId,
      materialId: '',  // only prune unassigned
      $or: [
        { bay: { $gt: newBayCount } },
        { level: { $nin: levelsArr } },
        { slot: { $nin: slotsArr } },
      ]
    }, { isDeleted: true })

    // Generate missing locations within new bounds
    const newLocs = generateLocations(rackId, newBayCount, levelsArr, slotsArr)
    if (newLocs.length > 0) {
      await Location.insertMany(
        newLocs.map(l => ({ ...l, materialId: '', batch: '', notes: '' })),
        { ordered: false }
      ).catch(() => {})
      
      // Undelete any existing locations that fall within new bounds
      await Location.updateMany(
        { rack: rackId, bay: { $lte: newBayCount }, level: { $in: levelsArr }, slot: { $in: slotsArr }, isDeleted: true },
        { isDeleted: false }
      )
    }

    res.json(rack)
  } catch (err) { next(err) }
})

/**
 * PATCH /api/racks/:id/status
 * Toggle Active/Inactive
 */
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const rackId = req.params.id.toUpperCase()
    const rack = await Rack.findOne({ id: rackId })
    if (!rack) return res.status(404).json({ error: `Rack ${rackId} not found.` })

    rack.status = rack.status === 'Active' ? 'Inactive' : 'Active'
    await rack.save()
    res.json(rack)
  } catch (err) { next(err) }
})

/**
 * DELETE /api/racks/:id
 * Only if no assigned locations
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const rackId = req.params.id.toUpperCase()
    const activeMovements = await Movement.aggregate([
      { $match: { locationId: { $regex: `^${rackId}-` }, isDeleted: { $ne: true } } },
      { $group: {
          _id: "$locationId",
          total: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } }
      }},
      { $match: { total: { $gt: 0 } } }
    ])

    const assigned = await Location.findOne({ rack: rackId, materialId: { $ne: '' }, isDeleted: { $ne: true } })
    
    if (assigned || activeMovements.length > 0) {
      return res.status(400).json({ error: 'Cannot delete rack with assigned materials or active stock. Empty it first.' })
    }
    
    // Soft delete the rack
    await Rack.updateOne({ id: rackId }, { isDeleted: true })
    
    // Soft delete all locations in the rack
    await Location.updateMany({ rack: rackId }, { isDeleted: true })
    
    res.json({ message: `Rack ${rackId} and all its locations deleted.` })
  } catch (err) { next(err) }
})

export default router
