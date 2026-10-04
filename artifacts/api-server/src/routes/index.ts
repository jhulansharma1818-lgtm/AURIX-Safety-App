import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contactsRouter from "./contacts";
import demoRouter from "./demo";
import incidentsRouter from "./incidents";
import journeysRouter from "./journeys";
import respondersRouter from "./responders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(demoRouter);
router.use(journeysRouter);
router.use(contactsRouter);
router.use(incidentsRouter);
router.use(respondersRouter);

export default router;
