const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { dbOps } = require('../utils/database');

const router = express.Router();

// Dashboard home page
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get dashboard statistics
        const stats = await dbOps.getDashboardStats();
        
        // Get today's sessions
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = await dbOps.getSessionsByDateRange(today, today);
        
        // Get this week's sessions
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const weekSessions = await dbOps.getSessionsByDateRange(
            startOfWeek.toISOString().split('T')[0],
            endOfWeek.toISOString().split('T')[0]
        );
        
        // Get monthly usage summary
        const currentDate = new Date();
        const monthlyUsage = await dbOps.getMonthlyUsageSummary(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1
        );
        
        // Calculate some additional metrics
        const totalMonthlyHours = monthlyUsage.reduce((sum, resident) => sum + resident.monthly_support_hours, 0);
        const usedMonthlyHours = monthlyUsage.reduce((sum, resident) => sum + parseFloat(resident.hours_used), 0);
        const utilizationRate = totalMonthlyHours > 0 ? (usedMonthlyHours / totalMonthlyHours * 100).toFixed(1) : 0;
        
        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSessions = await dbOps.getSessionsByDateRange(
            sevenDaysAgo.toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        );
        
        // Group sessions by support type for chart
        const sessionsByType = {};
        weekSessions.forEach(session => {
            if (!sessionsByType[session.support_type]) {
                sessionsByType[session.support_type] = 0;
            }
            sessionsByType[session.support_type]++;
        });
        
        res.render('dashboard/index', {
            title: 'Dashboard - Support Hours Tracker',
            stats: stats,
            todaySessions: todaySessions,
            weekSessions: weekSessions,
            monthlyUsage: monthlyUsage,
            recentSessions: recentSessions.slice(0, 10), // Show last 10 sessions
            sessionsByType: sessionsByType,
            metrics: {
                totalMonthlyHours: totalMonthlyHours,
                usedMonthlyHours: usedMonthlyHours.toFixed(1),
                utilizationRate: utilizationRate
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('error', {
            title: 'Dashboard Error',
            message: 'Unable to load dashboard data'
        });
    }
});

// Quick stats API endpoint
router.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const stats = await dbOps.getDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        res.status(500).json({ error: 'Unable to fetch statistics' });
    }
});

// Today's sessions API endpoint
router.get('/api/today-sessions', requireAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const sessions = await dbOps.getSessionsByDateRange(today, today);
        res.json(sessions);
    } catch (error) {
        console.error('Today sessions API error:', error);
        res.status(500).json({ error: 'Unable to fetch today\'s sessions' });
    }
});

// Upcoming sessions for next 7 days
router.get('/api/upcoming-sessions', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const sessions = await dbOps.getSessionsByDateRange(
            today.toISOString().split('T')[0],
            nextWeek.toISOString().split('T')[0]
        );
        
        // Filter only planned sessions
        const upcomingSessions = sessions.filter(session => 
            session.status === 'planned' && new Date(session.session_date) >= today
        );
        
        res.json(upcomingSessions);
    } catch (error) {
        console.error('Upcoming sessions API error:', error);
        res.status(500).json({ error: 'Unable to fetch upcoming sessions' });
    }
});

// Monthly overview
router.get('/monthly-overview', requireAuth, async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        
        const monthlyUsage = await dbOps.getMonthlyUsageSummary(year, month);
        
        // Get sessions for the month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        
        const monthlySessions = await dbOps.getSessionsByDateRange(
            startOfMonth.toISOString().split('T')[0],
            endOfMonth.toISOString().split('T')[0]
        );
        
        // Calculate statistics
        const totalPlanned = monthlySessions.filter(s => s.status === 'planned').length;
        const totalCompleted = monthlySessions.filter(s => s.status === 'completed').length;
        const totalCancelled = monthlySessions.filter(s => s.status === 'cancelled').length;
        const totalNoShow = monthlySessions.filter(s => s.status === 'no_show').length;
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        res.render('dashboard/monthly-overview', {
            title: `Monthly Overview - ${monthNames[month - 1]} ${year}`,
            monthlyUsage: monthlyUsage,
            monthlySessions: monthlySessions,
            stats: {
                totalPlanned,
                totalCompleted,
                totalCancelled,
                totalNoShow,
                totalSessions: monthlySessions.length
            },
            currentMonth: month,
            currentYear: year,
            monthName: monthNames[month - 1]
        });
    } catch (error) {
        console.error('Monthly overview error:', error);
        res.render('error', {
            title: 'Monthly Overview Error',
            message: 'Unable to load monthly overview'
        });
    }
});

module.exports = router;