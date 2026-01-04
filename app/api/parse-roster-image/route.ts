import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { matchPlayerNames } from '@/lib/player-matcher';
import { sleeper } from '@/lib/providers/sleeper';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ROSTER_EXTRACTION_PROMPT = `You are analyzing a fantasy football roster screenshot. Extract ALL player names visible in the image.

Instructions:
1. Look for player names in the roster/lineup area
2. Include players from all positions (QB, RB, WR, TE, K, DEF, FLEX, BENCH, IR)
3. Return ONLY the player names, one per line
4. Use the full name as shown (e.g., "Patrick Mahomes" not just "Mahomes")
5. If a nickname or abbreviation is shown, include it as-is
6. Ignore team names, positions, and other metadata
7. If you cannot identify any players, respond with "NO_PLAYERS_FOUND"

Common platforms you might see:
- Sleeper: Dark interface with player cards
- ESPN: Light/dark mode with player rows
- Yahoo: Player list with profile photos
- NFL Fantasy: Official NFL styling

Output format - just the names, one per line:
Patrick Mahomes
Saquon Barkley
Ja'Marr Chase
...`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Determine media type
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: ROSTER_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Failed to extract player names from image' },
        { status: 500 }
      );
    }

    const extractedText = textContent.text.trim();

    // Check if no players found
    if (extractedText === 'NO_PLAYERS_FOUND' || extractedText.length === 0) {
      return NextResponse.json({
        success: true,
        extractedNames: [],
        matchedPlayers: [],
        notMatched: [],
        message: 'No player names could be identified in the image. Please try a clearer screenshot.',
      });
    }

    // Parse the extracted names
    const extractedNames = extractedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('-') && !line.startsWith('*'));

    // Match names to our player database
    const matchResults = await matchPlayerNames(extractedNames);

    // Separate matched and unmatched
    const matchedPlayers: Array<{
      name: string;
      id: string;
      extractedAs: string;
      confidence: number;
      matchType: string;
    }> = [];

    const notMatched: Array<{
      extractedName: string;
      reason: string;
    }> = [];

    for (const result of matchResults) {
      if (result.matchedId && result.matchedName) {
        // Get full player info
        const playerInfo = await sleeper.getPlayer(result.matchedId);
        matchedPlayers.push({
          name: result.matchedName,
          id: result.matchedId,
          extractedAs: result.extractedName,
          confidence: result.confidence,
          matchType: result.matchType,
        });
      } else {
        notMatched.push({
          extractedName: result.extractedName,
          reason: 'Could not find matching player in database',
        });
      }
    }

    return NextResponse.json({
      success: true,
      extractedNames,
      matchedPlayers,
      notMatched,
      message: `Found ${matchedPlayers.length} players from screenshot`,
    });
  } catch (error) {
    console.error('Error parsing roster image:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process image. Please try again.' },
      { status: 500 }
    );
  }
}
