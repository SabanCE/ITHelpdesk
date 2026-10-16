
const express = require('express');
const { requireRole } = require('../middleware/auth');
const sql = require('mssql/msnodesqlv8');
const { dispatchUnassignedTickets } = require('../ticketAssignment');

const router = express.Router();

// GET /api/tickets

router.get('/', async (req, res) => {
    try {
        const { status, priority } = req.query;

        const allowedStatuses = [
            'open',
            'in_progress',
            'resolved',
            'closed'
        ];

        const allowedPriorities = ['low', 'medium', 'high'];

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Geçersiz durum filtresi.'
            });
        }

        if (priority && !allowedPriorities.includes(priority)) {
            return res.status(400).json({
                message: 'Geçersiz öncelik filtresi.'
            });
        }

        const pool = req.app.locals.dbPool;
        const request = pool.request();
        const conditions = [];

        if (req.user.role === 'employee') {
            conditions.push('t.CreatedBy = @currentUserId');
            request.input('currentUserId', req.user.id);
        }

        if (status === 'open') {
            // Açık: henüz çözülmemiş tüm ticket'lar
            conditions.push(
                "t.Status IN ('open', 'in_progress')"
            );
        } else if (status === 'closed' || status === 'resolved') {
            // Kapalı: çözülmüş ticket'lar
            conditions.push("t.Status = 'resolved'");
        } else if (status === 'in_progress') {
            conditions.push("t.Status = @status AND t.AssignedTo IS NOT NULL");
            request.input('status', status);
        }

        if (priority) {
            conditions.push('t.Priority = @priority');
            request.input('priority', priority);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const result = await request.query(`
            SELECT
                t.Id,
                t.Title,
                t.Description,
                CASE
                    WHEN t.AssignedTo IS NULL AND t.Status = 'in_progress'
                        THEN 'open'
                    ELSE t.Status
                END AS Status,
                t.Priority,
                t.AssignedTo,
                t.CreatedAt,
                resolution.ResolvedAt,
                employee.Name AS EmployeeName,
                itstaff.Name AS AssignedITStaff
            FROM dbo.Tickets AS t
            INNER JOIN dbo.Users AS employee
                ON t.CreatedBy = employee.Id
            LEFT JOIN dbo.Users AS itstaff
                ON t.AssignedTo = itstaff.Id
            OUTER APPLY (
                SELECT MIN(h.CreatedAt) AS ResolvedAt
                FROM dbo.TicketHistory AS h
                WHERE h.TicketId = t.Id
                  AND h.NewStatus = 'resolved'
            ) AS resolution
            ${whereClause}
            ORDER BY t.CreatedAt DESC;
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Ticket listesi alınamadı:', error.message);

        res.status(500).json({
            message: 'Ticket listesi alınırken bir hata oluştu.'
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'Geçerli bir ticket ID girilmelidir.'
            });
        }

        const pool = req.app.locals.dbPool;

        const request = pool.request()
            .input('id', id);
        let ownerCondition = '';

        if (req.user.role === 'employee') {
            ownerCondition = 'AND t.CreatedBy = @currentUserId';
            request.input('currentUserId', req.user.id);
        }

        const result = await request
            .query(`
                SELECT
                    t.Id,
                    t.Title,
                    t.Description,
                    CASE
                        WHEN t.AssignedTo IS NULL AND t.Status = 'in_progress'
                            THEN 'open'
                        ELSE t.Status
                    END AS Status,
                    t.Priority,
                    t.AssignedTo,
                    t.CreatedAt,
                    resolution.ResolvedAt,
                    employee.Name AS EmployeeName,
                    itstaff.Name AS AssignedITStaff
                FROM dbo.Tickets AS t
                INNER JOIN dbo.Users AS employee
                    ON t.CreatedBy = employee.Id
                LEFT JOIN dbo.Users AS itstaff
                    ON t.AssignedTo = itstaff.Id
                OUTER APPLY (
                    SELECT MIN(h.CreatedAt) AS ResolvedAt
                    FROM dbo.TicketHistory AS h
                    WHERE h.TicketId = t.Id
                      AND h.NewStatus = 'resolved'
                ) AS resolution
                WHERE t.Id = @id
                ${ownerCondition};
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                message: 'Ticket bulunamadı.'
            });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Ticket alınamadı:', error.message);

        res.status(500).json({
            message: 'Ticket alınırken bir hata oluştu.'
        });
    }
});


