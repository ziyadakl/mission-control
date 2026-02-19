/**
 * Task Test API
 * Runs automated browser tests on task deliverables
 * Called by the orchestrating LLM (master agent) to verify work before human review
 *
 * Enhanced validations:
 * - JavaScript console error detection
 * - CSS syntax validation (via css-tree)
 * - Link/resource validation (img src, script src, link href)
 * - URL deliverable support (HTTP test for dynamic, file:// for static)
 */

import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getSupabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import * as csstree from 'css-tree';
import type { Task, TaskDeliverable } from '@/lib/types';

interface CssValidationError {
  message: string;
  line?: number;
  column?: number;
}

interface ResourceError {
  type: 'image' | 'script' | 'stylesheet' | 'link' | 'other';
  url: string;
  error: string;
}

interface TestResult {
  passed: boolean;
  deliverable: {
    id: string;
    title: string;
    path: string;
    type: 'file' | 'url';
  };
  httpStatus: number | null;
  consoleErrors: string[];
  consoleWarnings: string[];
  cssErrors: CssValidationError[];
  resourceErrors: ResourceError[];
  screenshotPath: string | null;
  duration: number;
  error?: string;
}

interface TestResponse {
  taskId: string;
  taskTitle: string;
  passed: boolean;
  results: TestResult[];
  summary: string;
  testedAt: string;
  newStatus?: string;
}

// Screenshots stored in projects directory - set via PROJECTS_PATH env var
const SCREENSHOTS_DIR = ((process.env.PROJECTS_PATH || '~/projects').replace(/^~/, process.env.HOME || '')) + '/.screenshots';

/**
 * POST /api/tasks/[id]/test
 * Run automated browser tests on all deliverables for a task
 *
 * Enhanced workflow:
 * - Runs on tasks in 'testing' status (moved there after agent completion)
 * - PASS -> moves to 'review' for human approval
 * - FAIL -> moves to 'assigned' for agent to fix
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: taskId } = await params;
    const supabase = getSupabase();

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Error fetching task:', taskError);
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
    }
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get all deliverables (file and url types)
    const { data: deliverables, error: delError } = await supabase
      .from('task_deliverables')
      .select('*')
      .eq('task_id', taskId)
      .in('deliverable_type', ['file', 'url']);

    if (delError) {
      console.error('Error fetching deliverables:', delError);
      return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 });
    }

    if (!deliverables || deliverables.length === 0) {
      // Instead of returning 400 (which causes infinite heartbeat loop),
      // move to review with an alert so the user sees it
      const now = new Date().toISOString();

      const existingAlert = (task as any).alert_reason;
      const alertReason = existingAlert
        ? existingAlert  // preserve webhook's more detailed alert
        : 'No testable deliverables found — automated testing skipped.';

      await supabase
        .from('tasks')
        .update({ status: 'review', alert_reason: alertReason, updated_at: now })
        .eq('id', taskId);

      await supabase.from('task_activities').insert({
        id: uuidv4(),
        task_id: taskId,
        activity_type: 'status_changed',
        message: 'Moved to REVIEW — no testable deliverables, automated testing skipped',
        created_at: now,
      });

      return NextResponse.json({
        taskId,
        taskTitle: task.title,
        passed: false,
        results: [],
        summary: 'No testable deliverables found (file or url types) — moved to review with alert',
        testedAt: now,
        newStatus: 'review',
        warning: 'no_deliverables',
      });
    }

    // Ensure screenshots directory exists
    if (!existsSync(SCREENSHOTS_DIR)) {
      mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const results: TestResult[] = [];

    try {
      for (const deliverable of deliverables) {
        const result = await testDeliverable(browser, deliverable as TaskDeliverable, taskId);
        results.push(result);
      }
    } finally {
      await browser.close();
    }

    // Determine overall pass/fail
    const passed = results.every(r => r.passed);
    const failedCount = results.filter(r => !r.passed).length;

    // Build summary
    let summary: string;
    if (passed) {
      summary = `All ${results.length} deliverable(s) passed automated testing. No console errors, CSS errors, or broken resources detected.`;
    } else {
      const issues: string[] = [];
      for (const r of results.filter(r => !r.passed)) {
        const errorTypes: string[] = [];
        if (r.consoleErrors.length > 0) errorTypes.push(`${r.consoleErrors.length} JS errors`);
        if (r.cssErrors.length > 0) errorTypes.push(`${r.cssErrors.length} CSS errors`);
        if (r.resourceErrors.length > 0) errorTypes.push(`${r.resourceErrors.length} broken resources`);
        issues.push(`${r.deliverable.title}: ${errorTypes.join(', ')}`);
      }
      summary = `${failedCount}/${results.length} deliverable(s) failed. Issues: ${issues.join('; ')}`;
    }

    // Log activity
    const activityMessage = passed
      ? `Automated test passed - ${results.length} deliverable(s) verified, no issues found`
      : `Automated test failed - ${summary}`;

    const now = new Date().toISOString();

    const { error: activityError } = await supabase
      .from('task_activities')
      .insert({
        id: uuidv4(),
        task_id: taskId,
        activity_type: passed ? 'test_passed' : 'test_failed',
        message: activityMessage,
        metadata: { results: results.map(r => ({
          deliverable: r.deliverable.title,
          type: r.deliverable.type,
          passed: r.passed,
          consoleErrors: r.consoleErrors.length,
          cssErrors: r.cssErrors.length,
          resourceErrors: r.resourceErrors.length,
          screenshot: r.screenshotPath
        })) },
        created_at: now,
      });

    if (activityError) {
      console.error('Error logging test activity:', activityError);
    }

    // Update task status based on results
    let newStatus: string | undefined;

    if (passed) {
      // Tests passed -> move to review for human approval
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'review', updated_at: now })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating task status to review:', updateError);
      }
      newStatus = 'review';

      await supabase
        .from('task_activities')
        .insert({
          id: uuidv4(),
          task_id: taskId,
          activity_type: 'status_changed',
          message: 'Task moved to REVIEW - automated tests passed, awaiting human approval',
          created_at: now,
        });
    } else {
      // Tests failed -> move back to assigned for agent to fix
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'assigned', updated_at: now })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating task status to assigned:', updateError);
      }
      newStatus = 'assigned';

      await supabase
        .from('task_activities')
        .insert({
          id: uuidv4(),
          task_id: taskId,
          activity_type: 'status_changed',
          message: 'Task moved back to ASSIGNED due to failed automated tests - agent needs to fix issues',
          created_at: now,
        });
    }

    const response: TestResponse = {
      taskId,
      taskTitle: task.title,
      passed,
      results,
      summary,
      testedAt: new Date().toISOString(),
      newStatus
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate CSS syntax using css-tree
 */
