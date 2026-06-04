import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

const SELECT_QUERY = `
    SELECT
        a.agendamento_id,
        a.usuario_id,
        a.data_agendada,
        a.descricao_servico,
        a.status,
        a.criado_em,


        c.cliente_id,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,

        e.endereco_id,
        e.cliente_id AS endereco_cliente_id,
        e.cep AS endereco_cep,
        e.logradouro AS endereco_logradouro,
        e.numero AS endereco_numero,
        e.bairro AS endereco_bairro,
        e.cidade AS endereco_cidade,
        e.estado AS endereco_estado,
        e.complemento AS endereco_complemento,


        v.veiculo_id,
        v.marca AS veiculo_marca,
        v.modelo AS veiculo_modelo,
        v.placa AS veiculo_placa,


        u.nome AS usuario_nome
    FROM agendamentos a
    LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
    LEFT JOIN veiculos v ON v.veiculo_id = a.veiculo_id
    LEFT JOIN usuarios u ON u.usuario_id = a.usuario_id
    LEFT JOIN enderecos e ON e.cliente_id = c.cliente_id
`;

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q, status } = req.query;

        let query = SELECT_QUERY;
        const params: string[] = [];
        const conditions: string[] = [];

        if (q) {
            conditions.push("(c.nome LIKE ? OR c.telefone LIKE ? OR v.placa LIKE ? OR v.modelo LIKE ?)");
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }

        if (status && status !== "Todos") {
            conditions.push("a.status = ?");
            params.push(status as string);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY a.data_agendada DESC";

        const [rows]: any = await db.query(query, params);

        const grouped = new Map<number, any>();

        for (const row of rows) {
            if (!grouped.has(row.agendamento_id)) {
                grouped.set(row.agendamento_id, { ...row, enderecos: [] });
            }

            if (row.endereco_id) {
                grouped.get(row.agendamento_id).enderecos.push({
                    endereco_id: row.endereco_id,
                    cep: row.endereco_cep,
                    logradouro: row.endereco_logradouro,
                    numero: row.endereco_numero,
                    bairro: row.endereco_bairro,
                    cidade: row.endereco_cidade,
                    estado: row.endereco_estado,
                    complemento: row.endereco_complemento,
                });
            }
        }

        res.json(Array.from(grouped.values()));
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE a.agendamento_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Agendamento não encontrado" });
        }

        const base = { ...rows[0], enderecos: [] };

        for (const row of rows) {
            if (row.endereco_id) {
                base.enderecos.push({
                    endereco_id: row.endereco_id,
                    cep: row.endereco_cep,
                    logradouro: row.endereco_logradouro,
                    numero: row.endereco_numero,
                    bairro: row.endereco_bairro,
                    cidade: row.endereco_cidade,
                    estado: row.endereco_estado,
                    complemento: row.endereco_complemento,
                });
            }
        }

        res.json(base);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar agendamento" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    try {
        const { cliente_id, veiculo_id, data_agendada, descricao_servico } = req.body;
        const usuario_id = (req as any).user.id;

        if (!cliente_id || !veiculo_id || !data_agendada) {
            return res.status(400).json({ message: "Campos obrigatórios faltando!" });
        }

        const [result]: any = await db.query(
            `INSERT INTO agendamentos (
                cliente_id,
                veiculo_id, 
                usuario_id, 
                data_agendada, 
                descricao_servico
            )
            VALUES (
                ?, ?, ?, ?, ?
            )`,
            [
                cliente_id,
                veiculo_id,
                usuario_id,
                data_agendada,
                descricao_servico || null
            ]
        );

        res.status(201).json({ agendamento_id: result.insertId, message: "Agendamento criado com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: "Erro ao criar agendamento!" });
    }
});

export default router;