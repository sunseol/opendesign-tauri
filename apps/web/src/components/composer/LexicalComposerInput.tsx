'use client';

import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { mergeRegister } from '@lexical/utils';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  PASTE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
} from 'react';

import {
  buildInlineMentionParts,
  type InlineMentionEntity,
} from '../../utils/inlineMentions';

export interface ComposerTriggerState {
  mention: { q: string } | null;
  slash: { q: string } | null;
}

export interface MentionInsert {
  token: string;
  entity: InlineMentionEntity;
}

export interface LexicalComposerInputProps {
  draft: string;
  placeholder: string;
  knownEntities: InlineMentionEntity[];
  onChange(plainText: string, present: InlineMentionEntity[]): void;
  onTrigger(state: ComposerTriggerState): void;
  onEnterSend(): void;
  onPasteFiles?: (files: File[]) => void;
  popoverOpen: boolean;
  onPopoverKey(key: 'ArrowDown' | 'ArrowUp' | 'Tab' | 'Enter' | 'Escape'): boolean;
  title?: string;
  testId?: string;
}

export interface LexicalComposerInputHandle {
  getText(): string;
  setText(text: string): void;
  clear(): void;
  focus(): void;
  insertText(text: string): void;
  insertMention(insert: MentionInsert): void;
  replaceActiveTrigger(text: string): void;
}

const EDITOR_THEME = {
  paragraph: 'composer-editor-paragraph',
};

function serializeNode(node: LexicalNode): string {
  if ($isLineBreakNode(node)) return '\n';
  return node.getTextContent();
}

function serializeEditorText(): string {
  const blocks: string[] = [];
  for (const block of $getRoot().getChildren()) {
    if (!$isParagraphNode(block)) {
      blocks.push(block.getTextContent());
      continue;
    }
    blocks.push(block.getChildren().map(serializeNode).join(''));
  }
  return blocks.join('\n');
}

function setEditorText(text: string): void {
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  root.append(paragraph);

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) paragraph.append($createLineBreakNode());
    if (line) paragraph.append($createTextNode(line));
  });
  paragraph.selectEnd();
}

function previousTextOnLine(node: TextNode, offset: number): string {
  let text = node.getTextContent().slice(0, offset);
  let previous = node.getPreviousSibling();
  while (previous && !$isLineBreakNode(previous)) {
    text = previous.getTextContent() + text;
    previous = previous.getPreviousSibling();
  }
  return text;
}

function activeTriggerPrefix(selection: RangeSelection): string | null {
  const node = selection.anchor.getNode();
  if (!$isTextNode(node)) return null;
  return previousTextOnLine(node, selection.anchor.offset);
}

function replaceActiveTriggerInSelection(selection: RangeSelection, text: string): boolean {
  const node = selection.anchor.getNode();
  if (!$isTextNode(node)) return false;
  const offset = selection.anchor.offset;
  const before = node.getTextContent().slice(0, offset);
  const match = /(^|\s)[@/][^\s@/]*$/.exec(before);
  if (!match) return false;
  const token = match[0].replace(/^\s+/, '');
  const start = offset - token.length;
  if (start < 0) return false;
  node.spliceText(start, token.length, text, true);
  return true;
}