function validateCss(css: string): CssValidationError[] {
  const errors: CssValidationError[] = [];

  try {
    csstree.parse(css, {
      parseAtrulePrelude: false,
      parseRulePrelude: false,
      parseValue: false,
      onParseError: (error) => {
        // SyntaxParseError has offset, rawMessage, formattedMessage
        // We can calculate line/column from offset if needed
        errors.push({
          message: error.rawMessage || error.message
        });
      }
    });
  } catch (error) {
    errors.push({
      message: `CSS parse error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return errors;
}

/**
 * Extract and validate inline CSS from HTML content
 */
function extractAndValidateCss(htmlContent: string): CssValidationError[] {
  const errors: CssValidationError[] = [];

  // Extract <style> tag contents
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;

  while ((match = styleRegex.exec(htmlContent)) !== null) {
    const cssContent = match[1];
    const cssErrors = validateCss(cssContent);
    errors.push(...cssErrors);
  }

  return errors;
}

/**
 * Determine if a URL is testable via HTTP (dynamic content) or should use file://
 */
function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Test a single deliverable
 */
async function testDeliverable(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  deliverable: TaskDeliverable,
  taskId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const resourceErrors: ResourceError[] = [];
  let cssErrors: CssValidationError[] = [];
  let httpStatus: number | null = null;
  let screenshotPath: string | null = null;

  const isUrlDeliverable = deliverable.deliverable_type === 'url';
  const testPath = deliverable.path || '';

  try {
    // For file deliverables, check file exists
    if (!isUrlDeliverable) {
      if (!testPath || !existsSync(testPath)) {
        return {
          passed: false,
          deliverable: {
            id: deliverable.id,
            title: deliverable.title,
            path: testPath || 'unknown',
            type: 'file'
          },
          httpStatus: null,
          consoleErrors: [`File does not exist: ${testPath}`],
          consoleWarnings: [],
          cssErrors: [],
          resourceErrors: [],
          screenshotPath: null,
          duration: Date.now() - startTime,
          error: 'File not found'
        };
      }

      // Skip non-HTML files for browser testing
      if (!testPath.endsWith('.html') && !testPath.endsWith('.htm')) {
        return {
          passed: true,
          deliverable: {
            id: deliverable.id,
            title: deliverable.title,
            path: testPath,
            type: 'file'
          },
          httpStatus: null,
          consoleErrors: [],
          consoleWarnings: [],
          cssErrors: [],
          resourceErrors: [],
          screenshotPath: null,
          duration: Date.now() - startTime,
          error: 'Skipped - not an HTML file'
        };
      }

      // Validate CSS in file before browser test
      const htmlContent = readFileSync(testPath, 'utf-8');
      cssErrors = extractAndValidateCss(htmlContent);
    }

    // For URL deliverables, determine test approach
    let testUrl: string;
    if (isUrlDeliverable) {
      if (isHttpUrl(testPath)) {
        // HTTP URL - test directly
        testUrl = testPath;
      } else {
        // Treat as file path
        if (!existsSync(testPath)) {
          return {
            passed: false,
            deliverable: {
              id: deliverable.id,
              title: deliverable.title,
              path: testPath,
              type: 'url'
            },
            httpStatus: null,
            consoleErrors: [`URL path does not exist: ${testPath}`],
            consoleWarnings: [],
            cssErrors: [],
            resourceErrors: [],
            screenshotPath: null,
            duration: Date.now() - startTime,
            error: 'Path not found'
          };
        }
        testUrl = `file://${testPath}`;
      }
    } else {
      testUrl = `file://${testPath}`;
    }

    const context = await browser.newContext();

    try {
      const page = await context.newPage();

      // Capture console messages
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        } else if (msg.type() === 'warning') {
          consoleWarnings.push(msg.text());
        }
      });

      // Capture page errors
      page.on('pageerror', error => {
        consoleErrors.push(`Page error: ${error.message}`);
      });

      // Capture failed resource requests
      page.on('requestfailed', request => {
        const url = request.url();
        const failure = request.failure();
        const resourceType = request.resourceType();

        let type: ResourceError['type'] = 'other';
        if (resourceType === 'image') type = 'image';
        else if (resourceType === 'script') type = 'script';
        else if (resourceType === 'stylesheet') type = 'stylesheet';
        else if (resourceType === 'document') type = 'link';

        resourceErrors.push({
          type,
          url,
          error: failure?.errorText || 'Request failed'
        });
      });

      // Load page
      const response = await page.goto(testUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      httpStatus = response?.status() || null;

      // For HTTP URLs, check for non-success status codes
      if (isHttpUrl(testUrl) && httpStatus && (httpStatus < 200 || httpStatus >= 400)) {
        consoleErrors.push(`HTTP error: Server returned status ${httpStatus}`);
      }

      // Wait a bit for any async JS to run
      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshotFilename = `${taskId}-${deliverable.id}-${Date.now()}.png`;
      screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } finally {
      await context.close();
    }

    // Determine pass/fail
    // Fail conditions: console errors, CSS errors, or resource loading errors
    const passed = consoleErrors.length === 0 && cssErrors.length === 0 && resourceErrors.length === 0;

    return {
      passed,
      deliverable: {
        id: deliverable.id,
        title: deliverable.title,
        path: testPath,
        type: isUrlDeliverable ? 'url' : 'file'
      },
      httpStatus,
      consoleErrors,
      consoleWarnings,
      cssErrors,
      resourceErrors,
      screenshotPath,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      passed: false,
      deliverable: {
        id: deliverable.id,
        title: deliverable.title,
        path: testPath || 'unknown',
        type: isUrlDeliverable ? 'url' : 'file'
      },
      httpStatus,
      consoleErrors: [...consoleErrors, `Test error: ${error}`],
      consoleWarnings,
      cssErrors,
      resourceErrors,
      screenshotPath,
      duration: Date.now() - startTime,
      error: String(error)
    };
  }
}

