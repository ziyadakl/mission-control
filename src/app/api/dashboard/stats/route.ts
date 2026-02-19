import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function GET() {
  try {
    const supabase = getSupabase();

    // Last 7 days of stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Failed to fetch daily stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Aggregate
    const today = new Date().toISOString().split('T')[0];
    const todayStats = (data || []).filter(d => d.date === today);
    const todayCost = todayStats.reduce((sum: number, d: { estimated_cost: string | number }) => sum + Number(d.estimated_cost), 0);
    const weekCost = (data || []).reduce((sum: number, d: { estimated_cost: string | number }) => sum + Number(d.estimated_cost), 0);
    const weekTokens = (data || []).reduce((sum: number, d: { total_tokens: number }) => sum + d.total_tokens, 0);

    // Daily breakdown for sparkline
    const daily = (data || []).map((d: { date: string; estimated_cost: string | number; total_tokens: number }) => ({
      date: d.date,
      cost: Number(d.estimated_cost),
      tokens: d.total_tokens,
    }));

    return NextResponse.json({
      todayCost,
      weekCost,
      weekTokens,
      daily,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