router.post('/', async (req, res) => {
    let transaction;
    try {
        const { title, description, priority, createdBy: requestedCreatedBy } = req.body ?? {};
        const canCreateForEmployee = ['it_staff', 'it_admin'].includes(req.user.role);
        const createdBy = canCreateForEmployee
            ? requestedCreatedBy
            : req.user.id;

        if (
            typeof title !== 'string' ||
            !title.trim() ||
            typeof description !== 'string' ||
            !description.trim() ||
            !Number.isInteger(createdBy) ||
            createdBy <= 0
        ) {
            return res.status(400).json({
                message: canCreateForEmployee
                    ? 'Başlık, açıklama ve talep sahibi çalışan zorunludur.'
                    : 'Başlık ve açıklama zorunludur.'
            });
        }

        const allowedPriorities = ['low', 'medium', 'high'];
        const selectedPriority = priority ?? 'medium';

        if (!allowedPriorities.includes(selectedPriority)) {
            return res.status(400).json({
                message: 'Öncelik low, medium veya high olmalıdır.'
            });
        }

        const pool = req.app.locals.dbPool;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const employeeResult = await transaction.request()
            .input('createdBy', createdBy)
            .query(`
                SELECT Id
                FROM dbo.Users
                WHERE Id = @createdBy
                  AND Role = 'employee';
            `);

        if (employeeResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Talep sahibi olarak geçerli bir çalışan seçilmelidir.'
            });
        }

        const result = await transaction.request()
            .input('title', title.trim())
            .input('description', description.trim())
            .input('priority', selectedPriority)
            .input('createdBy', createdBy)
            .query(`
                INSERT INTO dbo.Tickets
                    (Title, Description, Priority, CreatedBy)
                OUTPUT
                    INSERTED.Id,
                    INSERTED.Title,
                    INSERTED.Description,
                    INSERTED.Status,
                    INSERTED.Priority,
                    INSERTED.CreatedBy,
                    INSERTED.CreatedAt
                VALUES
                    (@title, @description, @priority, @createdBy);
            `);

        await dispatchUnassignedTickets(pool, req.user.id, transaction);
        const currentTicket = await transaction.request()
            .input('id', result.recordset[0].Id)
            .query(`
                    SELECT
                        ticket.Id,
                        ticket.Title,
                        ticket.Description,
                        ticket.Status,
                        ticket.Priority,
                        ticket.CreatedBy,
                        ticket.AssignedTo,
                        ticket.CreatedAt,
                        employee.Name AS EmployeeName,
                        itstaff.Name AS AssignedITStaff
                    FROM dbo.Tickets AS ticket
                    INNER JOIN dbo.Users AS employee
                        ON employee.Id = ticket.CreatedBy
                    LEFT JOIN dbo.Users AS itstaff
                        ON itstaff.Id = ticket.AssignedTo
                    WHERE ticket.Id = @id;
            `);

        await transaction.commit();
        res.status(201).json(currentTicket.recordset[0]);
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Ticket oluşturma transaction geri alınamadı:', rollbackError.message);
            }
        }
        console.error('Ticket oluşturulamadı:', error.message);

        res.status(500).json({
            message: 'Ticket oluşturulurken bir hata oluştu.'
        });
    }
});



