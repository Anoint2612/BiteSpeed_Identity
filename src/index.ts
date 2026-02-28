import express from 'express';
import { PORT } from './utils/config';
import routes from './routes';

const app = express();

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
