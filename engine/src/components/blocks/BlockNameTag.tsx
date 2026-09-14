import type { ParsedBlock } from '@/lib/blocks';
import { describeBlock } from '@/lib/blockNames';

/**
 * The strip above each block on a `library` page: pattern code, block name,
 * variant, and the keys to find it in the data. Plain text, never a heading,
 * so it cannot disturb the page's heading outline.
 */
export function BlockNameTag({ block }: { block: ParsedBlock }) {
  const d = describeBlock(block.type, block.props as Record<string, unknown>, block.style);
  return (
    <div className="he-specimen">
      <div className="shell he-specimen__bar">
        {d.pattern && <span className="he-specimen__code">{d.pattern}</span>}
        <span className="he-specimen__name">{d.name}</span>
        {d.variant && <span className="he-specimen__variant">{d.variant}</span>}
        {d.extras.map((extra) => (
          <span key={extra} className="he-specimen__extra">
            + {extra}
          </span>
        ))}
        <span className="he-specimen__key">{d.key}</span>
      </div>
    </div>
  );
}
