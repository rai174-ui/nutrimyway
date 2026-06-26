import { Router, type IRouter } from "express";
import healthRouter from "./health";
import membersRouter from "./members";
import bomRouter from "./bom";
import packsRouter from "./packs";
import authRouter from "./auth";
import centersRouter from "./centers";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(centersRouter);
router.use(healthRouter);
router.use(membersRouter);
router.use(bomRouter);
router.use(packsRouter);
router.use(adminRouter);

export default router;
