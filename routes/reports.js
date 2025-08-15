const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// Main reports dashboard
router.get('/', requireAuth, async (req, res) => {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // Get overview statistics
        const overviewStats = await getOverviewStats();
        
        // Get monthly utilization data
        const monthlyUtilization = await getMonthlyUtilization(currentYear, currentMonth);
        
        // Get support type distribution
        const supportTypeStats = await getSupportTypeDistribution(currentYear, currentMonth);
        
        // Get property utilization
        const propertyStats = await getPropertyUtilization(currentYear, currentMonth);
        
        // Get worker performance
        const workerStats = await getWorkerPerformance(currentYear, currentMonth);

        res.render('reports/index', {
            title: 'Reports & Analytics - Support Hours Tracker',
            overviewStats,
            monthlyUtilization,
            supportTypeStats,
            propertyStats,
            workerStats,
            currentYear,
            currentMonth
        });
    } catch (error) {
        console.error('Reports error:', error);
        res.render('error', {
            title: 'Reports Error',
            message: 'Unable to load reports'
        });
    }
});

// Monthly summary report
router.get('/monthly-summary', requireAuth, async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
        const reportYear = parseInt(year);
        const reportMonth = parseInt(month);

        const monthlyData = await getDetailedMonthlyReport(reportYear, reportMonth);
        
        res.render('reports/monthly-summary', {
            title: `Monthly Summary - ${getMonthName(reportMonth)} ${reportYear}`,
            reportData: monthlyData,
            reportYear,
            reportMonth,
            monthName: getMonthName(reportMonth)
        });
    } catch (error) {
        console.error('Monthly summary error:', error);
        res.render('error', {
            title: 'Monthly Summary Error',
            message: 'Unable to load monthly summary'
        });
    }
});

// Utilization report
router.get('/utilization', requireAuth, async (req, res) => {
    try {
        const { 
            year = new Date().getFullYear(), 
            month = new Date().getMonth() + 1,
            property_id = null 
        } = req.query;
        
        const reportYear = parseInt(year);
        const reportMonth = parseInt(month);

        const utilizationData = await getUtilizationReport(reportYear, reportMonth, property_id);
        const properties = await dbOps.getAllProperties();

        res.render('reports/utilization', {
            title: `Utilization Report - ${getMonthName(reportMonth)} ${reportYear}`,
            utilizationData,
            properties,
            selectedProperty: property_id,
            reportYear,
            reportMonth,
            monthName: getMonthName(reportMonth)
        });
    } catch (error) {
        console.error('Utilization report error:', error);
        res.render('error', {
            title: 'Utilization Report Error',
            message: 'Unable to load utilization report'
        });
    }
});

// Support worker performance report
router.get('/worker-performance', requireAuth, async (req, res) => {
    try {
        const { 
            year = new Date().getFullYear(), 
            month = new Date().getMonth() + 1 
        } = req.query;
        
        const reportYear = parseInt(year);
        const reportMonth = parseInt(month);

        const performanceData = await getWorkerPerformanceDetail(reportYear, reportMonth);

        res.render('reports/worker-performance', {
            title: `Worker Performance - ${getMonthName(reportMonth)} ${reportYear}`,
            performanceData,
            reportYear,
            reportMonth,
            monthName: getMonthName(reportMonth)
        });
    } catch (error) {
        console.error('Worker performance error:', error);
        res.render('error', {
            title: 'Worker Performance Error',
            message: 'Unable to load worker performance report'
        });
    }
});

