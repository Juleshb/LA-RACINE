import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownCode({ className, children, ...props }) {
  const text = String(children ?? '').replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className || '')?.[1] || '';
  const isBlock = Boolean(className) || text.includes('\n');

  if (!isBlock) {
    return <code className="ai-md-inline-code" {...props}>{text}</code>;
  }

  return (
    <div className="ai-md-codeblock">
      {lang ? <div className="ai-md-code-lang">{lang}</div> : null}
      <pre>
        <code className={className} {...props}>{text}</code>
      </pre>
    </div>
  );
}

export default function AiMarkdown({ content, streaming = false }) {
  if (!content) return null;

  return (
    <div className={`ai-md ${streaming ? 'is-streaming' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: MarkdownCode,
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
          table: ({ children }) => (
            <div className="ai-md-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming ? <span className="ai-tutor-cursor" aria-hidden /> : null}
    </div>
  );
}
