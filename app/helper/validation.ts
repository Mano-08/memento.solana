import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif"];

export const mintNFTSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const createGiftSchema = z.object({
  friendId: z.string().min(3),
  question1: z.string().min(5).max(30),
  answer1: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  solAmount: z.number().positive(),
});

export const nftFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, "Max 5MB file")
  .refine((file) => ACCEPTED_TYPES.includes(file.type), "Invalid file type");
