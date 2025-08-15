const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// List all sessions with filtering
router.get('/', requireAuth, async (req, res) => {
    try {
        const { 
            date_from, 
            date_to, 
            property_id, 
            resident_id, 
            support_worker_id, 
            support_type, 
            status,
            page = 1,
            limit = 50
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Build dynamic WHERE clause
        if (date_from) {
            paramCount++;
            whereConditions.push(`s.session_date >= $${paramCount}`);
            queryParams.push(date_from);
        }
        if (date_to) {
            paramCount++;
            whereConditions.push(`s.session_date <= $${paramCount}`);
            queryParams.push(date_to);
        }
        if (property_id) {
            paramCount++;
            whereConditions.push(`s.property_id = $${paramCount}`);
            queryParams.push(property_id);
        }
        if (resident_id) {
            paramCount++;
            whereConditions.push(`s.resident_id = $${paramCount}`);
            queryParams.push(resident_id);
        }
        if (support_worker_id) {
            paramCount++;
            whereConditions.push(`s.support_worker_id = $${paramCount}`);
            queryParams.push(support_worker_id);
        }
        if (support_type) {
            paramCount++;
            whereConditions.push(`s.support_type = $${paramCount}`);
            queryParams.push(support_type);
        }
        if (status) {
            paramCount++;
            whereConditions.push(`s.status = $${paramCount}`);
            queryParams.push(status);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        // Calculate offset for pagination
        const offset = (page - 1) * limit;
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(limit, offset);

        const sessionsQuery = `
            SELECT s.*, 
                   r.first_name as resident_first_name, r.last_name as resident_last_name,
                   sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                   p.name as property_name
            FROM support_sessions s
            JOIN residents r ON s.resident_id = r.id
            JOIN support_workers sw ON s.support_worker_id = sw.id
            JOIN properties p ON s.property_id = p.id
            ${whereClause}
            ORDER BY s.session_date DESC, s.start_time DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const sessions = await query(sessionsQuery, queryParams);

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM support_sessions s
            JOIN residents r ON s.resident_id = r.id
            JOIN support_workers sw ON s.support_worker_id = sw.id
            JOIN properties p ON s.property_id = p.id
            ${whereClause}
        `;
        const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset
        const totalSessions = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalSessions / limit);

        // Get filter options
        const properties = await dbOps.getAllProperties();
        const residents = await dbOps.getAllResidents();
        const supportWorkers = await dbOps.getAllSupportWorkers();

        res.render('sessions/index', {
            title: 'Support Sessions - Support Hours Tracker',
            sessions: sessions.rows,
            properties,
            residents,
            supportWorkers,
            filters: req.query,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalSessions,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Sessions list error:', error);
        res.render('error', {
            title: 'Sessions Error',
            message: 'Unable to load sessions'
        });
    }
});

// Create session form
router.get('/create', requireAdmin, async (req, res) => {
    try {
        const properties = await dbOps.getAllProperties();
        const residents = await dbOps.getAllResidents();
        const supportWorkers = await dbOps.getAllSupportWorkers();

        // Pre-fill with query parameters if provided
        const preselected = {
            property_id: req.query.property_id || '',
            resident_id: req.query.resident_id || '',
            support_worker_id: req.query.support_worker_id || '',
            support_type: req.query.support_type || '',
            session_date: req.query.session_date || new Date().toISOString().split('T')[0],
            start_time: req.query.start_time || '09:00',
            end_time: req.query.end_time || '10:00'
        };

        res.render('sessions/create', {
            title: 'Create Session - Support Hours Tracker',
            properties,
            residents,
            supportWorkers,
            supportTypes: [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ],
            preselected
        });
    } catch (error) {
        console.error('Session create form error:', error);
        res.render('error', {
            title: 'Session Error',
            message: 'Unable to load create form'
        });
    }
});

// View single session
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const session = await dbOps.getSessionById(req.params.id);
        if (!session) {
            return res.status(404).render('error', {
                title: 'Session Not Found',
                message: 'The requested session does not exist'
            });
        }

        res.render('sessions/view', {
            title: `Session Details - Support Hours Tracker`,
            session: session
        });
    } catch (error) {
        console.error('Session view error:', error);
        res.render('error', {
            title: 'Session Error',
            message: 'Unable to load session details'
        });
    }
});

