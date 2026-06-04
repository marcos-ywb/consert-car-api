import "dotenv/config";

import express from "express";
import cors from "cors";

import authRouter from "./routes/auth";
import { authMiddleware } from "./middlewares/auth";

import customersRouter from "./routes/customers";
import vehiclesRouter from "./routes/vehicles";
import appointmentsRouter from "./routes/appointments";
import ordersRouter from "./routes/orders";
import usersRouter from "./routes/users";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);

app.use(authMiddleware);
app.use("/customers", customersRouter);
app.use("/vehicles", vehiclesRouter);
app.use("/appointments", appointmentsRouter);
app.use("/orders", ordersRouter);
app.use("/users", usersRouter);

app.get("/", (req, res) => {
    res.json({ message: "API rodando!" });
});

app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
});