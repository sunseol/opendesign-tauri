import { act } from 'react';
import { screen } from '@testing-library/react';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from 'lexical';

interface LexicalHost extends HTMLElement {
  __lexicalEditor?: LexicalEditor;
}

export async function flushComposerMount(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export function getComposerEditor(): LexicalEditor {
  const input = screen.getByTestId('chat-composer-input') as LexicalHost;
  const editor = input.__lexicalEditor;
  if (!editor) {
    throw new Error('chat-composer-input is not a mounted Lexical editor');
  }
  return editor;
}

export function typeInComposer(value: string, caret?: number): void {
  const editor = getComposerEditor();
  const lines = value.split('\n');
  const lastLine = lines.at(-1) ?? '';
  act(() => {
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        if (value.length === 0) {
          paragraph.select();
          return;
        }

        let lastText: ReturnType<typeof $createTextNode> | null = null;
        lines.forEach((line, index) => {
          if (index > 0) paragraph.append($createLineBreakNode());
          if (!line) return;
          const textNode = $createTextNode(line);
          paragraph.append(textNode);
          lastText = textNode;
        });
        if (lastText) {
          const textNode: ReturnType<typeof $createTextNode> = lastText;
          const position = Math.min(caret ?? lastLine.length, lastLine.length);
          textNode.select(position, position);
        } else {
          paragraph.selectEnd();
        }
      },
      { discrete: true },
    );
  });
}

export function composerText(): string {
  const input = screen.getByTestId('chat-composer-input');
  const paragraphs = input.querySelectorAll('p');
  if (paragraphs.length === 0) return input.textContent ?? '';
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    let line = '';
    paragraph.childNodes.forEach((node) => {
      line += node.nodeName === 'BR' ? '\n' : node.textContent ?? '';
    });
    lines.push(line);
  });
  return lines.join('\n');
}

export async function typeAndSettle(value: string, caret = value.length): Promise<void> {
  typeInComposer(value, caret);
  await act(async () => {
    await Promise.resolve();
  });
}

export function pressEnter(
  options: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
): void {
  const editor = getComposerEditor();
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    shiftKey: Boolean(options.shift),
    metaKey: Boolean(options.meta),
    ctrlKey: Boolean(options.ctrl),
    altKey: false,
  });
  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, event);
  });
}
