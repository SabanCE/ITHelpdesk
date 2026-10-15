const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

function isValidEmail(email) {
    return typeof email === 'string' &&
        email.length <= 150 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    if (typeof password !== 'string') {
        return 'Şifre zorunludur.';
    }

    if (password.length < 8) {
        return 'Şifre en az 8 karakter olmalıdır.';
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
        return 'Şifre bcrypt sınırı olan 72 baytı aşamaz.';
    }

    return null;
}

function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}

module.exports = {
    hashPassword,
    isValidEmail,
    validatePassword,
    verifyPassword
};
