import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

const SELECT_QUERY = `
    SELECT
        v.veiculo_id,
        v.placa,
        v.marca,
        v.modelo,
        v.ano,
        v.cor,
        c.cliente_id,
        c.nome AS proprietario
    FROM veiculos v
    LEFT JOIN clientes c ON c.cliente_id = v.cliente_id
`;

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        let query = SELECT_QUERY;
        const params: string[] = [];

        if (q) {
            query += " WHERE v.placa LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ? OR c.nome LIKE ?";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }

        query += " ORDER BY v.marca ASC";

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar veículos" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE v.veiculo_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Veículo não encontrado" });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar veículo" });
    }
});

export default router;