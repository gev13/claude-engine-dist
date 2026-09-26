import { Fragment } from 'react';
import type { AnyBlock, ParsedBlock, ParsedRowProps } from '@/lib/blocks';
import { BlockNameTag } from './BlockNameTag';
import { parseBlocks } from '@/lib/blocks';
import { blockStyleToCss, isSafeBlockId, rowToCss } from '@/lib/blockStyle-css';
import { itemStyleToCss, type ItemStyle } from '@/lib/itemStyle';
import { cn } from '@/lib/utils';
import {
  CardGridBlock,
  CheckListsBlock,
  CtaBlock,
  FaqBlock,
  FigureBlock,
  HeroBlock,
  ImageBlock,
  InfoPanelBlock,
  NumberedListBlock,
  PagerBlock,
  ProseBlock,
  SpacerBlock,
  SplitPointsBlock,
  StatsBlock,
  TableBlock,
} from './index';
import { PostListBlock, ServicesIndexBlock } from './dynamic';
import { ContactFormBlock } from './ContactForm';
import { Carousel } from './library/Carousel';
import { Marquee } from './library/Marquee';
import { StackedPanels } from './library/StackedPanels';
import { AppPromo, Collage, LogoWall, MediaBand, OverlayCard, QuoteBlock, SplitMedia } from './library/content';
import { Configurator } from './library/Configurator';
import { SubNav } from './library/SubNav';
import { TabsBlock } from './library/Tabs';
import { WindowFrame } from './library/WindowFrame';
import { NewsletterBlock } from './library/Newsletter';
import { PinnedMedia } from './library/PinnedMedia';
import { RevealObserver } from './library/RevealObserver';
import { ScrollStory } from './library/ScrollStory';
import { ButtonsBlock, HeadingBlock, TeamBlock } from './library/elements';
import { CountdownBlock, NoticeBlock, PricingBlock, ProgressBlock } from './library/elements-client';
import { SocialLinksBlock } from './library/SocialLinks';
import {
  CompareBlock,
  GalleryBlock,
  HorizontalAccordionBlock,
  MapBlock,
} from './library/showcase';
import { ProjectsSource } from './library/ProjectsSource';
import { VideoSource } from './library/VideoSource';
import { SectionVideo } from './library/SectionVideo';
import { BreadcrumbsBlock, BusinessHoursBlock, ChartBlock, PriceListBlock, ReviewsBlock, SearchBlock, TextPathBlock } from './library/widgets';
import { FlipBoxBlock, HotspotsBlock, ShareBlock, TocBlock } from './library/widgets-client';
import type { Crumb } from '@/lib/seo/jsonld';
import type { Paging } from '@/server/content/resolve';
import type { Locale } from '@/lib/locales';
import { MAX_SAVED_DEPTH, SAVED_BLOCK_TYPE } from '@/lib/blockTree';
import { getSavedTree } from '@/server/content/savedBlocks';
import type { BlockStyle } from '@/lib/blockStyle';
import { ShapeDividers } from './library/effects';
import { CategoryIndexBlock } from './library/CategoryIndex';
import { TiltObserver } from './library/TiltObserver';
import { GlitchObserver } from './library/GlitchObserver';
import { FormBlock } from './library/FormBlock';
import { LottieBlock } from './library/LottieBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const registry: Record<string, (props: any) => React.ReactNode | Promise<React.ReactNode>> = {
  hero: HeroBlock,
  stats: StatsBlock,
  prose: ProseBlock,
  splitPoints: SplitPointsBlock,
  cardGrid: CardGridBlock,
  numberedList: NumberedListBlock,
  checkLists: CheckListsBlock,
  faq: FaqBlock,
  cta: CtaBlock,
  pager: PagerBlock,
  servicesIndex: ServicesIndexBlock,
  postList: PostListBlock,
  contactForm: ContactFormBlock,
  infoPanel: InfoPanelBlock,
  image: ImageBlock,
  table: TableBlock,
  spacer: SpacerBlock,
  figure: FigureBlock,
  carousel: Carousel,
  marquee: Marquee,
  stackedPanels: StackedPanels,
  splitMedia: SplitMedia,
  overlayCard: OverlayCard,
  mediaBand: MediaBand,
  tabs: TabsBlock,
  logoWall: LogoWall,
  quote: QuoteBlock,
  configurator: Configurator,
  collage: Collage,
  appPromo: AppPromo,
  windowFrame: WindowFrame,
  subNav: SubNav,
  scrollStory: ScrollStory,
  pinnedMedia: PinnedMedia,
  newsletter: NewsletterBlock,
  heading: HeadingBlock,
  buttons: ButtonsBlock,
  notice: NoticeBlock,
  progress: ProgressBlock,
  countdown: CountdownBlock,
  socialLinks: SocialLinksBlock,
  pricing: PricingBlock,
  team: TeamBlock,
  compare: CompareBlock,
  // 2.17 — a server wrapper, so an ambient film's box has the file's own shape.
  video: VideoSource,
  gallery: GalleryBlock,
  horizontalAccordion: HorizontalAccordionBlock,
  projects: ProjectsSource,
  map: MapBlock,
  chart: ChartBlock,
  hotspots: HotspotsBlock,
  flipBox: FlipBoxBlock,
  priceList: PriceListBlock,
  businessHours: BusinessHoursBlock,
  share: ShareBlock,
  reviews: ReviewsBlock,
  toc: TocBlock,
  categoryIndex: CategoryIndexBlock,
  breadcrumbs: BreadcrumbsBlock,
  textPath: TextPathBlock,
  search: SearchBlock,
  form: FormBlock,
  lottie: LottieBlock,
};

