// Authentication middleware

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        return res.redirect('/auth/login');
    }
    next();
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            return res.redirect('/auth/login');
        }

        if (!roles.includes(req.session.user.role)) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            return res.status(403).render('error', { 
                title: 'Access Denied',
                message: 'You do not have permission to access this resource.'
            });
        }
        next();
    };
};

const requireAdmin = requireRole(['admin']);

const checkAuth = (req, res, next) => {
    // Non-blocking auth check, sets req.isAuthenticated
    req.isAuthenticated = !!req.session.user;
    req.isAdmin = req.session.user && req.session.user.role === 'admin';
    next();
};

module.exports = {
    requireAuth,
    requireRole,
    requireAdmin,
    checkAuth
};