/**
 * File Preview API
 * Serves local files for preview (HTML only for security)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, realpathSync } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Determine content type from extension
  const ext = path.extname(filePath).toLowerCase();
  const ALLOWED_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/plain',
    '.csv': 'text/plain',
    '.log': 'text/plain',
  };

  const contentType = ALLOWED_TYPES[ext];
  if (!contentType) {
    return NextResponse.json(
      { error: `File type '${ext}' not supported for preview. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}` },
      { status: 400 }
    );
  }

  // Expand tilde and normalize
  const expandedPath = filePath.replace(/^~/, process.env.HOME || '');
  const normalizedPath = path.normalize(expandedPath);

  // Security check - only allow paths from environment config
  const allowedPaths = [
    process.env.WORKSPACE_BASE_PATH?.replace(/^~/, process.env.HOME || ''),
    process.env.PROJECTS_PATH?.replace(/^~/, process.env.HOME || ''),
  ].filter(Boolean) as string[];

  if (!existsSync(normalizedPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Resolve symlinks to real path before checking allowlist
  let resolvedPath: string;
  try {
    resolvedPath = realpathSync(normalizedPath);
  } catch {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const isAllowed = allowedPaths.some(allowed => {
    try {
      const resolvedBase = realpathSync(path.normalize(allowed));
      return resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    console.warn(`[SECURITY] Path traversal attempt blocked in preview: ${normalizedPath} -> ${resolvedPath}`);
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('[FILE] Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
