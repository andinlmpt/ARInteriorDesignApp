import { useEffect, type RefObject } from 'react';

/**
 * Copies each table's column headings onto its cells as `data-label`. On a phone a table row is
 * shown as a card (global.css), and each value takes its heading from this label. One observer for
 * the whole console, so no table repeats its headings in every cell; it re-runs when rows change.
 */
export function useTableCellLabels(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;

    const label = () => {
      element.querySelectorAll('table.table').forEach((table) => {
        const headings = Array.from(table.querySelectorAll('thead th'), (th) => th.textContent?.trim() ?? '');
        table.querySelectorAll('tbody tr').forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            const text = headings[index] ?? '';
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
          });
        });
      });
    };

    label();
    // Only added and removed nodes: setting the labels themselves doesn't trigger it again.
    const observer = new MutationObserver(label);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);
}
