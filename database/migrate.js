const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'support_hours',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
    try {
        console.log('Starting database migration...');
        
        // Read and execute init.sql
        const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await pool.query(initSql);
        
        console.log('Database migration completed successfully!');
        
        // Check if we should run seed data
        if (process.env.NODE_ENV === 'development') {
            console.log('Running seed data...');
            const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
            await pool.query(seedSql);
            console.log('Seed data inserted successfully!');
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrate();
}

module.exports = { migrate };