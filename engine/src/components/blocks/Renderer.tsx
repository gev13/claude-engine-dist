import { Fragment } from 'react';
import type { AnyBlock, ParsedBlock, ParsedRowProps } from '@/lib/blocks';
import { BlockNameTag } from './BlockNameTag';
import { parseBlocks } from '@/lib/blocks';
import { blockStyleToCss, rowToCss } from '@/lib/blockStyle-css';
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
  ProjectsBlock,
  VideoBlock,
} from './library/showcase';
import { BreadcrumbsBlock, BusinessHoursBlock, ChartBlock, PriceListBlock, ReviewsBlock, SearchBlock, TextPathBlock } from './library/widgets';
import { FlipBoxBlock, HotspotsBlock, ShareBlock, TocBlock } from './library/widgets-client';
import type { Crumb } from '@/lib/seo/jsonld';
import type { BlockStyle } from '@/lib/blockStyle';
import { ShapeDividers } from './library/effects';
import { TiltObserver } from './library/TiltObserver';
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
  video: VideoBlock,
  gallery: GalleryBlock,
  horizontalAccordion: HorizontalAccordionBlock,
  projects: ProjectsBlock,
  map: MapBlock,
  chart: ChartBlock,
  hotspots: HotspotsBlock,
  flipBox: FlipBoxBlock,
  priceList: PriceListBlock,
  businessHours: BusinessHoursBlock,
  share: ShareBlock,
  reviews: ReviewsBlock,
  toc: TocBlock,
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
    <div id={style.anchorId} className={cn(`he-b-${block.id}`, shellClass(style))} data-reveal-delay={revealDelay(style)}>
      {children}
      <ShapeDividers style={style} />
    </div>
  );
}

/** Width, entrance, hover, sticky, snap and shape classes a styled block or row carries (P3-C). */
function shellClass(style: BlockStyle) {
  return cn(
    style.width && WIDTH_CLASS[style.width],
    revealClass(style),
    style.hover && `he-hover he-hover--${style.hover}`,
    (style.shapeTop || style.shapeBottom) && 'he-has-shape',
    style.sticky && 'he-sticky',
    style.snap && 'he-snap',
  );
}

const revealDelay = (style: BlockStyle) => (style.reveal && style.revealDelay ? style.revealDelay : undefined);

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
function RowBlock({ block, trail }: { block: ParsedBlock; trail?: Crumb[] }) {
  const props = block.props as ParsedRowProps;
  const style = block.style;

  return (
    <div
      id={style?.anchorId}
      className={cn('he-row', `he-b-${block.id}`, style && shellClass(style))}
      data-reveal-delay={style ? revealDelay(style) : undefined}
    >
      <div className="shell">
        <div className={`he-r-${block.id}`}>
          {props.columns.map((column) => (
            <div key={column.id} className={cn(`he-c-${column.id}`, 'he-nested')}>
              {column.blocks.filter(isLive).map((child) => renderBlock(child, trail))}
            </div>
          ))}
        </div>
      </div>
      {style && <ShapeDividers style={style} />}
    </div>
  );
}

/** `trail` is the page's own breadcrumb trail; only the breadcrumbs block reads it. */
function renderBlock(block: ParsedBlock, trail?: Crumb[]): React.ReactNode {
  if (block.type === 'row') return <RowBlock key={block.id} block={block} trail={trail} />;

  const Component = registry[block.type];
  if (!Component) return null;

  return (
    <BlockShell key={block.id} block={block}>
      <Component
        {...(block.props as object)}
        {...(block.type === 'breadcrumbs' ? { trail } : {})}
        {...(block.type === 'form' ? { blockId: block.id } : {})}
      />
    </BlockShell>
  );
}

/** Every rule the tree needs, gathered in one pass so rows contribute theirs. */
function collectCss(blocks: ParsedBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    parts.push(blockStyleToCss(block.id, block.style));

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
}: {
  blocks: AnyBlock[] | null | undefined;
  /** Print each block's name above it — the `library` page template. */
  showNames?: boolean;
  /** The page's breadcrumb trail, the same one its structured data uses. */
  trail?: Crumb[];
}) {
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
              {renderBlock(block, trail)}
            </Fragment>
          ))
        : parsed.map((block) => renderBlock(block, trail))}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {anyStyle(parsed, (s) => s.reveal) && <RevealObserver />}
      {anyStyle(parsed, (s) => s.hover === 'tilt') && <TiltObserver />}
    </>
  );
}
