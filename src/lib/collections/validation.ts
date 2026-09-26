import { z } from "zod";

export const collectionNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da coleção.")
  .max(120, "O nome deve ter no máximo 120 caracteres.");

export const collectionIdSchema = z.uuid();

export type CollectionFormState = {
  error?: string;
  nameError?: string;
  success?: string;
};
