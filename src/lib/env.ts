import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL não foi definida." })
    .url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({
      error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi definida.",
    })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não pode estar vazia."),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ error: "SUPABASE_SERVICE_ROLE_KEY não foi definida." })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY não pode estar vazia."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatEnvError(error: z.ZodError): Error {
  const details = error.issues.map((issue) => issue.message).join(" ");
  return new Error(`Configuração de ambiente inválida. ${details}`);
}

export function parsePublicEnv(input: unknown): PublicEnv {
  const result = publicEnvSchema.safeParse(input);

  if (!result.success) {
    throw formatEnvError(result.error);
  }

  return result.data;
}

export function parseServerEnv(input: unknown): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    throw formatEnvError(result.error);
  }

  return result.data;
}

export function readPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
