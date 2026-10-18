import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout from '../legal/LegalLayout';
import { business } from '../config/business';

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <div className="lg-card">
        <h2>Skepticall is free</h2>
        <p>
          There is nothing to buy and nothing to refund today. We don’t take payments, there are no subscriptions or in-app
          purchases, and we hold no payment details. There are no hidden fees.
        </p>
      </div>

      <h2>If that changes</h2>
      <p>
        If we ever add paid features, we’ll publish the full terms before you’re asked to pay, including the price (with taxes), how
        billing works, how to cancel, and how refunds work, including any right you have by law to cancel a purchase within a set period.
        Nothing will be charged without your explicit action, and this page will be updated first.
      </p>

      <h2>Questions</h2>
      <p>
        {business.email ? <>Write to <a href={`mailto:${business.email}`}>{business.email}</a>.</> : <>Our contact details are listed below.</>}{' '}
        You can also read our <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalLayout>
  );
}
