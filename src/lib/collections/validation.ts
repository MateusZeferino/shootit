import { z } from "zod";

export const collectionNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do álbum.")
  .max(120, "O nome deve ter no máximo 120 caracteres.");

export const collectionIdSchema = z.uuid();

export const collectionStatusSchema = z.enum(["active", "inactive"]);

export type CollectionFormState = {
  error?: string;
  nameError?: string;
  success?: string;
};
