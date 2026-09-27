"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/user";
import {
  collectionIdSchema,
  collectionNameSchema,
  type CollectionFormState,
} from "@/lib/collections/validation";
import { PHOTO_BUCKET } from "@/lib/photos/validation";

function parseCollectionId(value: FormDataEntryValue | null): string {
  const parsed = collectionIdSchema.safeParse(value);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function createCollection(
  _previousState: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const { supabase } = await requireUser();
  const name = collectionNameSchema.safeParse(formData.get("name"));
  if (!name.success) {
    return { nameError: name.error.issues[0]?.message };
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({ name: name.data })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Não foi possível criar o álbum. Tente novamente." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/albuns");
  redirect(`/colecoes/${data.id}`);
}

export async function renameCollection(
  _previousState: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const { supabase, userId } = await requireUser();
  const id = parseCollectionId(formData.get("id"));
  const name = collectionNameSchema.safeParse(formData.get("name"));
  if (!name.success) {
    return { nameError: name.error.issues[0]?.message };
  }

  const { data, error } = await supabase
    .from("collections")
    .update({ name: name.data })
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Não foi possível renomear o álbum. Tente novamente." };
  }
  if (!data) notFound();

  revalidatePath("/dashboard");
  revalidatePath("/albuns");
  revalidatePath(`/colecoes/${id}`);
  return { success: "Nome atualizado." };
}

export async function deleteCollection(
  _previousState: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const { supabase, userId } = await requireUser();
  const id = parseCollectionId(formData.get("id"));

  const { data: collection, error: collectionError } = await supabase
    .from("collections")
    .select("id")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (collectionError) return { error: "Não foi possível verificar o álbum. Tente novamente." };
  if (!collection) notFound();

  const prefix = `${userId}/${id}`;
  while (true) {
    const { data: objects, error: listError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(prefix, { limit: 100 });
    if (listError || !objects) {
      return { error: "Não foi possível listar as fotos do álbum. Tente novamente." };
    }
    if (objects.length === 0) break;
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(objects.map((object) => `${prefix}/${object.name}`));
    if (storageError) {
      return { error: "Não foi possível remover todos os arquivos. Tente novamente." };
    }
  }

  const { data, error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Não foi possível excluir o álbum. Tente novamente." };
  }
  if (!data) notFound();

  revalidatePath("/dashboard");
  revalidatePath("/albuns");
  redirect("/dashboard");
}
