import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
const app = express();

app.use(express.json({ limit: '20kb' }));
app.use(
    cors({
        origin: process.env.ORIGIN || 'http://127.0.0.1:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
);
app.use(cookieParser());
console.log(process.env.ORIGIN);
import linkRouter from './routes/link.route.js';
import userRouter from './routes/user.route.js';
import { redirect } from './controllers/link.controller.js';

app.use('/api/v1/link', linkRouter);
app.use('/api/v1/user', userRouter);
app.get('/test', (req, res) => res.send('hello world'));
app.get('/:key', redirect);
export default app;
