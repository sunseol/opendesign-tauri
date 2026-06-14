if (typeof window !== 'undefined') {
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
  });

  if (typeof Range !== 'undefined') {
    if (typeof Range.prototype.getBoundingClientRect !== 'function') {
      Range.prototype.getBoundingClientRect = zeroRect;
    }
    if (typeof Range.prototype.getClientRects !== 'function') {
      Range.prototype.getClientRects = () =>
        Object.assign([], { item: () => null });
    }
  }

  if (
    typeof Element !== 'undefined' &&
    typeof Element.prototype.scrollIntoView !== 'function'
  ) {
    Element.prototype.scrollIntoView = () => {};
  }
}
