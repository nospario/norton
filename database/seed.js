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

async function seed() {
    try {
        console.log('Starting database seeding...');
        
        // Read and execute seed.sql
        const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
        await pool.query(seedSql);
        
        console.log('Database seeding completed successfully!');
        console.log('Default users created:');
        console.log('- Admin: admin@support-hours.com / admin123');
        console.log('- Viewer: viewer@support-hours.com / admin123');
        
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run seeding if called directly
if (require.main === module) {
    seed();
}

module.exports = { seed };