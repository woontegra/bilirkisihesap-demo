import express from "express";
import {
  saveCalculation,
  getCalculations,
  getCalculationById,
  deleteCalculation
} from "../controllers/fazlaMesaiController.js";

const router = express.Router();

router.post("/save", saveCalculation);
router.get("/list", getCalculations);
router.get("/:id", getCalculationById);
router.delete("/:id", deleteCalculation);

export default router;
