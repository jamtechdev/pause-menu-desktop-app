import React from 'react';
import './PricingCard.css';

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  monthlyEquivalent?: string | null;
  features: string[];
  popular?: boolean;
  onSubscribe: () => void;
  currentPlan?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  name,
  price,
  period,
  monthlyEquivalent,
  features,
  popular = false,
  onSubscribe,
  currentPlan = false,
}) => {
  return (
    <div className={`pricing-card ${popular ? 'popular' : ''} ${currentPlan ? 'current' : ''}`}>
      {popular && <div className="popular-badge">Most Popular</div>}
      {currentPlan && <div className="current-badge">Current Plan</div>}
      
      <div className="pricing-header">
        <h3>{name}</h3>
        <div className="pricing-price">
          <span className="price">{price}</span>
          <span className="period">/{period}</span>
        </div>
        {monthlyEquivalent && (
          <div className="monthly-equivalent">
            ${monthlyEquivalent.replace('$', '')}/month billed annually
          </div>
        )}
      </div>

      <ul className="pricing-features">
        {features.map((feature, index) => (
          <li key={index}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16.667 5L7.5 14.167 3.333 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        className={`pricing-button ${currentPlan ? 'current-button' : ''}`}
        onClick={onSubscribe}
        disabled={currentPlan}
      >
        {currentPlan ? 'Current Plan' : 'Subscribe'}
      </button>
    </div>
  );
};

