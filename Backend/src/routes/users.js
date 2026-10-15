const express = require('express');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('it_staff', 'it_admin'), async (req, res) => {
    try {
        const { role } = req.query;
        const allowedRoles = ['employee', 'it_staff'];

        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                message: 'Geçersiz kullanıcı rolü.'
            });
        }

        const request = req.app.locals.dbPool.request();
        let query = `
            SELECT Id, Name, Role
            FROM dbo.Users
        `;

        if (role) {
            query += ' WHERE Role = @role';
            request.input('role', role);
        } else {
            query += " WHERE Role IN ('employee', 'it_staff')";
        }

        query += ' ORDER BY Name;';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Kullanıcı listesi alınamadı:', error.message);

        res.status(500).json({
            message: 'Kullanıcı listesi alınırken bir hata oluştu.'
        });
    }
});

module.exports = router;
