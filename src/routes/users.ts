import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

const SELECT_QUERY = `
    SELECT
        usuario_id,
        nome,
        telefone,
        email,
        cargo,
        status,
        criado_em
    FROM usuarios
`;

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE usuario_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado!" });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar usuário!" });
    }
});

export default router;