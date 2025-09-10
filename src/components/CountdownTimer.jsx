import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ endTime, startTime, isStartCountdown = false, showSeconds = false }) => {
  const calculateTimeLeft = () => {
    const targetTime = isStartCountdown ? startTime : endTime;
    const difference = +new Date(targetTime) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    // Update every second if showSeconds is true, every minute otherwise
    const interval = showSeconds ? 1000 : 60000;
    
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, interval);

    return () => clearTimeout(timer);
  });

  const formatTime = () => {
    const parts = [];
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
    parts.push(`${String(timeLeft.minutes || 0).padStart(2, '0')}m`);
    
    // Only show seconds if showSeconds prop is true
    if (showSeconds) {
      parts.push(`${String(timeLeft.seconds || 0).padStart(2, '0')}s`);
    }
    
    return parts.join(' ');
  };

  return (
    <div className="countdown-timer" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '0.95rem',
      fontWeight: '500',
      whiteSpace: 'nowrap'
    }}>
      {Object.keys(timeLeft).length > 0 ? (
        <span style={{ color: 'white' }}>
          {isStartCountdown ? 'Starts in: ' : 'Ends in: '}
          <strong>{formatTime()}</strong>
        </span>
      ) : (
        <span style={{ color: 'white' }}>{isStartCountdown ? 'Round has started!' : 'Round has ended.'}</span>
      )}
    </div>
  );
};

export default CountdownTimer;