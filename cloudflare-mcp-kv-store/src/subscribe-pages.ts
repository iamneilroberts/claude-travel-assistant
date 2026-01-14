/**
 * Subscription-related HTML pages
 */

export function getSubscribePageHtml(
  userId: string | null,
  promo: string | null,
  canceled: string | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscribe to Voygent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a5f7a 0%, #0d3d4d 100%); min-height: 100vh; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; color: white; margin-bottom: 40px; }
    .header h1 { font-size: 36px; margin-bottom: 10px; }
    .header p { font-size: 18px; opacity: 0.9; }
    .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .plan { background: white; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); transition: transform 0.2s; }
    .plan:hover { transform: translateY(-5px); }
    .plan.featured { border: 3px solid #e67e22; position: relative; }
    .plan.featured::before { content: 'Most Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #e67e22; color: white; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .plan h2 { font-size: 24px; margin-bottom: 10px; color: #1a5f7a; }
    .plan .price { font-size: 48px; font-weight: 700; color: #333; margin: 15px 0; }
    .plan .price span { font-size: 16px; color: #666; font-weight: normal; }
    .plan .limit { color: #666; margin-bottom: 20px; font-size: 14px; }
    .plan ul { list-style: none; text-align: left; margin: 20px 0; }
    .plan li { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .plan li::before { content: '\\2713'; color: #27ae60; margin-right: 10px; font-weight: bold; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; font-size: 16px; transition: all 0.2s; }
    .btn-primary { background: #1a5f7a; color: white; }
    .btn-primary:hover { background: #145068; }
    .btn-secondary { background: #eee; color: #333; }
    .trial-badge { background: #d4edda; color: #155724; padding: 8px 16px; border-radius: 20px; font-size: 13px; margin-bottom: 20px; display: inline-block; }
    .alert { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .footer { text-align: center; color: rgba(255,255,255,0.7); margin-top: 40px; font-size: 14px; }
    .footer a { color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Choose Your Voygent Plan</h1>
      <p>Start with a 30-day free trial. No credit card required.</p>
    </div>
    ${canceled ? '<div class="alert">Checkout was canceled. Feel free to try again when you are ready.</div>' : ''}
    <div class="plans">
      <div class="plan">
        <h2>Starter</h2>
        <div class="trial-badge">30-day free trial</div>
        <div class="price">$29<span>/month</span></div>
        <div class="limit">10 proposals per month</div>
        <ul>
          <li>AI-powered trip planning</li>
          <li>Beautiful published proposals</li>
          <li>Client feedback system</li>
          <li>Email support</li>
        </ul>
        <button class="btn btn-secondary" onclick="subscribe('starter')">Start Free Trial</button>
      </div>
      <div class="plan featured">
        <h2>Professional</h2>
        <div class="trial-badge">30-day free trial</div>
        <div class="price">$79<span>/month</span></div>
        <div class="limit">50 proposals per month</div>
        <ul>
          <li>Everything in Starter</li>
          <li>Custom branding</li>
          <li>Priority support</li>
          <li>Advanced analytics</li>
        </ul>
        <button class="btn btn-primary" onclick="subscribe('professional')">Start Free Trial</button>
      </div>
      <div class="plan">
        <h2>Agency</h2>
        <div class="trial-badge">30-day free trial</div>
        <div class="price">$199<span>/month</span></div>
        <div class="limit">Unlimited proposals</div>
        <ul>
          <li>Everything in Professional</li>
          <li>Unlimited publishing</li>
          <li>White-label options</li>
          <li>Dedicated support</li>
        </ul>
        <button class="btn btn-secondary" onclick="subscribe('agency')">Start Free Trial</button>
      </div>
    </div>
    <div class="footer">
      <p>Questions? <a href="mailto:support@voygent.app">Contact us</a></p>
    </div>
  </div>
  <script>
    const userId = '${userId || ''}';
    const promoCode = '${promo || ''}';
    async function subscribe(tier) {
      if (!userId) {
        alert('User ID is required. Please use the link from your welcome email.');
        return;
      }
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, tier, promoCode: promoCode || undefined })
        });
        const data = await response.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert(data.error || 'Failed to start checkout');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

export const SUBSCRIBE_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Voygent!</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #27ae60 0%, #1e8449 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 16px; padding: 50px; text-align: center; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #27ae60; margin-bottom: 15px; }
    p { color: #666; margin-bottom: 25px; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 32px; background: #1a5f7a; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .btn:hover { background: #145068; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#127881;</div>
    <h1>Welcome to Voygent!</h1>
    <p>Your 30-day free trial has started. You now have full access to all features.</p>
    <p>Check your email for setup instructions, or start planning your first trip now!</p>
    <a href="https://claude.ai" class="btn">Open Claude to Start Planning</a>
  </div>
</body>
</html>`;
