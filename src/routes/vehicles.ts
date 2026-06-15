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
        c.nome AS proprietario,
        c.telefone AS proprietario_telefone,
        e.endereco_id,
        e.cep,
        e.logradouro,
        e.numero,
        e.bairro,
        e.cidade,
        e.estado,
        e.complemento
    FROM veiculos v
    LEFT JOIN clientes c ON c.cliente_id = v.cliente_id
    LEFT JOIN enderecos e ON e.cliente_id = c.cliente_id
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

        const [rows]: any = await db.query(query, params);

        const grouped = new Map<number, any>();
        for (const row of rows) {
            if (!grouped.has(row.veiculo_id)) {
                grouped.set(row.veiculo_id, { ...row, enderecos: [] });
            }
            if (row.endereco_id) {
                const v = grouped.get(row.veiculo_id)!;
                const ja = v.enderecos.some((e: any) => e.endereco_id === row.endereco_id);
                if (!ja) v.enderecos.push({
                    endereco_id: row.endereco_id,
                    cep: row.cep,
                    logradouro: row.logradouro,
                    numero: row.numero,
                    bairro: row.bairro,
                    cidade: row.cidade,
                    estado: row.estado,
                    complemento: row.complemento,
                });
            }
        }

        res.json(Array.from(grouped.values()));
    } catch (error) {
        console.error("Erro ao buscar veículos:", error);
        res.status(500).json({ message: "Erro ao buscar veículos!" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE v.veiculo_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Veículo não encontrado!" });
        }

        const base = { ...rows[0], enderecos: [] };
        for (const row of rows) {
            if (row.endereco_id) {
                base.enderecos.push({
                    endereco_id: row.endereco_id,
                    cep: row.cep,
                    logradouro: row.logradouro,
                    numero: row.numero,
                    bairro: row.bairro,
                    cidade: row.cidade,
                    estado: row.estado,
                    complemento: row.complemento,
                });
            }
        }

        res.json(base);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar veículo!" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    try {
        const { cliente_id, placa, marca, modelo, ano, cor } = req.body;

        if (!cliente_id || !placa || !marca || !modelo) {
            return res.status(400).json({ message: "Campos obrigatórios: cliente_id, placa, marca, modelo." });
        }

        const [result]: any = await db.query(
            `INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano, cor)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                cliente_id,
                placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                marca,
                modelo,
                ano || null,
                cor || null,
            ]
        );

        res.status(201).json({ veiculo_id: result.insertId, message: "Veículo cadastrado com sucesso!" });
    } catch (error: any) {
        console.error("Erro ao cadastrar veículo:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Placa já cadastrada!" });
        }
        res.status(500).json({ message: "Erro ao cadastrar veículo!" });
    }
});

export default router;