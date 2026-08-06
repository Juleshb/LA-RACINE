/**
 * Turn common LaTeX / markdown-math into clearer text before rendering.
 * Keeps symbols readable on mobile without a full math engine.
 */

function simplifyLatex(raw: string): string {
  let s = raw.trim();

  const replaceAll = (input: string, pattern: RegExp, replacer: (m: RegExpMatchArray) => string) => {
    let out = input;
    let prev = '';
    while (out !== prev) {
      prev = out;
      out = out.replace(pattern, (...args) => {
        const m = args as unknown as RegExpMatchArray;
        return replacer(m);
      });
    }
    return out;
  };

  s = s.replace(/\\times/g, '×');
  s = s.replace(/\\cdot/g, '·');
  s = s.replace(/\\div/g, '÷');
  s = s.replace(/\\pm/g, '±');
  s = s.replace(/\\mp/g, '∓');
  s = s.replace(/\\leq|\\le\b/g, '≤');
  s = s.replace(/\\geq|\\ge\b/g, '≥');
  s = s.replace(/\\neq|\\ne\b/g, '≠');
  s = s.replace(/\\approx/g, '≈');
  s = s.replace(/\\infty/g, '∞');
  s = s.replace(/\\pi\b/g, 'π');
  s = s.replace(/\\theta/g, 'θ');
  s = s.replace(/\\alpha/g, 'α');
  s = s.replace(/\\beta/g, 'β');
  s = s.replace(/\\gamma/g, 'γ');
  s = s.replace(/\\delta/g, 'δ');
  s = s.replace(/\\lambda/g, 'λ');
  s = s.replace(/\\mu\b/g, 'μ');
  s = s.replace(/\\sigma/g, 'σ');
  s = s.replace(/\\omega/g, 'ω');
  s = s.replace(/\\degree/g, '°');
  s = s.replace(/\\%/g, '%');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\;/g, ' ');
  s = s.replace(/\\quad/g, '  ');
  s = s.replace(/\\qquad/g, '    ');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\{|\\}/g, '');

  s = replaceAll(s, /\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (m) => `(${m[1]})/(${m[2]})`);
  s = replaceAll(s, /\\sqrt\{([^{}]+)\}/g, (m) => `√(${m[1]})`);
  s = replaceAll(s, /\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, (m) => `${m[1]}√(${m[2]})`);
  s = replaceAll(s, /\\text\{([^{}]*)\}/g, (m) => m[1]);
  s = replaceAll(s, /\\mathrm\{([^{}]*)\}/g, (m) => m[1]);
  s = replaceAll(s, /\\mathbf\{([^{}]*)\}/g, (m) => m[1]);

  s = s.replace(/\^\{2\}|\^2\b/g, '²');
  s = s.replace(/\^\{3\}|\^3\b/g, '³');
  s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');
  s = s.replace(/_\{([^{}]+)\}/g, '_($1)');

  s = s.replace(/\\([a-zA-Z]+)/g, '$1');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/** Protect fenced code so we do not rewrite LaTeX inside source. */
function mapOutsideCode(content: string, map: (chunk: string) => string): string {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part;
      return map(part);
    })
    .join('');
}

/**
 * Normalize AI markdown so equations and code render clearly on mobile.
 */
export function preprocessAiMarkdown(content: string): string {
  if (!content) return '';

  return mapOutsideCode(content, (chunk) => {
    let s = chunk;

    // Display math → math fence
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => `\n\n\`\`\`math\n${simplifyLatex(eq)}\n\`\`\`\n\n`);
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, eq) => `\n\n\`\`\`math\n${simplifyLatex(eq)}\n\`\`\`\n\n`);

    // Inline math → inline code (readable)
    s = s.replace(/\\\((.+?)\\\)/g, (_, eq) => `\`${simplifyLatex(eq)}\``);
    s = s.replace(/\$([^$\n]+?)\$/g, (_, eq) => `\`${simplifyLatex(eq)}\``);

    // Bare LaTeX-ish lines that look like equations
    s = s.replace(/(^|\n)\s*(\\frac|\\sqrt|\\sum|\\int)([^\n]+)/g, (full, lead, cmd, rest) => {
      return `${lead}\`\`\`math\n${simplifyLatex(cmd + rest)}\n\`\`\``;
    });

    return s;
  });
}
