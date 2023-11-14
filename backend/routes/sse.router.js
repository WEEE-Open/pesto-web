import express from "express";
import { sse } from "../sse";

const sseRouter = express.Router();

sseRouter.get("/stream", sse.init);

export default sseRouter;
