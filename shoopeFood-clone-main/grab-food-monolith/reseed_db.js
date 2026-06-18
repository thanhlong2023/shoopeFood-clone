const { sequelize } = require('./src/models');
const { initializeDatabase } = require('./src/services/databaseInitializer');

async function reseed() {
    try {
        console.log('Authenticating...');
        await sequelize.authenticate();
        
        console.log('Dropping all tables and recreating...');
        await sequelize.sync({ force: true });
        
        console.log('Running database initializer (which includes seeding)...');
        await initializeDatabase();
        
        console.log('Seed completed successfully!');
    } catch(err) {
        console.error('Error during seed:', err);
    } finally {
        process.exit(0);
    }
}
reseed();
