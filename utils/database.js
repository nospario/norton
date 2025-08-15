const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'support_hours',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

// Generic database query function
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Transaction wrapper
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Common database operations
const dbOps = {
    // Users
    async getUserByEmail(email) {
        const result = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );
        return result.rows[0];
    },

    async getUserById(id) {
        const result = await query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [id]
        );
        return result.rows[0];
    },

    async createUser(userData) {
        const result = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, first_name, last_name, role, created_at`,
            [userData.email, userData.password_hash, userData.first_name, userData.last_name, userData.role]
        );
        return result.rows[0];
    },

    async updateUserLastLogin(id) {
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );
    },

    async updateUserPassword(id, passwordHash) {
        await query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
            [passwordHash, id]
        );
    },

    async incrementFailedLoginAttempts(id) {
        await query(
            'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
            [id]
        );
    },

    async resetFailedLoginAttempts(id) {
        await query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
            [id]
        );
    },

    async lockUser(id, lockUntil) {
        await query(
            'UPDATE users SET locked_until = $1 WHERE id = $2',
            [lockUntil, id]
        );
    },

    // Properties
    async getAllProperties() {
        const result = await query(
            'SELECT * FROM properties ORDER BY name'
        );
        return result.rows;
    },

    async getPropertyById(id) {
        const result = await query(
            'SELECT * FROM properties WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    async createProperty(propertyData) {
        const result = await query(
            `INSERT INTO properties (name, address, max_capacity, manager_name, manager_email, manager_phone)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [propertyData.name, propertyData.address, propertyData.max_capacity, 
             propertyData.manager_name, propertyData.manager_email, propertyData.manager_phone]
        );
        return result.rows[0];
    },

    async updateProperty(id, propertyData) {
        const result = await query(
            `UPDATE properties 
             SET name = $1, address = $2, max_capacity = $3, manager_name = $4, manager_email = $5, manager_phone = $6
             WHERE id = $7
             RETURNING *`,
            [propertyData.name, propertyData.address, propertyData.max_capacity, 
             propertyData.manager_name, propertyData.manager_email, propertyData.manager_phone, id]
        );
        return result.rows[0];
    },

    async deleteProperty(id) {
        await query(
            'UPDATE properties SET is_active = false WHERE id = $1',
            [id]
        );
    },

    // Residents
    async getAllResidents() {
        const result = await query(
            `SELECT r.*, p.name as property_name 
             FROM residents r 
             LEFT JOIN properties p ON r.property_id = p.id 
             WHERE r.is_active = true 
             ORDER BY r.last_name, r.first_name`
        );
        return result.rows;
    },

    async getResidentById(id) {
        const result = await query(
            `SELECT r.*, p.name as property_name 
             FROM residents r 
             LEFT JOIN properties p ON r.property_id = p.id 
             WHERE r.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async getResidentsByProperty(propertyId) {
        const result = await query(
            `SELECT * FROM residents 
             WHERE property_id = $1 AND is_active = true 
             ORDER BY last_name, first_name`,
            [propertyId]
        );
        return result.rows;
    },

    // Support Workers
    async getAllSupportWorkers() {
        const result = await query(
            'SELECT * FROM support_workers WHERE is_active = true ORDER BY last_name, first_name'
        );
        return result.rows;
    },

    async getSupportWorkerById(id) {
        const result = await query(
            'SELECT * FROM support_workers WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    // Support Sessions
    async getSessionsByDateRange(startDate, endDate) {
        const result = await query(
            `SELECT s.*, 
                    r.first_name as resident_first_name, r.last_name as resident_last_name,
                    sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                    p.name as property_name
             FROM support_sessions s
             JOIN residents r ON s.resident_id = r.id
             JOIN support_workers sw ON s.support_worker_id = sw.id
             JOIN properties p ON s.property_id = p.id
             WHERE s.session_date BETWEEN $1 AND $2
             ORDER BY s.session_date, s.start_time`,
            [startDate, endDate]
        );
        return result.rows;
    },

    async getSessionById(id) {
        const result = await query(
            `SELECT s.*, 
                    r.first_name as resident_first_name, r.last_name as resident_last_name,
                    sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                    p.name as property_name
             FROM support_sessions s
             JOIN residents r ON s.resident_id = r.id
             JOIN support_workers sw ON s.support_worker_id = sw.id
             JOIN properties p ON s.property_id = p.id
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    // Dashboard statistics
    async getDashboardStats() {
        const result = await query(`
            SELECT 
                (SELECT COUNT(*) FROM residents WHERE is_active = true) as total_residents,
                (SELECT COUNT(*) FROM support_workers WHERE is_active = true) as total_support_workers,
                (SELECT COUNT(*) FROM properties WHERE is_active = true) as total_properties,
                (SELECT COUNT(*) FROM support_sessions 
                 WHERE DATE_TRUNC('month', session_date) = DATE_TRUNC('month', CURRENT_DATE)
                 AND status = 'completed') as sessions_this_month,
                (SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 
                 FROM support_sessions 
                 WHERE DATE_TRUNC('month', session_date) = DATE_TRUNC('month', CURRENT_DATE)
                 AND status = 'completed') as hours_this_month,
                (SELECT COUNT(*) FROM support_sessions 
                 WHERE session_date = CURRENT_DATE) as sessions_today
        `);
        return result.rows[0];
    },

    // Monthly usage summary
    async getMonthlyUsageSummary(year, month) {
        const result = await query(`
            SELECT 
                r.id,
                r.first_name,
                r.last_name,
                r.monthly_support_hours,
                p.name as property_name,
                COALESCE(SUM(s.duration_minutes), 0) / 60.0 as hours_used,
                r.monthly_support_hours - COALESCE(SUM(s.duration_minutes), 0) / 60.0 as remaining_hours
            FROM residents r
            LEFT JOIN properties p ON r.property_id = p.id
            LEFT JOIN support_sessions s ON r.id = s.resident_id 
                AND EXTRACT(YEAR FROM s.session_date) = $1
                AND EXTRACT(MONTH FROM s.session_date) = $2
                AND s.status = 'completed'
            WHERE r.is_active = true
            GROUP BY r.id, r.first_name, r.last_name, r.monthly_support_hours, p.name
            ORDER BY r.last_name, r.first_name
        `, [year, month]);
        return result.rows;
    }
};

module.exports = { pool, query, transaction, dbOps };