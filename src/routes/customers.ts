import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

const SELECT_QUERY = `
    SELECT
        c.cliente_id,
        c.nome,
        c.telefone,
        c.cpf,
        e.endereco_id,
        e.cep,
        e.logradouro,
        e.numero,
        e.bairro,
        e.cidade,
        e.estado,
        e.complemento,
        v.veiculo_id,
        v.placa,
        v.marca,
        v.modelo,
        v.ano,
        v.cor
    FROM clientes c
    LEFT JOIN enderecos e ON e.cliente_id = c.cliente_id
    LEFT JOIN veiculos v ON v.cliente_id = c.cliente_id
`;

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        let query = SELECT_QUERY;
        const params: string[] = [];

        if (q) {
            query += " WHERE c.nome LIKE ? OR c.telefone LIKE ? OR c.cpf LIKE ?";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        query += " ORDER BY c.nome ASC";

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar clientes" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query(
            SELECT_QUERY + " WHERE c.cliente_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar cliente" });
    }
});


router.post("/", async (req: Request, res: Response) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const { nome, telefone, cpf, endereco, veiculo } = req.body;

        const [clienteResult]: any = await connection.query(
            `INSERT INTO clientes (nome, telefone, cpf) VALUES (?, ?, ?)`,
            [nome, telefone.replace(/\D/g, ""), cpf.replace(/\D/g, "")]
        );

        const cliente_id = clienteResult.insertId;

        await connection.query(
            `INSERT INTO enderecos (cliente_id, cep, logradouro, numero, bairro, cidade, estado, complemento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cliente_id,
                endereco.cep.replace(/\D/g, ""),
                endereco.logradouro,
                endereco.numero,
                endereco.bairro,
                endereco.cidade,
                endereco.estado,
                endereco.complemento || null
            ]
        );

        await connection.query(
            `INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano, cor)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                cliente_id,
                veiculo.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                veiculo.marca,
                veiculo.modelo,
                veiculo.ano,
                veiculo.cor
            ]
        );

        await connection.commit();

        res.status(201).json({ cliente_id, message: "Cliente criado com sucesso!" });
    } catch (error: any) {
        await connection.rollback();

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "CPF já cadastrado!" });
        }

        res.status(500).json({ message: "Erro ao criar cliente!" });
    } finally {
        connection.release();
    }
});

export default router;