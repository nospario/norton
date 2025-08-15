const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import route handlers
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const propertyRoutes = require('./routes/properties');
const residentRoutes = require('./routes/residents');
const supportWorkerRoutes = require('./routes/support-workers');
const sessionRoutes = require('./routes/sessions');
const reportRoutes = require('./routes/reports');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
let pool;
try {
    pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'support_hours',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });
    
    // Test database connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.log('Database connection failed, running in demo mode');
            pool = null;
        } else {
            console.log('Database connected successfully');
        }
    });
} catch (error) {
    console.log('Database unavailable, running in demo mode');
    pool = null;
}

// Make pool available to routes
app.locals.pool = pool;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? 1000 : 100),
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
        // Skip rate limiting for development environment
        return process.env.NODE_ENV === 'development';
    }
});
app.use(limiter);

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
    credentials: true,
}));

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
    },
}));

// Handlebars configuration
const hbs = exphbs.create({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    extname: '.hbs',
    helpers: {
        formatDate: (date) => {
            if (!date) return '';
            return new Date(date).toLocaleDateString('en-GB');
        },
        formatTime: (time) => {
            if (!time) return '';
            return time.substring(0, 5); // Remove seconds
        },
        formatDateTime: (dateTime) => {
            if (!dateTime) return '';
            return new Date(dateTime).toLocaleString('en-GB');
        },
        eq: (a, b) => a === b,
        or: (a, b) => a || b,
        and: (a, b) => a && b,
        json: (obj) => JSON.stringify(obj),
        capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
        supportTypeColor: (type) => {
            const colors = {
                'mental_health': '#dc3545',
                'domestic_independence': '#28a745',
                'activity_group': '#007bff'
            };
            return colors[type] || '#6c757d';
        },
        supportTypeLabel: (type) => {
            const labels = {
                'mental_health': 'Mental Health Support',
                'domestic_independence': 'Domestic & Independence Support',
                'activity_group': 'Activity Based Group Support'
            };
            return labels[type] || type;
        },
        formatDecimal: (number, decimals = 1) => {
            if (number == null || isNaN(number)) return '0.0';
            return parseFloat(number).toFixed(decimals);
        },
        gt: (a, b) => a > b,
        gte: (a, b) => a >= b,
        lt: (a, b) => a < b,
        lte: (a, b) => a <= b,
        formatDateInput: (date) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        },
        contains: (array, item) => {
            if (!array || !Array.isArray(array)) return false;
            return array.includes(item);
        },
        ifCond: function(v1, operator, v2, options) {
            switch (operator) {
                case '==':
                    return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        },
        // Calendar helpers
        getWeekStart: function(year, month) {
            const date = new Date(year, month - 1, 1);
            const day = date.getDay();
            const diff = date.getDate() - day;
            const weekStart = new Date(date.setDate(diff));
            return weekStart.toISOString().split('T')[0];
        },
        getCurrentDate: function(format) {
            const now = new Date();
            switch(format) {
                case 'year':
                    return now.getFullYear();
                case 'month':
                    return now.getMonth() + 1;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    return weekStart.toISOString().split('T')[0];
                case 'date':
                default:
                    return now.toISOString().split('T')[0];
            }
        },
        addMinutes: function(timeString, minutes) {
            const [hours, mins] = timeString.split(':').map(Number);
            const totalMinutes = hours * 60 + mins + minutes;
            const newHours = Math.floor(totalMinutes / 60);
            const newMins = totalMinutes % 60;
            return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        },
        // Query string helper
        buildQueryString: function(filters) {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });
            return params.toString();
        },
        // Math helpers
        math: function(lvalue, operator, rvalue) {
            lvalue = parseFloat(lvalue);
            rvalue = parseFloat(rvalue);
            return {
                '+': lvalue + rvalue,
                '-': lvalue - rvalue,
                '*': lvalue * rvalue,
                '/': lvalue / rvalue,
                '%': lvalue % rvalue
            }[operator];
        },
        // Array helpers
        range: function(start, end) {
            const result = [];
            for (let i = start; i <= end; i++) {
                result.push(i);
            }
            return result;
        },
        limit: function(array, limit) {
            if (!Array.isArray(array)) return [];
            return array.slice(0, limit);
        },
        filter: function(array, property, operator, value) {
            if (!Array.isArray(array)) return [];
            return array.filter(item => {
                const itemValue = item[property];
                switch (operator) {
                    case '>': return itemValue > value;
                    case '<': return itemValue < value;
                    case '>=': return itemValue >= value;
                    case '<=': return itemValue <= value;
                    case '==': return itemValue == value;
                    case '!=': return itemValue != value;
                    default: return true;
                }
            });
        },
        orderBy: function(array, property, direction, limit) {
            if (!Array.isArray(array)) return [];
            const sorted = array.sort((a, b) => {
                const aVal = a[property];
                const bVal = b[property];
                if (direction === 'desc') {
                    return bVal - aVal;
                }
                return aVal - bVal;
            });
            return limit ? sorted.slice(0, limit) : sorted;
        },
        // Calculation helpers
        calculatePercentage: function(value, array, property) {
            if (!Array.isArray(array) || array.length === 0) return 0;
            const total = array.reduce((sum, item) => sum + (parseFloat(item[property]) || 0), 0);
            return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
        },
        calculateTotalHours: function(sessions) {
            if (!Array.isArray(sessions)) return '0.0';
            const totalMinutes = sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
            return (totalMinutes / 60).toFixed(1);
        },
        calculateAverageUtilization: function(residents) {
            if (!Array.isArray(residents) || residents.length === 0) return '0';
            const total = residents.reduce((sum, resident) => sum + parseFloat(resident.utilization_rate || 0), 0);
            return (total / residents.length).toFixed(1);
        },
        calculateCompletionRate: function(stats) {
            if (!Array.isArray(stats) || stats.length === 0) return '0';
            const totalSessions = stats.reduce((sum, stat) => sum + (stat.session_count || 0), 0);
            const completedSessions = stats.reduce((sum, stat) => sum + (stat.completed_count || 0), 0);
            return totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : '0';
        },
        calculateAverageOccupancy: function(properties) {
            if (!Array.isArray(properties) || properties.length === 0) return '0';
            const total = properties.reduce((sum, property) => sum + parseFloat(property.occupancy_rate || 0), 0);
            return (total / properties.length).toFixed(1);
        },
        calculateWorkerUtilization: function(workers) {
            if (!Array.isArray(workers) || workers.length === 0) return '0';
            const total = workers.reduce((sum, worker) => sum + parseFloat(worker.utilization_rate || 0), 0);
            return (total / workers.length).toFixed(1);
        },
        calculateNoShowRate: function(stats) {
            if (!Array.isArray(stats) || stats.length === 0) return '0';
            const totalSessions = stats.reduce((sum, stat) => sum + (stat.session_count || 0), 0);
            const noShowSessions = stats.reduce((sum, stat) => sum + (stat.no_show_count || 0), 0);
            return totalSessions > 0 ? ((noShowSessions / totalSessions) * 100).toFixed(1) : '0';
        },
        calculateAverageSessionDuration: function(stats) {
            if (!Array.isArray(stats) || stats.length === 0) return '0';
            const totalDuration = stats.reduce((sum, stat) => sum + (stat.avg_duration || 0), 0);
            return stats.length > 0 ? (totalDuration / stats.length).toFixed(0) : '0';
        },
        groupByType: function(sessions) {
            if (!Array.isArray(sessions)) return {};
            return sessions.reduce((groups, session) => {
                const type = session.support_type;
                groups[type] = (groups[type] || 0) + 1;
                return groups;
            }, {});
        }
    }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to make user available in templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/properties', propertyRoutes);
app.use('/residents', residentRoutes);
app.use('/support-workers', supportWorkerRoutes);
app.use('/sessions', sessionRoutes);
app.use('/reports', reportRoutes);
app.use('/calendar', calendarRoutes);

// Root route
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: 'Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Support Hours Tracker running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});

module.exports = app;