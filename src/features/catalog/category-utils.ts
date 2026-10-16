import type { Category } from '@/domain';

export function getDescendantIds(categoryId: string, categories: Category[]): Set<string> {
  const descendants = new Set<string>();
  const findChildren = (parentId: string) => {
    for (const cat of categories) {
      if (cat.parentId === parentId) {
        descendants.add(cat.id);
        findChildren(cat.id);
      }
    }
  };
  findChildren(categoryId);
  return descendants;
}
