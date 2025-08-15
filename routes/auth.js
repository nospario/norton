const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { dbOps } = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', { 
        title: 'Login - Support Hours Tracker',
        error: req.session.error,
        layout: 'auth'
    });
    delete req.session.error;
});

// Login handler
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.session.error = 'Please provide valid email and password';
            return res.redirect('/auth/login');
        }

        const { email, password } = req.body;
        
        // Get user from database
        const user = await dbOps.getUserByEmail(email);
        if (!user) {
            req.session.error = 'Invalid email or password';
            return res.redirect('/auth/login');
        }

        // Check if user is locked
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            req.session.error = 'Account is temporarily locked. Please try again later.';
            return res.redirect('/auth/login');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            // Increment failed attempts
            await dbOps.incrementFailedLoginAttempts(user.id);
            
            // Lock account if too many failed attempts
            if (user.failed_login_attempts >= 4) { // 5 attempts total
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
                await dbOps.lockUser(user.id, lockUntil);
                req.session.error = 'Too many failed attempts. Account locked for 15 minutes.';
            } else {
                req.session.error = 'Invalid email or password';
            }
            return res.redirect('/auth/login');
        }

        // Reset failed attempts on successful login
        await dbOps.resetFailedLoginAttempts(user.id);
        await dbOps.updateUserLastLogin(user.id);

        // Set session
        req.session.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
        };

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        req.session.error = 'An error occurred during login';
        res.redirect('/auth/login');
    }
});

// Logout handler
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

// Password reset request page
router.get('/reset-password', (req, res) => {
    res.render('auth/reset-password', { 
        title: 'Reset Password - Support Hours Tracker',
        layout: 'auth'
    });
});

// Password reset request handler
router.post('/reset-password', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/reset-password', {
                title: 'Reset Password - Support Hours Tracker',
                error: 'Please provide a valid email address',
                layout: 'auth'
            });
        }

        const { email } = req.body;
        const user = await dbOps.getUserByEmail(email);
        
        // Always show success message for security
        res.render('auth/reset-password', {
            title: 'Reset Password - Support Hours Tracker',
            success: 'If an account with that email exists, a password reset link has been sent.',
            layout: 'auth'
        });

        // Only send email if user exists (implement email sending here)
        if (user) {
            // TODO: Implement email sending functionality
            console.log(`Password reset requested for ${email}`);
        }
    } catch (error) {
        console.error('Password reset error:', error);
        res.render('auth/reset-password', {
            title: 'Reset Password - Support Hours Tracker',
            error: 'An error occurred. Please try again.',
            layout: 'auth'
        });
    }
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await dbOps.getUserById(req.session.user.id);
        res.render('auth/profile', {
            title: 'Profile - Support Hours Tracker',
            user: user
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.render('error', {
            title: 'Error',
            message: 'Unable to load profile'
        });
    }
});

// Update profile
router.post('/profile', requireAuth, [
    body('first_name').notEmpty().trim(),
    body('last_name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const user = await dbOps.getUserById(req.session.user.id);
            return res.render('auth/profile', {
                title: 'Profile - Support Hours Tracker',
                user: user,
                error: 'Please provide valid information'
            });
        }

        const { first_name, last_name, email } = req.body;
        
        // Update user in database
        await dbOps.query(
            'UPDATE users SET first_name = $1, last_name = $2, email = $3 WHERE id = $4',
            [first_name, last_name, email, req.session.user.id]
        );

        // Update session
        req.session.user.first_name = first_name;
        req.session.user.last_name = last_name;
        req.session.user.email = email;

        const user = await dbOps.getUserById(req.session.user.id);
        res.render('auth/profile', {
            title: 'Profile - Support Hours Tracker',
            user: user,
            success: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Profile update error:', error);
        const user = await dbOps.getUserById(req.session.user.id);
        res.render('auth/profile', {
            title: 'Profile - Support Hours Tracker',
            user: user,
            error: 'An error occurred updating your profile'
        });
    }
});

// Change password
router.post('/change-password', requireAuth, [
    body('current_password').isLength({ min: 1 }),
    body('new_password').isLength({ min: 8 }),
    body('confirm_password').custom((value, { req }) => {
        if (value !== req.body.new_password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const user = await dbOps.getUserById(req.session.user.id);
            return res.render('auth/profile', {
                title: 'Profile - Support Hours Tracker',
                user: user,
                error: 'Please provide valid password information'
            });
        }

        const { current_password, new_password } = req.body;
        const user = await dbOps.getUserById(req.session.user.id);

        // Verify current password
        const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
        if (!isValidPassword) {
            return res.render('auth/profile', {
                title: 'Profile - Support Hours Tracker',
                user: user,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(new_password, saltRounds);

        // Update password
        await dbOps.updateUserPassword(req.session.user.id, hashedPassword);

        res.render('auth/profile', {
            title: 'Profile - Support Hours Tracker',
            user: user,
            success: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        const user = await dbOps.getUserById(req.session.user.id);
        res.render('auth/profile', {
            title: 'Profile - Support Hours Tracker',
            user: user,
            error: 'An error occurred changing your password'
        });
    }
});

module.exports = router;