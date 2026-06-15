import { Router, Request, Response } from "express";
import db from "../lib/db";
import bcrypt from "bcryptjs";

const router = Router();

const SELECT_QUERY = `
    SELECT
        usuario_id,
        nome,
        cpf,
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
            query += " WHERE nome LIKE ? OR email LIKE ? OR telefone LIKE ? OR cpf LIKE ?";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
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
        console.error("Erro ao buscar usuário por ID:", error);
        res.status(500).json({ message: "Erro ao buscar usuário!" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    try {
        const { nome, cpf, telefone, email, senha, cargo, requerTrocaSenha } = req.body;

        if (!nome || !cpf || !telefone || !email || !senha || !cargo) {
            return res.status(400).json({ message: "Preencha todos os campos obrigatórios!" });
        }

        const [existingUser]: any = await db.query(
            "SELECT usuario_id FROM usuarios WHERE cpf = ? OR email = ?",
            [cpf, email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: "CPF já cadastrado!" });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(senha, saltRounds);

        const insertQuery = `
            INSERT INTO usuarios 
                (nome, cpf, telefone, email, senha, cargo, deve_trocar_senha)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const [result]: any = await db.query(insertQuery, [
            nome,
            cpf,
            telefone,
            email,
            hashedPassword,
            cargo,
            requerTrocaSenha ? 1 : 0
        ]);

        res.status(201).json({
            usuario_id: result.insertId,
            message: "Funcionário cadastrado com sucesso!"
        });

    } catch (error) {
        console.error("Erro ao criar funcionário:", error);
        res.status(500).json({ message: "Erro interno ao cadastrar funcionário!" });
    }
});

router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nome, telefone, email, cargo, status } = req.body;

        const [userCheck]: any = await db.query("SELECT usuario_id, status FROM usuarios WHERE usuario_id = ?", [id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado!" });
        }

        const fields: string[] = [];
        const params: any[] = [];

        if (nome !== undefined) { fields.push("nome = ?"); params.push(nome); }
        if (telefone !== undefined) { fields.push("telefone = ?"); params.push(telefone); }
        if (email !== undefined) { fields.push("email = ?"); params.push(email); }
        if (cargo !== undefined) { fields.push("cargo = ?"); params.push(cargo); }
        if (status !== undefined) { fields.push("status = ?"); params.push(status); }

        if (fields.length === 0) {
            return res.status(400).json({ message: "Nenhum campo informado para atualização." });
        }

        params.push(id);

        const dynamicQuery = `UPDATE usuarios SET ${fields.join(", ")} WHERE usuario_id = ?`;

        await db.query(dynamicQuery, params);

        res.json({ message: "Funcionário updated com sucesso!" });
    } catch (error) {
        console.error("Erro crítico no PUT /users:", error);
        res.status(500).json({ message: "Erro interno no servidor ao atualizar funcionário!" });
    }
});

router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [userCheck]: any = await db.query("SELECT usuario_id FROM usuarios WHERE usuario_id = ?", [id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado!" });
        }

        await db.query("DELETE FROM usuarios WHERE usuario_id = ?", [id]);

        res.json({ message: "Funcionário removido com sucesso do sistema!" });
    } catch (error) {
        console.error("Erro ao deletar funcionário:", error);
        res.status(500).json({ message: "Erro ao remover funcionário!" });
    }
});

export default router;