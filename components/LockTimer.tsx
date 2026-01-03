'use client';

import { useState, useEffect } from 'react';

interface LockTimerProps {
  team: string | null;
  playerName?: string;
  className?: string;
  compact?: boolean;
}

interface LockInfo {
  lockTime: string | null;
  status: 'upcoming' | 'imminent' | 'locked' | 'bye' | 'no_team';
  opponent?: string;
  isHome?: boolean;
  injuryStatus?: string | null;
  resting?: {
    isResting: boolean;
    reason?: string;
  };
}

function formatTimeRemaining(lockTime: Date): string {
  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) return 'LOCKED';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    // Show day and time for games more than 24h away
    return `Locks ${lockTime.toLocaleDateString('en-US', { weekday: 'short' })} ${lockTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  if (hours >= 1) {
    return `Locks in ${hours}h ${minutes}m`;
  }

  return `Locks in ${minutes}m`;
}

export default function LockTimer({
  team,
  playerName,
  className = '',
  compact = false,
}: LockTimerProps) {
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch lock time
  useEffect(() => {
    if (!team && !playerName) {
      setLoading(false);
      return;
    }

    const fetchLockTime = async () => {
      try {
        const params = new URLSearchParams();
        if (team) params.set('team', team);
        if (playerName) params.set('player', playerName);

        const res = await fetch(`/api/locktime?${params}`);
        if (res.ok) {
          const data = await res.json();
          setLockInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch lock time:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLockTime();
  }, [team, playerName]);

  // Update countdown every second when imminent
  useEffect(() => {
    if (!lockInfo?.lockTime) return;

    const updateDisplay = () => {
      const lockTime = new Date(lockInfo.lockTime!);
      const now = new Date();
      const diff = lockTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeDisplay('LOCKED');
        setLockInfo(prev => prev ? { ...prev, status: 'locked' } : null);
      } else {
        setTimeDisplay(formatTimeRemaining(lockTime));
        // Check if we crossed into imminent status
        if (diff <= 60 * 60 * 1000 && lockInfo.status !== 'imminent') {
          setLockInfo(prev => prev ? { ...prev, status: 'imminent' } : null);
        }
      }
    };

    updateDisplay();

    // Update more frequently when close to lock
    const interval = lockInfo.status === 'imminent' ? 1000 : 60000;
    const timer = setInterval(updateDisplay, interval);

    return () => clearInterval(timer);
  }, [lockInfo?.lockTime, lockInfo?.status]);

  if (loading) {
    return compact ? null : (
      <span className={`text-zinc-600 text-xs ${className}`}>...</span>
    );
  }

  if (!lockInfo || !lockInfo.lockTime) {
    // Handle bye week or no team
    if (lockInfo?.status === 'bye') {
      return (
        <span className={`text-purple-400 text-xs uppercase ${className}`}>
          BYE WEEK
        </span>
      );
    }
    return null;
  }

  const getStatusColor = () => {
    switch (lockInfo.status) {
      case 'locked':
        return 'text-zinc-500 bg-zinc-800';
      case 'imminent':
        return 'text-red-400 bg-red-950/50 animate-pulse';
      default:
        return 'text-zinc-400 bg-zinc-800/50';
    }
  };

  // Resting warning takes priority
  if (lockInfo.resting?.isResting) {
    if (compact) {
      return (
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wide bg-purple-950/50 text-purple-400 ${className}`}>
          RESTING
        </span>
      );
    }
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="px-2 py-1 text-xs uppercase tracking-wide bg-purple-950/50 text-purple-400 border border-purple-800">
          {lockInfo.resting.reason || 'DNP - Resting'}
        </span>
        <span className="text-purple-400 text-xs">
          Do not start
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${getStatusColor()} ${className}`}>
        {lockInfo.status === 'locked' ? 'LOCKED' : timeDisplay.replace('Locks ', '')}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`px-2 py-1 text-xs uppercase tracking-wide ${getStatusColor()}`}>
        {timeDisplay}
      </span>
      {lockInfo.opponent && lockInfo.status !== 'locked' && (
        <span className="text-zinc-500 text-xs">
          {lockInfo.isHome ? 'vs' : '@'} {lockInfo.opponent}
        </span>
      )}
    </div>
  );
}
