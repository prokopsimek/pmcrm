import { z } from 'zod';

/**
 * Contact Validation Schemas
 */

export const contactSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/i, {
      message: 'Invalid phone number',
    })
    .optional()
    .or(z.literal('')),
  company: z
    .string()
    .max(100, 'Company name must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  position: z
    .string()
    .max(100, 'Position must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  tags: z
    .array(z.string())
    .optional()
    .default([]),
});

export const updateContactSchema = contactSchema.partial();

export type ContactFormInput = z.infer<typeof contactSchema>;
export type UpdateContactFormInput = z.infer<typeof updateContactSchema>;
