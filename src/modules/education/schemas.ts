import { z } from 'zod';

export const educationModulesQuerySchema = z.object({
  week: z.string().optional().transform((v) => v ? parseInt(v, 10) : undefined),
});

export const moduleIdParamSchema = z.object({
  id: z.string().uuid('Invalid module ID'),
});

export const markProgressSchema = z.object({
  module_id: z.string().uuid('Invalid module ID'),
});
