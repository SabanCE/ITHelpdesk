
const express = require('express');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const userRoutes = require('./routes/users');
const { authenticateToken, requireRole } = require('./middleware/auth');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tickets', authenticateToken, ticketRoutes);
app.use('/api/users', authenticateToken, requireRole('it_staff', 'it_admin'), userRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.json({
        message: 'HelpDesk API çalışıyor!'
    });
});

module.exports = app;
