/**
 * Sanitize HTML content for safe rendering.
 * Removes script tags, event handlers, and dangerous attributes
 * while preserving safe HTML, CSS, and data attributes.
 */
export function sanitizeHtml(html: string): string {
  // Remove all <script> tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove <script> tags without closing tags
  sanitized = sanitized.replace(/<script\b[^>]*\/?>/gi, "");

  // Remove all on* event handler attributes (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove javascript: protocol in href/src/action attributes
  sanitized = sanitized.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');

  // Remove data: protocol in src attributes (except for images)
  sanitized = sanitized.replace(/src\s*=\s*(?:"data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi, 'src=""');

  // Remove <iframe> tags (potential for clickjacking)
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<iframe\b[^>]*\/?>/gi, "");

  // Remove <object> and <embed> tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, "");

  // Remove <form> action attributes pointing to external URLs (keep forms for display)
  sanitized = sanitized.replace(/<form\b([^>]*)action\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')([^>]*)>/gi, '<form$1$2>');

  return sanitized;
}

/**
 * Extract just the <body> content from a full HTML document,
 * preserving the <style> from <head>.
 */
export function extractBodyContent(html: string): { styles: string; body: string } {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  const styles = styleMatch ? styleMatch.join("\n") : "";

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  return { styles, body };
}
