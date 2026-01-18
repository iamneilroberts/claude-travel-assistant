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
    .manage { background: white; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); margin-bottom: 20px; }
    .status-message { color: #1a5f7a; font-weight: 600; margin-bottom: 12px; }
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
    <div id="manageSection" class="manage" style="display:none;">
      <p id="statusMessage" class="status-message"></p>
      <button class="btn btn-primary" onclick="openPortal()">Manage Subscription</button>
    </div>
    <div class="plans">
      <div class="plan featured">
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
        <button class="btn btn-primary" onclick="subscribe('starter')">Start Free Trial</button>
      </div>
    </div>
    <div class="footer">
      <p>Questions? <a href="mailto:support@voygent.app">Contact us</a></p>
    </div>
  </div>
  <script>
    const userId = '${userId || ''}';
    const promoCode = '${promo || ''}';
    const plansEl = document.querySelector('.plans');
    const manageSection = document.getElementById('manageSection');
    const statusMessage = document.getElementById('statusMessage');

    function formatTier(tier) {
      if (!tier) return 'your plan';
      return tier.charAt(0).toUpperCase() + tier.slice(1);
    }

    async function openPortal() {
      if (!userId) {
        alert('User ID is required. Please use the link from your welcome email.');
        return;
      }
      try {
        const response = await fetch('/api/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await response.json();
        if (data.portalUrl) {
          window.location.href = data.portalUrl;
        } else {
          alert(data.error || 'Failed to open billing portal');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    async function loadSubscriptionStatus() {
      if (!userId) return;
      try {
        const response = await fetch('/api/subscription?userId=' + encodeURIComponent(userId));
        if (!response.ok) return;
        const data = await response.json();
        const activeStatuses = ['active', 'trialing', 'past_due'];
        if (activeStatuses.includes(data.status)) {
          manageSection.style.display = 'block';
          plansEl.style.display = 'none';
          statusMessage.textContent = 'You are currently on the ' + formatTier(data.tier) + ' plan (' + data.status + ').';
        }
      } catch (err) {
        console.warn('Failed to load subscription status:', err);
      }
    }

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
    loadSubscriptionStatus();
  </script>
</body>
</html>`;
}

/**
 * Generate dynamic success page with onboarding checklist
 */
export function getSubscribeSuccessHtml(mcpUrl?: string): string {
  const configJson = JSON.stringify({
    mcpServers: {
      voygent: {
        command: "npx",
        args: ["-y", "mcp-remote", mcpUrl || "https://voygent.somotravel.workers.dev?key=YOUR_KEY"]
      }
    }
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Voygent!</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #27ae60 0%, #1e8449 100%); min-height: 100vh; padding: 2rem; }
    .container { max-width: 600px; margin: 0 auto; }
    .card { background: white; border-radius: 16px; padding: 2.5rem; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .icon { font-size: 64px; margin-bottom: 1rem; }
    h1 { color: #27ae60; margin-bottom: 0.5rem; font-size: 1.75rem; }
    .subtitle { color: #666; margin-bottom: 2rem; line-height: 1.6; }

    /* Checklist */
    .checklist { list-style: none; text-align: left; margin: 2rem 0; }
    .checklist li {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem; margin: 0.5rem 0;
      background: #f8f9fa; border-radius: 8px;
    }
    .checklist .step-icon {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #e9ecef; font-weight: bold; flex-shrink: 0;
    }
    .checklist .done .step-icon { background: #28a745; color: white; }
    .checklist .step-text { flex: 1; }
    .checklist .step-link { color: #1a5f7a; font-weight: 500; }

    /* Config Box */
    .config-section { text-align: left; margin-top: 2rem; }
    .config-section h3 { font-size: 1rem; margin-bottom: 0.5rem; color: #333; }
    .config-section p { font-size: 0.875rem; color: #666; margin-bottom: 0.75rem; }
    .config-box {
      background: #1e1e1e; color: #d4d4d4; padding: 1rem;
      border-radius: 8px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem;
      overflow-x: auto; position: relative; text-align: left;
      white-space: pre;
    }
    .copy-btn {
      position: absolute; top: 0.5rem; right: 0.5rem;
      background: #333; border: none; color: white;
      padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer;
      font-size: 0.75rem; transition: background 0.2s;
    }
    .copy-btn:hover { background: #444; }
    .copy-btn.copied { background: #28a745; }

    /* Buttons */
    .btn { display: inline-block; padding: 14px 32px; background: #1a5f7a; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 1.5rem; }
    .btn:hover { background: #145068; }

    /* Path hint */
    .path-hint { font-size: 0.75rem; color: #888; margin-top: 0.5rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">&#127881;</div>
      <h1>Welcome to Voygent!</h1>
      <p class="subtitle">Your 30-day free trial has started. Follow these steps to get started:</p>

      <ul class="checklist">
        <li class="done">
          <span class="step-icon">&#10003;</span>
          <span class="step-text">Subscription activated</span>
        </li>
        <li>
          <span class="step-icon">1</span>
          <span class="step-text">
            Install Claude Desktop
            <a href="https://claude.ai/download" target="_blank" class="step-link">Download &rarr;</a>
          </span>
        </li>
        <li>
          <span class="step-icon">2</span>
          <span class="step-text">Add Voygent MCP server (see below)</span>
        </li>
        <li>
          <span class="step-icon">3</span>
          <span class="step-text">Create your first trip</span>
        </li>
        <li>
          <span class="step-icon">4</span>
          <span class="step-text">Publish to your website</span>
        </li>
      </ul>

      <div class="config-section">
        <h3>Step 2: Add to Claude Desktop</h3>
        <p>Add this to your Claude Desktop config file:</p>
        <div class="config-box">
          <button class="copy-btn" onclick="copyConfig(this)">Copy</button>${configJson}</div>
        <p class="path-hint">
          Config location:<br>
          Mac: ~/Library/Application Support/Claude/claude_desktop_config.json<br>
          Windows: %APPDATA%\\Claude\\claude_desktop_config.json
        </p>
      </div>

      <a href="https://claude.ai" class="btn" target="_blank">Open Claude to Start Planning &rarr;</a>
    </div>
  </div>
  <script>
    function copyConfig(btn) {
      const config = ${JSON.stringify(configJson)};
      navigator.clipboard.writeText(config).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// Keep for backwards compatibility
export const SUBSCRIBE_SUCCESS_HTML = getSubscribeSuccessHtml();
