import { Router, Request, Response } from "express";
import db from "../lib/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        let query = `
            SELECT
                c.cliente_id, c.nome, c.telefone, c.cpf,
                e.endereco_id, e.cep, e.logradouro, e.numero, e.bairro, e.cidade, e.estado, e.complemento,
                v.veiculo_id, v.placa, v.marca, v.modelo, v.ano, v.cor
            FROM clientes c
            LEFT JOIN enderecos e ON e.cliente_id = c.cliente_id
            LEFT JOIN veiculos v ON v.cliente_id = c.cliente_id
        `;
        const params: string[] = [];

        if (q) {
            query += " WHERE c.nome LIKE ? OR c.telefone LIKE ? OR c.cpf LIKE ?";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        query += " ORDER BY c.nome ASC";

        const [rows]: any = await db.query(query, params);

        const customerMap = new Map<number, any>();

        for (const row of rows) {
            const cid = row.cliente_id;

            if (!customerMap.has(cid)) {
                customerMap.set(cid, {
                    cliente_id: cid,
                    nome: row.nome,
                    telefone: row.telefone,
                    cpf: row.cpf,
                    enderecos: [],
                    veiculos: []
                });
            }

            const currentCustomer = customerMap.get(cid)!;

            if (row.endereco_id && !currentCustomer.enderecos.some((e: any) => e.endereco_id === row.endereco_id)) {
                currentCustomer.enderecos.push({
                    endereco_id: row.endereco_id,
                    cep: row.cep,
                    logradouro: row.logradouro,
                    numero: row.numero,
                    bairro: row.bairro,
                    cidade: row.cidade,
                    estado: row.estado,
                    complemento: row.complemento
                });
            }

            if (row.veiculo_id && !currentCustomer.veiculos.some((v: any) => v.veiculo_id === row.veiculo_id)) {
                currentCustomer.veiculos.push({
                    veiculo_id: row.veiculo_id,
                    placa: row.placa,
                    marca: row.marca,
                    modelo: row.modelo,
                    ano: row.ano,
                    cor: row.cor
                });
            }
        }

        res.json(Array.from(customerMap.values()));
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        res.status(500).json({ message: "Erro ao buscar clientes" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const clienteId = req.params.id;

        const [clientes]: any = await db.query("SELECT * FROM clientes WHERE cliente_id = ?", [clienteId]);
        if (clientes.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        const [enderecos]: any = await db.query("SELECT * FROM enderecos WHERE cliente_id = ?", [clienteId]);
        const [veiculos]: any = await db.query("SELECT * FROM veiculos WHERE cliente_id = ?", [clienteId]);

        res.json({
            cliente_id: clientes[0].cliente_id,
            nome: clientes[0].nome,
            telefone: clientes[0].telefone,
            cpf: clientes[0].cpf,
            enderecos,
            veiculos
        });
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar cliente" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { nome, telefone, cpf, enderecos, veiculos } = req.body;

        if (!nome || !telefone) {
            return res.status(400).json({ message: "Nome e telefone são obrigatórios." });
        }

        const [clienteResult]: any = await connection.query(
            `INSERT INTO clientes (nome, telefone, cpf) VALUES (?, ?, ?)`,
            [nome, telefone.replace(/\D/g, ""), cpf ? cpf.replace(/\D/g, "") : null]
        );
        const cliente_id = clienteResult.insertId;

        if (Array.isArray(enderecos)) {
            for (const addr of enderecos) {
                if (!addr.cep || !addr.logradouro) continue;

                await connection.query(
                    `INSERT INTO enderecos (cliente_id, cep, logradouro, numero, bairro, cidade, estado, complemento)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        cliente_id,
                        addr.cep.replace(/\D/g, ""),
                        addr.logradouro,
                        addr.numero,
                        addr.bairro,
                        addr.cidade,
                        addr.estado,
                        addr.complemento || null
                    ]
                );
            }
        }


        if (Array.isArray(veiculos)) {
            for (const vec of veiculos) {
                if (!vec.placa || !vec.marca) continue;


                const placaLimpa = vec.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

                await connection.query(
                    `INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano, cor)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        cliente_id,
                        placaLimpa,
                        vec.marca,
                        vec.modelo,
                        vec.ano || null,
                        vec.cor || null
                    ]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ cliente_id, message: "Cliente criado com sucesso!" });
    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO COMPLETO NO BANCO DE DADOS:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "CPF já cadastrado!" });
        }
        res.status(500).json({ message: "Erro ao criar cliente!", error: error.message });
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req: Request, res: Response) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const clienteId = req.params.id;
        const { name, phone, cpf, enderecos, veiculos } = req.body;

        await connection.query(
            `UPDATE clientes SET nome = ?, telefone = ?, cpf = ? WHERE cliente_id = ?`,
            [name, phone.replace(/\D/g, ""), cpf ? cpf.replace(/\D/g, "") : null, clienteId]
        );

        if (Array.isArray(enderecos)) {
            await connection.query("DELETE FROM enderecos WHERE cliente_id = ?", [clienteId]);
            for (const addr of enderecos) {
                await connection.query(
                    `INSERT INTO enderecos (cliente_id, cep, logradouro, numero, bairro, cidade, estado, complemento)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [clienteId, addr.cep.replace(/\D/g, ""), addr.logradouro, addr.numero, addr.bairro, addr.cidade, addr.estado, addr.complemento || null]
                );
            }
        }

        if (Array.isArray(veiculos)) {
            await connection.query("DELETE FROM veiculos WHERE cliente_id = ?", [clienteId]);
            for (const vec of veiculos) {
                await connection.query(
                    `INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano, cor)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [clienteId, vec.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(), vec.marca, vec.modelo, vec.ano || null, vec.cor || null]
                );
            }
        }

        await connection.commit();
        res.json({ message: "Cliente atualizado com sucesso!" });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: "Erro ao atualizar dados do cliente." });
    } finally {
        connection.release();
    }
});

export default router;