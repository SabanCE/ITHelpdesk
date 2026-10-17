const sql = require('mssql/msnodesqlv8');
const { dispatchUnassignedTickets } = require('../src/ticketAssignment');

function createTransaction(queryResults) {
    const requests = [];
    const transaction = {
        begin: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        request: jest.fn(() => {
            const request = {
                inputs: {},
                input(name, value) {
                    this.inputs[name] = value;
                    return this;
                },
                query: jest.fn().mockResolvedValue(queryResults[requests.length])
            };
            requests.push(request);
            return request;
        })
    };
    return { transaction, requests };
}

describe('automatic ticket assignment', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('assigns priority-ordered queue tickets to each idle technician once', async () => {
        const { transaction, requests } = createTransaction([
            { recordset: [{ LockResult: 0 }] },
            { recordset: [] },
            { recordset: [{ Id: 4 }, { Id: 5 }] },
            { recordset: [{ Id: 21 }, { Id: 22 }, { Id: 23 }] }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 9)).resolves.toBe(2);

        expect(requests[0].query.mock.calls[0][0]).toContain('sp_getapplock');
        expect(requests[2].query.mock.calls[0][0]).toContain('NOT EXISTS');
        expect(requests[3].query.mock.calls[0][0]).toContain("WHEN 'high' THEN 0");
        expect(requests[4].inputs).toEqual({ ticketId: 21, staffId: 4 });
        expect(requests[5].inputs).toEqual({ ticketId: 22, staffId: 5 });
        expect(transaction.commit).toHaveBeenCalledTimes(1);
        expect(transaction.rollback).not.toHaveBeenCalled();
    });

    test('rolls back when the dispatch lock cannot be acquired', async () => {
        const { transaction } = createTransaction([
            { recordset: [{ LockResult: -1 }] }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 9))
            .rejects.toThrow('Otomatik ticket atama kilidi alınamadı.');

        expect(transaction.rollback).toHaveBeenCalledTimes(1);
        expect(transaction.commit).not.toHaveBeenCalled();
    });

    test('reopens legacy in-progress tickets without an assignee', async () => {
        const { transaction, requests } = createTransaction([
            { recordset: [{ LockResult: 0 }] },
            { recordset: [{ Id: 18 }] },
            { recordset: [] },
            { recordset: [] },
            { recordset: [] }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 9)).resolves.toBe(0);

        expect(requests[2].inputs).toEqual({ ticketId: 18, changedBy: 9 });
        expect(requests[2].query.mock.calls[0][0]).toContain("'in_progress', 'open'");
        expect(transaction.commit).toHaveBeenCalledTimes(1);
    });

    test('does not return a manually released ticket to the releasing technician', async () => {
        const { transaction, requests } = createTransaction([
            { recordset: [{ LockResult: 0 }] },
            { recordset: [] },
            { recordset: [{ Id: 4 }] },
            {
                recordset: [
                    { Id: 21, LastReleasedBy: 4 },
                    { Id: 22, LastReleasedBy: null }
                ]
            }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 9)).resolves.toBe(1);

        expect(requests[4].inputs).toEqual({ ticketId: 22, staffId: 4 });
    });

    test('does not reassign a released ticket to its staff member in the same dispatch', async () => {
        const { transaction, requests } = createTransaction([
            { recordset: [{ LockResult: 0 }] },
            { recordset: [] },
            { recordset: [{ Id: '4' }] },
            { recordset: [{ Id: 21, LastReleasedBy: 4 }] }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 4, transaction, 4)).resolves.toBe(0);

        expect(requests).toHaveLength(4);
        expect(transaction.commit).not.toHaveBeenCalled();
    });

    test('keeps a released ticket queued when its staff member is the only idle technician', async () => {
        const { transaction, requests } = createTransaction([
            { recordset: [{ LockResult: 0 }] },
            { recordset: [] },
            { recordset: [{ Id: '4' }] },
            { recordset: [{ Id: 21, LastReleasedBy: '4' }] }
        ]);
        jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);

        await expect(dispatchUnassignedTickets({}, 4)).resolves.toBe(0);

        expect(requests).toHaveLength(4);
        expect(transaction.commit).toHaveBeenCalledTimes(1);
    });
});
