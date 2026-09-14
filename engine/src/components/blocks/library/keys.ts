/**
 * Arrow-key movement for a tab list or a radio group: Left/Up and Right/Down
 * step with wrap-around, Home and End jump. Focus follows the selection, as
 * the ARIA tabs and radio-group patterns expect.
 */
export function arrowKeys(count: number, active: number, select: (index: number) => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in steps) next = (active + steps[e.key]! + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;

    e.preventDefault();
    select(next);
    const items = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]');
    items[next]?.focus();
  };
}
