const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// List all support workers
router.get('/', requireAuth, async (req, res) => {
    try {
        const supportWorkers = await dbOps.getAllSupportWorkers();
        res.render('support-workers/index', {
            title: 'Support Workers - Support Hours Tracker',
            supportWorkers: supportWorkers
        });
    } catch (error) {
        console.error('Support workers list error:', error);
        res.render('error', {
            title: 'Support Workers Error',
            message: 'Unable to load support workers'
        });
    }
});

// Create support worker form
router.get('/create', requireAdmin, (req, res) => {
    const supportTypes = [
        { key: 'mental_health', label: 'Mental Health Support' },
        { key: 'domestic_independence', label: 'Domestic & Independence Support' },
        { key: 'activity_group', label: 'Activity Based Group Support' }
    ];
    
    res.render('support-workers/create', {
        title: 'Create Support Worker - Support Hours Tracker',
        supportTypes: supportTypes
    });
});

// Create support worker handler
router.post('/create', requireAdmin, [
    body('first_name').notEmpty().trim().isLength({ max: 100 }),
    body('last_name').notEmpty().trim().isLength({ max: 100 }),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('max_hours_per_week').isInt({ min: 1, max: 60 }),
    body('max_hours_per_month').isInt({ min: 1, max: 250 }),
    body('specializations').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const supportTypes = [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ];
            return res.render('support-workers/create', {
                title: 'Create Support Worker - Support Hours Tracker',
                supportTypes: supportTypes,
                error: 'Please provide valid support worker information',
                formData: req.body
            });
        }
        
        const specializations = req.body.specializations || [];
        
        const result = await query(
            `INSERT INTO support_workers (first_name, last_name, email, phone, max_hours_per_week, max_hours_per_month, specializations)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [req.body.first_name, req.body.last_name, req.body.email || null, req.body.phone || null,
             parseInt(req.body.max_hours_per_week), parseInt(req.body.max_hours_per_month), specializations]
        );
        
        res.redirect('/support-workers/' + result.rows[0].id);
    } catch (error) {
        console.error('Support worker creation error:', error);
        const supportTypes = [
            { key: 'mental_health', label: 'Mental Health Support' },
            { key: 'domestic_independence', label: 'Domestic & Independence Support' },
            { key: 'activity_group', label: 'Activity Based Group Support' }
        ];
        res.render('support-workers/create', {
            title: 'Create Support Worker - Support Hours Tracker',
            supportTypes: supportTypes,
            error: 'An error occurred creating the support worker',
            formData: req.body
        });
    }
});

// View single support worker
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const supportWorker = await dbOps.getSupportWorkerById(req.params.id);
        if (!supportWorker) {
            return res.status(404).render('error', {
                title: 'Support Worker Not Found',
                message: 'The requested support worker does not exist'
            });
        }
        
        // Get support worker's sessions for current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const sessions = await query(
            `SELECT s.*, 
                    r.first_name as resident_first_name, r.last_name as resident_last_name,
                    p.name as property_name
             FROM support_sessions s
             JOIN residents r ON s.resident_id = r.id
             JOIN properties p ON s.property_id = p.id
             WHERE s.support_worker_id = $1 
               AND s.session_date BETWEEN $2 AND $3
             ORDER BY s.session_date DESC, s.start_time DESC`,
            [supportWorker.id, startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
        );
        
        // Calculate workload statistics
        const completedSessions = sessions.rows.filter(s => s.status === 'completed');
        const totalHoursWorked = completedSessions.reduce((sum, session) => sum + (session.duration_minutes / 60), 0);
        const monthlyUtilization = supportWorker.max_hours_per_month > 0 
            ? ((totalHoursWorked / supportWorker.max_hours_per_month) * 100).toFixed(1)
            : 0;
        
        // Get current week's hours
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const weekSessions = await query(
            `SELECT SUM(duration_minutes) / 60.0 as weekly_hours
             FROM support_sessions
             WHERE support_worker_id = $1 
               AND session_date BETWEEN $2 AND $3
               AND status = 'completed'`,
            [supportWorker.id, startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]]
        );
        
        const weeklyHours = weekSessions.rows[0].weekly_hours || 0;
        const weeklyUtilization = supportWorker.max_hours_per_week > 0 
            ? ((weeklyHours / supportWorker.max_hours_per_week) * 100).toFixed(1)
            : 0;
        
        res.render('support-workers/view', {
            title: `${supportWorker.first_name} ${supportWorker.last_name} - Support Workers`,
            supportWorker: supportWorker,
            sessions: sessions.rows,
            stats: {
                totalHoursWorked: totalHoursWorked.toFixed(1),
                monthlyUtilization: monthlyUtilization,
                weeklyHours: weeklyHours.toFixed(1),
                weeklyUtilization: weeklyUtilization,
                totalSessions: sessions.rows.length,
                completedSessions: completedSessions.length
            }
        });
    } catch (error) {
        console.error('Support worker view error:', error);
        res.render('error', {
            title: 'Support Worker Error',
            message: 'Unable to load support worker details'
        });
    }
});

// Edit support worker form
router.get('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const supportWorker = await dbOps.getSupportWorkerById(req.params.id);
        if (!supportWorker) {
            return res.status(404).render('error', {
                title: 'Support Worker Not Found',
                message: 'The requested support worker does not exist'
            });
        }
        
        const supportTypes = [
            { key: 'mental_health', label: 'Mental Health Support' },
            { key: 'domestic_independence', label: 'Domestic & Independence Support' },
            { key: 'activity_group', label: 'Activity Based Group Support' }
        ];
        
        res.render('support-workers/edit', {
            title: `Edit ${supportWorker.first_name} ${supportWorker.last_name} - Support Workers`,
            supportWorker: supportWorker,
            supportTypes: supportTypes
        });
    } catch (error) {
        console.error('Support worker edit form error:', error);
        res.render('error', {
            title: 'Support Worker Error',
            message: 'Unable to load support worker for editing'
        });
    }
});

// Update support worker handler
router.post('/:id/edit', requireAdmin, [
    body('first_name').notEmpty().trim().isLength({ max: 100 }),
    body('last_name').notEmpty().trim().isLength({ max: 100 }),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('max_hours_per_week').isInt({ min: 1, max: 60 }),
    body('max_hours_per_month').isInt({ min: 1, max: 250 }),
    body('specializations').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const supportWorker = await dbOps.getSupportWorkerById(req.params.id);
            const supportTypes = [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ];
            return res.render('support-workers/edit', {
                title: `Edit ${supportWorker.first_name} ${supportWorker.last_name} - Support Workers`,
                supportWorker: supportWorker,
                supportTypes: supportTypes,
                error: 'Please provide valid support worker information',
                formData: req.body
            });
        }
        
        const specializations = req.body.specializations || [];
        
        await query(
            `UPDATE support_workers 
             SET first_name = $1, last_name = $2, email = $3, phone = $4, 
                 max_hours_per_week = $5, max_hours_per_month = $6, specializations = $7
             WHERE id = $8`,
            [req.body.first_name, req.body.last_name, req.body.email || null, req.body.phone || null,
             parseInt(req.body.max_hours_per_week), parseInt(req.body.max_hours_per_month), specializations, req.params.id]
        );
        
        res.redirect('/support-workers/' + req.params.id);
    } catch (error) {
        console.error('Support worker update error:', error);
        const supportWorker = await dbOps.getSupportWorkerById(req.params.id);
        const supportTypes = [
            { key: 'mental_health', label: 'Mental Health Support' },
            { key: 'domestic_independence', label: 'Domestic & Independence Support' },
            { key: 'activity_group', label: 'Activity Based Group Support' }
        ];
        res.render('support-workers/edit', {
            title: `Edit ${supportWorker.first_name} ${supportWorker.last_name} - Support Workers`,
            supportWorker: supportWorker,
            supportTypes: supportTypes,
            error: 'An error occurred updating the support worker',
            formData: req.body
        });
    }
});

module.exports = router;