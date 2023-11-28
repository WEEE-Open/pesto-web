import express from "express";
import { init } from "../sse.js";

const sseRouter = express.Router();

sseRouter.get("/stream", init);

export default sseRouter;