/** The reveal-on-scroll classes, when a block or row asks for them. */
const revealClass = (style: ParsedBlock['style']) => style?.reveal && `he-reveal he-reveal--${style.reveal}`;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Named widths, applied by overriding the container the inner `.shell` reads. */
const WIDTH_CLASS = {
  narrow: 'he-w-narrow',
  standard: '',
  wide: 'he-w-wide',
  full: 'he-w-full',
} as const;

/**
 * The wrapper that carries a block's own styling.
 *
 * Only blocks that have a style are wrapped, so a page nobody has styled
 * renders exactly the DOM it rendered before this existed.
 */
function BlockShell({ block, children }: { block: ParsedBlock; children: React.ReactNode }) {
  const style = block.style;
  if (!style) return <>{children}</>;

  return (
    <div
      id={style.anchorId}
      className={cn(`he-b-${block.id}`, shellClass(style))}
      data-reveal-delay={revealDelay(style)}
      data-glitch={glitchScope(style)}
    >
      {children}
      {style.background?.videoUrl && <SectionVideo background={style.background} />}
      <ShapeDividers style={style} />
    </div>
  );
}

/** Width, entrance, hover, sticky, snap and shape classes a styled block or row carries (P3-C). */
function shellClass(style: BlockStyle) {
  return cn(
    /* The editor's own classes first, so they read as the reason this block
       looks different when somebody inspects it. */
    style.className,
    style.width && WIDTH_CLASS[style.width],
    revealClass(style),
    style.hover && `he-hover he-hover--${style.hover}`,
    // 3.0 — glitch text; GlitchObserver finds the headings.
    style.glitch && `he-glitch he-glitch--${style.glitch.effect}`,
    style.glitch?.trigger === 'hover' && 'he-glitch--hover',
    (style.shapeTop || style.shapeBottom) && 'he-has-shape',
    style.sticky && 'he-sticky',
    style.snap && 'he-snap',
    // 2.19 (T31) — the site's alternate palette on this section: a light band on a dark site.
    style.scheme === 'alt' && 'he-scheme-alt',
    // 3.3 — the hook Appearance → Panels' "line up the content" aims at.
    style.panel && 'he-panel',
  );
}

const revealDelay = (style: BlockStyle) => (style.reveal && style.revealDelay ? style.revealDelay : undefined);
/** Every heading, or (unset) only the first — read by GlitchObserver. */
const glitchScope = (style: BlockStyle) => (style.glitch?.scope === 'headings' ? 'all' : undefined);

