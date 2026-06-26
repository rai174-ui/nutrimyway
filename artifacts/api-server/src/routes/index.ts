import { Router, type IRouter } from "express";
import healthRouter from "./health";
import membersRouter from "./members";
import bomRouter from "./bom";
import packsRouter from "./packs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(membersRouter);
router.use(bomRouter);
router.use(packsRouter);

export default router;
