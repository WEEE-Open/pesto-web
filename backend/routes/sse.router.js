import express from "express";
import { init } from "../sse.js";

const sseRouter = express.Router();

//? idk what it's supposed to do but I have to respond to the request in some way
sseRouter.get("/stream", (req, res) => { init(); res.send("init sse done"); }); // TODO: do something better here

export default sseRouter;
