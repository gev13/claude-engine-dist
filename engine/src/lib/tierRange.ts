/** Each tier as its own width range — the four never overlap (2.19). Shared by the stylesheet writer and the scripts that follow a tier (3.34). */
export const TIER_RANGE: Record<'base' | 'laptop' | 'tablet' | 'mobile', string> = {
  base: '(min-width:1441px)',
  laptop: '(min-width:1025px) and (max-width:1440px)',
  tablet: '(min-width:769px) and (max-width:1024px)',
  mobile: '(max-width:768px)',
};