function readPresentEntities(
  text: string,
  knownEntities: InlineMentionEntity[],
): InlineMentionEntity[] {
  const parts = buildInlineMentionParts(text, knownEntities, {
    highlightUnknown: false,
  });
  if (!parts) return [];
  const present: InlineMentionEntity[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.kind !== 'mention' || part.entity.kind === 'unknown') continue;
    const key = `${part.entity.kind}:${part.entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    present.push(part.entity);
  }
  return present;
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef]);
  return null;
}

function OnChangePlugin({
  knownEntities,
  onChange,
}: {
  knownEntities: InlineMentionEntity[];
  onChange: LexicalComposerInputProps['onChange'];
}) {
  const [editor] = useLexicalComposerContext();
  const knownRef = useRef(knownEntities);
  const onChangeRef = useRef(onChange);
  knownRef.current = knownEntities;
  onChangeRef.current = onChange;

  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      editorState.read(() => {
        const text = serializeEditorText();
        onChangeRef.current(text, readPresentEntities(text, knownRef.current));
      });
    });
  }, [editor]);
  return null;
}

function TriggerPlugin({
  onTrigger,
}: {
  onTrigger: LexicalComposerInputProps['onTrigger'];
}) {
  const [editor] = useLexicalComposerContext();
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          onTriggerRef.current({ mention: null, slash: null });
          return;
        }
        const before = activeTriggerPrefix(selection);
        if (before === null) {
          onTriggerRef.current({ mention: null, slash: null });
          return;
        }
        const mention = /(^|\s)@([^\s@]*)$/.exec(before);
        const slash = /^\/([^\s/]*)$/.exec(before);
        onTriggerRef.current({
          mention: mention ? { q: mention[2] ?? '' } : null,
          slash: slash ? { q: slash[1] ?? '' } : null,
        });
      });
    });
  }, [editor]);
  return null;
}

function KeyboardPlugin({
  onEnterSend,
  onPopoverKey,
  popoverOpen,
}: {
  onEnterSend: () => void;
  onPopoverKey: LexicalComposerInputProps['onPopoverKey'];
  popoverOpen: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const onEnterSendRef = useRef(onEnterSend);
  const onPopoverKeyRef = useRef(onPopoverKey);
  const popoverOpenRef = useRef(popoverOpen);
  onEnterSendRef.current = onEnterSend;
  onPopoverKeyRef.current = onPopoverKey;
  popoverOpenRef.current = popoverOpen;

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event: KeyboardEvent | null) => {
          if (editor.isComposing()) return false;
          if (event?.shiftKey) {
            event.preventDefault();
            editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
            return true;
          }
          if (popoverOpenRef.current) {
            event?.preventDefault();
            return onPopoverKeyRef.current('Enter');
          }
          event?.preventDefault();
          onEnterSendRef.current();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!popoverOpenRef.current || editor.isComposing()) return false;
          event?.preventDefault();
          return onPopoverKeyRef.current('ArrowDown');
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!popoverOpenRef.current || editor.isComposing()) return false;
          event?.preventDefault();
          return onPopoverKeyRef.current('ArrowUp');
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (!popoverOpenRef.current || editor.isComposing()) return false;
          event?.preventDefault();
          return onPopoverKeyRef.current('Tab');
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (!popoverOpenRef.current) return false;
          return onPopoverKeyRef.current('Escape');
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);
  return null;
}

function PastePlugin({
  onPasteFiles,
}: {
  onPasteFiles?: (files: File[]) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const onPasteFilesRef = useRef(onPasteFiles);
  onPasteFilesRef.current = onPasteFiles;

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        onPasteFilesRef.current?.(files);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}

function SeedingPlugin({
  draft,
}: {
  draft: string;
}) {
  const [editor] = useLexicalComposerContext();
  const lastSeeded = useRef<string | null>(null);

  useEffect(() => {
    const current = editor.getEditorState().read(serializeEditorText);
    if (draft === current || draft === lastSeeded.current) return;
    lastSeeded.current = draft;
    editor.update(setEditorText.bind(null, draft), { discrete: true });
  }, [draft, editor]);
  return null;
}

export const LexicalComposerInput = forwardRef<
  LexicalComposerInputHandle,
  LexicalComposerInputProps
>(function LexicalComposerInput(
  {
    draft,
    knownEntities,
    onChange,
    onEnterSend,
    onPasteFiles,
    onPopoverKey,
    onTrigger,
    placeholder,
    popoverOpen,
    testId = 'chat-composer-input',
    title,
  },
  ref,
) {
  const editorRef = useRef<LexicalEditor | null>(null);

  const initialConfig: InitialConfigType = {
    namespace: 'chat-composer',
    editable: true,
    nodes: [],
    theme: EDITOR_THEME,
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[composer-lexical]', error);
      }
    },
  };

  useImperativeHandle(
    ref,
    (): LexicalComposerInputHandle => ({
      getText() {
        const editor = editorRef.current;
        return editor ? editor.getEditorState().read(serializeEditorText) : '';
      },
      setText(text: string) {
        editorRef.current?.update(setEditorText.bind(null, text), { discrete: true });
      },
      clear() {
        editorRef.current?.update(setEditorText.bind(null, ''), { discrete: true });
      },
      focus() {
        editorRef.current?.focus();
      },
      insertText(text: string) {
        editorRef.current?.update(
          () => {
            let selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              $getRoot().selectEnd();
              selection = $getSelection();
            }
            if ($isRangeSelection(selection)) selection.insertText(text);
          },
          { discrete: true },
        );
      },
      insertMention(insert: MentionInsert) {
        editorRef.current?.update(
          () => {
            let selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              $getRoot().selectEnd();
              selection = $getSelection();
            }
            if (!$isRangeSelection(selection)) return;
            const inserted = replaceActiveTriggerInSelection(selection, `${insert.token} `);
            if (!inserted) selection.insertText(`${insert.token} `);
          },
          { discrete: true },
        );
      },
      replaceActiveTrigger(text: string) {
        editorRef.current?.update(
          () => {
            let selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              $getRoot().selectEnd();
              selection = $getSelection();
            }
            if (!$isRangeSelection(selection)) return;
            const replaced = replaceActiveTriggerInSelection(selection, text);
            if (!replaced) selection.insertText(text);
          },
          { discrete: true },
        );
      },
    }),
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="composer-input-editor">
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={placeholder}
              aria-multiline="true"
              aria-placeholder={placeholder}
              className="ph-no-capture composer-editable"
              data-testid={testId}
              placeholder={<div className="composer-input-placeholder">{placeholder}</div>}
              role="textbox"
              spellCheck={false}
              title={title ?? placeholder}
            />
          }
          placeholder={<div className="composer-input-placeholder">{placeholder}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <EditorRefPlugin editorRef={editorRef} />
      <OnChangePlugin knownEntities={knownEntities} onChange={onChange} />
      <TriggerPlugin onTrigger={onTrigger} />
      <KeyboardPlugin
        onEnterSend={onEnterSend}
        onPopoverKey={onPopoverKey}
        popoverOpen={popoverOpen}
      />
      <PastePlugin onPasteFiles={onPasteFiles} />
      <SeedingPlugin draft={draft} />
    </LexicalComposer>
  );
});
