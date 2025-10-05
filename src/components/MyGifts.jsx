
import React, { useState, useEffect } from 'react';

const MyGifts = () => {
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const response = await fetch('/api/subscriptions/gifts', {
          headers: {
            // Include authorization token if needed
          },
        });

        if (response.ok) {
          const data = await response.json();
          setGifts(data.giftSubscriptions);
        } else {
          console.error('Failed to fetch gifts');
        }
      } catch (error) {
        console.error('Error fetching gifts:', error);
      }
    };

    fetchGifts();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Gift code copied to clipboard!');
  };

  return (
    <div>
      <h2>My Gift Subscriptions</h2>
      {gifts.length === 0 ? (
        <p>You have no available gifts.</p>
      ) : (
        <div className="gifts-container">
          {gifts.map((gift) => (
            <div key={gift.id} className="gift-card">
              <p>Gift Code: <code>{gift.gift_code}</code></p>
              <button onClick={() => copyToClipboard(gift.gift_code)}>Copy Code</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyGifts;
