import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q || String(q).trim().length < 2) {
            return res.json({ clientes: [], veiculos: [], agendamentos: [] });
        }

        const term = `%${String(q).trim()}%`;

        const [clientes]: any = await db.query(
            `
            SELECT 
                cliente_id, 
                nome, 
                telefone
            FROM clientes
            WHERE nome LIKE ? OR telefone LIKE ?
            LIMIT 5
            `,
            [term, term]
        );

        const [veiculos]: any = await db.query(
            `
            SELECT 
                v.veiculo_id, 
                v.marca, 
                v.modelo, 
                v.placa, 
                c.nome AS proprietario
            FROM veiculos v
            LEFT JOIN clientes c ON c.cliente_id = v.cliente_id
            WHERE v.placa LIKE ? OR v.modelo LIKE ? OR v.marca LIKE ?
            LIMIT 5
            `,
            [term, term, term]
        );

        const [agendamentos]: any = await db.query(
            `
            SELECT
                a.agendamento_id,
                a.status,
                a.data_agendada,
                c.nome AS cliente_nome,
                v.marca AS veiculo_marca,
                v.modelo AS veiculo_modelo,
                v.placa AS veiculo_placa
            FROM agendamentos a
            LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
            LEFT JOIN veiculos v ON v.veiculo_id = a.veiculo_id
            WHERE c.nome LIKE ? OR v.placa LIKE ? OR v.modelo LIKE ?
            LIMIT 5
            `,
            [term, term, term]
        );

        res.json({ clientes, veiculos, agendamentos })
    } catch (error) {
        console.error("Erro na busca geral! ", error);
        res.status(500).json({ message: "Erro ao realizar busca geral!" });
    }
});

export default router;