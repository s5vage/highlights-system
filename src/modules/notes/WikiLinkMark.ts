import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';

const wikiLinkInputRegex = /(?:^|\s)\[\[([^[\]]+)\]\]$/;

export const WikiLink = Mark.create({
  name: 'wikiLink',
  inclusive: false,

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-wiki-link': 'true', class: 'wiki-link' }),
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: wikiLinkInputRegex,
        type: this.type,
      }),
    ];
  },
});