router.patch('/:id', requireRole('it_staff', 'it_admin'), async (req, res) => {
    const id = Number(req.params.id);
    const { status, priority, assignedTo } = req.body ?? {};
    const changedBy = req.user.id;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            message: 'Geçerli bir ticket ID girilmelidir.'
        });
    }

    const allowedStatuses = ['open', 'in_progress', 'resolved'];
    const allowedPriorities = ['low', 'medium', 'high'];

    if (status === undefined && priority === undefined &&
        assignedTo === undefined) {
        return res.status(400).json({
            message: 'Güncellenecek bir alan göndermelisin.'
        });
    }

    if (status !== undefined && !allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: 'Geçersiz durum değeri.'
        });
    }

    if (priority !== undefined &&
        !allowedPriorities.includes(priority)) {
        return res.status(400).json({
            message: 'Geçersiz öncelik değeri.'
        });
    }

    if (
        assignedTo !== undefined &&
        assignedTo !== null &&
        (!Number.isInteger(assignedTo) || assignedTo <= 0)
    ) {
        return res.status(400).json({
            message: 'assignedTo pozitif bir kullanıcı ID veya null olmalıdır.'
        });
    }

    if (
        assignedTo !== undefined
        && req.user.role !== 'it_admin'
        && !(req.user.role === 'it_staff' && assignedTo === null)
    ) {
        return res.status(403).json({
            message: 'Talep personelini yalnızca IT yöneticisi atayabilir; personel kendi ticketını bırakabilir.'
        });
    }

    const pool = req.app.locals.dbPool;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // Ticket'ı oku ve transaction boyunca kilitle
        const currentResult = await transaction.request()
            .input('id', id)
            .query(`
                SELECT
                    ticket.Id,
                    ticket.Status,
                    ticket.AssignedTo,
                    resolution.ResolvedAt
                FROM dbo.Tickets AS ticket WITH (UPDLOCK, ROWLOCK)
                OUTER APPLY (
                    SELECT MIN(h.CreatedAt) AS ResolvedAt
                    FROM dbo.TicketHistory AS h
                    WHERE h.TicketId = ticket.Id
                      AND h.NewStatus = 'resolved'
                ) AS resolution
                WHERE ticket.Id = @id;
            `);

        if (currentResult.recordset.length === 0) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Ticket bulunamadı.'
            });
        }

        const oldStatus = currentResult.recordset[0].Status;
        const oldAssignedTo = currentResult.recordset[0].AssignedTo;
        let resolvedAt = currentResult.recordset[0].ResolvedAt ?? null;
        const nextAssignedTo = assignedTo === undefined ? oldAssignedTo : assignedTo;
        let nextStatus = status === undefined ? oldStatus : status;

        if (
            req.user.role === 'it_staff'
            && assignedTo === null
            && Number(oldAssignedTo) !== req.user.id
        ) {
            await transaction.rollback();
            return res.status(403).json({
                message: 'Yalnızca size atanmış ticketı kuyruğa bırakabilirsiniz.'
            });
        }

        if (nextAssignedTo === null && nextStatus === 'in_progress') {
            if (status === 'in_progress') {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Atanmamış ticket işlemde durumuna alınamaz.'
                });
            }
            nextStatus = 'open';
        }

        if (status !== undefined) {
            const staffResult = await transaction.request()
                .input('changedBy', changedBy)
                .query(`
                    SELECT Id
                    FROM dbo.Users
                    WHERE Id = @changedBy
                      AND Role IN ('it_staff', 'it_admin');
                `);

            if (staffResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(400).json({
                    message: 'Durumu değiştiren IT personeli bulunamadı.'
                });
            }
        }

        if (assignedTo !== undefined && assignedTo !== null) {
            const assignedResult = await transaction.request()
                .input('assignedTo', assignedTo)
                .query(`
                    SELECT Id
                    FROM dbo.Users
                    WHERE Id = @assignedTo
                      AND Role = 'it_staff';
                `);

            if (assignedResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(400).json({
                    message: 'Atanacak IT personeli bulunamadı.'
                });
            }
        }

        const updates = [];
        const request = transaction.request();

        request.input('id', id);

        if (status !== undefined || nextStatus !== oldStatus) {
            updates.push('Status = @status');
            request.input('status', nextStatus);
        }

        if (priority !== undefined) {
            updates.push('Priority = @priority');
            request.input('priority', priority);
        }

        if (assignedTo !== undefined) {
            updates.push('AssignedTo = @assignedTo');
            request.input('assignedTo', assignedTo);
        }

        const updateResult = await request.query(`
            UPDATE dbo.Tickets
            SET ${updates.join(', ')}
            OUTPUT
                INSERTED.Id,
                INSERTED.Title,
                INSERTED.Description,
                INSERTED.Status,
                INSERTED.Priority,
                INSERTED.CreatedBy,
                INSERTED.AssignedTo,
                INSERTED.CreatedAt
            WHERE Id = @id;
        `);

        // Yalnızca durum gerçekten değiştiyse geçmişe ekle
        if (nextStatus !== oldStatus) {
            await transaction.request()
                .input('ticketId', id)
                .input('changedBy', changedBy)
                .input('oldStatus', oldStatus)
                .input('newStatus', nextStatus)
                .query(`
                    INSERT INTO dbo.TicketHistory
                        (TicketId, ChangedBy, OldStatus, NewStatus)
                    VALUES
                        (@ticketId, @changedBy, @oldStatus, @newStatus);
                `);

            if (nextStatus === 'resolved') {
                const resolutionResult = await transaction.request()
                    .input('ticketId', id)
                    .query(`
                        SELECT MIN(CreatedAt) AS ResolvedAt
                        FROM dbo.TicketHistory
                        WHERE TicketId = @ticketId
                          AND NewStatus = 'resolved';
                    `);
                resolvedAt = resolutionResult.recordset[0].ResolvedAt;
            }
        }

        if (
            assignedTo === null
            && oldAssignedTo !== null
            && nextStatus !== 'resolved'
        ) {
            await transaction.request()
                .input('ticketId', id)
                .input('changedBy', changedBy)
                .query(`
                    INSERT INTO dbo.TicketHistory
                        (TicketId, ChangedBy, OldStatus, NewStatus)
                    VALUES
                        (@ticketId, @changedBy, 'open', 'open');
                `);
        }

        const releasedByStaff = assignedTo === null && req.user.role === 'it_staff'
            ? req.user.id
            : undefined;
        await dispatchUnassignedTickets(
            pool,
            changedBy,
            transaction,
            releasedByStaff,
        );
        await transaction.commit();

        res.json({
            ...updateResult.recordset[0],
            ResolvedAt: resolvedAt
        });
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error('Transaction geri alınamadı:',
                rollbackError.message);
        }

        console.error('Ticket güncellenemedi:', error.message);

        res.status(500).json({
            message: 'Ticket güncellenirken bir hata oluştu.'
        });
    }
});


router.get('/:id/history', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: 'Geçerli bir ticket ID girilmelidir.'
            });
        }

        const pool = req.app.locals.dbPool;

        const request = pool.request()
            .input('ticketId', id);
        let ownerCondition = '';

        if (req.user.role === 'employee') {
            ownerCondition = `
                AND EXISTS (
                    SELECT 1
                    FROM dbo.Tickets AS t
                    WHERE t.Id = h.TicketId
                      AND t.CreatedBy = @currentUserId
                )
            `;
            request.input('currentUserId', req.user.id);
        }

        const result = await request
            .query(`
                SELECT
                    h.Id,
                    h.TicketId,
                    h.OldStatus,
                    h.NewStatus,
                    h.CreatedAt,
                    u.Name AS ChangedByName
                FROM dbo.TicketHistory AS h
                INNER JOIN dbo.Users AS u
                    ON h.ChangedBy = u.Id
                WHERE h.TicketId = @ticketId
                ${ownerCondition}
                ORDER BY h.CreatedAt DESC, h.Id DESC;
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Ticket geçmişi alınamadı:', error.message);

        res.status(500).json({
            message: 'Ticket geçmişi alınırken bir hata oluştu.'
        });
    }
});




module.exports = router;
