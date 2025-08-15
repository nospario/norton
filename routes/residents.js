const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// List all residents
router.get('/', requireAuth, async (req, res) => {
    try {
        const residents = await dbOps.getAllResidents();
        res.render('residents/index', {
            title: 'Residents - Support Hours Tracker',
            residents: residents
        });
    } catch (error) {
        console.error('Residents list error:', error);
        res.render('error', {
            title: 'Residents Error',
            message: 'Unable to load residents'
        });
    }
});

// Create resident form
router.get('/create', requireAdmin, async (req, res) => {
    try {
        const properties = await dbOps.getAllProperties();
        res.render('residents/create', {
            title: 'Create Resident - Support Hours Tracker',
            properties: properties
        });
    } catch (error) {
        console.error('Resident create form error:', error);
        res.render('error', {
            title: 'Resident Error',
            message: 'Unable to load create form'
        });
    }
});

// Create resident handler
router.post('/create', requireAdmin, [
    body('first_name').notEmpty().trim().isLength({ max: 100 }),
    body('last_name').notEmpty().trim().isLength({ max: 100 }),
    body('property_id').isUUID(),
    body('monthly_support_hours').isInt({ min: 0, max: 200 }),
    body('start_date').isDate(),
    body('end_date').optional({ nullable: true }).isDate(),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('emergency_contact_name').optional().trim().isLength({ max: 255 }),
    body('emergency_contact_phone').optional().trim().isLength({ max: 50 }),
    body('special_requirements').optional().trim(),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const properties = await dbOps.getAllProperties();
            return res.render('residents/create', {
                title: 'Create Resident - Support Hours Tracker',
                properties: properties,
                error: 'Please provide valid resident information',
                formData: req.body
            });
        }
        
        const residentData = {
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            property_id: req.body.property_id,
            monthly_support_hours: parseInt(req.body.monthly_support_hours),
            start_date: req.body.start_date,
            end_date: req.body.end_date || null,
            email: req.body.email || null,
            phone: req.body.phone || null,
            emergency_contact_name: req.body.emergency_contact_name || null,
            emergency_contact_phone: req.body.emergency_contact_phone || null,
            special_requirements: req.body.special_requirements || null,
            notes: req.body.notes || null
        };
        
        const result = await query(
            `INSERT INTO residents (first_name, last_name, property_id, monthly_support_hours, start_date, end_date, email, phone, emergency_contact_name, emergency_contact_phone, special_requirements, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [residentData.first_name, residentData.last_name, residentData.property_id, residentData.monthly_support_hours,
             residentData.start_date, residentData.end_date, residentData.email, residentData.phone,
             residentData.emergency_contact_name, residentData.emergency_contact_phone, residentData.special_requirements, residentData.notes]
        );
        
        res.redirect('/residents/' + result.rows[0].id);
    } catch (error) {
        console.error('Resident creation error:', error);
        const properties = await dbOps.getAllProperties();
        res.render('residents/create', {
            title: 'Create Resident - Support Hours Tracker',
            properties: properties,
            error: 'An error occurred creating the resident',
            formData: req.body
        });
    }
});

// View single resident
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const resident = await dbOps.getResidentById(req.params.id);
        if (!resident) {
            return res.status(404).render('error', {
                title: 'Resident Not Found',
                message: 'The requested resident does not exist'
            });
        }
        
        // Get resident's sessions for current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const sessions = await query(
            `SELECT s.*, 
                    sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                    p.name as property_name
             FROM support_sessions s
             JOIN support_workers sw ON s.support_worker_id = sw.id
             JOIN properties p ON s.property_id = p.id
             WHERE s.resident_id = $1 
               AND s.session_date BETWEEN $2 AND $3
             ORDER BY s.session_date DESC, s.start_time DESC`,
            [resident.id, startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
        );
        
        // Calculate usage statistics
        const completedSessions = sessions.rows.filter(s => s.status === 'completed');
        const totalHoursUsed = completedSessions.reduce((sum, session) => sum + (session.duration_minutes / 60), 0);
        const remainingHours = resident.monthly_support_hours - totalHoursUsed;
        const utilizationPercent = resident.monthly_support_hours > 0 
            ? ((totalHoursUsed / resident.monthly_support_hours) * 100).toFixed(1)
            : 0;
        
        res.render('residents/view', {
            title: `${resident.first_name} ${resident.last_name} - Residents`,
            resident: resident,
            sessions: sessions.rows,
            stats: {
                totalHoursUsed: totalHoursUsed.toFixed(1),
                remainingHours: remainingHours.toFixed(1),
                utilizationPercent: utilizationPercent,
                totalSessions: sessions.rows.length,
                completedSessions: completedSessions.length
            }
        });
    } catch (error) {
        console.error('Resident view error:', error);
        res.render('error', {
            title: 'Resident Error',
            message: 'Unable to load resident details'
        });
    }
});

// Edit resident form
router.get('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const resident = await dbOps.getResidentById(req.params.id);
        if (!resident) {
            return res.status(404).render('error', {
                title: 'Resident Not Found',
                message: 'The requested resident does not exist'
            });
        }
        
        const properties = await dbOps.getAllProperties();
        res.render('residents/edit', {
            title: `Edit ${resident.first_name} ${resident.last_name} - Residents`,
            resident: resident,
            properties: properties
        });
    } catch (error) {
        console.error('Resident edit form error:', error);
        res.render('error', {
            title: 'Resident Error',
            message: 'Unable to load resident for editing'
        });
    }
});

// Update resident handler
router.post('/:id/edit', requireAdmin, [
    body('first_name').notEmpty().trim().isLength({ max: 100 }),
    body('last_name').notEmpty().trim().isLength({ max: 100 }),
    body('property_id').isUUID(),
    body('monthly_support_hours').isInt({ min: 0, max: 200 }),
    body('start_date').isDate(),
    body('end_date').optional({ nullable: true }).isDate(),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('emergency_contact_name').optional().trim().isLength({ max: 255 }),
    body('emergency_contact_phone').optional().trim().isLength({ max: 50 }),
    body('special_requirements').optional().trim(),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const resident = await dbOps.getResidentById(req.params.id);
            const properties = await dbOps.getAllProperties();
            return res.render('residents/edit', {
                title: `Edit ${resident.first_name} ${resident.last_name} - Residents`,
                resident: resident,
                properties: properties,
                error: 'Please provide valid resident information',
                formData: req.body
            });
        }
        
        await query(
            `UPDATE residents 
             SET first_name = $1, last_name = $2, property_id = $3, monthly_support_hours = $4, 
                 start_date = $5, end_date = $6, email = $7, phone = $8, 
                 emergency_contact_name = $9, emergency_contact_phone = $10, 
                 special_requirements = $11, notes = $12
             WHERE id = $13`,
            [req.body.first_name, req.body.last_name, req.body.property_id, parseInt(req.body.monthly_support_hours),
             req.body.start_date, req.body.end_date || null, req.body.email || null, req.body.phone || null,
             req.body.emergency_contact_name || null, req.body.emergency_contact_phone || null,
             req.body.special_requirements || null, req.body.notes || null, req.params.id]
        );
        
        res.redirect('/residents/' + req.params.id);
    } catch (error) {
        console.error('Resident update error:', error);
        const resident = await dbOps.getResidentById(req.params.id);
        const properties = await dbOps.getAllProperties();
        res.render('residents/edit', {
            title: `Edit ${resident.first_name} ${resident.last_name} - Residents`,
            resident: resident,
            properties: properties,
            error: 'An error occurred updating the resident',
            formData: req.body
        });
    }
});

module.exports = router;