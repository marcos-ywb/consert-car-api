import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token não fornecido." });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token mal fornecido ou vazio!" });
    }

    try {
        const payload = verifyToken(token);
        (req as any).user = payload;
        next();
    } catch {
        return res.status(401).json({ message: "Token inválido ou expirado." });
    }
}