/** Whether any block on the page, or in any of its rows, has a style that matches. */
function anyStyle(blocks: ParsedBlock[], test: (style: BlockStyle) => unknown): boolean {
  return blocks.some(
    (block) =>
      Boolean(block.style && test(block.style)) ||
      (block.type === 'row' && (block.props as ParsedRowProps).columns.some((column) => anyStyle(column.blocks.filter(isLive), test))),
  );
}

/** Blocks an editor has switched off cost the page nothing at all. */
const isLive = (block: ParsedBlock) => block.style?.disabled !== true;

/**
 * A row: a twelve-column grid whose columns hold blocks of their own.
 *
 * The wrapper is always rendered, unlike other blocks, because a row needs the
 * grid class regardless of whether anybody has styled it.
 */
/**
 * What the page hands down to the blocks that need it: the breadcrumb trail
 * (the breadcrumbs block) and, for the one post list that pages on the
 * server, which page this is.
 */
export type RenderContext = {
  trail?: Crumb[];
  paging?: Paging & { blockId: string };
  /** The project whose page this is — a projects block can leave it out (2.14). */
  currentProjectId?: string;
  /** The page's language — a synced saved block shows its translation (2.15). */
  locale?: Locale;
  /** The saved blocks this render is already inside, outermost first — a cycle stops here. */
  savedPath?: string[];
};

/**
 * T8 (2.15) — a synced saved block: its tree, rendered where the reference
 * sits. A missing or deleted one renders nothing on the site; the builder is
 * where that is said. A reference inside a saved block that is already being
 * rendered, or past the depth limit, also renders nothing — the save refuses
 * both, and this is what keeps an edited database from looping a page.
 */
async function SavedBlockRef({ savedBlockId, ctx }: { savedBlockId: string; ctx: RenderContext }) {
  const path = ctx.savedPath ?? [];
  if (path.includes(savedBlockId) || path.length >= MAX_SAVED_DEPTH) return null;
  const saved = await getSavedTree(savedBlockId, ctx.locale);
  if (!saved || saved.tree.length === 0) return null;
  return (
    <BlockRenderer
      blocks={saved.tree}
      trail={ctx.trail}
      paging={ctx.paging}
      currentProjectId={ctx.currentProjectId}
      locale={ctx.locale}
      savedPath={[...path, savedBlockId]}
    />
  );
}

function RowBlock({ block, ctx }: { block: ParsedBlock; ctx: RenderContext }) {
  const props = block.props as ParsedRowProps;
  const style = block.style;

  return (
    <div
      id={style?.anchorId}
      className={cn('he-row', `he-b-${block.id}`, style && shellClass(style))}
      data-reveal-delay={style ? revealDelay(style) : undefined}
      data-glitch={style ? glitchScope(style) : undefined}
    >
      <div className="shell">
        <div className={`he-r-${block.id}`}>
          {props.columns.map((column) => (
            <div key={column.id} className={cn(`he-c-${column.id}`, 'he-nested')}>
              {column.blocks.filter(isLive).map((child) => renderBlock(child, ctx))}
            </div>
          ))}
        </div>
      </div>
      {style?.background?.videoUrl && <SectionVideo background={style.background} />}
      {style && <ShapeDividers style={style} />}
    </div>
  );
}

/** `trail` is the page's own breadcrumb trail; only the breadcrumbs block reads it. */
function renderBlock(block: ParsedBlock, ctx: RenderContext): React.ReactNode {
  if (block.type === 'row') return <RowBlock key={block.id} block={block} ctx={ctx} />;
  if (block.type === SAVED_BLOCK_TYPE) {
    // The instance's own style is its wrapper: outer spacing and visibility.
    return (
      <BlockShell key={block.id} block={block}>
        <SavedBlockRef savedBlockId={(block.props as { savedBlockId: string }).savedBlockId} ctx={ctx} />
      </BlockShell>
    );
  }

  const Component = registry[block.type];
  if (!Component) return null;

  return (
    <BlockShell key={block.id} block={block}>
      <Component
        {...(block.props as object)}
        {...(block.type === 'breadcrumbs' ? { trail: ctx.trail } : {})}
        {...(block.type === 'form' || block.type === 'cardGrid' || block.type === 'postList' || block.type === 'projects'
          ? { blockId: block.id }
          : {})}
        {...((block.type === 'postList' || block.type === 'projects') && ctx.paging?.blockId === block.id ? { paging: ctx.paging } : {})}
        {...(block.type === 'projects' && ctx.currentProjectId ? { currentProjectId: ctx.currentProjectId } : {})}
        {...(block.type === 'categoryIndex' ? { locale: ctx.locale } : {})}
      />
    </BlockShell>
  );
}

