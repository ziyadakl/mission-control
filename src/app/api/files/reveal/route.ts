/**
 * File Reveal API
 * Opens a file's location in Finder (macOS) or Explorer (Windows)
 */

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    // Expand tilde
    const expandedPath = filePath.replace(/^~/, process.env.HOME || '');

    // Security: Ensure path is within allowed directories (from env config)
    const allowedPaths = [
      process.env.WORKSPACE_BASE_PATH?.replace(/^~/, process.env.HOME || ''),
      process.env.PROJECTS_PATH?.replace(/^~/, process.env.HOME || ''),
    ].filter(Boolean) as string[];

    const normalizedPath = path.normalize(expandedPath);
    const isAllowed = allowedPaths.some(allowed =>
      normalizedPath.startsWith(path.normalize(allowed))
    );

    if (!isAllowed) {
      console.warn(`[FILE] Blocked access to: ${filePath}`);
      return NextResponse.json(
        { error: 'Path not in allowed directories' },
        { status: 403 }
      );
    }

    // Check if file/directory exists
    if (!existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'File or directory not found', path: normalizedPath },
        { status: 404 }
      );
    }

    // Open in Finder (macOS) - reveal the file
    const platform = process.platform;

    if (platform === 'darwin') {
      await execFileAsync('open', ['-R', normalizedPath]);
    } else if (platform === 'win32') {
      await execFileAsync('explorer', ['/select,' + normalizedPath]);
    } else {
      // Linux - open containing folder
      await execFileAsync('xdg-open', [path.dirname(normalizedPath)]);
    }

    console.log(`[FILE] Revealed: ${normalizedPath}`);
    return NextResponse.json({ success: true, path: normalizedPath });
  } catch (error) {
    console.error('[FILE] Error revealing file:', error);
    return NextResponse.json(
      { error: 'Failed to reveal file' },
      { status: 500 }
    );
  }
}
