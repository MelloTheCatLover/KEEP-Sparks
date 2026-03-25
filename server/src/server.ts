import express, { Request, Response } from "express";

const app = express();

app.get("/", (req: Request, res: Response): any => {
  res.send("Server is running. Sparks all over the place!!!");
});

export default app;
