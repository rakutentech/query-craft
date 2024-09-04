// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
export async function GET() {
  try {
    return NextResponse.json({status: 200});
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}