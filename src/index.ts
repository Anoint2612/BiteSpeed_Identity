import express from 'express';
import { PORT } from './utils/config';
import routes from './routes';

const app = express();

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.send('The api is working try the /api/identify with POST method in Postman/curl to check the working or refer to the github repo for more: https://github.com/Anoint2612/BiteSpeed_Identity');
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

export default app;
