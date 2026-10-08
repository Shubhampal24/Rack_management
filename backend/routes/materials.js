// backend/routes/materials.js
import { Router } from 'express'
import Material from '../models/Material.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * GET /api/materials
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const materials = await Material.find({ isDeleted: { $ne: true } }).sort({ id: 1 }).lean()
    res.json(materials)
  } catch (err) { next(err) }
})

/**
 * POST /api/materials
 * Body: { id, name, description, category, unit, reorderLevel }
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id, name, description, category, unit, reorderLevel, openingStock } = req.body

    if (!id || !name) {
      return res.status(400).json({ error: 'Material ID and Name are required.' })
    }

    const existing = await Material.findOne({ id: id.toUpperCase() })
    if (existing) {
      if (existing.isDeleted) {
        existing.isDeleted = false
        existing.name = name.toUpperCase()
        existing.description = description || ''
        existing.category = category || ''
        existing.unit = unit || 'PCS'
        existing.reorderLevel = Number(reorderLevel) || 0
        existing.openingStock = Number(openingStock) || 0
        await existing.save()
        return res.status(201).json(existing)
      }
      return res.status(409).json({ error: `Material ID "${id.toUpperCase()}" already exists.` })
    }

    const material = new Material({
      id: id.toUpperCase(),
      name: name.toUpperCase(),
      description: description || '',
      category: category || '',
      unit: unit || 'PCS',
      reorderLevel: Number(reorderLevel) || 0,
      openingStock: Number(openingStock) || 0,
    })

    await material.save()
    res.status(201).json(material)
  } catch (err) { next(err) }
})

/**
 * PUT /api/materials/:id
 * Body: { name, description, category, unit, reorderLevel }
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const matId = req.params.id.toUpperCase()
    const { name, description, category, unit, reorderLevel } = req.body

    const material = await Material.findOne({ id: matId, isDeleted: { $ne: true } })
    if (!material) return res.status(404).json({ error: `Material ${matId} not found.` })

    if (name !== undefined) material.name = name.toUpperCase()
    if (description !== undefined) material.description = description
    if (category !== undefined) material.category = category
    if (unit !== undefined) material.unit = unit
    if (reorderLevel !== undefined) material.reorderLevel = Number(reorderLevel)

    await material.save()
    res.json(material)
  } catch (err) { next(err) }
})

/**
 * DELETE /api/materials/:id
 * Prevent deletion if material has stock or movements
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const matId = req.params.id.toUpperCase()

    // Dependency check 1: Is it assigned to any location?
    const Location = (await import('../models/Location.js')).default
    const locInUse = await Location.findOne({ materialId: matId, isDeleted: { $ne: true } })
    if (locInUse) {
      return res.status(400).json({ error: `Cannot delete: Material is currently assigned to location ${locInUse.locationId}.` })
    }

    // Dependency check 2: Does it have movement history?
    const Movement = (await import('../models/Movement.js')).default
    const movInUse = await Movement.findOne({ materialId: matId, isDeleted: { $ne: true } })
    if (movInUse) {
      return res.status(400).json({ error: `Cannot delete: Material has existing transaction history.` })
    }

    const deleted = await Material.findOneAndUpdate(
      { id: matId, isDeleted: { $ne: true } }, 
      { isDeleted: true }, 
      { new: true }
    )
    if (!deleted) return res.status(404).json({ error: `Material ${matId} not found.` })
    res.json({ message: `Material ${matId} deleted.` })
  } catch (err) { next(err) }
})

export default router
