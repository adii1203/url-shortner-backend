import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
const app = express();

app.use(express.json({ limit: '20kb' }));
app.use(
    cors({
        origin: 'http://127.0.0.1:5173',
        credentials: true,
    })
);
app.use(cookieParser());

import linkRouter from './routes/link.route.js';
import userRouter from './routes/user.route.js';

app.use('/api/v1/link', linkRouter);
app.use('/api/v1/user', userRouter);
app.get('/test', (req, res) => res.send('hello world'));
export default app;