/**
 * GET /api/tasks/[id]/test
 * Get info about the test endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id: taskId } = await params;
  const supabase = getSupabase();

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    console.error('Error fetching task:', taskError);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const { data: deliverables, error: delError } = await supabase
    .from('task_deliverables')
    .select('*')
    .eq('task_id', taskId)
    .in('deliverable_type', ['file', 'url']);

  if (delError) {
    console.error('Error fetching deliverables:', delError);
    return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 });
  }

  const allDeliverables = (deliverables ?? []) as TaskDeliverable[];
  const fileDeliverables = allDeliverables.filter(d => d.deliverable_type === 'file');
  const urlDeliverables = allDeliverables.filter(d => d.deliverable_type === 'url');

  return NextResponse.json({
    taskId,
    taskTitle: task.title,
    taskStatus: task.status,
    deliverableCount: allDeliverables.length,
    testableFiles: fileDeliverables
      .filter(d => d.path?.endsWith('.html') || d.path?.endsWith('.htm'))
      .map(d => ({ id: d.id, title: d.title, path: d.path })),
    testableUrls: urlDeliverables.map(d => ({ id: d.id, title: d.title, path: d.path })),
    validations: [
      'JavaScript console error detection',
      'CSS syntax validation (via css-tree)',
      'Resource loading validation (images, scripts, stylesheets)',
      'HTTP status code validation (for URL deliverables)'
    ],
    workflow: {
      expectedStatus: 'testing',
      onPass: 'Moves to review for human approval',
      onFail: 'Moves to assigned for agent to fix issues'
    },
    usage: {
      method: 'POST',
      description: 'Run automated browser tests on all HTML/URL deliverables',
      returns: 'Test results with pass/fail, console errors, CSS errors, resource errors, and screenshots'
    }
  });
  } catch (error) {
    console.error('Failed to get test info:', error);
    return NextResponse.json({ error: 'Failed to get test info' }, { status: 500 });
  }
}
