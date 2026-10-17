const assert = require('node:assert/strict');
const sql = require('mssql');

const baseUrl = process.env.INTEGRATION_API_URL || 'http://localhost:3001';
const databaseConfig = {
    server: process.env.CI_SQL_HOST || 'localhost',
    port: Number(process.env.CI_SQL_PORT || 1433),
    user: 'ithelpdesk_ci',
    password: process.env.CI_SQL_APP_PASSWORD,
    database: 'HelpDeskIntegration',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const body = response.status === 204 ? null : await response.json();
    return { response, body };
}

async function main() {
    const unauthenticated = await request('/api/tickets');
    assert.equal(unauthenticated.response.status, 401);
    console.log('PASS: API rejects unauthenticated ticket requests (401).');

    const login = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@ci.test',
            password: 'CI-Integration-Passw0rd!'
        })
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.Role, 'it_admin');
    const authorization = `Bearer ${login.body.token}`;
    console.log('PASS: SQL-backed administrator login succeeds.');

    const create = await request('/api/tickets', {
        method: 'POST',
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: 'CI SQL integration ticket',
            description: 'Created through the API against SQL Server.',
            priority: 'high',
            createdBy: 1
        })
    });
    assert.equal(create.response.status, 201);
    assert.equal(create.body.Title, 'CI SQL integration ticket');
    assert.equal(create.body.CreatedBy, 1);
    assert.equal(create.body.AssignedTo, 2);
    const ticketId = create.body.Id;
    console.log('PASS: ticket creation persists and auto-assigns through SQL Server.');

    const list = await request('/api/tickets', {
        headers: { Authorization: authorization }
    });
    assert.equal(list.response.status, 200);
    assert.ok(list.body.some((ticket) => ticket.Id === ticketId));
    console.log('PASS: ticket list reads the created SQL record.');

    const update = await request(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'resolved' })
    });
    assert.equal(update.response.status, 200);
    assert.equal(update.body.Status, 'resolved');
    assert.ok(update.body.ResolvedAt);
    console.log('PASS: ticket status update and history persist in SQL Server.');

    const history = await request(`/api/tickets/${ticketId}/history`, {
        headers: { Authorization: authorization }
    });
    assert.equal(history.response.status, 200);
    assert.equal(history.body.length, 1);
    assert.equal(history.body[0].NewStatus, 'resolved');
    console.log('PASS: ticket history is readable from SQL Server.');

    const deletion = await request(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { Authorization: authorization }
    });
    assert.equal(deletion.response.status, 204);

    const missing = await request(`/api/tickets/${ticketId}`, {
        headers: { Authorization: authorization }
    });
    assert.equal(missing.response.status, 404);

    const verificationPool = await new sql.ConnectionPool(databaseConfig).connect();
    try {
        const result = await verificationPool.request()
            .input('ticketId', sql.Int, ticketId)
            .query(`
                SELECT
                    (SELECT COUNT(*) FROM dbo.Tickets WHERE Id = @ticketId) AS TicketCount,
                    (SELECT COUNT(*) FROM dbo.TicketHistory WHERE TicketId = @ticketId) AS HistoryCount;
            `);
        assert.equal(result.recordset[0].TicketCount, 0);
        assert.equal(result.recordset[0].HistoryCount, 0);
    } finally {
        await verificationPool.close();
    }
    console.log('PASS: delete removes the ticket and history rows (204, then 404).');
}

main().catch((error) => {
    console.error('SQL Server API integration test failed:', error.message);
    process.exitCode = 1;
});
