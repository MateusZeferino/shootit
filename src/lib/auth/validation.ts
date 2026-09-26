import { z } from "zod";

const email = z.string().trim().email("Informe um e-mail válido.").max(254);
const password = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.");

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "O nome deve ter no máximo 120 caracteres."),
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});

export type AuthFormState = {
  error?: string;
  success?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
};
