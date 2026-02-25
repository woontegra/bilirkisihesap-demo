import express from 'express';
import { saveCalculation, getCalculations, deleteCalculation } from '../../controllers/fazlaMesai/bilirkisi1Controller.js';
const router = express.Router();
router.post('/save', saveCalculation);
router.get('/list', getCalculations);
router.delete('/:id', deleteCalculation);
export default router;