/**
 * The rules for cards an editor styled individually.
 *
 * Scoped by the block's own id rather than by the wrapper `.he-b-<id>`,
 * because that wrapper only exists when the *block* has a style — and a card
 * can be styled inside a block nobody has touched.
 */
function cardCss(block: ParsedBlock): string {
  if (block.type !== 'cardGrid' || !isSafeBlockId(block.id)) return '';
  const cards = (block.props as { cards?: { style?: ItemStyle }[] }).cards ?? [];
  return cards.map((card, i) => itemStyleToCss(`.he-i-${block.id}-${i}`, card.style)).join('');
}

/** Every rule the tree needs, gathered in one pass so rows contribute theirs. */
function collectCss(blocks: ParsedBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    // A row keeps its grid one level in, so `swipeOn` has to aim differently.
    parts.push(blockStyleToCss(block.id, block.style, 'he-b', block.type === 'row'));
    parts.push(cardCss(block));

    if (block.type === 'row') {
      const props = block.props as ParsedRowProps;
      parts.push(rowToCss({ id: block.id, ...props }));
      for (const column of props.columns) {
        parts.push(collectCss(column.blocks.filter(isLive)));
      }
    }
  }

  return parts.filter(Boolean).join('');
}

/**
 * Renders a validated block tree. Unknown or malformed blocks are dropped by
 * parseBlocks, so a bad edit can never take a public page down.
 *
 * CSS is collected into one style element rather than written as inline style
 * attributes: rules can then carry media queries and descendant selectors,
 * which inline styles cannot express at all.
 */
export function BlockRenderer({
  blocks,
  showNames = false,
  trail,
  paging,
  currentProjectId,
  locale,
  savedPath,
}: {
  blocks: AnyBlock[] | null | undefined;
  /** Print each block's name above it — the `library` page template. */
  showNames?: boolean;
  /** The page's breadcrumb trail, the same one its structured data uses. */
  trail?: Crumb[];
  /** Which page of its server-paged post list this address is (2.13). */
  paging?: Paging & { blockId: string };
  /** On a project's own page, its id (2.14). */
  currentProjectId?: string;
  /** The page's language, for synced saved blocks (2.15). */
  locale?: Locale;
  /** Saved blocks this tree is already inside — set by `SavedBlockRef`, never by a page. */
  savedPath?: string[];
}) {
  const ctx: RenderContext = { trail, paging, currentProjectId, locale, savedPath };
  const parsed = parseBlocks(blocks).filter(isLive);
  // P3-C5 — a block that asks the page to snap to it turns gentle snapping on for the page.
  const css = collectCss(parsed) + (anyStyle(parsed, (s) => s.snap) ? 'html{scroll-snap-type:y proximity}' : '');

  // The style element goes last: a <style> applies wherever it sits, and
  // keeping it out of first place means the first block really is the page's
  // first child — which is what the over-hero header looks for.
  return (
    <>
      {showNames
        ? parsed.map((block) => (
            <Fragment key={block.id}>
              <BlockNameTag block={block} />
              {renderBlock(block, ctx)}
            </Fragment>
          ))
        : parsed.map((block) => renderBlock(block, ctx))}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {anyStyle(parsed, (s) => s.reveal) && <RevealObserver />}
      {anyStyle(parsed, (s) => s.hover === 'tilt') && <TiltObserver />}
      {anyStyle(parsed, (s) => s.glitch) && <GlitchObserver />}
    </>
  );
}
