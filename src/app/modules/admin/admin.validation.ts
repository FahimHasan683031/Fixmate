import { z } from 'zod';

const usersAdminSchema = z.object({
  query: z
    .object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      role: z.enum(['client', 'provider', 'all']).optional().default('all'),
      search: z.string().optional(),
    })
    .strict(),
});

const addNewCategorySchema = z.object({
  body: z
    .object({
      name: z.string({ invalid_type_error: 'Category name is required' }),
      subCategory: z.any(),
      image: z.string().optional(),
    })
    .strict(),
});

const getCategoriesSchema = z.object({
  query: z
    .object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      id: z.string().optional(),
    })
    .strict(),
});

const updateCategorySchema = z.object({
  body: z
    .object({
      id: z.string({ required_error: 'Category id is required' }),
      name: z.string({ invalid_type_error: 'Category name is required' }).optional(),
      subCategory: z.any(),
      image: z.string().optional(),
    })
    .strict(),
});

const updatePolicySchema = z.object({
  body: z
    .object({
      content: z.string({ invalid_type_error: 'Policy content is required' }).optional(),
    })
    .strict(),
});

const updateTermsSchema = z.object({
  body: z
    .object({
      content: z.string({ invalid_type_error: 'Terms content is required' }).optional(),
    })
    .strict(),
});

const getRequestsSchema = z.object({
  query: z
    .object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      id: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    })
    .strict(),
});

const approveOrRejectSchema = z.object({
  params: z
    .object({
      id: z.string({ invalid_type_error: 'User id is required' }),
      status: z.enum(['approve', 'reject'], { required_error: 'Status is required' }),
    })
    .strict(),
});

const findSchema = z.object({
  query: z
    .object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      search: z.string().optional(),
      compo: z
        .enum(['user', 'verification', 'support'], {
          invalid_type_error: 'You must give the type on this user, verification, support',
        })
        .optional()
        .default('user'),
    })
    .strict(),
});

const getBookingsSchema = z.object({
  query: z
    .object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      status: z.string().optional(),
      search: z.string().optional(),
    })
    .strict(),
});

export const AdminValidation = {
  usersAdminSchema,
  addNewCategorySchema,
  getCategoriesSchema,
  updateCategorySchema,
  updatePolicySchema,
  updateTermsSchema,
  getBookingsSchema,
  getRequestsSchema,
  approveOrRejectSchema,
  findSchema,
};
