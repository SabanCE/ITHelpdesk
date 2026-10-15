const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
        throw new Error('JWT_SECRET ortam değişkeni en az 32 bayt olmalıdır.');
    }
    return secret;
}

function createAccessToken(user) {
    return jwt.sign(
        { role: user.Role },
        getJwtSecret(),
        {
            algorithm: 'HS256',
            subject: String(user.Id),
            expiresIn: '8h'
        }
    );
}

function authenticateToken(req, res, next) {
    const authorization = req.get('authorization') ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            message: 'Devam etmek için giriş yapmalısınız.'
        });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256']
        });
        const id = Number(payload.sub);

        if (!Number.isInteger(id) || id <= 0 ||
            !['employee', 'it_staff', 'it_admin'].includes(payload.role)) {
            return res.status(401).json({
                message: 'Oturum geçersiz. Lütfen yeniden giriş yapın.'
            });
        }

        req.user = { id, role: payload.role };
        return next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.message.startsWith('JWT_SECRET')) {
            if (error.message.startsWith('JWT_SECRET')) {
                console.error(error.message);
                return res.status(500).json({
                    message: 'Sunucu kimlik doğrulama yapılandırması eksik.'
                });
            }

            return res.status(401).json({
                message: 'Oturum geçersiz veya süresi dolmuş. Lütfen yeniden giriş yapın.'
            });
        }

        return next(error);
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Bu işlem için yetkiniz yok.'
            });
        }
        return next();
    };
}

module.exports = {
    authenticateToken,
    createAccessToken,
    requireRole
};
