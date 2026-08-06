import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { preprocessAiMarkdown } from '@/src/lib/aiMarkdown';
import { colors, radius, spacing } from '@/src/theme';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type Props = {
  content: string;
  streaming?: boolean;
  /** User bubbles use inverted colors */
  inverted?: boolean;
};

function CodeBlock({ language, value }: { language?: string; value: string }) {
  const isMath = language === 'math' || language === 'latex' || language === 'equation';
  const label = isMath ? 'Equation' : language || 'Code';

  return (
    <View style={[styles.codeWrap, isMath && styles.mathWrap]}>
      <View style={[styles.codeLangBar, isMath && styles.mathLangBar]}>
        <Text style={[styles.codeLang, isMath && styles.mathLang]}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <Text style={[styles.codeBody, isMath && styles.mathBody]} selectable>
          {value.replace(/\n$/, '')}
        </Text>
      </ScrollView>
    </View>
  );
}

export function AiMarkdown({ content, streaming = false, inverted = false }: Props) {
  const prepared = useMemo(() => preprocessAiMarkdown(content || ''), [content]);

  if (!content) {
    return streaming ? <Text style={styles.body}>…</Text> : null;
  }

  const mdStyles = inverted ? invertedMarkdownStyles : markdownStyles;

  return (
    <View>
      <Markdown
        style={mdStyles}
        rules={{
          fence: (node, _children, _parent, styles) => {
            const lang = (node as { sourceInfo?: string }).sourceInfo || '';
            const value = typeof node.content === 'string' ? node.content : '';
            return (
              <View key={node.key} style={styles.fence}>
                <CodeBlock language={lang} value={value} />
              </View>
            );
          },
          code_block: (node, _children, _parent, styles) => {
            const value = typeof node.content === 'string' ? node.content : '';
            return (
              <View key={node.key} style={styles.code_block}>
                <CodeBlock value={value} />
              </View>
            );
          },
          code_inline: (node, _children, _parent, styles) => (
            <Text key={node.key} style={styles.code_inline}>
              {node.content}
            </Text>
          ),
        }}
      >
        {prepared}
      </Markdown>
      {streaming ? <Text style={styles.cursor}>▍</Text> : null}
    </View>
  );
}

const baseBody = {
  fontSize: 15,
  lineHeight: 23,
  color: colors.text,
} as const;

const markdownStyles = StyleSheet.create({
  body: baseBody,
  paragraph: {
    ...baseBody,
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 8, marginTop: 4 },
  heading2: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 6, marginTop: 4 },
  heading3: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4, marginTop: 2 },
  strong: { fontWeight: '800', color: colors.ink },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  bullet_list_icon: { color: colors.teal, fontSize: 16, lineHeight: 23 },
  ordered_list_icon: { color: colors.brand, fontWeight: '700' },
  blockquote: {
    backgroundColor: colors.tealSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 8,
    borderRadius: radius.sm,
  },
  code_inline: {
    fontFamily: mono,
    fontSize: 13,
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandBorder,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  fence: { marginVertical: 8 },
  code_block: { marginVertical: 8 },
  link: { color: colors.teal, fontWeight: '700', textDecorationLine: 'underline' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginVertical: 8 },
  thead: { backgroundColor: colors.brandSoft },
  th: { padding: 8, fontWeight: '800', color: colors.ink },
  td: { padding: 8, borderTopWidth: 1, borderColor: colors.border },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 10 },
});

const invertedMarkdownStyles = StyleSheet.create({
  ...markdownStyles,
  body: { ...baseBody, color: '#fff' },
  paragraph: { ...baseBody, color: '#fff', marginTop: 0, marginBottom: 8 },
  heading1: { ...markdownStyles.heading1, color: '#fff' },
  heading2: { ...markdownStyles.heading2, color: '#fff' },
  heading3: { ...markdownStyles.heading3, color: '#fff' },
  strong: { fontWeight: '800', color: '#fff' },
  code_inline: {
    ...markdownStyles.code_inline,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  link: { color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
});

const styles = StyleSheet.create({
  body: baseBody,
  cursor: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 16,
  },
  codeWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  mathWrap: {
    backgroundColor: '#ecfdf5',
    borderColor: '#99f6e4',
  },
  codeLangBar: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: '#1e293b',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  mathLangBar: {
    backgroundColor: '#ccfbf1',
    borderBottomColor: '#99f6e4',
  },
  codeLang: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  mathLang: {
    color: '#0f766e',
  },
  codeBody: {
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 20,
    color: '#e2e8f0',
    padding: spacing.sm,
    minWidth: '100%',
  },
  mathBody: {
    fontFamily: mono,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '700',
    color: '#134e4a',
    padding: spacing.md,
  },
});
