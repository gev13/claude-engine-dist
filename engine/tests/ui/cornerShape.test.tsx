// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CornerShapeFields } from '../../src/components/admin/CornerShapeFields';

/* 2.21 — one corner control for Appearance → Shape, the Design tab and a
   card's own style. Rounded writes nothing; a cut keeps only what differs
   from the default corners. */

afterEach(cleanup);

describe('the corner control', () => {
  it('writes nothing for rounded, and a cut with its size when chosen', () => {
    const onChange = vi.fn();
    render(<CornerShapeFields label="Cards" value={undefined} fallbackSize={20} onChange={onChange} />);
    expect(screen.queryByLabelText(/Cut/, { selector: 'input' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Cards'), { target: { value: 'cut' } });
    expect(onChange).toHaveBeenLastCalledWith({ style: 'cut' });
  });

  it('offers the corners once cut, and never lets the last one go', () => {
    const onChange = vi.fn();
    render(<CornerShapeFields label="Cards" value={{ style: 'cut', size: 12 }} fallbackSize={20} onChange={onChange} />);
    expect((screen.getByLabelText('Top right') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Top left') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Top left'));
    expect(onChange).toHaveBeenLastCalledWith({ style: 'cut', size: 12, corners: ['tl', 'tr', 'bl'] });
    cleanup();
    onChange.mockReset();
    render(<CornerShapeFields label="Cards" value={{ style: 'cut', corners: ['tr'] }} fallbackSize={20} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Top right'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears everything when set back to rounded', () => {
    const onChange = vi.fn();
    render(<CornerShapeFields label="Cards" value={{ style: 'cut', size: 12 }} fallbackSize={20} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Cards'), { target: { value: 'rounded' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
