const express = require('express');
const {
    hashPassword,
    isValidEmail,
    validatePassword,
    verifyPassword
} = require('../passwordhash');
const { createAccessToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body ?? {};
    const normalizedEmail = typeof email === 'string'
        ? email.trim().toLowerCase()
        : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const passwordError = validatePassword(password);

    if (!normalizedName || normalizedName.length > 100) {
        return res.status(400).json({
            message: 'Ad soyad zorunludur ve 100 karakteri aşamaz.'
        });
    }

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            message: 'Geçerli bir e-posta adresi girilmelidir.'
        });
    }

    if (passwordError) {
        return res.status(400).json({ message: passwordError });
    }

    try {
        const pool = req.app.locals.dbPool;
        const existingUser = await pool.request()
            .input('email', normalizedEmail)
            .query(`
                SELECT Id
                FROM dbo.Users
                WHERE Email = @email;
            `);

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({
                message: 'Bu e-posta adresi zaten kayıtlı.'
            });
        }

        const passwordHash = await hashPassword(password);
        const result = await pool.request()
            .input('name', normalizedName)
            .input('email', normalizedEmail)
            .input('passwordHash', passwordHash)
            .query(`
                INSERT INTO dbo.Users (Name, Email, Role, PasswordHash)
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.Role
                VALUES (@name, @email, 'employee', @passwordHash);
            `);

        return res.status(201).json({ user: result.recordset[0] });
    } catch (error) {
        if (error.number === 2601 || error.number === 2627) {
            return res.status(409).json({
                message: 'Bu e-posta adresi zaten kayıtlı.'
            });
        }

        console.error('Kullanıcı kaydı oluşturulamadı:', error.message);
        return res.status(500).json({
            message: 'Kayıt oluşturulurken bir hata oluştu.'
        });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    const normalizedEmail = typeof email === 'string'
        ? email.trim().toLowerCase()
        : '';

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            message: 'Geçerli bir e-posta adresi girilmelidir.'
        });
    }

    if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({
            message: 'Geçerli bir şifre girilmelidir.'
        });
    }

    try {
        const result = await req.app.locals.dbPool.request()
            .input('email', normalizedEmail)
            .query(`
                SELECT Id, Name, Email, Role, PasswordHash
                FROM dbo.Users
                WHERE Email = @email;
            `);

        const user = result.recordset[0];
        const passwordMatches = user?.PasswordHash
            ? await verifyPassword(password, user.PasswordHash)
            : false;

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'E-posta adresi veya şifre hatalı.'
            });
        }

        const publicUser = {
            Id: user.Id,
            Name: user.Name,
            Email: user.Email,
            Role: user.Role
        };
        return res.json({
            user: publicUser,
            token: createAccessToken(user)
        });
    } catch (error) {
        console.error('Giriş doğrulanamadı:', error.message);
        return res.status(500).json({
            message: 'Giriş sırasında bir hata oluştu.'
        });
    }
});

module.exports = router;
