import { pageAppearanceCss, type PageAppearance } from '@/lib/pageAppearance';
import { getTheme } from '@/server/content/theme';

/**
 * One page's own colours (T31, 2.19), as a `<style>` after its content —
 * last, for the same reason a page's CSS is last: a style element first in
 * `main` would stop the over-hero header lying over the hero. Nothing at all
 * for a page with no colours of its own.
 */
export async function PageAppearanceStyle({ appearance }: { appearance: PageAppearance | undefined }) {
  if (!appearance || (!appearance.background && appearance.scheme !== 'alt')) return null;
  const css = pageAppearanceCss(appearance, await getTheme());
  return css ? <style id="he-page-appearance" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
