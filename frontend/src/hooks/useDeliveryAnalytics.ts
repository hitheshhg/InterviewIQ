import { useState, useMemo } from 'react';

export interface FillerWordMatch {
  word: string;
  count: number;
}

export interface DeliveryMetrics {
  totalWords: number;
  fillerCount: number;
  fillerWords: FillerWordMatch[];
  wpm: number;
  pacingStatus: 'slow' | 'ideal' | 'fast';
  fillerRating: 'crisp' | 'moderate' | 'high';
  eyeContactScore: number;
  postureStatus: 'attentive' | 'stable' | 'fidgeting';
}

const COMMON_FILLER_WORDS = [
  'um',
  'uh',
  'uhh',
  'er',
  'ah',
  'like',
  'basically',
  'actually',
  'literally',
  'you know',
  'sort of',
  'kind of',
  'i mean',
];

export const useDeliveryAnalytics = (
  transcript: string,
  durationSeconds: number
) => {
  const [eyeContactEvents, setEyeContactEvents] = useState<number[]>([]);
  const [postureEvents, setPostureEvents] = useState<'attentive' | 'stable' | 'fidgeting'>('attentive');

  // Compute text-based speech metrics: words, WPM, and filler density
  const textMetrics = useMemo(() => {
    const cleanText = transcript.toLowerCase().trim();
    if (!cleanText) {
      return {
        totalWords: 0,
        fillerCount: 0,
        fillerWords: [],
        wpm: 0,
        pacingStatus: 'ideal' as const,
        fillerRating: 'crisp' as const,
      };
    }

    const words = cleanText.split(/\s+/).filter(Boolean);
    const totalWords = words.length;

    // Detect filler words with regex word boundaries
    const detectedFillers: Record<string, number> = {};
    let fillerCount = 0;

    for (const filler of COMMON_FILLER_WORDS) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = cleanText.match(regex);
      if (matches && matches.length > 0) {
        detectedFillers[filler] = matches.length;
        fillerCount += matches.length;
      }
    }

    const fillerWords: FillerWordMatch[] = Object.entries(detectedFillers).map(
      ([word, count]) => ({ word, count })
    );

    // Calculate Words Per Minute (WPM)
    const minutes = Math.max(durationSeconds / 60, 0.1);
    const calculatedWpm = Math.round(totalWords / minutes);
    const wpm = Math.min(Math.max(calculatedWpm, 0), 250);

    let pacingStatus: 'slow' | 'ideal' | 'fast' = 'ideal';
    if (wpm < 110) pacingStatus = 'slow';
    else if (wpm > 175) pacingStatus = 'fast';

    let fillerRating: 'crisp' | 'moderate' | 'high' = 'crisp';
    if (fillerCount >= 6) fillerRating = 'high';
    else if (fillerCount >= 3) fillerRating = 'moderate';

    return {
      totalWords,
      fillerCount,
      fillerWords,
      wpm,
      pacingStatus,
      fillerRating,
    };
  }, [transcript, durationSeconds]);

  // Record an eye contact sample (0 to 100)
  const recordEyeContact = (score: number) => {
    setEyeContactEvents((prev) => {
      const next = [...prev, score];
      if (next.length > 60) next.shift(); // Keep rolling window of last 60 ticks
      return next;
    });
  };

  const updatePosture = (posture: 'attentive' | 'stable' | 'fidgeting') => {
    setPostureEvents(posture);
  };

  // Average rolling eye contact percentage
  const eyeContactScore = useMemo(() => {
    if (eyeContactEvents.length === 0) return 85; // Natural baseline
    const sum = eyeContactEvents.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / eyeContactEvents.length);
  }, [eyeContactEvents]);

  const metrics: DeliveryMetrics = {
    ...textMetrics,
    eyeContactScore,
    postureStatus: postureEvents,
  };

  return {
    metrics,
    recordEyeContact,
    updatePosture,
  };
};

export default useDeliveryAnalytics;
