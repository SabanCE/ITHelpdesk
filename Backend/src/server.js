
const app = require('./app');
const { connectDB } = require('./db');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        if (!process.env.JWT_SECRET ||
            Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
            throw new Error('JWT_SECRET .env dosyasında en az 32 bayt olarak tanımlanmalıdır.');
        }

        const pool = await connectDB();

        app.locals.dbPool = pool;

        app.listen(PORT, () => {
            console.log(
                `Sunucu http://localhost:${PORT} adresinde çalışıyor.`
            );
        });
    } catch (error) {
        console.error('Sunucu başlatılamadı.', error);
        process.exitCode = 1;
    }
}

// Bu dosya doğrudan çalıştırıldığında sunucuyu başlat.
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
