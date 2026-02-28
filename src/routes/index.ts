import { Router } from 'express';
import { identify } from '../controllers/identify.controller';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.post('/identify', identify);

export default router;
