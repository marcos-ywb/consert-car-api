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
        deve_trocar_senha,
        criado_em
    FROM usuarios
`;

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        let query = SELECT_QUERY;
        const params: string[] = [];

        if (q) {
            query += " WHERE nome LIKE ? OR email LIKE ? OR telefone LIKE ?";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        query += " ORDER BY nome ASC";

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao buscar equipe:", error);
        res.status(500).json({ message: "Erro ao buscar equipe!" });
    }
});

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