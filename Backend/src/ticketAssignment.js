const { sql } = require('./db');

async function dispatchUnassignedTickets(
    pool,
    changedBy,
    existingTransaction,
    excludedStaffId,
) {
    const ownsTransaction = existingTransaction === undefined;
    const transaction = existingTransaction ?? new sql.Transaction(pool);

    try {
        if (ownsTransaction) {
            await transaction.begin();
        }

        const lockResult = await transaction.request()
            .input('resource', 'helpdesk-ticket-dispatch')
            .input('lockTimeout', 10000)
            .query(`
                DECLARE @lockResult int;
                EXEC @lockResult = sp_getapplock
                    @Resource = @resource,
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction',
                    @LockTimeout = @lockTimeout;
                SELECT @lockResult AS LockResult;
            `);

        if (lockResult.recordset[0].LockResult < 0) {
            throw new Error('Otomatik ticket atama kilidi alınamadı.');
        }

        const unassignedInProgress = await transaction.request()
            .query(`
                SELECT Id
                FROM dbo.Tickets WITH (UPDLOCK, ROWLOCK)
                WHERE AssignedTo IS NULL
                  AND Status = 'in_progress';
            `);

        for (const ticket of unassignedInProgress.recordset) {
            await transaction.request()
                .input('ticketId', ticket.Id)
                .input('changedBy', changedBy)
                .query(`
                    UPDATE dbo.Tickets
                    SET Status = 'open'
                    WHERE Id = @ticketId
                      AND AssignedTo IS NULL
                      AND Status = 'in_progress';

                    IF @@ROWCOUNT > 0
                    BEGIN
                        INSERT INTO dbo.TicketHistory
                            (TicketId, ChangedBy, OldStatus, NewStatus)
                        VALUES
                            (@ticketId, @changedBy, 'in_progress', 'open');
                    END;
                `);
        }

        const idleStaffResult = await transaction.request()
            .query(`
                SELECT
                    staff.Id,
                    MAX(history.CreatedAt) AS LastCompletedAt
                FROM dbo.Users AS staff
                LEFT JOIN dbo.Tickets AS assigned
                    ON assigned.AssignedTo = staff.Id
                LEFT JOIN dbo.TicketHistory AS history
                    ON history.TicketId = assigned.Id
                   AND history.NewStatus = 'resolved'
                WHERE staff.Role = 'it_staff'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.Tickets AS active
                      WHERE active.AssignedTo = staff.Id
                        AND active.Status NOT IN ('resolved', 'closed')
                  )
                GROUP BY staff.Id
                ORDER BY MAX(history.CreatedAt), staff.Id;
            `);

        const queuedTicketsResult = await transaction.request()
            .query(`
                SELECT ticket.Id, release.ChangedBy AS LastReleasedBy
                FROM dbo.Tickets AS ticket WITH (UPDLOCK, ROWLOCK)
                OUTER APPLY (
                    SELECT TOP 1 history.ChangedBy
                    FROM dbo.TicketHistory AS history
                    WHERE history.TicketId = ticket.Id
                      AND history.OldStatus = 'open'
                      AND history.NewStatus = 'open'
                    ORDER BY history.CreatedAt DESC, history.Id DESC
                ) AS release
                WHERE ticket.AssignedTo IS NULL
                  AND ticket.Status = 'open'
                ORDER BY
                    CASE ticket.Priority
                        WHEN 'high' THEN 0
                        WHEN 'medium' THEN 1
                        ELSE 2
                    END,
                    ticket.CreatedAt,
                    ticket.Id;
            `);

        const queuedTickets = [...queuedTicketsResult.recordset];
        let assignmentCount = 0;

        for (const staff of idleStaffResult.recordset) {
            if (
                excludedStaffId !== undefined
                && Number(staff.Id) === Number(excludedStaffId)
            ) {
                continue;
            }
            const ticketIndex = queuedTickets.findIndex((ticket) =>
                Number(ticket.LastReleasedBy) !== Number(staff.Id));
            if (ticketIndex < 0) continue;
            const [ticket] = queuedTickets.splice(ticketIndex, 1);
            await transaction.request()
                .input('ticketId', ticket.Id)
                .input('staffId', staff.Id)
                .query(`
                    UPDATE dbo.Tickets
                    SET AssignedTo = @staffId,
                        Status = 'open'
                    WHERE Id = @ticketId
                      AND AssignedTo IS NULL
                      AND Status = 'open';
                `);
            assignmentCount += 1;
        }

        if (ownsTransaction) {
            await transaction.commit();
        }
        return assignmentCount;
    } catch (error) {
        if (ownsTransaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Otomatik atama transaction geri alınamadı:', rollbackError.message);
            }
        }
        throw error;
    }
}

module.exports = { dispatchUnassignedTickets };
