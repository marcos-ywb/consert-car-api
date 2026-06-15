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
    const clienteId = req.params.id;
    const { name, phone, cpf, enderecos, veiculos } = req.body;

    try {
        await connection.beginTransaction();

        const nomeFinal = name || "";
        const telefoneFinal = phone ? phone.replace(/\D/g, "") : "";
        const cpfFinal = cpf ? cpf.replace(/\D/g, "") : null;

        await connection.query(
            `UPDATE clientes SET nome = ?, telefone = ?, cpf = ? WHERE cliente_id = ?`,
            [nomeFinal, telefoneFinal, cpfFinal, clienteId]
        );

        if (Array.isArray(enderecos)) {
            await connection.query("DELETE FROM enderecos WHERE cliente_id = ?", [clienteId]);
            for (const addr of enderecos) {
                if (!addr.cep || !addr.logradouro) continue;

                await connection.query(
                    `INSERT INTO enderecos (cliente_id, cep, logradouro, numero, bairro, cidade, estado, complemento)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [clienteId, addr.cep.replace(/\D/g, ""), addr.logradouro || "", addr.numero || "", addr.bairro || "", addr.cidade || "", addr.estado || "", addr.complemento || null]
                );
            }
        }

        if (Array.isArray(veiculos)) {
            const incomingVehicles = veiculos
                .filter(v => v.placa && v.marca)
                .map(vec => ({
                    veiculo_id: vec.veiculo_id && vec.veiculo_id !== 0 ? parseInt(String(vec.veiculo_id), 10) : null,
                    placa: vec.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                    marca: vec.marca || "",
                    modelo: vec.modelo || "",
                    ano: vec.ano || null,
                    cor: vec.cor || null
                }));

            const [currentVehicles]: any = await connection.query(
                "SELECT veiculo_id FROM veiculos WHERE cliente_id = ?",
                [clienteId]
            );
            const currentIds = currentVehicles.map((v: any) => v.veiculo_id);

            const incomingIds = incomingVehicles.map(v => v.veiculo_id).filter(id => id !== null) as number[];
            const idsToDelete = currentIds.filter((id: any) => !incomingIds.includes(id));

            for (const vId of idsToDelete) {
                try {
                    await connection.query("DELETE FROM veiculos WHERE veiculo_id = ? AND cliente_id = ?", [vId, clienteId]);
                } catch (delError: any) {
                    if (delError.code === "ER_ROW_IS_REFERENCED_2" || delError.errno === 1451) {
                        console.error(`AVISO DE INTEGRIDADE: Veículo ID ${vId} não pôde ser removido pois possui agendamentos.`);
                        throw new Error("CANNOT_DELETE_VEHICLE_WITH_AGENDAMENTO");
                    } else {
                        throw delError;
                    }
                }
            }

            for (const vec of incomingVehicles) {
                if (vec.veiculo_id && currentIds.includes(vec.veiculo_id)) {
                    await connection.query(
                        `UPDATE veiculos SET placa = ?, marca = ?, modelo = ?, ano = ?, cor = ? 
                         WHERE veiculo_id = ? AND cliente_id = ?`,
                        [vec.placa, vec.marca, vec.modelo, vec.ano, vec.cor, vec.veiculo_id, clienteId]
                    );
                } else {
                    await connection.query(
                        `INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano, cor)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [clienteId, vec.placa, vec.marca, vec.modelo, vec.ano, vec.cor]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ message: "Cliente atualizado com sucesso!" });

    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO CRÍTICO NO UPDATE DE CLIENTE:", error);

        if (error.message === "CANNOT_DELETE_VEHICLE_WITH_AGENDAMENTO") {
            return res.status(409).json({
                message: "Não foi possível salvar as alterações. Você tentou remover um veículo que já possui agendamentos cadastrados. Por favor, remova ou altere os agendamentos vinculados antes de tentar remover o veículo."
            });
        }

        res.status(500).json({ message: "Erro interno no servidor ao salvar alterações do cliente." });
    } finally {
        connection.release();
    }
});

export default router;