// Export endpoints
router.get('/export/monthly-summary', requireAuth, async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month = new Date().getMonth() + 1, format = 'csv' } = req.query;
        const reportYear = parseInt(year);
        const reportMonth = parseInt(month);

        const data = await getDetailedMonthlyReport(reportYear, reportMonth);
        
        if (format === 'csv') {
            const csv = generateCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${reportYear}-${reportMonth.toString().padStart(2, '0')}.csv"`);
            res.send(csv);
        } else {
            res.status(400).json({ error: 'Unsupported format' });
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// Helper functions
async function getOverviewStats() {
    const result = await query(`
        SELECT 
            (SELECT COUNT(*) FROM residents WHERE is_active = true) as total_residents,
            (SELECT COUNT(*) FROM support_workers WHERE is_active = true) as total_workers,
            (SELECT COUNT(*) FROM properties WHERE is_active = true) as total_properties,
            (SELECT COUNT(*) FROM support_sessions 
             WHERE DATE_TRUNC('month', session_date) = DATE_TRUNC('month', CURRENT_DATE)) as sessions_this_month,
            (SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 
             FROM support_sessions 
             WHERE DATE_TRUNC('month', session_date) = DATE_TRUNC('month', CURRENT_DATE)
             AND status = 'completed') as hours_this_month,
            (SELECT COALESCE(SUM(monthly_support_hours), 0) FROM residents WHERE is_active = true) as total_allocated_hours
    `);
    
    const stats = result.rows[0];
    stats.utilization_rate = stats.total_allocated_hours > 0 
        ? ((stats.hours_this_month / stats.total_allocated_hours) * 100).toFixed(1)
        : 0;
    
    return stats;
}

async function getMonthlyUtilization(year, month) {
    const result = await query(`
        SELECT 
            r.id,
            r.first_name,
            r.last_name,
            r.monthly_support_hours,
            p.name as property_name,
            COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0) / 60.0 as hours_used,
            COALESCE(SUM(CASE WHEN s.status = 'planned' THEN s.duration_minutes ELSE 0 END), 0) / 60.0 as hours_planned,
            COALESCE(SUM(CASE WHEN s.status = 'cancelled' THEN s.duration_minutes ELSE 0 END), 0) / 60.0 as hours_cancelled,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN s.status = 'no_show' THEN 1 END) as no_show_sessions
        FROM residents r
        LEFT JOIN properties p ON r.property_id = p.id
        LEFT JOIN support_sessions s ON r.id = s.resident_id 
            AND EXTRACT(YEAR FROM s.session_date) = $1
            AND EXTRACT(MONTH FROM s.session_date) = $2
        WHERE r.is_active = true
        GROUP BY r.id, r.first_name, r.last_name, r.monthly_support_hours, p.name
        ORDER BY r.last_name, r.first_name
    `, [year, month]);

    return result.rows.map(row => ({
        ...row,
        utilization_rate: row.monthly_support_hours > 0 
            ? ((row.hours_used / row.monthly_support_hours) * 100).toFixed(1)
            : 0,
        remaining_hours: row.monthly_support_hours - row.hours_used
    }));
}

async function getSupportTypeDistribution(year, month) {
    const result = await query(`
        SELECT 
            support_type,
            COUNT(*) as session_count,
            SUM(duration_minutes) / 60.0 as total_hours,
            AVG(duration_minutes) as avg_duration,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
            COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_count
        FROM support_sessions
        WHERE EXTRACT(YEAR FROM session_date) = $1
          AND EXTRACT(MONTH FROM session_date) = $2
        GROUP BY support_type
        ORDER BY total_hours DESC
    `, [year, month]);

    return result.rows;
}

async function getPropertyUtilization(year, month) {
    const result = await query(`
        SELECT 
            p.id,
            p.name,
            p.max_capacity,
            COUNT(DISTINCT r.id) as current_residents,
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END) / 60.0 as total_hours,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions
        FROM properties p
        LEFT JOIN residents r ON p.id = r.property_id AND r.is_active = true
        LEFT JOIN support_sessions s ON p.id = s.property_id 
            AND EXTRACT(YEAR FROM s.session_date) = $1
            AND EXTRACT(MONTH FROM s.session_date) = $2
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.max_capacity
        ORDER BY total_hours DESC
    `, [year, month]);

    return result.rows.map(row => ({
        ...row,
        occupancy_rate: row.max_capacity > 0 
            ? ((row.current_residents / row.max_capacity) * 100).toFixed(1)
            : 0
    }));
}

async function getWorkerPerformance(year, month) {
    const result = await query(`
        SELECT 
            sw.id,
            sw.first_name,
            sw.last_name,
            sw.max_hours_per_month,
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END) / 60.0 as hours_worked,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions,
            COUNT(CASE WHEN s.status = 'no_show' THEN 1 END) as no_show_sessions,
            AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END) as avg_session_duration
        FROM support_workers sw
        LEFT JOIN support_sessions s ON sw.id = s.support_worker_id 
            AND EXTRACT(YEAR FROM s.session_date) = $1
            AND EXTRACT(MONTH FROM s.session_date) = $2
        WHERE sw.is_active = true
        GROUP BY sw.id, sw.first_name, sw.last_name, sw.max_hours_per_month
        ORDER BY hours_worked DESC
    `, [year, month]);

    return result.rows.map(row => ({
        ...row,
        utilization_rate: row.max_hours_per_month > 0 
            ? ((row.hours_worked / row.max_hours_per_month) * 100).toFixed(1)
            : 0,
        completion_rate: row.total_sessions > 0 
            ? ((row.completed_sessions / row.total_sessions) * 100).toFixed(1)
            : 0
    }));
}

async function getDetailedMonthlyReport(year, month) {
    const [
        summary,
        residents,
        workers,
        properties,
        sessions
    ] = await Promise.all([
        getOverviewStats(),
        getMonthlyUtilization(year, month),
        getWorkerPerformance(year, month),
        getPropertyUtilization(year, month),
        query(`
            SELECT s.*, 
                   r.first_name as resident_first_name, r.last_name as resident_last_name,
                   sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                   p.name as property_name
            FROM support_sessions s
            JOIN residents r ON s.resident_id = r.id
            JOIN support_workers sw ON s.support_worker_id = sw.id
            JOIN properties p ON s.property_id = p.id
            WHERE EXTRACT(YEAR FROM s.session_date) = $1
              AND EXTRACT(MONTH FROM s.session_date) = $2
            ORDER BY s.session_date, s.start_time
        `, [year, month])
    ]);

    return {
        summary,
        residents,
        workers,
        properties,
        sessions: sessions.rows
    };
}

async function getUtilizationReport(year, month, propertyId) {
    let whereClause = `WHERE EXTRACT(YEAR FROM s.session_date) = $1 AND EXTRACT(MONTH FROM s.session_date) = $2`;
    let params = [year, month];
    
    if (propertyId) {
        whereClause += ` AND p.id = $3`;
        params.push(propertyId);
    }

    const result = await query(`
        SELECT 
            DATE(s.session_date) as session_date,
            COUNT(*) as total_sessions,
            SUM(s.duration_minutes) / 60.0 as total_hours,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions,
            COUNT(CASE WHEN s.status = 'no_show' THEN 1 END) as no_show_sessions,
            COUNT(DISTINCT s.resident_id) as unique_residents,
            COUNT(DISTINCT s.support_worker_id) as unique_workers
        FROM support_sessions s
        JOIN properties p ON s.property_id = p.id
        ${whereClause}
        GROUP BY DATE(s.session_date)
        ORDER BY session_date
    `, params);

    return result.rows;
}

async function getWorkerPerformanceDetail(year, month) {
    const result = await query(`
        SELECT 
            sw.id,
            sw.first_name,
            sw.last_name,
            sw.max_hours_per_month,
            sw.specializations,
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END) / 60.0 as hours_worked,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions,
            COUNT(CASE WHEN s.status = 'no_show' THEN 1 END) as no_show_sessions,
            COUNT(DISTINCT s.resident_id) as unique_residents,
            COUNT(DISTINCT DATE(s.session_date)) as working_days,
            AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END) as avg_session_duration,
            STRING_AGG(DISTINCT s.support_type, ', ') as support_types_delivered
        FROM support_workers sw
        LEFT JOIN support_sessions s ON sw.id = s.support_worker_id 
            AND EXTRACT(YEAR FROM s.session_date) = $1
            AND EXTRACT(MONTH FROM s.session_date) = $2
        WHERE sw.is_active = true
        GROUP BY sw.id, sw.first_name, sw.last_name, sw.max_hours_per_month, sw.specializations
        ORDER BY hours_worked DESC
    `, [year, month]);

    return result.rows.map(row => ({
        ...row,
        utilization_rate: row.max_hours_per_month > 0 
            ? ((row.hours_worked / row.max_hours_per_month) * 100).toFixed(1)
            : 0,
        completion_rate: row.total_sessions > 0 
            ? ((row.completed_sessions / row.total_sessions) * 100).toFixed(1)
            : 0,
        avg_hours_per_day: row.working_days > 0 
            ? (row.hours_worked / row.working_days).toFixed(1)
            : 0
    }));
}

function generateCSV(data) {
    // Simple CSV generation for resident utilization
    const headers = ['Resident Name', 'Property', 'Allocated Hours', 'Hours Used', 'Utilization Rate', 'Remaining Hours'];
    const rows = data.residents.map(resident => [
        `${resident.first_name} ${resident.last_name}`,
        resident.property_name || '',
        resident.monthly_support_hours,
        resident.hours_used.toFixed(1),
        `${resident.utilization_rate}%`,
        resident.remaining_hours.toFixed(1)
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

module.exports = router;