import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ endTime }) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(endTime) - +new Date();
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
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const formatTime = () => {
    const parts = [];
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
    parts.push(`${String(timeLeft.minutes || 0).padStart(2, '0')}m`);
    parts.push(`${String(timeLeft.seconds || 0).padStart(2, '0')}s`);
    return parts.join(' ');
  };

  return (
    <div className="countdown-timer">
      {Object.keys(timeLeft).length > 0 ? (
        <span><strong>{formatTime()}</strong></span>
      ) : (
        <span>Round has ended.</span>
      )}
    </div>
  );
};

export default CountdownTimer;