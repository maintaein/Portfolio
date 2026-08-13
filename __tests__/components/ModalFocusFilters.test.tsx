import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Modal from '@/components/atoms/Modal';

type FilterCase = 'hidden' | 'ancestor' | 'display' | 'visibility';

function FilterHarness({ filterCase }: { filterCase: FilterCase }) {
  const filteredButton = (
    <button
      data-testid="filtered"
      hidden={filterCase === 'hidden'}
      style={{
        display: filterCase === 'display' ? 'none' : 'block',
        visibility: filterCase === 'visibility' ? 'hidden' : 'visible',
      }}
    >
      filtered focus target
    </button>
  );

  return (
    <Modal isOpen onClose={() => {}} showCloseButton={false}>
      {filterCase === 'ancestor' ? (
        <div aria-hidden="true">{filteredButton}</div>
      ) : (
        filteredButton
      )}
      <button data-testid="visible">visible button</button>
    </Modal>
  );
}

describe('Modal focusable filtering', () => {
  it.each<FilterCase>(['hidden', 'ancestor', 'display', 'visibility'])(
    'excludes the %s hidden condition independently',
    async (filterCase) => {
      render(<FilterHarness filterCase={filterCase} />);
      const visible = screen.getByTestId('visible');

      if (filterCase === 'hidden') {
        const filtered = screen.getByTestId('filtered');
        const getComputedStyle = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
          const style = getComputedStyle(element, pseudo);
          return element === filtered
            ? ({ ...style, display: 'block', visibility: 'visible' } as CSSStyleDeclaration)
            : style;
        });
        vi.spyOn(filtered, 'closest').mockReturnValue(null);
      }

      await vi.waitFor(() => expect(visible).toHaveFocus());
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(visible).toHaveFocus();
    },
  );
});
