import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    cluster: z.string(),
    clusterSlug: z.string().optional(),
    primaryKeyword: z.string(),
    tags: z.array(z.string()).default([]),
    readingTime: z.number().optional(),
    /** Populated by generate-post.js for FAQPage schema markup */
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .optional(),
  }),
});

const compare = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    /** The items being compared, e.g. ["Pellet Therapy", "Creams", "Patches"] */
    subjects: z.array(z.string()),
    cluster: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts, compare };
