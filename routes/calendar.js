const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { dbOps, query } = require('../utils/database');

const router = express.Router();

// Main calendar view
router.get('/', requireAuth, async (req, res) => {
    try {
        const { 
            view = 'monthly', 
            year = new Date().getFullYear(), 
            month = new Date().getMonth() + 1,
            week = null,
            date = null,
            property_id = null
        } = req.query;

        const currentDate = new Date();
        const viewYear = parseInt(year);
        const viewMonth = parseInt(month);

        let startDate, endDate, calendarTitle;

        if (view === 'weekly') {
            // Weekly view - specific week or current week
            let weekStart;
            if (week) {
                weekStart = new Date(week);
            } else {
                // Default to current week
                weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
            }
            startDate = new Date(weekStart);
            endDate = new Date(weekStart);
            endDate.setDate(endDate.getDate() + 6);
            calendarTitle = `Week of ${startDate.toLocaleDateString('en-GB')}`;
        } else if (view === 'daily' && date) {
            // Daily view - specific date
            startDate = new Date(date);
            endDate = new Date(date);
            calendarTitle = startDate.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } else {
            // Monthly view (default)
            startDate = new Date(viewYear, viewMonth - 1, 1);
            endDate = new Date(viewYear, viewMonth, 0);
            calendarTitle = startDate.toLocaleDateString('en-GB', { 
                year: 'numeric', 
                month: 'long' 
            });
        }

        // Get sessions for the date range
        let sessionsQuery = `
            SELECT s.*, 
                   r.first_name as resident_first_name, r.last_name as resident_last_name,
                   sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                   p.name as property_name
            FROM support_sessions s
            JOIN residents r ON s.resident_id = r.id
            JOIN support_workers sw ON s.support_worker_id = sw.id
            JOIN properties p ON s.property_id = p.id
            WHERE s.session_date BETWEEN $1 AND $2
        `;
        
        let queryParams = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];

        if (property_id) {
            sessionsQuery += ` AND s.property_id = $3`;
            queryParams.push(property_id);
        }

        sessionsQuery += ` ORDER BY s.session_date, s.start_time`;

        const sessions = await query(sessionsQuery, queryParams);

        // Get filter options
        const properties = await dbOps.getAllProperties();

        // Prepare calendar data based on view
        let calendarData;
        if (view === 'monthly') {
            calendarData = generateMonthlyCalendar(viewYear, viewMonth, sessions.rows);
        } else if (view === 'weekly') {
            calendarData = generateWeeklyCalendar(startDate, sessions.rows);
        } else if (view === 'daily') {
            calendarData = generateDailyCalendar(startDate, sessions.rows);
        }

        // Set the current week for weekly view
        let currentWeek = week;
        if (view === 'weekly' && !week) {
            currentWeek = startDate.toISOString().split('T')[0];
        }

        res.render('calendar/index', {
            title: `Calendar - ${calendarTitle}`,
            view,
            calendarTitle,
            calendarData,
            sessions: sessions.rows,
            properties,
            currentDate: {
                year: viewYear,
                month: viewMonth,
                week: currentWeek,
                date: date
            },
            filters: {
                property_id
            },
            navigation: generateNavigation(view, viewYear, viewMonth, currentWeek, date)
        });
    } catch (error) {
        console.error('Calendar error:', error);
        res.render('error', {
            title: 'Calendar Error',
            message: 'Unable to load calendar'
        });
    }
});

// API endpoint for getting sessions for a specific date
router.get('/api/sessions/:date', requireAuth, async (req, res) => {
    try {
        const sessions = await query(
            `SELECT s.*, 
                    r.first_name as resident_first_name, r.last_name as resident_last_name,
                    sw.first_name as worker_first_name, sw.last_name as worker_last_name,
                    p.name as property_name
             FROM support_sessions s
             JOIN residents r ON s.resident_id = r.id
             JOIN support_workers sw ON s.support_worker_id = sw.id
             JOIN properties p ON s.property_id = p.id
             WHERE s.session_date = $1
             ORDER BY s.start_time`,
            [req.params.date]
        );

        res.json(sessions.rows);
    } catch (error) {
        console.error('Get sessions by date error:', error);
        res.status(500).json({ error: 'Unable to fetch sessions' });
    }
});

// Generate monthly calendar grid
function generateMonthlyCalendar(year, month, sessions) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const calendar = {
        weeks: [],
        daysOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    };

    // Group sessions by date
    const sessionsByDate = {};
    sessions.forEach(session => {
        const dateKey = session.session_date.toISOString().split('T')[0];
        if (!sessionsByDate[dateKey]) {
            sessionsByDate[dateKey] = [];
        }
        sessionsByDate[dateKey].push(session);
    });

    // Generate 6 weeks
    for (let week = 0; week < 6; week++) {
        const weekData = [];
        
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const dateKey = currentDate.toISOString().split('T')[0];
            const isCurrentMonth = currentDate.getMonth() === month - 1;
            const isToday = currentDate.toDateString() === new Date().toDateString();
            
            weekData.push({
                date: currentDate.getDate(),
                fullDate: dateKey,
                isCurrentMonth,
                isToday,
                sessions: sessionsByDate[dateKey] || []
            });
        }
        
        calendar.weeks.push(weekData);
    }

    return calendar;
}

// Generate weekly calendar
function generateWeeklyCalendar(startDate, sessions) {
    const calendar = {
        days: [],
        timeSlots: []
    };

    // Generate time slots (9 AM to 6 PM in 30-minute intervals)
    for (let hour = 9; hour <= 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            if (hour === 18 && minute > 0) break; // Stop at 6:00 PM
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            calendar.timeSlots.push(timeString);
        }
    }

    // Generate days of the week
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dateKey = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
        const isToday = date.toDateString() === new Date().toDateString();
        
        // Get sessions for this day
        const daySessions = sessions.filter(session => 
            session.session_date.toISOString().split('T')[0] === dateKey
        );

        calendar.days.push({
            date: date.getDate(),
            fullDate: dateKey,
            dayName,
            isToday,
            sessions: daySessions
        });
    }

    return calendar;
}

// Generate daily calendar
function generateDailyCalendar(date, sessions) {
    const calendar = {
        date: date,
        sessions: sessions.filter(session => 
            session.session_date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
        ).sort((a, b) => a.start_time.localeCompare(b.start_time)),
        timeSlots: []
    };

    // Generate hourly time slots
    for (let hour = 8; hour <= 19; hour++) {
        calendar.timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }

    return calendar;
}

// Generate navigation links
function generateNavigation(view, year, month, week, date) {
    const nav = { view };

    if (view === 'monthly') {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;

        nav.prev = { year: prevYear, month: prevMonth };
        nav.next = { year: nextYear, month: nextMonth };
        nav.current = { year, month };
    } else if (view === 'weekly' && week) {
        const weekDate = new Date(week);
        const prevWeek = new Date(weekDate);
        prevWeek.setDate(prevWeek.getDate() - 7);
        const nextWeek = new Date(weekDate);
        nextWeek.setDate(nextWeek.getDate() + 7);

        nav.prev = { week: prevWeek.toISOString().split('T')[0] };
        nav.next = { week: nextWeek.toISOString().split('T')[0] };
        nav.current = { week };
    } else if (view === 'daily' && date) {
        const currentDate = new Date(date);
        const prevDay = new Date(currentDate);
        prevDay.setDate(prevDay.getDate() - 1);
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);

        nav.prev = { date: prevDay.toISOString().split('T')[0] };
        nav.next = { date: nextDay.toISOString().split('T')[0] };
        nav.current = { date };
    }

    return nav;
}

module.exports = router;