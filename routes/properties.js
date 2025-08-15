const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// List all properties
router.get('/', requireAuth, async (req, res) => {
    try {
        const properties = await dbOps.getAllProperties();
        
        // Get resident count for each property
        const propertiesWithCounts = await Promise.all(
            properties.map(async (property) => {
                const residents = await dbOps.getResidentsByProperty(property.id);
                return {
                    ...property,
                    current_residents: residents.length,
                    available_spaces: property.max_capacity - residents.length
                };
            })
        );
        
        res.render('properties/index', {
            title: 'Properties - Support Hours Tracker',
            properties: propertiesWithCounts
        });
    } catch (error) {
        console.error('Properties list error:', error);
        res.render('error', {
            title: 'Properties Error',
            message: 'Unable to load properties'
        });
    }
});

// Create property form
router.get('/create', requireAdmin, (req, res) => {
    res.render('properties/create', {
        title: 'Create Property - Support Hours Tracker'
    });
});

// View single property
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const property = await dbOps.getPropertyById(req.params.id);
        if (!property) {
            return res.status(404).render('error', {
                title: 'Property Not Found',
                message: 'The requested property does not exist'
            });
        }
        
        const residents = await dbOps.getResidentsByProperty(property.id);
        
        // Get this month's sessions for this property
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const monthlySessions = await query(
            `SELECT s.*, 
                    r.first_name as resident_first_name, r.last_name as resident_last_name,
                    sw.first_name as worker_first_name, sw.last_name as worker_last_name
             FROM support_sessions s
             JOIN residents r ON s.resident_id = r.id
             JOIN support_workers sw ON s.support_worker_id = sw.id
             WHERE s.property_id = $1 
               AND s.session_date BETWEEN $2 AND $3
             ORDER BY s.session_date DESC, s.start_time DESC`,
            [property.id, startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
        );
        
        res.render('properties/view', {
            title: `${property.name} - Properties`,
            property: property,
            residents: residents,
            monthlySessions: monthlySessions.rows,
            current_residents: residents.length,
            available_spaces: property.max_capacity - residents.length
        });
    } catch (error) {
        console.error('Property view error:', error);
        res.render('error', {
            title: 'Property Error',
            message: 'Unable to load property details'
        });
    }
});

// Create property handler
router.post('/create', requireAdmin, [
    body('name').notEmpty().trim().isLength({ max: 255 }),
    body('address').optional().trim(),
    body('max_capacity').isInt({ min: 1, max: 50 }),
    body('manager_name').optional().trim().isLength({ max: 255 }),
    body('manager_email').optional().isEmail().normalizeEmail(),
    body('manager_phone').optional().trim().isLength({ max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('properties/create', {
                title: 'Create Property - Support Hours Tracker',
                error: 'Please provide valid property information',
                formData: req.body
            });
        }
        
        const propertyData = {
            name: req.body.name,
            address: req.body.address || null,
            max_capacity: parseInt(req.body.max_capacity),
            manager_name: req.body.manager_name || null,
            manager_email: req.body.manager_email || null,
            manager_phone: req.body.manager_phone || null
        };
        
        const newProperty = await dbOps.createProperty(propertyData);
        
        res.redirect('/properties/' + newProperty.id);
    } catch (error) {
        console.error('Property creation error:', error);
        res.render('properties/create', {
            title: 'Create Property - Support Hours Tracker',
            error: 'An error occurred creating the property',
            formData: req.body
        });
    }
});

// Edit property form
router.get('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const property = await dbOps.getPropertyById(req.params.id);
        if (!property) {
            return res.status(404).render('error', {
                title: 'Property Not Found',
                message: 'The requested property does not exist'
            });
        }
        
        res.render('properties/edit', {
            title: `Edit ${property.name} - Properties`,
            property: property
        });
    } catch (error) {
        console.error('Property edit form error:', error);
        res.render('error', {
            title: 'Property Error',
            message: 'Unable to load property for editing'
        });
    }
});

// Update property handler
router.post('/:id/edit', requireAdmin, [
    body('name').notEmpty().trim().isLength({ max: 255 }),
    body('address').optional().trim(),
    body('max_capacity').isInt({ min: 1, max: 50 }),
    body('manager_name').optional().trim().isLength({ max: 255 }),
    body('manager_email').optional().isEmail().normalizeEmail(),
    body('manager_phone').optional().trim().isLength({ max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const property = await dbOps.getPropertyById(req.params.id);
            return res.render('properties/edit', {
                title: `Edit ${property.name} - Properties`,
                property: property,
                error: 'Please provide valid property information',
                formData: req.body
            });
        }
        
        const propertyData = {
            name: req.body.name,
            address: req.body.address || null,
            max_capacity: parseInt(req.body.max_capacity),
            manager_name: req.body.manager_name || null,
            manager_email: req.body.manager_email || null,
            manager_phone: req.body.manager_phone || null
        };
        
        await dbOps.updateProperty(req.params.id, propertyData);
        
        res.redirect('/properties/' + req.params.id);
    } catch (error) {
        console.error('Property update error:', error);
        const property = await dbOps.getPropertyById(req.params.id);
        res.render('properties/edit', {
            title: `Edit ${property.name} - Properties`,
            property: property,
            error: 'An error occurred updating the property',
            formData: req.body
        });
    }
});

// Delete property handler
router.post('/:id/delete', requireAdmin, async (req, res) => {
    try {
        const property = await dbOps.getPropertyById(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        
        // Check if property has residents
        const residents = await dbOps.getResidentsByProperty(req.params.id);
        if (residents.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete property with active residents. Please move residents first.' 
            });
        }
        
        await dbOps.deleteProperty(req.params.id);
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.json({ success: true });
        } else {
            res.redirect('/properties');
        }
    } catch (error) {
        console.error('Property deletion error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({ error: 'An error occurred deleting the property' });
        } else {
            res.redirect('/properties');
        }
    }
});

// Property statistics API
router.get('/:id/stats', requireAuth, async (req, res) => {
    try {
        const property = await dbOps.getPropertyById(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        
        const residents = await dbOps.getResidentsByProperty(req.params.id);
        
        // Get this month's sessions
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const monthlySessionsResult = await query(
            `SELECT 
                COUNT(*) as total_sessions,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
                SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned_sessions,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_sessions,
                SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show_sessions,
                SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END) / 60.0 as total_hours
             FROM support_sessions
             WHERE property_id = $1 
               AND session_date BETWEEN $2 AND $3`,
            [req.params.id, startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
        );
        
        const stats = {
            property: property,
            residents: {
                total: residents.length,
                capacity: property.max_capacity,
                available: property.max_capacity - residents.length
            },
            monthly_sessions: monthlySessionsResult.rows[0]
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Property stats error:', error);
        res.status(500).json({ error: 'Unable to fetch property statistics' });
    }
});

module.exports = router;