// Create session handler
router.post('/create', requireAdmin, [
    body('resident_id').isUUID(),
    body('support_worker_id').isUUID(),
    body('property_id').isUUID(),
    body('support_type').isIn(['mental_health', 'domestic_independence', 'activity_group']),
    body('session_date').isDate(),
    body('start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('end_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('duration_minutes').isInt({ min: 15, max: 480 }),
    body('status').optional().isIn(['planned', 'completed', 'cancelled', 'no_show']),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const properties = await dbOps.getAllProperties();
            const residents = await dbOps.getAllResidents();
            const supportWorkers = await dbOps.getAllSupportWorkers();
            return res.render('sessions/create', {
                title: 'Create Session - Support Hours Tracker',
                properties,
                residents,
                supportWorkers,
                supportTypes: [
                    { key: 'mental_health', label: 'Mental Health Support' },
                    { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                    { key: 'activity_group', label: 'Activity Based Group Support' }
                ],
                error: 'Please provide valid session information',
                formData: req.body
            });
        }

        // Validate that end time is after start time
        if (req.body.start_time >= req.body.end_time) {
            const properties = await dbOps.getAllProperties();
            const residents = await dbOps.getAllResidents();
            const supportWorkers = await dbOps.getAllSupportWorkers();
            return res.render('sessions/create', {
                title: 'Create Session - Support Hours Tracker',
                properties,
                residents,
                supportWorkers,
                supportTypes: [
                    { key: 'mental_health', label: 'Mental Health Support' },
                    { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                    { key: 'activity_group', label: 'Activity Based Group Support' }
                ],
                error: 'End time must be after start time',
                formData: req.body
            });
        }

        // Check for conflicts (same support worker at same time)
        const conflictCheck = await query(
            `SELECT id FROM support_sessions 
             WHERE support_worker_id = $1 
               AND session_date = $2 
               AND status NOT IN ('cancelled', 'no_show')
               AND ((start_time <= $3 AND end_time > $3) 
                    OR (start_time < $4 AND end_time >= $4)
                    OR (start_time >= $3 AND end_time <= $4))`,
            [req.body.support_worker_id, req.body.session_date, req.body.start_time, req.body.end_time]
        );

        if (conflictCheck.rows.length > 0) {
            const properties = await dbOps.getAllProperties();
            const residents = await dbOps.getAllResidents();
            const supportWorkers = await dbOps.getAllSupportWorkers();
            return res.render('sessions/create', {
                title: 'Create Session - Support Hours Tracker',
                properties,
                residents,
                supportWorkers,
                supportTypes: [
                    { key: 'mental_health', label: 'Mental Health Support' },
                    { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                    { key: 'activity_group', label: 'Activity Based Group Support' }
                ],
                error: 'Support worker is already scheduled at this time',
                formData: req.body
            });
        }

        const result = await query(
            `INSERT INTO support_sessions 
             (resident_id, support_worker_id, property_id, support_type, session_date, 
              start_time, end_time, duration_minutes, status, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [req.body.resident_id, req.body.support_worker_id, req.body.property_id, 
             req.body.support_type, req.body.session_date, req.body.start_time, 
             req.body.end_time, parseInt(req.body.duration_minutes), 
             req.body.status || 'planned', req.body.notes || null, req.session.user.id]
        );

        res.redirect('/sessions/' + result.rows[0].id);
    } catch (error) {
        console.error('Session creation error:', error);
        const properties = await dbOps.getAllProperties();
        const residents = await dbOps.getAllResidents();
        const supportWorkers = await dbOps.getAllSupportWorkers();
        res.render('sessions/create', {
            title: 'Create Session - Support Hours Tracker',
            properties,
            residents,
            supportWorkers,
            supportTypes: [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ],
            error: 'An error occurred creating the session',
            formData: req.body
        });
    }
});

// Edit session form
router.get('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const session = await dbOps.getSessionById(req.params.id);
        if (!session) {
            return res.status(404).render('error', {
                title: 'Session Not Found',
                message: 'The requested session does not exist'
            });
        }

        const properties = await dbOps.getAllProperties();
        const residents = await dbOps.getAllResidents();
        const supportWorkers = await dbOps.getAllSupportWorkers();

        res.render('sessions/edit', {
            title: `Edit Session - Support Hours Tracker`,
            session,
            properties,
            residents,
            supportWorkers,
            supportTypes: [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ]
        });
    } catch (error) {
        console.error('Session edit form error:', error);
        res.render('error', {
            title: 'Session Error',
            message: 'Unable to load session for editing'
        });
    }
});

// Update session handler
router.post('/:id/edit', requireAdmin, [
    body('resident_id').isUUID(),
    body('support_worker_id').isUUID(),
    body('property_id').isUUID(),
    body('support_type').isIn(['mental_health', 'domestic_independence', 'activity_group']),
    body('session_date').isDate(),
    body('start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('end_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('duration_minutes').isInt({ min: 15, max: 480 }),
    body('status').isIn(['planned', 'completed', 'cancelled', 'no_show']),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const session = await dbOps.getSessionById(req.params.id);
            const properties = await dbOps.getAllProperties();
            const residents = await dbOps.getAllResidents();
            const supportWorkers = await dbOps.getAllSupportWorkers();
            return res.render('sessions/edit', {
                title: `Edit Session - Support Hours Tracker`,
                session,
                properties,
                residents,
                supportWorkers,
                supportTypes: [
                    { key: 'mental_health', label: 'Mental Health Support' },
                    { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                    { key: 'activity_group', label: 'Activity Based Group Support' }
                ],
                error: 'Please provide valid session information',
                formData: req.body
            });
        }

        await query(
            `UPDATE support_sessions 
             SET resident_id = $1, support_worker_id = $2, property_id = $3, support_type = $4, 
                 session_date = $5, start_time = $6, end_time = $7, duration_minutes = $8, 
                 status = $9, notes = $10
             WHERE id = $11`,
            [req.body.resident_id, req.body.support_worker_id, req.body.property_id, 
             req.body.support_type, req.body.session_date, req.body.start_time, 
             req.body.end_time, parseInt(req.body.duration_minutes), 
             req.body.status, req.body.notes || null, req.params.id]
        );

        res.redirect('/sessions/' + req.params.id);
    } catch (error) {
        console.error('Session update error:', error);
        const session = await dbOps.getSessionById(req.params.id);
        const properties = await dbOps.getAllProperties();
        const residents = await dbOps.getAllResidents();
        const supportWorkers = await dbOps.getAllSupportWorkers();
        res.render('sessions/edit', {
            title: `Edit Session - Support Hours Tracker`,
            session,
            properties,
            residents,
            supportWorkers,
            supportTypes: [
                { key: 'mental_health', label: 'Mental Health Support' },
                { key: 'domestic_independence', label: 'Domestic & Independence Support' },
                { key: 'activity_group', label: 'Activity Based Group Support' }
            ],
            error: 'An error occurred updating the session',
            formData: req.body
        });
    }
});

// Delete session
router.post('/:id/delete', requireAdmin, async (req, res) => {
    try {
        await query('DELETE FROM support_sessions WHERE id = $1', [req.params.id]);
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.json({ success: true });
        } else {
            res.redirect('/sessions');
        }
    } catch (error) {
        console.error('Session deletion error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({ error: 'An error occurred deleting the session' });
        } else {
            res.redirect('/sessions');
        }
    }
});

// API endpoint to get residents by property
router.get('/api/properties/:propertyId/residents', requireAuth, async (req, res) => {
    try {
        const residents = await dbOps.getResidentsByProperty(req.params.propertyId);
        res.json(residents);
    } catch (error) {
        console.error('Get residents by property error:', error);
        res.status(500).json({ error: 'Unable to fetch residents' });
    }
});

module.exports = router;