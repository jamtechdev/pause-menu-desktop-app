import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PricingCard } from '../components/PricingCard';
import { EmailModal } from '../components/EmailModal';
import { apiService } from '../services/api';
import './Pricing.css';

export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Free',
      monthlyPrice: '$0',
      yearlyPrice: '$0',
      features: [
        'Basic features',
        'Limited documents',
        'Community support',
        'Personal use only',
      ],
    },
    {
      name: 'Pro',
      monthlyPrice: '$19.99',
      yearlyPrice: '$179.91', // 25% discount
      features: [
        'Unlimited documents',
        'Advanced analytics',
        'Custom branding',
        'Team collaboration',
        'Priority support',
        'API access',
        'All Pro features',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      monthlyPrice: '$49.99',
      yearlyPrice: '$449.91', // 25% discount
      features: [
        'Everything in Pro',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantee',
        'On-premise deployment',
        'Advanced security',
      ],
    },
  ];

  const handleSubscribe = (planName: string) => {
    if (planName === 'Free') {
      // Redirect to download page for free users
      navigate('/download');
      return;
    }

    // Show email modal for paid plans (Pro and Enterprise)
    setSelectedPlan(`${planName}-${billingPeriod}`);
    setShowEmailModal(true);
  };

  const handleEmailSubmit = async (email: string) => {
    if (!selectedPlan) return;

    setLoading(true);
    setError(null);
    setShowEmailModal(false);

    try {
      // Extract plan name and period from selectedPlan (format: "pro-monthly" or "pro-yearly")
      const [planName, period] = selectedPlan.split('-');
      const billingPeriod = (period as 'monthly' | 'yearly') || 'monthly';
      
      // Create checkout session with email and billing period
      const response = await apiService.createCheckoutSession(
        planName.toLowerCase(), 
        email,
        billingPeriod
      );
      
      if (response.success && response.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.url;
      } else {
        setError('Failed to create checkout session. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        <div className="pricing-header">
          <h1>Choose Your Plan</h1>
          <p>Start free, upgrade when you're ready. Cancel anytime.</p>
          
          {/* Billing Period Toggle */}
          <div className="billing-toggle">
            <span className={billingPeriod === 'monthly' ? 'active' : ''}>Monthly</span>
            <button
              className={`toggle-switch ${billingPeriod === 'yearly' ? 'yearly' : ''}`}
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              aria-label="Toggle billing period"
            >
              <span className="toggle-slider"></span>
            </button>
            <span className={billingPeriod === 'yearly' ? 'active' : ''}>
              Yearly
              <span className="savings-badge">Save 25%</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '32px',
            textAlign: 'center',
            color: '#fca5a5',
            fontSize: '14px',
          }}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
              Please make sure the backend server is running at {process.env.REACT_APP_API_URL || 'http://localhost:3000'}
            </div>
          </div>
        )}

        <div className="pricing-grid">
          {plans.map((plan, index) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const period = billingPeriod === 'monthly' ? 'month' : 'year';
            
            // Calculate monthly equivalent for yearly plans (25% discount)
            let monthlyEquivalent: string | null = null;
            if (billingPeriod === 'yearly' && plan.name !== 'Free') {
              const yearlyPrice = parseFloat(plan.yearlyPrice.replace('$', ''));
              const equivalent = (yearlyPrice / 12).toFixed(2);
              monthlyEquivalent = `$${equivalent}`;
            }
            
            return (
              <div 
                key={plan.name}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <PricingCard
                  name={plan.name}
                  price={price}
                  period={period}
                  monthlyEquivalent={monthlyEquivalent}
                  features={plan.features}
                  popular={plan.popular}
                  onSubscribe={() => handleSubscribe(plan.name)}
                />
              </div>
            );
          })}
        </div>

        <div className="pricing-footer">
          <p>All plans include a 14-day free trial. No credit card required for Free plan.</p>
          <p>Questions? <a href="mailto:support@letmesell.com">Contact support</a></p>
        </div>
      </div>

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setSelectedPlan(null);
        }}
        onSubmit={handleEmailSubmit}
        loading={loading}
      />
    </div>
  );
};

