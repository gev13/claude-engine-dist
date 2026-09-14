import { cn } from '@/lib/utils';

/* A five-star rating (P3-A7), filled to the value — halves included. The row
   is drawn twice, a dim track and a clipped gold copy over it, so any value
   between 0 and 5 fills exactly. Screen readers hear the number. */

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';

function Row() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        // The viewBox pads each star, so the stars sit apart with no gap to account for.
        <svg key={i} viewBox="-1.5 0 27 24" aria-hidden="true" focusable="false">
          <path d={STAR} />
        </svg>
      ))}
    </>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className={cn('he-stars', className)} role="img" aria-label={`Rated ${clamped} out of 5`}>
      <span className="he-stars__track">
        <Row />
      </span>
      <span className="he-stars__fill" style={{ width: `${(clamped / 5) * 100}%` }}>
        <Row />
      </span>
    </span>
  );
}
