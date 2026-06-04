import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import db from "../lib/db";
import { signToken } from "../lib/jwt";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email e senha obrigatórios!" });
        }

        const [rows]: any = await db.query(
            `SELECT usuario_id, nome, email, telefone, senha, cargo, status, deve_trocar_senha
            FROM usuarios WHERE email = ? LIMIT 1`,
            [email]
        );

        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ message: "Credenciais inválidas!" });
        }

        if (!usuario.status) {
            return res.status(403).json({ message: "Usuário inativo!" });
        }

        const passwordMatch = await bcrypt.compare(password, usuario.senha);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Credenciais inválidas!" });
        }

        const token = signToken({
            id: usuario.usuario_id,
            name: usuario.nome,
            email: usuario.email,
            role: usuario.cargo,
        });

        res.json({
            token,
            user: {
                id: usuario.usuario_id,
                name: usuario.nome,
                email: usuario.email,
                phone: usuario.telefone,
                role: usuario.cargo,
                mustChangePassword: Boolean(usuario.deve_trocar_senha),
            },
        });

    } catch (error) {
        console.error("Erro no login: ", error);
        res.status(500).json({ message: "Erro ao realizar login!" });
    }
});

router.post("/change-password", async (req: Request, res: Response) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ message: "Dados obrigatórios faltando!" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres!" });
        }

        const [rows]: any = await db.query(
            `SELECT usuario_id FROM usuarios WHERE email = ? LIMIT 1`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado!" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            `UPDATE usuarios SET senha = ?, deve_trocar_senha = FALSE WHERE email = ?`,
            [hashedPassword, email]
        );

        res.json({ message: "Senha alterada com sucesso!" });
    } catch (error) {
        console.log("Erro ao alterar senha! ", error);
        res.status(500).json({ message: "Erro ao alterar senha!" });
    }
});

export default router;