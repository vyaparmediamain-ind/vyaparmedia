/**
 * Enterprise Web Application Firewall (WAF) Pattern Matching Engine
 * Used by Next.js Edge Middleware and Security Verification Tests
 */

export const SUSPICIOUS_WAF_PATTERNS: RegExp[] = [
  // Scanners & vulnerability exploitation tools
  /\b(?:sqlmap|nikto|nmap|masscan|dirbuster|gobuster|wpscan|wp-scan|acunetix|nessus|qualys|zgrab)\b/i,
  /\/wp-(?:admin|login\.php)\b/i,
  /\/phpmyadmin\b/i,
  /\.env\b/i,
  /\.git\b/i,
  /\.aws\b/i,

  // Path traversal / LFI
  /\.\.[/\\]/,
  /%2e%2e/i,
  /%252e/i,
  /\/etc\/(?:passwd|shadow)/i,
  /\b(?:boot\.ini|win\.ini)\b/i,
  /\/proc\/self\//i,

  // SQL Injection
  /\bunion(?:\s|%20|\+)+(?:all(?:\s|%20|\+)+)?select\b/i,
  /\b(?:sleep|pg_sleep)\s*\(/i,
  /\bbenchmark\s*\(/i,
  /\bwaitfor\s+delay\b/i,
  /\bxp_cmdshell\b/i,
  /\binformation_schema\b/i,
  /\bload_file\s*\(/i,
  /\binto\s+outfile\b/i,
  /\bor\s+1\s*=\s*1\b/i,
  /'\s*or\s+'1'\s*=\s*'1/i,
  /;\s*--/i,

  // Remote Code Execution / XSS
  /<script\b/i,
  /\$\{jndi:/i,
  /\b(?:eval|system|passthru|shell_exec|base64_decode)\s*\(/i,
];

/**
 * Returns true if the request fingerprint matches any WAF-blocked pattern.
 */
export function checkWafPatterns(requestFingerprint: string): boolean {
  return SUSPICIOUS_WAF_PATTERNS.some((pattern) => pattern.test(requestFingerprint));
}
