
require('dotenv').config();

const auth = (process.env.DB_AUTH || 'windows').toLowerCase();
const sql = auth === 'sql'
    ? require('mssql')
    : require('mssql/msnodesqlv8');

function getConfig(env = process.env) {
    const configuredAuth = (env.DB_AUTH || 'windows').toLowerCase();
    const isSqlAuth = configuredAuth === 'sql';

    if (!isSqlAuth && configuredAuth !== 'windows') {
        throw new Error('DB_AUTH "windows" veya "sql" olmalıdır.');
    }

    const config = {
        server: isSqlAuth ? (env.DB_HOST || env.DB_SERVER) : env.DB_SERVER,
        database: env.DB_NAME,
        options: {
            trustedConnection: !isSqlAuth,
            trustServerCertificate: true
        }
    };

    if (!config.server || !config.database) {
        throw new Error('DB_SERVER/DB_HOST ve DB_NAME tanımlanmalıdır.');
    }

    if (isSqlAuth) {
        const port = Number(env.DB_PORT || 1433);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('DB_PORT 1-65535 arasında bir port olmalıdır.');
        }
        if (!env.DB_USER || !env.DB_PASSWORD) {
            throw new Error('SQL kimlik doğrulaması için DB_USER ve DB_PASSWORD tanımlanmalıdır.');
        }

        config.port = port;
        config.user = env.DB_USER;
        config.password = env.DB_PASSWORD;
    }

    return config;
}

async function connectDB() {
    try {
        const pool = await sql.connect(getConfig());
        console.log('SQL Server bağlantısı başarılı!');
        return pool;
    } catch (error) {
        console.error('SQL Server bağlantı hatası:', error.message);
        throw error;
    }
}

module.exports = { sql, connectDB, getConfig };
