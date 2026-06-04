import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET as string;
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d") as any;

export interface JwtPayload {
    id: number;
    name: string;
    email: string;
    role: string;
}

export const signToken = (payload: JwtPayload): string => {
    return jwt.sign({ ...payload }, SECRET, { expiresIn: EXPIRES_IN });
};

export const verifyToken = (token: string): JwtPayload => {
    return jwt.verify(token, SECRET) as JwtPayload;
};