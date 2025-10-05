
import React, { useState, useEffect } from 'react';

const SubscriptionBundles = () => {
  const [bundles, setBundles] = useState([]);

  useEffect(() => {
    // Fetch bundles from the backend
    // This is a placeholder, you'll need to implement the actual API endpoint
    const fetchBundles = async () => {
      const mockBundles = [
        { id: 1, name: '3-Pack', quantity: 3, price: 56.70, discount: 10 },
        { id: 2, name: '5-Pack', quantity: 5, price: 84, discount: 20 }, // Discount is 20% ($21 off $105)
        { id: 3, name: '10-Pack', quantity: 10, price: 121, discount: 42 },
        { id: 4, name: '21-Pack', quantity: 21, price: 221, discount: 50 },
      ];
      setBundles(mockBundles);
    };

    fetchBundles();
  }, []);

  const handlePurchase = async (bundleId) => {
    try {
      const response = await fetch('/api/subscriptions/bundles/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include authorization token if needed
        },
        body: JSON.stringify({ bundleId }),
      });

      if (response.ok) {
        alert('Purchase successful!');
        // Optionally redirect to the My Gifts page
      } else {
        const errorData = await response.json();
        alert(`Purchase failed: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('An error occurred during purchase.');
    }
  };

  return (
    <div>
      <h2>Subscription Bundles</h2>
      <div className="bundles-container">
        {bundles.map((bundle) => (
          <div key={bundle.id} className="bundle-card">
            <h3>{bundle.name}</h3>
            <p>{bundle.quantity} Subscriptions</p>
            <p>{bundle.discount}% off</p>
            <p>Price: ${bundle.price}</p>
            <button onClick={() => handlePurchase(bundle.id)}>Purchase</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionBundles;
