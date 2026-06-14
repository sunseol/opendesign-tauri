import { describe, expect, it } from 'vitest';
import type { AnalyticsEventPayload } from '../src/analytics/events.js';

describe('analytics event family contract', () => {
  it('accepts representative interaction payloads for product funnels', () => {
    const payloads = [
      {
        event: 'page_view',
        props: {
          page_name: 'design_systems',
          area: 'design_system_create',
          view_type: 'page',
          entry_from: 'home_card',
          available_design_system_count: 3,
        },
      },
      {
        event: 'ui_click',
        props: {
          page_name: 'plugins',
          area: 'import_modal',
          element: 'import',
          import_source: 'github',
        },
      },
      {
        event: 'ui_click',
        props: {
          page_name: 'chat_panel',
          area: 'questions_form',
          element: 'submit',
          answered_count: 2,
          skipped_count: 1,
          form_id: 'discovery',
          project_id: 'proj-1',
        },
      },
      {
        event: 'ui_click',
        props: {
          page_name: 'file_manager',
          area: 'reference_board',
          element: 'category_chip',
          category_id: 'systems',
          project_id: 'proj-1',
        },
      },
      {
        event: 'ui_click',
        props: {
          page_name: 'file_manager',
          area: 'tab_launcher',
          element: 'open_file',
          file_kind: 'design-files',
          project_id: 'proj-1',
        },
      },
      {
        event: 'ui_click',
        props: {
          page_name: 'artifact',
          area: 'handoff',
          element: 'copy_cli_prompt',
          target_id: 'codex',
          target_available: true,
          handoff_tab: 'cli',
          framework: 'react',
          artifact_id: 'artifact-1',
          artifact_kind: 'html',
        },
      },
      {
        event: 'surface_view',
        props: {
          page_name: 'file_manager',
          area: 'reference_board',
          project_id: 'proj-1',
        },
      },
    ] satisfies AnalyticsEventPayload[];

    expect(payloads.map((payload) => payload.event)).toEqual([
      'page_view',
      'ui_click',
      'ui_click',
      'ui_click',
      'ui_click',
      'ui_click',
      'surface_view',
    ]);
  });

  it('accepts representative result payloads for issue 31 event families', () => {
    const payloads = [
      {
        event: 'plugin_import_result',
        props: {
          page_name: 'plugins',
          area: 'import_modal',
          import_source: 'folder',
          result: 'success',
        },
      },
      {
        event: 'file_upload_result',
        props: {
          page_name: 'design_systems',
          area: 'design_system_source',
          source_type: 'fig',
          design_system_id: 'ds-1',
          file_count: 2,
          file_type: 'folder',
          file_size_bucket: '10_100mb',
          result: 'success',
          duration_ms: 42,
        },
      },
      {
        event: 'feedback_submit_result',
        props: {
          page_name: 'chat_panel',
          area: 'chat_panel',
          element: 'assistant_feedback_reason_submit',
          action: 'submit_feedback_reason',
          project_id: 'proj-1',
          project_kind: 'prototype',
          conversation_id: 'conv-1',
          assistant_message_id: 'msg-1',
          run_id: 'run-1',
          model_id: 'default',
          agent_provider_id: 'codex_cli',
          rating: 'negative',
          reason: 'missed_request',
          reason_count: 1,
          has_custom_reason: true,
          custom_reason: 'Button should be easier to find.',
          result: 'success',
        },
      },
      {
        event: 'amr_auth_result',
        props: {
          page_name: 'onboarding',
          area: 'amr_auth',
          result: 'success',
          duration_ms: 1500,
          entry_id: 'entry-1',
          source_detail: 'onboarding_amr_card',
        },
      },
      {
        event: 'onboarding_complete_result',
        props: {
          page_name: 'onboarding',
          area: 'onboarding',
          result: 'completed',
          exit_step_name: 'about_you',
          completion_type: 'completed_without_design_system',
          runtime_type: 'amr_cloud',
          has_about_you: true,
          has_design_system_request: false,
          source_count: 0,
          duration_ms: 10_000,
          onboarding_session_id: 'onboarding-1',
          role: 'designer',
          organization_size: '2_10',
          use_cases: ['prototype'],
          discovery_source: 'search',
        },
      },
      {
        event: 'design_system_source_ingest_result',
        props: {
          page_name: 'design_systems',
          area: 'design_system_create',
          entry_from: 'design_systems_page',
          source_type: 'local_code',
          ingest_method: 'local_snapshot',
          result: 'partial_success',
          has_fallback: true,
          fallback_type: 'manual_upload',
          repo_host: 'unknown',
          file_count: 128,
          folder_file_count_bucket: '51_200',
          total_size_bucket: '10_50mb',
          duration_ms: 3000,
          design_system_id: 'ds-1',
        },
      },
      {
        event: 'design_system_apply_result',
        props: {
          page_name: 'studio',
          area: 'design_system_picker',
          action: 'apply_to_run',
          result: 'success',
          target_project_kind: 'hyperframes',
          design_system_id: 'ds-1',
          design_system_source: 'official_preset',
          design_system_status: 'ready',
          design_system_applied: true,
          design_system_selection_mode: 'manual',
          is_default: false,
          is_auto_selected: false,
          available_design_system_count: 4,
          run_id: 'run-1',
          duration_ms: 25,
        },
      },
    ] satisfies AnalyticsEventPayload[];

    expect(payloads.map((payload) => payload.event)).toContain('design_system_apply_result');
    expect(payloads).toHaveLength(7);
  });
});
