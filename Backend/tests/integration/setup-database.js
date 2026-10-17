const sql = require('mssql');
const { hashPassword } = require('../../src/passwordhash');

const database = 'HelpDeskIntegration';
const appLogin = 'ithelpdesk_ci';
const appPassword = process.env.CI_SQL_APP_PASSWORD;

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} must be set.`);
    return value;
}

function connectionConfig(user, password, dbName = 'master') {
    return {
        server: process.env.CI_SQL_HOST || 'localhost',
        port: Number(process.env.CI_SQL_PORT || 1433),
        user,
        password,
        database: dbName,
        connectionTimeout: 5000,
        requestTimeout: 15000,
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    };
}

async function connectWithRetry(config) {
    let lastError;

    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            const pool = await new sql.ConnectionPool(config).connect();
            return pool;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    throw lastError;
}

async function main() {
    const saPassword = required('CI_SQL_SA_PASSWORD');
    required('CI_SQL_APP_PASSWORD');

    const master = await connectWithRetry(
        connectionConfig('sa', saPassword)
    );

    try {
        await master.request().query(`
            IF DB_ID(N'${database}') IS NULL
                CREATE DATABASE [${database}];
        `);

        await master.request().query(`
            IF SUSER_ID(N'${appLogin}') IS NULL
                CREATE LOGIN [${appLogin}]
                WITH PASSWORD = N'${appPassword.replaceAll("'", "''")}',
                     CHECK_POLICY = OFF,
                     DEFAULT_DATABASE = [${database}];
        `);
    } finally {
        await master.close();
    }

    const pool = await new sql.ConnectionPool(
        connectionConfig('sa', saPassword, database)
    ).connect();

    try {
        await pool.request().batch(`
            CREATE TABLE dbo.Users (
                Id int IDENTITY(1, 1) PRIMARY KEY,
                Name nvarchar(100) NOT NULL,
                Email nvarchar(150) NOT NULL UNIQUE,
                Role nvarchar(20) NOT NULL,
                PasswordHash nvarchar(100) NOT NULL
            );

            CREATE TABLE dbo.Tickets (
                Id int IDENTITY(1, 1) PRIMARY KEY,
                Title nvarchar(200) NOT NULL,
                Description nvarchar(max) NOT NULL,
                Status nvarchar(20) NOT NULL
                    CONSTRAINT DF_CI_Tickets_Status DEFAULT 'open',
                Priority nvarchar(10) NOT NULL
                    CONSTRAINT DF_CI_Tickets_Priority DEFAULT 'medium',
                CreatedBy int NOT NULL
                    CONSTRAINT FK_CI_Tickets_CreatedBy
                    REFERENCES dbo.Users(Id),
                AssignedTo int NULL
                    CONSTRAINT FK_CI_Tickets_AssignedTo
                    REFERENCES dbo.Users(Id),
                CreatedAt datetime2 NOT NULL
                    CONSTRAINT DF_CI_Tickets_CreatedAt DEFAULT SYSUTCDATETIME()
            );

            CREATE TABLE dbo.TicketHistory (
                Id int IDENTITY(1, 1) PRIMARY KEY,
                TicketId int NOT NULL
                    CONSTRAINT FK_CI_TicketHistory_Tickets
                    REFERENCES dbo.Tickets(Id),
                ChangedBy int NOT NULL
                    CONSTRAINT FK_CI_TicketHistory_Users
                    REFERENCES dbo.Users(Id),
                OldStatus nvarchar(20) NOT NULL,
                NewStatus nvarchar(20) NOT NULL,
                CreatedAt datetime2 NOT NULL
                    CONSTRAINT DF_CI_TicketHistory_CreatedAt
                    DEFAULT SYSUTCDATETIME()
            );
        `);

        const passwordHash = await hashPassword('CI-Integration-Passw0rd!');
        for (const user of [
            { name: 'CI Employee', email: 'employee@ci.test', role: 'employee' },
            { name: 'CI Technician', email: 'technician@ci.test', role: 'it_staff' },
            { name: 'CI Administrator', email: 'admin@ci.test', role: 'it_admin' }
        ]) {
            await pool.request()
                .input('name', sql.NVarChar(100), user.name)
                .input('email', sql.NVarChar(150), user.email)
                .input('role', sql.NVarChar(20), user.role)
                .input('passwordHash', sql.NVarChar(100), passwordHash)
                .query(`
                    INSERT INTO dbo.Users (Name, Email, Role, PasswordHash)
                    VALUES (@name, @email, @role, @passwordHash);
                `);
        }

        await pool.request().batch(`
            CREATE USER [${appLogin}] FOR LOGIN [${appLogin}];
            GRANT SELECT, INSERT ON OBJECT::dbo.Users TO [${appLogin}];
            GRANT SELECT, INSERT, UPDATE, DELETE
                ON OBJECT::dbo.Tickets TO [${appLogin}];
            GRANT SELECT, INSERT, DELETE
                ON OBJECT::dbo.TicketHistory TO [${appLogin}];
        `);
    } finally {
        await pool.close();
    }

    const appPool = await new sql.ConnectionPool(
        connectionConfig(appLogin, appPassword, database)
    ).connect();
    await appPool.close();

    console.log('SQL Server integration database and restricted login are ready.');
}

main().catch((error) => {
    console.error('Could not prepare SQL Server integration database:', error.message);
    process.exitCode = 1;
});
