
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-bytes-long';

function asUser(testRequest, id = 3, role = 'it_staff') {
    return testRequest.set(
        'Authorization',
        `Bearer ${jwt.sign({ role }, process.env.JWT_SECRET, {
            subject: String(id),
            expiresIn: '1h'
        })}`
    );
}

describe('HelpDesk API', () => {
    describe('/api/auth', () => {
        afterEach(() => {
            delete app.locals.dbPool;
        });

        test('Geçersiz e-posta biçimindeki giriş isteğini reddetmeli', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'gecersiz', password: 'Test123!' });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/e-posta/i);
        });

        test('Giriş için e-posta adresini normalleştirip parolayı doğrulamalı', async () => {
            const passwordHash = await bcrypt.hash('Test123!Guclu', 4);
            const query = jest.fn().mockResolvedValue({
                recordset: [{
                    Id: 3,
                    Name: 'Test Kullanıcısı',
                    Email: 'test@example.com',
                    Role: 'employee',
                    PasswordHash: passwordHash
                }]
            });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: ' TEST@EXAMPLE.COM ', password: 'Test123!Guclu' });

            expect(response.statusCode).toBe(200);
            expect(response.body.user).toEqual({
                Id: 3,
                Name: 'Test Kullanıcısı',
                Email: 'test@example.com',
                Role: 'employee'
            });
            expect(response.body.user.PasswordHash).toBeUndefined();
            expect(jwt.verify(response.body.token, process.env.JWT_SECRET).sub).toBe('3');
            expect(input).toHaveBeenCalledWith('email', 'test@example.com');
        });

        test('Yanlış şifre için genel kimlik bilgisi hatası döndürmeli', async () => {
            const passwordHash = await bcrypt.hash('Dogru123!', 4);
            const query = jest.fn().mockResolvedValue({
                recordset: [{
                    Id: 3,
                    Email: 'test@example.com',
                    PasswordHash: passwordHash
                }]
            });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'Yanlis123!' });

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                message: 'E-posta adresi veya şifre hatalı.'
            });
        });

        test('Kısa şifre ile kayıt isteğini reddetmeli', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test Kullanıcısı',
                    email: 'test@example.com',
                    password: 'kisa'
                });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toMatch(/8 karakter/i);
        });

        test('Kayıtta şifreyi hashleyip kullanıcıyı çalışan rolüyle eklemeli', async () => {
            let storedHash;
            const query = jest.fn()
                .mockResolvedValueOnce({ recordset: [] })
                .mockResolvedValueOnce({
                    recordset: [{
                        Id: 4,
                        Name: 'Yeni Çalışan',
                        Email: 'new@example.com',
                        Role: 'employee'
                    }]
                });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: ' Yeni Çalışan ',
                    email: ' NEW@EXAMPLE.COM ',
                    password: 'Guclu123!'
                });

            expect(response.statusCode).toBe(201);
            expect(response.body.user).toEqual({
                Id: 4,
                Name: 'Yeni Çalışan',
                Email: 'new@example.com',
                Role: 'employee'
            });
            storedHash = input.mock.calls.find(([key]) => key === 'passwordHash')[1];
            expect(storedHash).not.toBe('Guclu123!');
            await expect(bcrypt.compare('Guclu123!', storedHash)).resolves.toBe(true);
            expect(input).toHaveBeenCalledWith('email', 'new@example.com');
        });
    });

    test('GET / başarılı yanıt ve mesaj döndürmeli', async () => {
        const response = await request(app).get('/');

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            message: 'HelpDesk API çalışıyor!'
        });
    });

    describe('/api/users', () => {
        afterEach(() => {
            delete app.locals.dbPool;
        });

        test('GET /api/users kullanıcı listesini döndürmeli', async () => {
            const users = [
                { Id: 1, Name: 'Demo User', Role: 'employee' }
            ];
            const query = jest.fn().mockResolvedValue({ recordset: users });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(request(app).get('/api/users'));

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(users);
            expect(query).toHaveBeenCalledTimes(1);
        });

        test('Kullanıcı rolüne göre filtreleme yapmalı', async () => {
            const staff = [
                { Id: 2, Name: 'IT Staff', Role: 'it_staff' }
            ];
            const query = jest.fn().mockResolvedValue({ recordset: staff });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/users?role=it_staff')
            );

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(staff);
            expect(input).toHaveBeenCalledWith('role', 'it_staff');
        });

        test('IT yöneticisi kullanıcı dizinine erişebilmeli', async () => {
            const query = jest.fn().mockResolvedValue({ recordset: [] });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/users?role=employee'),
                9,
                'it_admin'
            );

            expect(response.statusCode).toBe(200);
            expect(input).toHaveBeenCalledWith('role', 'employee');
        });

        test('Geçersiz kullanıcı rolü filtresini reddetmeli', async () => {
            const response = await asUser(
                request(app).get('/api/users?role=admin')
            );

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                message: 'Geçersiz kullanıcı rolü.'
            });
        });

        test('Çalışan kullanıcı dizinini görememeli', async () => {
            const response = await asUser(
                request(app).get('/api/users'),
                4,
                'employee'
            );

            expect(response.statusCode).toBe(403);
        });
    });

    describe('/api/tickets', () => {
        afterEach(() => {
            delete app.locals.dbPool;
            jest.restoreAllMocks();
        });

        test('Kimlik doğrulaması olmadan ticket verisini vermemeli', async () => {
            const response = await request(app).get('/api/tickets');

            expect(response.statusCode).toBe(401);
        });

        test('Çalışan yalnızca kendi taleplerini listelemeli', async () => {
            const query = jest.fn().mockResolvedValue({ recordset: [] });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/tickets'),
                4,
                'employee'
            );

            expect(response.statusCode).toBe(200);
            expect(input).toHaveBeenCalledWith('currentUserId', 4);
            expect(query.mock.calls[0][0]).toContain('t.CreatedBy = @currentUserId');
        });

        test('Çalışan yalnızca kendi talep detayını açabilmeli', async () => {
            const query = jest.fn().mockResolvedValue({
                recordset: [{ Id: 10, Title: 'Kendi talebim' }]
            });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/tickets/10'),
                4,
                'employee'
            );

            expect(response.statusCode).toBe(200);
            expect(input).toHaveBeenCalledWith('currentUserId', 4);
            expect(query.mock.calls[0][0]).toContain('t.CreatedBy = @currentUserId');
        });

        test('Çalışan yalnızca kendi taleplerinin geçmişini görebilmeli', async () => {
            const query = jest.fn().mockResolvedValue({ recordset: [] });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/tickets/10/history'),
                4,
                'employee'
            );

            expect(response.statusCode).toBe(200);
            expect(input).toHaveBeenCalledWith('currentUserId', 4);
            expect(query.mock.calls[0][0]).toContain('t.CreatedBy = @currentUserId');
        });

        test('Çalışan ticket durumunu güncelleyememeli', async () => {
            const response = await asUser(
                request(app).patch('/api/tickets/1').send({ status: 'resolved' }),
                4,
                'employee'
            );

            expect(response.statusCode).toBe(403);
        });

        test('GET /api/tickets ticket listesini döndürmeli', async () => {
            const tickets = [
                { Id: 1, Title: 'Bilgisayar sorunu', Status: 'open' }
            ];
            const query = jest.fn().mockResolvedValue({ recordset: tickets });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(request(app).get('/api/tickets'));

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(tickets);
            expect(query).toHaveBeenCalledTimes(1);
            expect(query.mock.calls[0][0]).toContain('resolution.ResolvedAt');
            expect(query.mock.calls[0][0]).toContain('MIN(h.CreatedAt) AS ResolvedAt');
        });

        test('Geçersiz ticket ID için 400 döndürmeli', async () => {
            const response = await asUser(
                request(app).get('/api/tickets/abc')
            );

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                message: 'Geçerli bir ticket ID girilmelidir.'
            });
        });

        test('GET /api/tickets/:id ticket detayını döndürmeli', async () => {
            const ticket = { Id: 7, Title: 'E-posta sorunu' };
            const query = jest.fn().mockResolvedValue({
                recordset: [ticket]
            });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(request(app).get('/api/tickets/7'));

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(ticket);
            expect(input).toHaveBeenCalledWith('id', 7);
        });

        test('Eksik zorunlu alanlarla ticket oluşturmayı reddetmeli', async () => {
            const response = await asUser(request(app)
                .post('/api/tickets')
                .send({ title: 'Başlık' }));

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                message: 'Başlık, açıklama ve talep sahibi çalışan zorunludur.'
            });
        });

        test('Geçerli bilgilerle ticket oluşturmalı', async () => {
            const ticket = {
                Id: 8,
                Title: '  E-posta sorunu  ',
                Description: '  E-posta açılamıyor  ',
                Priority: 'high',
                CreatedBy: 3
            };
            const query = jest.fn()
                .mockResolvedValueOnce({ recordset: [{ Id: 3 }] })
                .mockResolvedValueOnce({ recordset: [ticket] });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(request(app)
                .post('/api/tickets')
                .send({
                    title: '  E-posta sorunu  ',
                    description: '  E-posta açılamıyor  ',
                    priority: 'high',
                    createdBy: 999
                }), 3, 'employee');

            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual(ticket);
            expect(query).toHaveBeenCalledTimes(2);
            expect(input).toHaveBeenCalledWith('title', 'E-posta sorunu');
            expect(input).toHaveBeenCalledWith('createdBy', 3);
            expect(input).toHaveBeenCalledWith(
                'description',
                'E-posta açılamıyor'
            );
        });

        test('IT personeli ticketi seçilen çalışana ait olarak oluşturmalı', async () => {
            const ticket = { Id: 8, CreatedBy: 12, AssignedTo: null };
            const query = jest.fn()
                .mockResolvedValueOnce({ recordset: [{ Id: 12 }] })
                .mockResolvedValueOnce({ recordset: [ticket] });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(request(app)
                .post('/api/tickets')
                .send({
                    title: 'E-posta sorunu',
                    description: 'E-posta açılamıyor',
                    createdBy: 12
                }));

            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual(ticket);
            expect(input).toHaveBeenCalledWith('createdBy', 12);
        });

        test('IT yöneticisi ticketi geçerli BT personeline atayabilmeli', async () => {
            const ticket = { Id: 8, AssignedTo: 3 };
            const query = jest.fn()
                .mockResolvedValueOnce({ recordset: [{ Id: 8, Status: 'open' }] })
                .mockResolvedValueOnce({ recordset: [{ Id: 3 }] })
                .mockResolvedValueOnce({ recordset: [ticket] });
            const input = jest.fn().mockReturnThis();
            const transaction = {
                begin: jest.fn().mockResolvedValue(),
                request: jest.fn(() => ({ input, query })),
                commit: jest.fn().mockResolvedValue(),
                rollback: jest.fn().mockResolvedValue()
            };
            const sql = require('mssql/msnodesqlv8');
            jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);
            app.locals.dbPool = {};

            const response = await asUser(
                request(app).patch('/api/tickets/8').send({ assignedTo: 3 }),
                9,
                'it_admin'
            );

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ ...ticket, ResolvedAt: null });
            expect(transaction.commit).toHaveBeenCalledTimes(1);
            expect(input).toHaveBeenCalledWith('assignedTo', 3);
            expect(query.mock.calls[1][0]).toContain("Role = 'it_staff'");
        });

        test('IT personeli ticket ataması yapamamalı', async () => {
            const response = await asUser(
                request(app).patch('/api/tickets/8').send({ assignedTo: 3 })
            );

            expect(response.statusCode).toBe(403);
        });

        test('Çözülen ticket için ilk çözüm zamanını yanıtla dönmeli', async () => {
            const resolvedAt = new Date('2026-10-15T10:30:00.000Z');
            const query = jest.fn()
                .mockResolvedValueOnce({
                    recordset: [{ Id: 8, Status: 'open', ResolvedAt: null }]
                })
                .mockResolvedValueOnce({ recordset: [{ Id: 3 }] })
                .mockResolvedValueOnce({
                    recordset: [{ Id: 8, Status: 'resolved' }]
                })
                .mockResolvedValueOnce({ recordset: [] })
                .mockResolvedValueOnce({ recordset: [{ ResolvedAt: resolvedAt }] });
            const input = jest.fn().mockReturnThis();
            const transaction = {
                begin: jest.fn().mockResolvedValue(),
                request: jest.fn(() => ({ input, query })),
                commit: jest.fn().mockResolvedValue(),
                rollback: jest.fn().mockResolvedValue()
            };
            const sql = require('mssql/msnodesqlv8');
            jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);
            app.locals.dbPool = {};

            const response = await asUser(
                request(app).patch('/api/tickets/8').send({ status: 'resolved' })
            );

            expect(response.statusCode).toBe(200);
            expect(response.body.ResolvedAt).toBe(resolvedAt.toISOString());
            expect(query.mock.calls[4][0]).toContain(
                "NewStatus = 'resolved'"
            );
            expect(transaction.commit).toHaveBeenCalledTimes(1);
        });

        test.each(['it_staff', 'it_admin'])(
            '%s rolü ticket durumunu İşlemde yapabilmeli',
            async (role) => {
                const query = jest.fn()
                    .mockResolvedValueOnce({
                        recordset: [{ Id: 8, Status: 'open', ResolvedAt: null }]
                    })
                    .mockResolvedValueOnce({ recordset: [{ Id: 3 }] })
                    .mockResolvedValueOnce({
                        recordset: [{ Id: 8, Status: 'in_progress' }]
                    })
                    .mockResolvedValueOnce({ recordset: [] });
                const input = jest.fn().mockReturnThis();
                const transaction = {
                    begin: jest.fn().mockResolvedValue(),
                    request: jest.fn(() => ({ input, query })),
                    commit: jest.fn().mockResolvedValue(),
                    rollback: jest.fn().mockResolvedValue()
                };
                const sql = require('mssql/msnodesqlv8');
                jest.spyOn(sql, 'Transaction').mockImplementation(() => transaction);
                app.locals.dbPool = {};

                const response = await asUser(
                    request(app).patch('/api/tickets/8').send({
                        status: 'in_progress'
                    }),
                    3,
                    role
                );

                expect(response.statusCode).toBe(200);
                expect(response.body.Status).toBe('in_progress');
                expect(input).toHaveBeenCalledWith('status', 'in_progress');
                expect(query.mock.calls[3][0]).toContain('TicketHistory');
                expect(transaction.commit).toHaveBeenCalledTimes(1);
            }
        );

        test('GET /api/tickets/:id/history geçmiş kayıtlarını döndürmeli', async () => {
            const history = [
                { Id: 1, TicketId: 7, OldStatus: 'open', NewStatus: 'resolved' }
            ];
            const query = jest.fn().mockResolvedValue({ recordset: history });
            const input = jest.fn().mockReturnThis();
            app.locals.dbPool = {
                request: jest.fn(() => ({ input, query }))
            };

            const response = await asUser(
                request(app).get('/api/tickets/7/history')
            );

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(history);
            expect(input).toHaveBeenCalledWith('ticketId', 7);
        });
    });
});
