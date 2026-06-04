import { Router, Request, Response } from "express";
import db from "../lib/db";
import { json } from "node:stream/consumers";

const router = Router();

const SELECT_QUERY = `
    SELECT
        os.os_id,
        os.descricao_servico,
        os.diagnostico,
        os.valor_total,
        os.status,
        os.data_entrada,
        os.data_saida,

        a.agendamento_id,
        a.data_agendada,

        v.veiculo_id,
        v.marca AS veiculo_marca,
        v.modelo AS veiculo_modelo,
        v.placa AS veiculo_placa,

        c.cliente_id,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,

        u.usuario_id,
        u.nome AS usuario_nome
    FROM ordens_servico os
    LEFT JOIN agendamentos a ON a.agendamento_id = os.agendamento_id
    LEFT JOIN veiculos v ON v.veiculo_id = os.veiculo_id
    LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
    LEFT JOIN usuarios u ON u.usuario_id = os.usuario_id
`;

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q, status } = req.query;

        let query = SELECT_QUERY;
        const params: string[] = [];
        const conditions: string[] = [];

        if (q) {
            conditions.push(`(
                c.nome LIKE ? OR
                v.placa LIKE ? OR
                v.modelo LIKE ? OR
                CAST(os.os_id AS CHAR) LIKE ?
            )`);
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }

        if (status && status !== "TODOS") {
            conditions.push("os.status = ?");
            params.push(status as string);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY os.data_entrada DESC";

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao buscar ordens de serviço! ", error);
        res.status(500).json({ message: "Erro ao buscar ordens de serviço!" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE os.os_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Ordem de serviço não encontrada!" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar ordem de serviço! ", error);
        res.status(500).json({ message: "Erro ao buscar ordem de serviço!" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    try {
        const {
            agendamento_id,
            veiculo_id,
            descricao_servico,
            diagnostico,
            valor_total,
        } = req.body;

        const usuario_id = (req as any).user.id;

        if (!agendamento_id || !veiculo_id || !descricao_servico || !diagnostico) {
            return res.status(400).json({ message: "Campos obrigatórios faltando!" });
        }

        const [result]: any = await db.query(
            `INSERT INTO ordens_servico
                (agendamento_id, veiculo_id, usuario_id, descricao_servico, diagnostico, valor_total)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                agendamento_id,
                veiculo_id,
                usuario_id,
                descricao_servico,
                diagnostico,
                valor_total ?? 0,
            ]
        );

        await db.query(
            `UPDATE agendamentos SET status = 'CONCLUIDO' WHERE agendamento_id = ?`,
            [agendamento_id]
        );

        res.status(201).json({ os_id: result.insertId, message: "Ordem de serviço criada com sucesso!" });
    } catch (error) {
        console.error("Erro ao criar ordem de serviço! ", error);
        res.status(500).json({ message: "Erro ao criar ordem de serviço!" });
    }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
        const { status } = req.body;

        const validStatus = [
            "ABERTA",
            "EM_ANDAMENTO",
            "AGUARDANDO_PECA",
            "FINALIZADA",
            "CANCELADA"
        ];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ message: "Status inválido!" });
        }

        const updateFields: string[] = ["status = ?"];
        const params: any[] = [status];

        if (status === "FINALIZADA") {
            updateFields.push("data_saida = NOW()");
        }

        params.push(req.params.id);

        await db.query(
            `UPDATE ordens_servico SET ${updateFields.join(", ")} WHERE os_id = ?`,
            params
        );

        res.json({ message: "Status atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar status! ", error);
        res.status(500).json({ message: "Erro ao atualizar status!" });
    }
});

router.patch("/:id/valor", async (req: Request, res: Response) => {
    try {
        const { valor_total } = req.body;

        if (valor_total === undefined || valor_total < 0) {
            return res.status(400).json({ message: "Valor inválido!" });
        }

        await db.query(
            `UPDATE ordens_servico SET valor_total = ? WHERE os_id = ?`,
            [valor_total, req.params.id]
        );

        res.json({ message: "Valor atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar valor! ", error);
        res.status(500).json({ message: "Erro ao atualizar valor!" });
    }
});

export default router;