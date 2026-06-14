const consumedSlideNavNonces = new Map<string, number>();

export interface SlideNavRequest {
  readonly name: string;
  readonly slideIndex: number;
  readonly nonce: number;
}

export function shouldConsumeSlideNav(key: string, nonce: number): boolean {
  if (consumedSlideNavNonces.get(key) === nonce) return false;
  consumedSlideNavNonces.set(key, nonce);
  return true;
}

export function resetConsumedSlideNavForTests(): void {
  consumedSlideNavNonces.clear();
}

export function isSlideNavDeliverableNow(
  request: Pick<SlideNavRequest, 'name'> | null | undefined,
  openTabs: readonly string[],
): boolean {
  return !!request?.name && openTabs.includes(request.name);
}

export function deliverableSlideNavForActiveFile(
  request: SlideNavRequest | null | undefined,
  activeFileName: string | null | undefined,
  deliverableNonce: number | null,
): { readonly slideIndex: number; readonly nonce: number } | null {
  if (!request || !activeFileName) return null;
  if (request.name !== activeFileName) return null;
  if (request.nonce !== deliverableNonce) return null;
  return { slideIndex: request.slideIndex, nonce: request.nonce };
}
