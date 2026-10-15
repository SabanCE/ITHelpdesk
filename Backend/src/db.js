
require('dotenv').config();

const sql = require('mssql/msnodesqlv8');

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        trustedConnection: true,
        trustServerCertificate: true
    }
};

async function connectDB() {
    try {
        const pool = await sql.connect(config);
        console.log('SQL Server bağlantısı başarılı!');
        return pool;
    } catch (error) {
        console.error('SQL Server bağlantı hatası:', error.message);
        throw error;
    }
}

module.exports = { sql, connectDB };
