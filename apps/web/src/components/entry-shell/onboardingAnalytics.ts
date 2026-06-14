import { useCallback, useEffect, useRef } from 'react';
import type {
  OnboardingClickProps,
  OnboardingCompleteResultProps,
  OnboardingPageViewProps,
  TrackingOnboardingArea,
  TrackingOnboardingClickAction,
  TrackingOnboardingClickElement,
  TrackingOnboardingCompletionResult,
  TrackingOnboardingCompletionType,
  TrackingOnboardingRuntimeType,
  TrackingOnboardingStepIndex,
  TrackingOnboardingStepName,
} from '@open-design/contracts/analytics';
import {
  clearOnboardingSessionId,
  getOrCreateOnboardingSessionId,
} from '../../analytics/onboarding-session';

export type OnboardingProfileAnalytics = {
  readonly role: string;
  readonly orgSize: string;
  readonly useCase: readonly string[];
  readonly source: string;
  readonly email: string;
};

type AnalyticsTrack = (event: string, properties: Record<string, unknown>) => void;

type OnboardingClickExtra = Partial<Omit<
  OnboardingClickProps,
  | 'page_name'
  | 'area'
  | 'element'
  | 'action'
  | 'step_index'
  | 'step_name'
  | 'onboarding_session_id'
>>;

type OnboardingCompleteExtra = {
  readonly errorCode?: string;
  readonly hasDesignSystemRequest?: boolean;
  readonly sourceCount?: number;
};

export type OnboardingAnalytics = {
  readonly clearSession: () => void;
  readonly emitAboutYouSubmit: () => void;
  readonly emitClick: (
    element: TrackingOnboardingClickElement,
    action: TrackingOnboardingClickAction,
    extra?: OnboardingClickExtra,
  ) => void;
  readonly emitComplete: (
    result: TrackingOnboardingCompletionResult,
    completionType: TrackingOnboardingCompletionType,
    extra?: OnboardingCompleteExtra,
  ) => void;
  readonly getProfile: () => OnboardingProfileAnalytics;
};

function onboardingStepInfo(step: number): {
  readonly area: TrackingOnboardingArea;
  readonly stepIndex: TrackingOnboardingStepIndex;
  readonly stepName: TrackingOnboardingStepName;
} {
  if (step === 0) return { area: 'runtime', stepIndex: '1', stepName: 'connect' };
  if (step === 1) return { area: 'about_you', stepIndex: '2', stepName: 'about_you' };
  if (step === 2) return { area: 'newsletter', stepIndex: '3', stepName: 'newsletter' };
  return { area: 'design_system', stepIndex: '4', stepName: 'design_system' };
}

function onboardingRuntimeType(
  runtime: 'amr' | 'local' | 'byok' | null,
): TrackingOnboardingRuntimeType {
  if (runtime === 'amr') return 'amr_cloud';
  if (runtime === 'local') return 'local_cli';
  if (runtime === 'byok') return 'byok';
  return 'none';
}

function hasAboutYouProfile(profile: OnboardingProfileAnalytics): boolean {
  return Boolean(
    profile.role ||
      profile.orgSize ||
      profile.useCase.length > 0 ||
      profile.source,
  );
}

function aboutYouFields(profile: OnboardingProfileAnalytics): Pick<
  OnboardingCompleteResultProps,
  'role' | 'organization_size' | 'use_cases' | 'discovery_source'
> {
  return {
    role: profile.role || 'unknown',
    organization_size: profile.orgSize || 'unknown',
    use_cases: profile.useCase.length > 0 ? [...profile.useCase] : ['unknown'],
    discovery_source: profile.source || 'unknown',
  };
}

function trackPageView(track: AnalyticsTrack, props: OnboardingPageViewProps): void {
  track('page_view', { ...props });
}

function trackOnboardingClick(track: AnalyticsTrack, props: OnboardingClickProps): void {
  track('ui_click', { ...props });
}

function trackOnboardingComplete(
  track: AnalyticsTrack,
  props: OnboardingCompleteResultProps,
): void {
  track('onboarding_complete_result', { ...props });
}

export function useOnboardingAnalytics({
  profile,
  runtime,
  step,
  track,
}: {
  readonly profile: OnboardingProfileAnalytics;
  readonly runtime: 'amr' | 'local' | 'byok' | null;
  readonly step: number;
  readonly track: AnalyticsTrack;
}): OnboardingAnalytics {
  const sessionIdRef = useRef<string>('');
  const startedAtRef = useRef<number>(Date.now());
  const lifecycleReportedRef = useRef(false);
  const aboutYouReportedRef = useRef(false);
  const profileRef = useRef(profile);

  if (!sessionIdRef.current) {
    sessionIdRef.current = getOrCreateOnboardingSessionId();
  }

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const info = onboardingStepInfo(step);
    trackPageView(track, {
      page_name: 'onboarding',
      area: info.area,
      step_index: info.stepIndex,
      step_name: info.stepName,
      onboarding_session_id: sessionId,
    });
  }, [step, track]);

  const clearSession = useCallback(() => {
    clearOnboardingSessionId();
  }, []);

  const getProfile = useCallback(() => profileRef.current, []);

  const emitClick = useCallback<OnboardingAnalytics['emitClick']>(
    (element, action, extra = {}) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const info = onboardingStepInfo(step);
      trackOnboardingClick(track, {
        page_name: 'onboarding',
        area: info.area,
        element,
        action,
        step_index: info.stepIndex,
        step_name: info.stepName,
        onboarding_session_id: sessionId,
        ...extra,
      });
    },
    [step, track],
  );

  const emitAboutYouSubmit = useCallback(() => {
    if (aboutYouReportedRef.current) return;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    aboutYouReportedRef.current = true;
    const snapshot = profileRef.current;
    trackOnboardingClick(track, {
      page_name: 'onboarding',
      area: 'about_you',
      element: 'about_you_submit',
      action: 'continue',
      step_index: '2',
      step_name: 'about_you',
      onboarding_session_id: sessionId,
      ...aboutYouFields(snapshot),
    });
  }, [track]);

  const emitComplete = useCallback<OnboardingAnalytics['emitComplete']>(
    (result, completionType, extra = {}) => {
      if (lifecycleReportedRef.current) return;
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      lifecycleReportedRef.current = true;
      const info = onboardingStepInfo(step);
      const snapshot = profileRef.current;
      const hasAboutYou = hasAboutYouProfile(snapshot);
      trackOnboardingComplete(track, {
        page_name: 'onboarding',
        area: 'onboarding',
        result,
        exit_step_name: info.stepName,
        completion_type: completionType,
        runtime_type: onboardingRuntimeType(runtime),
        has_about_you: hasAboutYou,
        has_design_system_request: extra.hasDesignSystemRequest ?? false,
        source_count: extra.sourceCount ?? 0,
        ...(extra.errorCode ? { error_code: extra.errorCode } : {}),
        duration_ms: Math.max(0, Date.now() - startedAtRef.current),
        onboarding_session_id: sessionId,
        ...(hasAboutYou ? aboutYouFields(snapshot) : {}),
      });
    },
    [runtime, step, track],
  );

  return {
    clearSession,
    emitAboutYouSubmit,
    emitClick,
    emitComplete,
    getProfile,
  };
}
