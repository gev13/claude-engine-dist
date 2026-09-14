import type { AnyBlock } from '@/lib/blocks';
import { PAGE_TEMPLATES } from './pages';
import { SECTION_TEMPLATES } from './sections';
import type { PageTemplate, Raw, SectionTemplate } from './types';

export { PAGE_TEMPLATES, SECTION_TEMPLATES };
export type { PageTemplate, Raw, SectionTemplate };

/**
 * Turns template blocks into page blocks: a copy of everything, with a new
 * id for every block and every row column, so two pages made from one
 * template never share a block — or a form's submissions.
 */
export function instantiate(list: readonly Raw[], makeId: () => string): AnyBlock[] {
  return list.map((raw) => {
    const props = structuredClone(raw.props);
    if (raw.type === 'row' && Array.isArray(props.columns)) {
      props.columns = (props.columns as { blocks?: Raw[] }[]).map((column) => ({
        ...column,
        id: makeId(),
        blocks: instantiate(column.blocks ?? [], makeId),
      }));
    }
    return { id: makeId(), type: raw.type, props, ...(raw.style ? { style: structuredClone(raw.style) } : {}) } as AnyBlock;
  });
}

export const findPageTemplate = (id: string) => PAGE_TEMPLATES.find((template) => template.id === id);
export const findSectionTemplate = (id: string) => SECTION_TEMPLATES.find((template) => template.id === id);
