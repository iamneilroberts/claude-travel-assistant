/**
 * Admin Dashboard HTML
 * Single-page app for managing users, trips, and support
 */

export const ADMIN_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voygent Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #161b22; color: #c9d1d9; }
    .header { background: linear-gradient(135deg, #238636 0%, #1a7f37 100%); color: white; padding: 20px 30px; }
    .header h1 { font-size: 24px; font-weight: 600; }
    .header p { opacity: 0.8; margin-top: 5px; }
    .nav-tabs { display: flex; gap: 5px; margin-top: 15px; flex-wrap: wrap; }
    .nav-tab { padding: 8px 16px; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 14px; }
    .nav-tab.active { background: #0d1117; color: #f0f6fc; }
    .nav-tab.mission-control { background: rgba(34, 197, 94, 0.3); }
    .nav-tab.mission-control.active { background: #238636; color: white; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: #0d1117; border-radius: 8px; padding: 15px; border: 1px solid #30363d; }
    .stat-card .label { color: #8b949e; font-size: 12px; margin-bottom: 5px; }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #58a6ff; }
    .section { background: #0d1117; border-radius: 8px; padding: 20px; border: 1px solid #30363d; margin-bottom: 20px; }
    .section h2 { font-size: 16px; margin-bottom: 15px; color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #21262d; }
    th { background: #161b22; font-weight: 600; color: #8b949e; position: sticky; top: 0; }
    tr:hover { background: #161b22; }
    tr.clickable { cursor: pointer; }
    .btn { display: inline-block; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: 500; cursor: pointer; border: none; font-size: 13px; }
    .btn-primary { background: #238636; color: white; }
    .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
    .btn-small { padding: 3px 8px; font-size: 11px; }
    .btn-link { background: none; color: #58a6ff; padding: 0; text-decoration: underline; }
    .btn:hover { opacity: 0.9; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; font-size: 13px; color: #c9d1d9; }
    .form-group input, .form-group select { width: 100%; padding: 8px; border: 1px solid #30363d; border-radius: 6px; font-size: 13px; background: #0d1117; color: #c9d1d9; }
    .filter-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; align-items: center; }
    .filter-row select, .filter-row input { padding: 6px 10px; border: 1px solid #30363d; border-radius: 6px; font-size: 12px; background: #0d1117; color: #c9d1d9; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); justify-content: center; align-items: center; z-index: 1000; }
    .modal.active { display: flex; }
    .modal-content { background: #161b22; border-radius: 8px; padding: 25px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; border: 1px solid #30363d; color: #c9d1d9; }
    .modal-content.wide { max-width: 900px; }
    .modal-content h3 { margin-bottom: 20px; color: #f0f6fc; }
    .json-view { background: #0d1117; color: #c9d1d9; padding: 15px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 11px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; border: 1px solid #30363d; }
    .email-preview { background: #0d1117; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; color: #c9d1d9; border: 1px solid #30363d; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .badge-green { background: rgba(63,185,80,0.2); color: #3fb950; }
    .badge-red { background: rgba(248,81,73,0.2); color: #f85149; }
    .badge-yellow { background: rgba(210,153,34,0.2); color: #d29922; }
    .badge-blue { background: rgba(88,166,255,0.2); color: #58a6ff; }
    .badge-gray { background: rgba(139,148,158,0.2); color: #8b949e; }
    .comment-box { background: #0d1117; border-left: 3px solid #58a6ff; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .comment-meta { font-size: 11px; color: #8b949e; margin-bottom: 5px; }
    .link-external { color: #58a6ff; text-decoration: none; }
    .link-external:hover { text-decoration: underline; color: #79c0ff; }
    .loading { text-align: center; padding: 40px; color: #8b949e; }
    .error { background: rgba(248,81,73,0.15); color: #f85149; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(248,81,73,0.4); }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .detail-section { margin-bottom: 15px; }
    .detail-section h4 { font-size: 13px; color: #8b949e; margin-bottom: 8px; border-bottom: 1px solid #21262d; padding-bottom: 5px; }
    .detail-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .detail-row .label { color: #8b949e; }
    .icon { font-size: 14px; margin-right: 5px; }
    @media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }

    /* Action Dropdown Menu */
    .action-menu { position: relative; display: inline-block; }
    .action-menu-btn { background: #21262d; border: 1px solid #30363d; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; color: #c9d1d9; }
    .action-menu-btn:hover { background: #30363d; }
    .action-menu-content { display: none; position: absolute; right: 0; top: 100%; background: #161b22; min-width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); border-radius: 8px; z-index: 100; overflow: hidden; margin-top: 4px; border: 1px solid #30363d; }
    .action-menu.open .action-menu-content { display: block; }
    .action-menu-item { display: block; width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; font-size: 13px; cursor: pointer; color: #c9d1d9; }
    .action-menu-item:hover { background: #21262d; }
    .action-menu-item.danger { color: #f85149; }
    .action-menu-item.danger:hover { background: rgba(248,81,73,0.15); }
    .action-menu-divider { height: 1px; background: #21262d; margin: 4px 0; }
    .action-menu-header { padding: 8px 14px; font-size: 10px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Mission Control - Clean Dark Theme */
    .mission-control-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
    .mode-tabs { display: flex; gap: 4px; background: #1e293b; padding: 4px; border-radius: 8px; }
    .mode-tab { padding: 8px 18px; background: transparent; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: #94a3b8; transition: all 0.2s; }
    .mode-tab.active { background: #3b82f6; color: white; }
    .mode-tab:hover:not(.active) { background: #334155; color: #e2e8f0; }
    .auto-controls { display: flex; align-items: center; gap: 12px; }
    .toggle-label { font-size: 13px; color: #94a3b8; }
    .toggle { position: relative; width: 44px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #475569; border-radius: 24px; transition: .2s; }
    .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .2s; }
    .toggle input:checked + .toggle-slider { background: #10b981; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

    /* Activity Table - Mission Control Theme (muted, high-tech, readable) */
    .arrivals-board { background: #0d1117; border-radius: 6px; padding: 0; overflow: hidden; border: 1px solid #30363d; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    .board-header { display: flex; background: #161b22; color: #8b949e; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; padding: 12px 14px; border-bottom: 1px solid #30363d; }
    .board-rows { max-height: 550px; overflow-y: auto; }
    .board-rows::-webkit-scrollbar { width: 8px; }
    .board-rows::-webkit-scrollbar-track { background: #0d1117; }
    .board-rows::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
    .board-row { display: flex; padding: 10px 14px; border-bottom: 1px solid #21262d; color: #c9d1d9; font-size: 13px; align-items: center; transition: background 0.1s; }
    .board-row:hover { background: #161b22; }
    .board-row.new { animation: rowHighlight 0.6s ease-out; }
    .col-time { width: 80px; color: #8b949e; font-size: 12px; font-weight: 500; }
    .col-user { width: 120px; color: #f0f6fc; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .col-action { width: 90px; font-size: 12px; }
    .col-action span { display: inline-block; padding: 3px 8px; background: #21262d; border: 1px solid #30363d; border-radius: 4px; color: #c9d1d9; font-weight: 500; }
    .col-trip { width: 180px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-trip a { color: #58a6ff; text-decoration: none; }
    .col-trip a:hover { color: #79c0ff; text-decoration: underline; }
    .col-detail { flex: 1; color: #8b949e; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px; }
    .col-detail.error { color: #f85149; background: rgba(248,81,73,0.1); padding: 4px 8px; border-radius: 4px; }
    .col-dur { width: 65px; color: #8b949e; font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
    .col-status { width: 70px; text-align: right; font-size: 12px; font-weight: 600; }
    .status-ok { color: #3fb950; }
    .status-err { color: #f85149; cursor: pointer; }
    .status-err:hover { color: #ff7b72; }

    /* Age-based row styling - subtle fade */
    .board-row.fresh { background: rgba(46,160,67,0.08); }
    .board-row.fresh .col-time { color: #3fb950; }
    .board-row.recent { background: transparent; }
    .board-row.stale { }
    .board-row.stale .col-time { color: #6e7681; }
    .board-row.old { }
    .board-row.old .col-time, .board-row.old .col-user { color: #6e7681; }

    @keyframes slideIn {
      0% { transform: translateY(-10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes rowHighlight {
      0% { background: rgba(56,139,253,0.15); }
      100% { background: transparent; }
    }

    /* Stats Panel - Mission Control Cards */
    .stats-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .stats-panel .stat-card { background: #0d1117; border-radius: 6px; padding: 16px; border: 1px solid #30363d; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    .stats-panel .stat-card .label { color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }
    .stats-panel .stat-card .value { font-size: 28px; font-weight: 700; color: #f0f6fc; margin-top: 6px; }
    .stats-panel .stat-card .change { font-size: 12px; margin-top: 5px; }
    .stats-panel .stat-card .change.up { color: #3fb950; }
    .stats-panel .stat-card .change.down { color: #f85149; }

    /* Insights Panel */
    .insights-panel { background: #0d1117; border-radius: 8px; padding: 20px; border: 1px solid #30363d; }
    .health-score { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #21262d; }
    .health-score .score { font-size: 48px; font-weight: 700; }
    .health-score .score.good { color: #3fb950; }
    .health-score .score.warning { color: #d29922; }
    .health-score .score.bad { color: #f85149; }
    .health-score .label { color: #8b949e; font-size: 14px; }
    .recommendation { padding: 12px; border-radius: 8px; margin-bottom: 10px; }
    .recommendation.warning { background: rgba(210,153,34,0.15); border-left: 4px solid #d29922; }
    .recommendation.info { background: rgba(88,166,255,0.15); border-left: 4px solid #58a6ff; }
    .recommendation.success { background: rgba(63,185,80,0.15); border-left: 4px solid #3fb950; }
    .recommendation .title { font-weight: 600; margin-bottom: 4px; color: #f0f6fc; }
    .recommendation .message { font-size: 13px; color: #c9d1d9; }
    .recommendation .action { font-size: 12px; color: #8b949e; margin-top: 4px; font-style: italic; }

    /* Expandable Rows */
    .board-row.expandable { cursor: pointer; }
    .board-row-details { display: none; padding: 10px 14px; background: #161b22; border-bottom: 1px solid #30363d; font-size: 12px; }
    .board-row-details.expanded { display: flex; gap: 20px; flex-wrap: wrap; }
    .board-row-details .detail-item { color: #c9d1d9; }
    .board-row-details .detail-item .label { color: #8b949e; margin-right: 6px; }
    .board-row-details .detail-item .value { color: #f0f6fc; }
    .expand-indicator { color: #8b949e; font-size: 10px; margin-left: 6px; transition: transform 0.2s; }

    /* Slow Call Highlighting */
    .board-row.slow { background: rgba(210,153,34,0.1) !important; }
    .board-row.slow .col-dur { color: #d29922 !important; font-weight: 600; }
    .slow-badge { display: inline-block; background: #d29922; color: #0d1117; font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; }

    /* Mission Control Grid Layout */
    .mc-grid { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
    .mc-sidebar { display: flex; flex-direction: column; gap: 12px; }
    @media (max-width: 1200px) { .mc-grid { grid-template-columns: 1fr; } }

    /* Sidebar Panels - Mission Control */
    .heatmap-panel, .error-panel, .tool-panel, .size-panel { background: #0d1117; border-radius: 6px; padding: 14px; border: 1px solid #30363d; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    .heatmap-panel h4, .error-panel h4, .tool-panel h4, .size-panel h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #21262d; display: flex; justify-content: space-between; align-items: center; color: #8b949e; }
    .heatmap-panel h4 { color: #3fb950; }
    .error-panel h4 { color: #f85149; }
    .tool-panel h4 { color: #58a6ff; }
    .size-panel h4 { color: #a371f7; }

    /* Error Breakdown */
    .error-bar { display: flex; align-items: center; margin-bottom: 10px; gap: 8px; }
    .error-bar .error-info { width: 85px; flex-shrink: 0; }
    .error-bar .tool-name { display: block; font-size: 12px; color: #f0f6fc; font-weight: 600; line-height: 1.3; }
    .error-bar .error-type { display: block; font-size: 10px; color: #f85149; line-height: 1.3; text-transform: uppercase; }
    .error-bar .type { width: 85px; font-size: 11px; color: #8b949e; }
    .error-bar .bar-container { flex: 1; height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; }
    .error-bar .bar { height: 100%; border-radius: 4px; }
    .error-bar .bar.validation { background: #d29922; }
    .error-bar .bar.auth { background: #f85149; }
    .error-bar .bar.not_found { background: #a371f7; }
    .error-bar .bar.timeout { background: #58a6ff; }
    .error-bar .bar.rate_limit { background: #db61a2; }
    .error-bar .bar.unknown { background: #8b949e; }
    .error-bar .count { font-size: 13px; color: #f0f6fc; font-weight: 600; min-width: 28px; text-align: right; }

    /* Hourly Heatmap */
    .heatmap-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
    .heatmap-cell { aspect-ratio: 1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #f0f6fc; cursor: default; transition: transform 0.15s; }
    .heatmap-cell:hover { transform: scale(1.15); z-index: 1; }
    .heatmap-cell.level-0 { background: #161b22; color: #484f58; }
    .heatmap-cell.level-1 { background: #0e4429; }
    .heatmap-cell.level-2 { background: #006d32; }
    .heatmap-cell.level-3 { background: #26a641; }
    .heatmap-cell.level-4 { background: #39d353; }
    .heatmap-cell.level-5 { background: #39d353; }
    .heatmap-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: #8b949e; }

    /* Tool Distribution */
    .tool-bar { display: flex; align-items: center; margin-bottom: 8px; }
    .tool-bar .name { width: 75px; font-size: 12px; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .tool-bar .bar-container { flex: 1; height: 8px; background: #21262d; border-radius: 4px; margin: 0 8px; overflow: hidden; }
    .tool-bar .bar { height: 100%; background: #58a6ff; border-radius: 4px; }
    .tool-bar .count { font-size: 12px; color: #f0f6fc; font-weight: 600; min-width: 30px; text-align: right; }

    /* Response Size Distribution */
    .size-bar { display: flex; align-items: center; margin-bottom: 8px; }
    .size-bar .name { width: 75px; font-size: 12px; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .size-bar .bar-container { flex: 1; height: 8px; background: #21262d; border-radius: 4px; margin: 0 8px; overflow: hidden; }
    .size-bar .bar { height: 100%; background: #a371f7; border-radius: 4px; }
    .size-bar .size { font-size: 11px; color: #f0f6fc; font-weight: 600; min-width: 50px; text-align: right; }

    /* Recent Errors Panel */
    .recent-errors { background: #0d1117; border-radius: 6px; padding: 14px; border: 1px solid #30363d; max-height: 180px; overflow-y: auto; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    .recent-errors h4 { color: #f85149; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #21262d; display: flex; justify-content: space-between; align-items: center; }
    .recent-errors h4 .count-badge { background: #f85149; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .error-item { padding: 10px 12px; background: rgba(248,81,73,0.08); border-left: 3px solid #f85149; border-radius: 0 4px 4px 0; margin-bottom: 8px; }
    .error-item .error-header { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
    .error-item .error-type { color: #f85149; font-weight: 600; }
    .error-item .error-time { color: #8b949e; }
    .error-item .error-detail { font-size: 11px; color: #c9d1d9; }

    /* Enhanced Stats Cards */
    .stats-panel .stat-card.has-detail { cursor: pointer; transition: all 0.15s; }
    .stats-panel .stat-card.has-detail:hover { background: #161b22; border-color: #58a6ff; }
    .stat-card .sub-value { font-size: 11px; color: #8b949e; margin-top: 4px; }
    .stat-card .sub-value.highlight { color: #d29922; }

    /* ============ RESPONSIVE - TABLET ============ */
    @media (max-width: 1024px) {
      .mc-grid { grid-template-columns: 1fr; }
      .mc-sidebar { flex-direction: row; flex-wrap: wrap; }
      .mc-sidebar > * { flex: 1 1 200px; min-width: 200px; }
      .col-detail { display: none; }
      .col-trip { flex: 1; }
      .stats-panel { grid-template-columns: repeat(2, 1fr); }
    }

    /* ============ RESPONSIVE - MOBILE ============ */
    @media (max-width: 640px) {
      .container { padding: 12px; }

      /* Header adjustments */
      .mission-control-header { flex-direction: column; align-items: stretch; gap: 12px; }
      .mode-tabs { justify-content: center; }
      .auto-controls { justify-content: center; }

      /* Activity table - card-based layout on mobile */
      .arrivals-board { border-radius: 8px; }
      .board-header { display: none; }
      .board-rows { max-height: none; }
      .board-row {
        flex-wrap: wrap;
        padding: 12px;
        gap: 8px;
        position: relative;
      }
      .col-time {
        width: auto;
        order: 1;
        font-size: 11px;
      }
      .col-user {
        width: auto;
        flex: 1;
        order: 2;
        font-size: 13px;
      }
      .col-status {
        width: auto;
        order: 3;
        position: static;
      }
      .col-action {
        width: auto;
        order: 4;
      }
      .col-action span {
        padding: 4px 10px;
        font-size: 10px;
      }
      .col-trip {
        width: 100%;
        order: 5;
        font-size: 11px;
        padding-top: 4px;
      }
      .col-detail {
        width: 100%;
        order: 6;
        display: block;
        font-size: 11px;
        padding-top: 2px;
        color: #94a3b8;
      }
      .col-detail.error { color: #fca5a5; }
      .col-dur {
        display: none;
      }
      .slow-badge {
        position: absolute;
        top: 8px;
        right: 60px;
      }
      .expand-indicator { display: none; }

      /* Expandable details */
      .board-row-details.expanded {
        flex-direction: column;
        gap: 8px;
        padding: 12px;
      }

      /* Stats panel */
      .stats-panel {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 12px;
      }
      .stats-panel .stat-card {
        padding: 12px;
      }
      .stats-panel .stat-card .value {
        font-size: 22px;
      }
      .stats-panel .stat-card .label {
        font-size: 10px;
      }
      .stat-card .sub-value {
        font-size: 10px;
      }

      /* Sidebar panels */
      .mc-sidebar {
        flex-direction: column;
        gap: 10px;
      }
      .mc-sidebar > * {
        min-width: 100%;
      }
      .heatmap-panel, .error-panel, .tool-panel, .recent-errors {
        padding: 12px;
      }
      .heatmap-grid {
        gap: 2px;
      }
      .heatmap-cell {
        font-size: 8px;
      }
      .error-bar .type {
        width: 70px;
        font-size: 10px;
      }
      .tool-bar .name {
        width: 60px;
        font-size: 10px;
      }

      /* Recent errors */
      .recent-errors {
        max-height: 150px;
      }
      .error-item {
        padding: 8px 10px;
      }
      .error-item .error-header {
        flex-direction: column;
        gap: 2px;
      }
      .error-item .error-detail {
        font-size: 10px;
      }
    }

    /* ============ RESPONSIVE - SMALL MOBILE ============ */
    @media (max-width: 380px) {
      .mode-tabs {
        width: 100%;
      }
      .mode-tab {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
        text-align: center;
      }
      .stats-panel {
        grid-template-columns: 1fr 1fr;
      }
      .stats-panel .stat-card .value {
        font-size: 20px;
      }
      .col-user {
        font-size: 12px;
      }
      .col-action span {
        font-size: 9px;
        padding: 3px 6px;
      }
    }

    /* Touch-friendly adjustments */
    @media (hover: none) and (pointer: coarse) {
      .board-row {
        min-height: 44px;
      }
      .mode-tab {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .toggle {
        width: 50px;
        height: 28px;
      }
      .toggle-slider:before {
        height: 22px;
        width: 22px;
      }
      .toggle input:checked + .toggle-slider:before {
        transform: translateX(22px);
      }
      .heatmap-cell:hover {
        transform: none;
      }
      .status-err {
        padding: 4px 8px;
        margin: -4px -8px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Voygent Admin Dashboard</h1>
    <p>Manage users, trips, and support</p>
    <div class="nav-tabs">
      <button class="nav-tab mission-control" onclick="showTab('missioncontrol')">Mission Control</button>
      <button class="nav-tab active" onclick="showTab('overview')">Overview</button>
      <button class="nav-tab" onclick="showTab('trips')">All Trips</button>
      <button class="nav-tab" onclick="showTab('comments')">Comments</button>
      <button class="nav-tab" onclick="showTab('support')">Support</button>
      <button class="nav-tab" onclick="showTab('activity')">Activity</button>
      <button class="nav-tab" onclick="showTab('users')">Users</button>
      <button class="nav-tab" onclick="showTab('billing')">Billing</button>
      <button class="nav-tab" onclick="showTab('messages')">Messages</button>
      <button class="nav-tab" onclick="showTab('knowledge')">Knowledge</button>
      <button class="nav-tab" onclick="showTab('maintenance')">Maintenance</button>
    </div>
  </div>

  <div class="container">
    <div id="error" class="error" style="display: none;"></div>

    <!-- MISSION CONTROL TAB -->
    <div id="tab-missioncontrol" class="tab-content">
      <div class="mission-control-header">
        <div class="mode-tabs">
          <button class="mode-tab active" data-mode="live">Live</button>
          <button class="mode-tab" data-mode="stats">Stats</button>
          <button class="mode-tab" data-mode="insights">Insights</button>
        </div>
        <div class="auto-controls">
          <span class="toggle-label">Auto-refresh</span>
          <label class="toggle">
            <input type="checkbox" id="autoRefreshToggle" checked>
            <span class="toggle-slider"></span>
          </label>
          <span id="refreshStatus" style="font-size:11px;color:#666;">Polling every 3s</span>
        </div>
      </div>

      <!-- Live Mode Panel -->
      <div id="panel-live" class="mode-panel">
        <div class="mc-grid">
          <div class="mc-main">
            <div class="arrivals-board">
              <div class="board-header">
                <span class="col-time">TIME</span>
                <span class="col-user">USER</span>
                <span class="col-action">ACTION</span>
                <span class="col-trip">TRIP</span>
                <span class="col-detail">DETAIL</span>
                <span class="col-dur">MS</span>
                <span class="col-status">STATUS</span>
              </div>
              <div class="board-rows" id="activityRows">
                <div style="padding:40px;text-align:center;color:#666;">Loading activity stream...</div>
              </div>
            </div>

            <!-- Recent Errors Panel -->
            <div class="recent-errors" id="recentErrorsPanel" style="margin-top:15px;">
              <h4>Recent Errors <span class="count-badge" id="errorCountBadge">0</span></h4>
              <div id="recentErrorsList">
                <div style="color:#6b7280;text-align:center;padding:10px;">No recent errors</div>
              </div>
            </div>
          </div>

          <div class="mc-sidebar">
            <!-- Hourly Heatmap -->
            <div class="heatmap-panel">
              <h4>Activity Heatmap (Today)</h4>
              <div class="heatmap-grid" id="hourlyHeatmap"></div>
              <div class="heatmap-labels">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
              </div>
            </div>

            <!-- Error Breakdown -->
            <div class="error-panel">
              <h4>Error Breakdown</h4>
              <div id="errorBreakdown">
                <div style="color:#6b7280;text-align:center;padding:10px;font-size:11px;">No errors today</div>
              </div>
            </div>

            <!-- Tool Distribution -->
            <div class="tool-panel">
              <h4>Tool Usage (Today)</h4>
              <div id="toolDistribution">
                <div style="color:#6b7280;text-align:center;padding:10px;font-size:11px;">Loading...</div>
              </div>
            </div>

            <!-- Response Sizes -->
            <div class="size-panel">
              <h4>Response Sizes</h4>
              <div id="responseSizes">
                <div style="color:#8b949e;text-align:center;padding:10px;font-size:11px;">Collecting data...</div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-panel" id="liveStats">
          <div class="stat-card has-detail">
            <div class="label">Calls Today</div>
            <div class="value" id="liveCallsToday">-</div>
            <div class="sub-value" id="liveCallsSub">-</div>
          </div>
          <div class="stat-card has-detail">
            <div class="label">Active Users</div>
            <div class="value" id="liveActiveUsers">-</div>
            <div class="sub-value" id="liveUsersSub">-</div>
          </div>
          <div class="stat-card has-detail">
            <div class="label">Avg Response</div>
            <div class="value" id="liveAvgResponse">-</div>
            <div class="sub-value" id="liveP95">P95: -</div>
          </div>
          <div class="stat-card has-detail">
            <div class="label">Error Rate</div>
            <div class="value" id="liveErrorRate">-</div>
            <div class="sub-value" id="liveErrorsSub">-</div>
          </div>
        </div>
      </div>

      <!-- Stats Mode Panel -->
      <div id="panel-stats" class="mode-panel" style="display:none;">
        <div class="section">
          <div class="filter-row">
            <select id="statsPeriod" onchange="loadStatsPanel()">
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
          <div id="statsContent"><div class="loading">Loading stats...</div></div>
        </div>
      </div>

      <!-- Insights Mode Panel -->
      <div id="panel-insights" class="mode-panel" style="display:none;">
        <div class="insights-panel" id="insightsContent">
          <div class="loading">Loading insights...</div>
        </div>
      </div>
    </div>

    <!-- OVERVIEW TAB -->
    <div id="tab-overview" class="tab-content active">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Users</div><div class="value" id="totalUsers">-</div></div>
        <div class="stat-card"><div class="label">Trips</div><div class="value" id="totalTrips">-</div></div>
        <div class="stat-card"><div class="label">Comments</div><div class="value" id="totalComments">-</div></div>
        <div class="stat-card"><div class="label">Unread</div><div class="value" id="totalUnread">-</div></div>
      </div>
      <div class="section">
        <h2>Recent Activity</h2>
        <div id="recentActivity"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <h2>Recent Comments</h2>
        <div id="recentComments"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- TRIPS TAB -->
    <div id="tab-trips" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="tripFilterUser" onchange="applyTripFilters()"><option value="">All Users</option></select>
          <select id="tripFilterPhase" onchange="applyTripFilters()">
            <option value="">All Phases</option>
            <option value="discovery">Discovery</option>
            <option value="proposal">Proposal</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <input type="text" id="tripFilterSearch" onkeyup="applyTripFilters()" placeholder="Search trips..." style="width:200px;">
          <span id="tripCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="tripsTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- COMMENTS TAB -->
    <div id="tab-comments" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="commentFilterUser" onchange="applyCommentFilters()"><option value="">All Users</option></select>
          <select id="commentFilterRead" onchange="applyCommentFilters()">
            <option value="">All Comments</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>
          <input type="text" id="commentFilterSearch" onkeyup="applyCommentFilters()" placeholder="Search comments..." style="width:200px;">
          <span id="commentCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="commentsTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- SUPPORT TAB -->
    <div id="tab-support" class="tab-content">
      <!-- AI Support Settings Panel -->
      <div class="section" style="margin-bottom:15px;">
        <h2 style="display:flex;justify-content:space-between;align-items:center;">
          AI Support Settings
          <span id="aiSupportStatus" class="badge badge-gray">Loading...</span>
        </h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-top:15px;">
          <div>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <span>AI Support Enabled</span>
              <label class="toggle">
                <input type="checkbox" id="aiSupportEnabled" onchange="saveAISettings()">
                <span class="toggle-slider"></span>
              </label>
            </label>
          </div>
          <div>
            <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:5px;">Confidence Threshold: <span id="thresholdValue">90</span>%</label>
            <input type="range" id="aiConfidenceThreshold" min="50" max="100" value="90" style="width:100%;" oninput="document.getElementById('thresholdValue').textContent=this.value" onchange="saveAISettings()">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#6e7681;"><span>50% (more auto)</span><span>100% (more review)</span></div>
          </div>
          <div>
            <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:5px;">Monthly Cost Limit ($)</label>
            <input type="number" id="aiMonthlyLimit" value="100" min="1" max="1000" style="width:100px;padding:4px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;" onchange="saveAISettings()">
          </div>
          <div>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <span>Auto-Send Responses</span>
              <label class="toggle">
                <input type="checkbox" id="aiAutoSend" onchange="saveAISettings()">
                <span class="toggle-slider"></span>
              </label>
            </label>
            <div style="font-size:10px;color:#6e7681;margin-top:4px;">When confidence exceeds threshold</div>
          </div>
        </div>
        <div style="display:flex;gap:20px;margin-top:15px;padding-top:15px;border-top:1px solid #21262d;">
          <div style="font-size:12px;"><span style="color:#8b949e;">Today:</span> <span id="aiTodayStats">-</span></div>
          <div style="font-size:12px;"><span style="color:#8b949e;">This Month:</span> <span id="aiMonthStats">-</span></div>
          <div style="font-size:12px;"><span style="color:#8b949e;">Queue:</span> <span id="aiQueueStats">-</span></div>
        </div>
      </div>

      <div class="section">
        <div class="filter-row">
          <select id="supportFilterStatus" onchange="applySupportFilters()">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="ai_review">AI Review</option>
            <option value="ai_resolved">AI Resolved</option>
            <option value="escalated">Escalated</option>
          </select>
          <select id="supportFilterPriority" onchange="applySupportFilters()">
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span id="supportCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="supportTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- ACTIVITY TAB -->
    <div id="tab-activity" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="filterUser" onchange="applyFilters()"><option value="">All Users</option></select>
          <select id="filterTrip" onchange="applyFilters()"><option value="">All Trips</option></select>
          <select id="filterTime" onchange="applyFilters()">
            <option value="">All Time</option>
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <input type="text" id="filterSearch" onkeyup="applyFilters()" placeholder="Search..." style="width:150px;">
          <span id="activityCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="activityList" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- USERS TAB -->
    <div id="tab-users" class="tab-content">
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Users</h2>
          <button class="btn btn-primary" onclick="showAddUserModal()">+ Add User</button>
        </div>
        <div id="usersTable"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- BILLING TAB -->
    <div id="tab-billing" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Active Subs</div><div class="value" id="activeSubs">-</div></div>
        <div class="stat-card"><div class="label">Trialing</div><div class="value" id="trialingSubs">-</div></div>
        <div class="stat-card"><div class="label">Past Due</div><div class="value" id="pastDueSubs">-</div></div>
        <div class="stat-card"><div class="label">MRR</div><div class="value" id="mrr">-</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Promo Codes</h2>
          <button class="btn btn-primary" onclick="showPromoCodeModal()">+ Create Promo Code</button>
        </div>
        <div id="promoCodesTable"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <h2>User Subscriptions</h2>
        <div id="subscriptionsTable"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- MESSAGES TAB -->
    <div id="tab-messages" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Active Broadcasts</div><div class="value" id="activeBroadcasts">-</div></div>
        <div class="stat-card"><div class="label">Open Threads</div><div class="value" id="openThreads">-</div></div>
        <div class="stat-card"><div class="label">Unread Replies</div><div class="value" id="unreadReplies">-</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Broadcast Announcements</h2>
          <button class="btn btn-primary" onclick="showBroadcastModal()">+ New Broadcast</button>
        </div>
        <div id="broadcastsTable"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Direct Message Threads</h2>
          <button class="btn btn-primary" onclick="showDirectMessageModal()">+ New Message</button>
        </div>
        <div class="filter-row">
          <select id="threadFilterUser" onchange="applyThreadFilters()"><option value="">All Users</option></select>
          <select id="threadFilterStatus" onchange="applyThreadFilters()">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select id="threadFilterUnread" onchange="applyThreadFilters()">
            <option value="">All Messages</option>
            <option value="unread">With Unread Replies</option>
          </select>
        </div>
        <div id="threadsTable"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- KNOWLEDGE BASE TAB -->
    <div id="tab-knowledge" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Pending Proposals</div><div class="value" id="kbPendingCount">-</div></div>
        <div class="stat-card"><div class="label">Troubleshooting</div><div class="value" id="kbTroubleshootingCount">-</div></div>
        <div class="stat-card"><div class="label">FAQ Entries</div><div class="value" id="kbFaqCount">-</div></div>
        <div class="stat-card"><div class="label">Total Approved</div><div class="value" id="kbTotalApproved">-</div></div>
      </div>

      <div class="section">
        <h2>Pending Proposals <span id="kbPendingBadge" class="badge badge-blue" style="margin-left:8px;">0</span></h2>
        <p style="color:#8b949e;font-size:13px;margin-bottom:15px;">Review solutions proposed by AI sessions. Approved items are added to the knowledge base and shown to future sessions.</p>
        <div id="kbPendingList"><div class="loading">Loading...</div></div>
      </div>

      <div class="section">
        <h2>Approved Knowledge</h2>
        <div class="filter-row">
          <select id="kbCategoryFilter" onchange="loadApprovedKnowledge()">
            <option value="">All Categories</option>
            <option value="troubleshooting">Troubleshooting</option>
            <option value="faq">FAQ</option>
          </select>
          <input type="text" id="kbSearch" placeholder="Search..." oninput="filterApprovedKnowledge()">
        </div>
        <div id="kbApprovedList"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- MAINTENANCE TAB -->
    <div id="tab-maintenance" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Last Run</div><div class="value" id="maintLastRun">-</div></div>
        <div class="stat-card"><div class="label">Duration</div><div class="value" id="maintDuration">-</div></div>
        <div class="stat-card"><div class="label">Total Users</div><div class="value" id="maintTotalUsers">-</div></div>
        <div class="stat-card"><div class="label">Total Trips</div><div class="value" id="maintTotalTrips">-</div></div>
      </div>

      <div class="section">
        <h2>Cron Job Status</h2>
        <p style="color:#8b949e;font-size:13px;margin-bottom:15px;">Maintenance runs every 15 minutes. Tasks include cleanup, index validation, and stats refresh.</p>
        <button class="btn btn-primary" onclick="runMaintenanceNow()" id="runMaintBtn">Run Maintenance Now</button>
        <span id="maintRunStatus" style="margin-left:10px;color:#8b949e;"></span>
      </div>

      <div class="section">
        <h2>Last Run Details</h2>
        <div id="maintDetails" style="background:#161b22;border-radius:8px;padding:15px;font-family:monospace;font-size:13px;">
          <div class="loading">Loading...</div>
        </div>
      </div>

      <div class="section">
        <h2>Recent History</h2>
        <div id="maintHistory" style="max-height:400px;overflow-y:auto;">
          <div class="loading">Loading...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add User Modal -->
  <div id="addUserModal" class="modal">
    <div class="modal-content">
      <h3>Add New User</h3>
      <form id="addUserForm">
        <div class="form-group"><label>Name *</label><input type="text" id="userName" required></div>
        <div class="form-group"><label>Email *</label><input type="email" id="userEmail" required></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="userPhone"></div>
        <div class="form-group"><label>Agency Name *</label><input type="text" id="agencyName" required></div>
        <div class="form-group"><label>Franchise</label><input type="text" id="agencyFranchise" placeholder="e.g., Cruise Planners"></div>
        <div class="form-group"><label>Website</label><input type="url" id="agencyWebsite"></div>
        <div class="form-group"><label>Booking URL</label><input type="url" id="agencyBookingUrl" placeholder="For client deposits"></div>
        <div class="form-group"><label>Logo URL</label><input type="url" id="agencyLogo"></div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Create User</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit User Modal -->
  <div id="editUserModal" class="modal">
    <div class="modal-content">
      <h3>Edit User</h3>
      <form id="editUserForm">
        <input type="hidden" id="editUserId">
        <div class="form-group"><label>Name *</label><input type="text" id="editUserName" required></div>
        <div class="form-group"><label>Email *</label><input type="email" id="editUserEmail" required></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="editUserPhone"></div>
        <div class="form-group"><label>Agency Name *</label><input type="text" id="editAgencyName" required></div>
        <div class="form-group"><label>Franchise</label><input type="text" id="editAgencyFranchise" placeholder="e.g., Cruise Planners"></div>
        <div class="form-group"><label>Website</label><input type="url" id="editAgencyWebsite"></div>
        <div class="form-group"><label>Booking URL</label><input type="url" id="editAgencyBookingUrl" placeholder="For client deposits"></div>
        <div class="form-group"><label>Logo URL</label><input type="url" id="editAgencyLogo"></div>
        <div class="form-group">
          <label>Status</label>
          <select id="editUserStatus">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Email Preview Modal -->
  <div id="emailModal" class="modal">
    <div class="modal-content">
      <h3>Setup Email Generated</h3>
      <p style="margin-bottom: 15px;">Send this email to the new user:</p>
      <div class="email-preview" id="emailPreview"></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="copyEmail()">Copy to Clipboard</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Setup Instructions Modal -->
  <div id="setupModal" class="modal">
    <div class="modal-content wide">
      <h3>Setup Instructions for <span id="setupUserName"></span></h3>
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button class="btn btn-secondary btn-small" onclick="showSetupTab('chatgpt')" id="tabChatGPT">ChatGPT</button>
        <button class="btn btn-secondary btn-small" onclick="showSetupTab('claude')" id="tabClaude">Claude Web</button>
      </div>
      <div id="setupContent" class="email-preview" style="max-height: 400px;"></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="copySetupInstructions()">Copy to Clipboard</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Trip Detail Modal -->
  <div id="tripDetailModal" class="modal">
    <div class="modal-content wide">
      <h3 id="tripDetailTitle">Trip Details</h3>
      <div id="tripDetailContent"><div class="loading">Loading...</div></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Support Detail Modal -->
  <div id="supportDetailModal" class="modal">
    <div class="modal-content wide">
      <h3 id="supportDetailTitle">Support Request</h3>
      <div id="supportDetailContent"><div class="loading">Loading...</div></div>
      <div style="margin-top: 20px;">
        <label style="font-weight:600;display:block;margin-bottom:8px;">Admin Notes / Reply:</label>
        <textarea id="supportAdminNotes" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:inherit;"></textarea>
        <small style="color:#666;">This reply will be shown to the user at the start of their next session.</small>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="saveSupportNotes()">Save Notes</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Promo Code Modal -->
  <div id="promoCodeModal" class="modal">
    <div class="modal-content">
      <h3>Create Promo Code</h3>
      <form id="promoCodeForm">
        <div class="form-group">
          <label>Code Name *</label>
          <input type="text" id="promoName" required placeholder="e.g., WELCOME30">
        </div>
        <div class="form-group">
          <label>Discount Type</label>
          <select id="promoType" onchange="togglePromoFields()">
            <option value="percent">Percentage Off</option>
            <option value="amount">Fixed Amount Off ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Discount Value *</label>
          <input type="number" id="promoValue" required placeholder="30" min="1">
        </div>
        <div class="form-group">
          <label>Duration</label>
          <select id="promoDuration" onchange="toggleDurationMonths()">
            <option value="once">First Payment Only</option>
            <option value="repeating">Multiple Months</option>
            <option value="forever">Forever</option>
          </select>
        </div>
        <div class="form-group" id="durationMonthsGroup" style="display:none;">
          <label>Number of Months</label>
          <input type="number" id="promoDurationMonths" placeholder="3" min="1" max="24">
        </div>
        <div class="form-group">
          <label>Max Redemptions (optional)</label>
          <input type="number" id="promoMaxRedemptions" placeholder="Unlimited if blank" min="1">
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Create Code</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- New Broadcast Modal -->
  <div id="broadcastModal" class="modal">
    <div class="modal-content">
      <h3>New Broadcast Announcement</h3>
      <div class="form-group">
        <label>Title *</label>
        <input type="text" id="broadcastTitle" placeholder="Maintenance Notice" required>
      </div>
      <div class="form-group">
        <label>Message *</label>
        <textarea id="broadcastBody" rows="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" placeholder="Your announcement message..."></textarea>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="broadcastPriority">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div class="form-group">
        <label>Expires (optional)</label>
        <input type="datetime-local" id="broadcastExpires">
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="createBroadcast()">Send to All Users</button>
        <button class="btn btn-secondary" onclick="closeBroadcastModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- New Direct Message Modal -->
  <div id="directMessageModal" class="modal">
    <div class="modal-content">
      <h3>Send Direct Message</h3>
      <div class="form-group">
        <label>Recipient *</label>
        <select id="messageRecipient">
          <option value="">Select user...</option>
        </select>
      </div>
      <div class="form-group">
        <label>Subject *</label>
        <input type="text" id="messageSubject" placeholder="Question about your trip">
      </div>
      <div class="form-group">
        <label>Message *</label>
        <textarea id="messageBody" rows="5" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" placeholder="Your message..."></textarea>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="sendDirectMessage()">Send Message</button>
        <button class="btn btn-secondary" onclick="closeDirectMessageModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Thread Detail Modal -->
  <div id="threadDetailModal" class="modal">
    <div class="modal-content" style="max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 id="threadDetailSubject">Thread Subject</h3>
        <button class="btn btn-secondary btn-small" onclick="closeThreadDetailModal()">Close</button>
      </div>
      <div id="threadMessages" style="max-height:400px;overflow-y:auto;margin-bottom:20px;border:1px solid #eee;border-radius:8px;padding:15px;background:#fafafa;"></div>
      <div style="border-top:1px solid #eee;padding-top:15px;">
        <textarea id="threadReplyBody" rows="3" placeholder="Type your reply..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;"></textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeThread()">Close Thread</button>
          <button class="btn btn-primary" onclick="sendThreadReply()">Send Reply</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let ADMIN_KEY = localStorage.getItem('voygent_admin_key');

    function promptForAdminKey() {
      ADMIN_KEY = prompt('Enter admin key:');
      if (ADMIN_KEY) {
        localStorage.setItem('voygent_admin_key', ADMIN_KEY);
        location.reload();
      }
    }

    if (!ADMIN_KEY) promptForAdminKey();

    const API_BASE = window.location.origin;

    // SECURITY: HTML escaping function to prevent XSS in HTML contexts
    function escapeHtml(unsafe) {
      if (unsafe === null || unsafe === undefined) return '';
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // SECURITY: JS string escaping for use in data-* attributes read by JS
    // This ensures values are safe when used in JavaScript contexts
    function escapeJsString(unsafe) {
      if (unsafe === null || unsafe === undefined) return '';
      return String(unsafe)
        .replace(/\\\\/g, '\\\\\\\\')
        .replace(/'/g, "\\\\'")
        .replace(/"/g, '\\\\"')
        .replace(/\\n/g, '\\\\n')
        .replace(/\\r/g, '\\\\r')
        .replace(/</g, '\\\\x3c')
        .replace(/>/g, '\\\\x3e');
    }

    // SECURITY: Validate URL scheme to prevent javascript: XSS
    function safeUrl(url) {
      if (!url) return null;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          return url;
        }
        return null; // Block javascript:, data:, etc.
      } catch {
        return null;
      }
    }

    // SECURITY: Event delegation for safe click handling
    // Instead of inline onclick with user data, we use data-* attributes
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const userId = target.dataset.userId;
      const tripId = target.dataset.tripId;
      const ticketId = target.dataset.ticketId;

      switch (action) {
        case 'edit-user':
          if (userId) editUser(userId);
          break;
        case 'view-trip':
          if (userId && tripId) viewTripDetail(userId, tripId);
          break;
        case 'view-support':
          if (ticketId) viewSupportDetail(ticketId);
          break;
        case 'view-screenshot':
          const url = target.dataset.url;
          if (url && safeUrl(url)) viewScreenshot(url);
          break;
      }
    });

    let currentEmail = '';
    let usersCache = [];
    let tripsCache = [];
    let commentsCache = [];
    let activityCache = [];

    async function api(endpoint, options = {}) {
      const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY, ...options.headers }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        if (res.status === 401) {
          localStorage.removeItem('voygent_admin_key');
          alert('Invalid admin key. Please enter a valid key.');
          promptForAdminKey();
          throw new Error('Unauthorized');
        }
        throw new Error(err.error || 'API Error');
      }
      return res.json();
    }

    function showTab(tab) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector(\`[onclick="showTab('\${tab}')"]\`).classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    }

    async function loadStats() {
      try {
        const data = await api('/admin/stats');
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('totalTrips').textContent = data.totalTrips;
        document.getElementById('totalComments').textContent = data.totalComments;
      } catch (e) {
        showError(e.message);
      }
    }

    let userSort = { field: 'lastActivity', dir: 'desc' };

    async function loadUsers() {
      try {
        const data = await api('/admin/users');
        usersCache = data.users;
        renderUsersTable();
      } catch (e) {
        document.getElementById('usersTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function sortUsers(field) {
      if (userSort.field === field) {
        userSort.dir = userSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        userSort.field = field;
        userSort.dir = field === 'name' ? 'asc' : 'desc';
      }
      renderUsersTable();
    }

    function getSortValue(user, field) {
      switch (field) {
        case 'name': return (user.name || '').toLowerCase();
        case 'trips': return user.stats?.tripCount || 0;
        case 'activity': return user.stats?.activityCount || 0;
        case 'created': return user.created || '';
        case 'firstActivity': return user.stats?.firstActivity || '';
        case 'lastActivity': return user.stats?.lastActivity || '';
        default: return '';
      }
    }

    function formatUserDate(dateStr) {
      if (!dateStr) return '<span style="color:#666">Never</span>';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '<span style="color:#666">Never</span>';
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      if (days === 0) return '<span style="color:#3baf2a">Today</span>';
      if (days === 1) return 'Yesterday';
      if (days < 7) return days + 'd ago';
      if (days < 30) return Math.floor(days / 7) + 'w ago';
      if (days < 365) return Math.floor(days / 30) + 'mo ago';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }

    function renderUsersTable() {
      const sorted = [...usersCache].sort((a, b) => {
        const aVal = getSortValue(a, userSort.field);
        const bVal = getSortValue(b, userSort.field);
        const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return userSort.dir === 'asc' ? cmp : -cmp;
      });

      const sortIcon = (field) => userSort.field === field ? (userSort.dir === 'asc' ? ' ▲' : ' ▼') : '';

      const html = sorted.length ? \`
        <table>
          <thead>
            <tr>
              <th style="cursor:pointer" onclick="sortUsers('name')">Name\${sortIcon('name')}</th>
              <th>Agency</th>
              <th style="cursor:pointer;text-align:center;width:60px" onclick="sortUsers('trips')">Trips\${sortIcon('trips')}</th>
              <th style="cursor:pointer;text-align:center;width:70px" onclick="sortUsers('activity')">Actions\${sortIcon('activity')}</th>
              <th style="cursor:pointer;width:80px" onclick="sortUsers('created')">Created\${sortIcon('created')}</th>
              <th style="cursor:pointer;width:80px" onclick="sortUsers('firstActivity')">First Use\${sortIcon('firstActivity')}</th>
              <th style="cursor:pointer;width:80px" onclick="sortUsers('lastActivity')">Last Use\${sortIcon('lastActivity')}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${sorted.map(u => \`
              <tr>
                <td>
                  \${escapeHtml(u.name)}<br>
                  <small style="color:#666">\${escapeHtml(u.email)}</small>
                </td>
                <td>\${escapeHtml(u.agency.name)}\${u.agency.franchise ? '<br><small style="color:#666">' + escapeHtml(u.agency.franchise) + '</small>' : ''}</td>
                <td style="text-align:center">\${u.stats?.tripCount || 0}</td>
                <td style="text-align:center">\${u.stats?.activityCount || 0}</td>
                <td>\${formatUserDate(u.created)}</td>
                <td>\${formatUserDate(u.stats?.firstActivity)}</td>
                <td>\${formatUserDate(u.stats?.lastActivity)}</td>
                <td><span class="status-badge status-\${escapeHtml(u.status)}">\${escapeHtml(u.status)}</span></td>
                <td class="actions" style="display: flex; gap: 4px;">
                  <button class="btn btn-secondary btn-small" data-action="edit-user" data-user-id="\${escapeHtml(u.userId)}">Edit</button>
                  <div class="action-menu" data-user-id="\${escapeHtml(u.userId)}">
                    <button class="action-menu-btn" onclick="toggleUserMenu('\${escapeHtml(u.userId)}')">Tools ▾</button>
                    <div class="action-menu-content">
                      <div class="action-menu-header">Quick Actions</div>
                      <button class="action-menu-item" onclick="showSetupInstructions('\${escapeHtml(u.userId)}')">Setup Instructions</button>
                      <button class="action-menu-item" onclick="userTool('\${escapeHtml(u.userId)}', 'add-samples')">Add Sample Trips</button>
                      <button class="action-menu-item" onclick="userTool('\${escapeHtml(u.userId)}', 'reset-new-user')">Reset to New User</button>
                      <button class="action-menu-item" onclick="userTool('\${escapeHtml(u.userId)}', 'reset-branding')">Reset Branding</button>
                      <div class="action-menu-divider"></div>
                      <div class="action-menu-header">Delete Data</div>
                      <button class="action-menu-item danger" onclick="userTool('\${escapeHtml(u.userId)}', 'clear-messages')">Clear Messages</button>
                      <button class="action-menu-item danger" onclick="userTool('\${escapeHtml(u.userId)}', 'clear-trips')">Delete All Trips</button>
                      <div class="action-menu-divider"></div>
                      <button class="action-menu-item danger" onclick="userTool('\${escapeHtml(u.userId)}', 'reset-account')">Full Account Reset</button>
                    </div>
                  </div>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \` : '<p>No users yet. Click "Add User" to create one.</p>';
      document.getElementById('usersTable').innerHTML = html;
    }

    let activityFilters = { users: [], trips: [] };

    async function loadActivity() {
      try {
        const data = await api('/admin/activity');
        activityCache = data.activities || [];
        activityFilters = data.filters || { users: [], trips: [] };

        // Populate filter dropdowns
        const userSelect = document.getElementById('filterUser');
        userSelect.innerHTML = '<option value="">All Users</option>' +
          activityFilters.users.map(u => \`<option value="\${u.userId}">\${u.name}</option>\`).join('');

        const tripSelect = document.getElementById('filterTrip');
        tripSelect.innerHTML = '<option value="">All Trips</option>' +
          activityFilters.trips.map(t => \`<option value="\${t}">\${t}</option>\`).join('');

        applyFilters();
      } catch (e) {
        document.getElementById('activityList').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyFilters() {
      const userFilter = document.getElementById('filterUser').value;
      const tripFilter = document.getElementById('filterTrip').value;
      const timeFilter = document.getElementById('filterTime').value;
      const searchFilter = document.getElementById('filterSearch').value.toLowerCase();

      let filtered = activityCache;

      // User filter
      if (userFilter) {
        filtered = filtered.filter(a => a.userId === userFilter);
      }

      // Trip filter
      if (tripFilter) {
        filtered = filtered.filter(a => a.tripId === tripFilter);
      }

      // Time filter
      if (timeFilter) {
        const now = Date.now();
        const cutoffs = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
        const cutoff = now - (cutoffs[timeFilter] || 0);
        filtered = filtered.filter(a => new Date(a.timestamp).getTime() > cutoff);
      }

      // Search filter
      if (searchFilter) {
        filtered = filtered.filter(a =>
          (a.tripId || '').toLowerCase().includes(searchFilter) ||
          (a.tripName || '').toLowerCase().includes(searchFilter) ||
          (a.change || '').toLowerCase().includes(searchFilter) ||
          (a.userName || '').toLowerCase().includes(searchFilter)
        );
      }

      // Update count
      document.getElementById('activityCount').textContent = \`(\${filtered.length} of \${activityCache.length})\`;

      // Render table
      if (filtered.length === 0) {
        document.getElementById('activityList').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No activity matches your filters.</p>';
        return;
      }

      const html = \`
        <table>
          <thead>
            <tr>
              <th style="width:160px;">Time</th>
              <th>User</th>
              <th>Trip</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            \${filtered.slice(0, 100).map(a => \`
              <tr>
                <td style="font-size:12px;color:#666;">\${formatTime(a.timestamp)}</td>
                <td>\${escapeHtml(a.userName || a.userId)}<br><small style="color:#999;">\${escapeHtml(a.agency || '')}</small></td>
                <td><code style="font-size:11px;">\${escapeHtml(a.tripId || '-')}</code>\${a.tripName ? '<br><small style="color:#666;">' + escapeHtml(a.tripName) + '</small>' : ''}</td>
                <td>\${escapeHtml(a.change || '-')}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
        \${filtered.length > 100 ? '<p style="text-align:center;color:#666;margin-top:10px;">Showing first 100 of ' + filtered.length + ' entries</p>' : ''}
      \`;
      document.getElementById('activityList').innerHTML = html;
    }

    function formatTime(ts) {
      if (!ts) return '-';
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const tzOpts = { timeZone: 'America/Chicago' };

      // Within last hour: "X minutes ago"
      if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins <= 1 ? 'Just now' : mins + ' min ago';
      }
      // Within last 24h: "X hours ago"
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
      }
      // Within last 7 days: "Mon 2:30 PM"
      if (diff < 604800000) {
        return d.toLocaleDateString('en-US', { weekday: 'short', ...tzOpts }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...tzOpts });
      }
      // Older: "Jan 5, 2:30 PM"
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...tzOpts }) + ', ' +
             d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...tzOpts });
    }

    function showAddUserModal() { document.getElementById('addUserModal').classList.add('active'); }
    function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
    function showError(msg) { const el = document.getElementById('error'); el.textContent = msg; el.style.display = 'block'; }

    function editUser(userId) {
      const user = usersCache.find(u => u.userId === userId);
      if (!user) { alert('User not found'); return; }

      document.getElementById('editUserId').value = user.userId;
      document.getElementById('editUserName').value = user.name || '';
      document.getElementById('editUserEmail').value = user.email || '';
      document.getElementById('editUserPhone').value = user.phone || '';
      document.getElementById('editAgencyName').value = user.agency?.name || '';
      document.getElementById('editAgencyFranchise').value = user.agency?.franchise || '';
      document.getElementById('editAgencyWebsite').value = user.agency?.website || '';
      document.getElementById('editAgencyBookingUrl').value = user.agency?.bookingUrl || '';
      document.getElementById('editAgencyLogo').value = user.agency?.logo || '';
      document.getElementById('editUserStatus').value = user.status || 'active';

      document.getElementById('editUserModal').classList.add('active');
    }

    // User Tools dropdown functions
    function toggleUserMenu(userId) {
      // Close all other menus first
      document.querySelectorAll('.action-menu.open').forEach(m => {
        if (m.dataset.userId !== userId) m.classList.remove('open');
      });
      // Toggle this menu
      const menu = document.querySelector(\`.action-menu[data-user-id="\${userId}"]\`);
      if (menu) menu.classList.toggle('open');
    }

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.action-menu')) {
        document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'));
      }
    });

    async function userTool(userId, action) {
      const user = usersCache.find(u => u.userId === userId);
      const userName = user ? user.name : userId;

      // Confirmation messages for destructive actions
      const confirmMessages = {
        'clear-messages': \`Delete ALL messages and comments for \${userName}?\`,
        'clear-trips': \`Delete ALL trips for \${userName}? This cannot be undone.\`,
        'reset-account': \`Fully reset \${userName}'s account? This will delete ALL trips, messages, and reset settings to defaults. This cannot be undone.\`
      };

      if (confirmMessages[action] && !confirm(confirmMessages[action])) {
        return;
      }

      // Close the menu
      document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'));

      try {
        let endpoint, method;

        switch (action) {
          case 'add-samples':
            endpoint = \`/admin/users/\${userId}/add-samples\`;
            method = 'POST';
            break;
          case 'reset-new-user':
            endpoint = \`/admin/users/\${userId}/reset-new-user\`;
            method = 'POST';
            break;
          case 'reset-branding':
            endpoint = \`/admin/users/\${userId}/reset-branding\`;
            method = 'POST';
            break;
          case 'clear-messages':
            endpoint = \`/admin/users/\${userId}/data/messages\`;
            method = 'DELETE';
            break;
          case 'clear-trips':
            endpoint = \`/admin/users/\${userId}/data/trips\`;
            method = 'DELETE';
            break;
          case 'reset-account':
            endpoint = \`/admin/users/\${userId}/reset-account\`;
            method = 'POST';
            break;
          default:
            alert('Unknown action: ' + action);
            return;
        }

        const result = await api(endpoint, { method });
        alert(result.message || 'Action completed successfully');

        // Refresh data after successful action
        loadUsers();
        loadTrips();
        loadActivity();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // Setup Instructions functions
    let currentSetupUser = null;
    let currentSetupTab = 'chatgpt';

    function showSetupInstructions(userId) {
      const user = usersCache.find(u => u.userId === userId);
      if (!user) { alert('User not found'); return; }

      currentSetupUser = user;
      document.getElementById('setupUserName').textContent = user.name;

      // Close the dropdown
      document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'));

      showSetupTab('chatgpt');
      document.getElementById('setupModal').classList.add('active');
    }

    function showSetupTab(tab) {
      currentSetupTab = tab;
      const user = currentSetupUser;
      if (!user) return;

      // Update tab styling
      document.getElementById('tabChatGPT').classList.toggle('btn-primary', tab === 'chatgpt');
      document.getElementById('tabChatGPT').classList.toggle('btn-secondary', tab !== 'chatgpt');
      document.getElementById('tabClaude').classList.toggle('btn-primary', tab === 'claude');
      document.getElementById('tabClaude').classList.toggle('btn-secondary', tab !== 'claude');

      const mcpUrl = \`https://voygent.somotravel.workers.dev/sse?key=\${user.authKey}\`;

      let content = '';
      if (tab === 'chatgpt') {
        content = \`== ChatGPT Web Setup ==

1. Go to ChatGPT Settings > Apps > Advanced settings > Create app

2. Fill in the form:
   - Name: Voygent
   - Description: Voygent AI powered travel assistant
   - MCP Server URL: \${mcpUrl}
   - Authentication: No Auth

3. Check "I understand and want to continue"

4. Click Create

5. Start a new conversation and say:
   "use voygent, list trips"

== Your Auth Key ==
\${user.authKey}

== MCP URL ==
\${mcpUrl}\`;
      } else {
        content = \`== Claude Web Setup (claude.ai) ==

1. Go to claude.ai and click your profile name in the sidebar

2. Click Settings > Connectors

3. Click "Add custom connector"

4. Fill in the form:
   - Name: Voygent
   - Remote MCP server URL: \${mcpUrl}

5. Click "Add" to save

6. Start a new conversation and say:
   "use voygent, list trips"

Note: Also works on Claude iOS app (same steps in Settings)

== Your Auth Key ==
\${user.authKey}

== MCP URL ==
\${mcpUrl}\`;
      }

      document.getElementById('setupContent').textContent = content;
    }

    function copySetupInstructions() {
      const content = document.getElementById('setupContent').textContent;
      navigator.clipboard.writeText(content).then(() => {
        alert('Copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Copied to clipboard!');
      });
    }

    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('userPhone').value || undefined,
            agency: {
              name: document.getElementById('agencyName').value,
              franchise: document.getElementById('agencyFranchise').value || undefined,
              website: document.getElementById('agencyWebsite').value || undefined,
              bookingUrl: document.getElementById('agencyBookingUrl').value || undefined,
              logo: document.getElementById('agencyLogo').value || undefined,
            }
          })
        });
        closeModal();
        currentEmail = data.setupEmail.body;
        document.getElementById('emailPreview').textContent = currentEmail;
        document.getElementById('emailModal').classList.add('active');
        loadUsers();
        loadStats();
        document.getElementById('addUserForm').reset();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('editUserId').value;
      try {
        await api('/admin/users/' + userId, {
          method: 'PUT',
          body: JSON.stringify({
            name: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            phone: document.getElementById('editUserPhone').value || undefined,
            status: document.getElementById('editUserStatus').value,
            agency: {
              name: document.getElementById('editAgencyName').value,
              franchise: document.getElementById('editAgencyFranchise').value || undefined,
              website: document.getElementById('editAgencyWebsite').value || undefined,
              bookingUrl: document.getElementById('editAgencyBookingUrl').value || undefined,
              logo: document.getElementById('editAgencyLogo').value || undefined,
            }
          })
        });
        closeModal();
        loadUsers();
        alert('User updated successfully!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    function copyEmail() {
      navigator.clipboard.writeText(currentEmail);
      alert('Copied to clipboard!');
    }

    // ========== TRIPS ==========
    async function loadTrips() {
      try {
        const data = await api('/admin/trips');
        tripsCache = data.trips || [];

        // Populate user filter
        const users = [...new Set(tripsCache.map(t => JSON.stringify({id: t.userId, name: t.userName})))].map(s => JSON.parse(s));
        document.getElementById('tripFilterUser').innerHTML = '<option value="">All Users</option>' +
          users.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join('');

        // Update unread count
        const totalUnread = tripsCache.reduce((sum, t) => sum + (t.unreadComments || 0), 0);
        document.getElementById('totalUnread').textContent = totalUnread;

        applyTripFilters();
      } catch (e) {
        document.getElementById('tripsTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyTripFilters() {
      const userFilter = document.getElementById('tripFilterUser').value;
      const phaseFilter = document.getElementById('tripFilterPhase').value;
      const searchFilter = document.getElementById('tripFilterSearch').value.toLowerCase();

      let filtered = tripsCache;
      if (userFilter) filtered = filtered.filter(t => t.userId === userFilter);
      if (phaseFilter) filtered = filtered.filter(t => t.meta.phase === phaseFilter);
      if (searchFilter) {
        filtered = filtered.filter(t =>
          t.tripId.toLowerCase().includes(searchFilter) ||
          (t.meta.clientName || '').toLowerCase().includes(searchFilter) ||
          (t.meta.destination || '').toLowerCase().includes(searchFilter) ||
          (t.userName || '').toLowerCase().includes(searchFilter)
        );
      }

      document.getElementById('tripCount').textContent = \`(\${filtered.length} of \${tripsCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('tripsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No trips found.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Trip</th><th>Client</th><th>Agent</th><th>Phase</th><th>Comments</th><th>Published</th><th>Actions</th></tr></thead>
        <tbody>\${filtered.map(t => {
          const phase = t.meta.phase || '';
          const badgeColor = phase === 'confirmed' ? 'green' : phase === 'proposal' ? 'blue' : 'gray';
          const validUrl = safeUrl(t.publishedUrl);
          return \`
          <tr class="clickable" data-action="view-trip" data-user-id="\${escapeHtml(t.userId)}" data-trip-id="\${escapeHtml(t.tripId)}">
            <td><code style="font-size:11px;">\${escapeHtml(t.tripId)}</code><br><small style="color:#666;">\${escapeHtml(t.meta.destination || '')}</small></td>
            <td>\${escapeHtml(t.meta.clientName || '-')}<br><small style="color:#666;">\${escapeHtml(t.meta.dates || '')}</small></td>
            <td>\${escapeHtml(t.userName)}<br><small style="color:#999;">\${escapeHtml(t.agency)}</small></td>
            <td><span class="badge badge-\${badgeColor}">\${escapeHtml(phase || '-')}</span></td>
            <td>\${t.commentCount > 0 ? \`<span class="badge \${t.unreadComments > 0 ? 'badge-red' : 'badge-gray'}">\${t.commentCount}\${t.unreadComments > 0 ? ' (' + t.unreadComments + ' new)' : ''}</span>\` : '-'}</td>
            <td>\${validUrl ? \`<a href="\${escapeHtml(validUrl)}" target="_blank" class="link-external" onclick="event.stopPropagation()">View</a>\` : '-'}</td>
            <td><button class="btn btn-small btn-secondary" data-action="view-trip" data-user-id="\${escapeHtml(t.userId)}" data-trip-id="\${escapeHtml(t.tripId)}" onclick="event.stopPropagation()">Details</button></td>
          </tr>
        \`}).join('')}</tbody>
      </table>\`;
      document.getElementById('tripsTable').innerHTML = html;
    }

    async function viewTripDetail(userId, tripId) {
      document.getElementById('tripDetailModal').classList.add('active');
      document.getElementById('tripDetailContent').innerHTML = '<div class="loading">Loading...</div>';
      document.getElementById('tripDetailTitle').textContent = tripId;

      try {
        const data = await api(\`/admin/trips/\${userId}/\${tripId}\`);
        const meta = data.data?.meta || {};
        const publishedUrl = meta.publishedUrl || (meta.tripId ? \`https://somotravel.us/\${meta.tripId}.html\` : null);

        let html = \`<div class="detail-grid">
          <div>
            <div class="detail-section">
              <h4>Trip Info</h4>
              <div class="detail-row"><span class="label">Client:</span> <span>\${meta.clientName || '-'}</span></div>
              <div class="detail-row"><span class="label">Destination:</span> <span>\${meta.destination || '-'}</span></div>
              <div class="detail-row"><span class="label">Dates:</span> <span>\${meta.dates || '-'}</span></div>
              <div class="detail-row"><span class="label">Phase:</span> <span>\${meta.phase || '-'}</span></div>
              <div class="detail-row"><span class="label">Status:</span> <span>\${meta.status || '-'}</span></div>
              <div class="detail-row"><span class="label">Travelers:</span> <span>\${data.data?.travelers?.count || '-'}</span></div>
            </div>
            <div class="detail-section">
              <h4>Agent</h4>
              <div class="detail-row"><span class="label">Name:</span> <span>\${data.user?.name || userId}</span></div>
              <div class="detail-row"><span class="label">Email:</span> <span>\${data.user?.email || '-'}</span></div>
              <div class="detail-row"><span class="label">Agency:</span> <span>\${data.user?.agency || '-'}</span></div>
            </div>
            \${publishedUrl ? \`<div class="detail-section">
              <h4>Published</h4>
              <a href="\${publishedUrl}" target="_blank" class="link-external">\${publishedUrl}</a>
            </div>\` : ''}
          </div>
          <div>
            <div class="detail-section">
              <h4>Comments (\${data.comments?.length || 0})</h4>
              \${data.comments?.length > 0 ? data.comments.map(c => \`
                <div class="comment-box">
                  <div class="comment-meta">
                    <strong>\${c.section || 'General'}</strong> · \${c.name || 'Anonymous'} · \${formatTime(c.timestamp)}
                    \${c.read ? '<span class="badge badge-gray">Read</span>' : '<span class="badge badge-red">Unread</span>'}
                  </div>
                  <div>\${c.message}</div>
                </div>
              \`).join('') : '<p style="color:#666;">No comments yet.</p>'}
            </div>
            <div class="detail-section">
              <h4>Recent Activity</h4>
              \${data.activity?.length > 0 ? \`<ul style="font-size:12px;color:#666;">\${data.activity.slice(0,10).map(a => \`<li>\${formatTime(a.timestamp)}: \${a.change}</li>\`).join('')}</ul>\` : '<p style="color:#666;">No activity recorded.</p>'}
            </div>
          </div>
        </div>
        <div class="detail-section" style="margin-top:15px;">
          <h4>Raw Data <button class="btn btn-small btn-secondary" onclick="toggleJson()">Toggle</button></h4>
          <div id="jsonData" class="json-view" style="display:none;">\${JSON.stringify(data.data, null, 2)}</div>
        </div>\`;

        document.getElementById('tripDetailContent').innerHTML = html;
      } catch (e) {
        document.getElementById('tripDetailContent').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function toggleJson() {
      const el = document.getElementById('jsonData');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    // ========== COMMENTS ==========
    async function loadComments() {
      try {
        const data = await api('/admin/comments');
        commentsCache = data.comments || [];

        // Populate user filter
        const users = [...new Set(commentsCache.map(c => JSON.stringify({id: c.userId, name: c.userName})))].map(s => JSON.parse(s));
        document.getElementById('commentFilterUser').innerHTML = '<option value="">All Users</option>' +
          users.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join('');

        applyCommentFilters();
        renderRecentComments();
      } catch (e) {
        document.getElementById('commentsTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyCommentFilters() {
      const userFilter = document.getElementById('commentFilterUser').value;
      const readFilter = document.getElementById('commentFilterRead').value;
      const searchFilter = document.getElementById('commentFilterSearch').value.toLowerCase();

      let filtered = commentsCache;
      if (userFilter) filtered = filtered.filter(c => c.userId === userFilter);
      if (readFilter === 'unread') filtered = filtered.filter(c => !c.read);
      if (readFilter === 'read') filtered = filtered.filter(c => c.read);
      if (searchFilter) {
        filtered = filtered.filter(c =>
          (c.message || '').toLowerCase().includes(searchFilter) ||
          (c.tripId || '').toLowerCase().includes(searchFilter) ||
          (c.name || '').toLowerCase().includes(searchFilter) ||
          (c.section || '').toLowerCase().includes(searchFilter)
        );
      }

      document.getElementById('commentCount').textContent = \`(\${filtered.length} of \${commentsCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('commentsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No comments found.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Time</th><th>Trip</th><th>Section</th><th>From</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>\${filtered.map(c => \`
          <tr class="clickable" data-action="view-trip" data-user-id="\${escapeHtml(c.userId)}" data-trip-id="\${escapeHtml(c.tripId)}">
            <td style="font-size:11px;color:#666;">\${formatTime(c.timestamp)}</td>
            <td><code style="font-size:10px;">\${escapeHtml(c.tripId)}</code><br><small style="color:#999;">\${escapeHtml(c.userName)}</small></td>
            <td>\${escapeHtml(c.section || 'General')}</td>
            <td>\${escapeHtml(c.name || 'Anonymous')}\${c.email ? '<br><small style="color:#666;">' + escapeHtml(c.email) + '</small>' : ''}</td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${escapeHtml(c.message)}</td>
            <td>\${c.read ? '<span class="badge badge-gray">Read</span>' : '<span class="badge badge-red">Unread</span>'}</td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('commentsTable').innerHTML = html;
    }

    function renderRecentComments() {
      const recent = commentsCache.slice(0, 5);
      if (recent.length === 0) {
        document.getElementById('recentComments').innerHTML = '<p style="color:#666;">No comments yet.</p>';
        return;
      }
      const html = recent.map(c => \`
        <div class="comment-box" data-action="view-trip" data-user-id="\${escapeHtml(c.userId)}" data-trip-id="\${escapeHtml(c.tripId)}" style="cursor:pointer;">
          <div class="comment-meta">
            <strong>\${escapeHtml(c.section || 'General')}</strong> on <code>\${escapeHtml(c.tripId)}</code> · \${escapeHtml(c.name || 'Anonymous')} · \${formatTime(c.timestamp)}
            \${c.read ? '' : '<span class="badge badge-red">New</span>'}
          </div>
          <div>\${escapeHtml(c.message)}</div>
        </div>
      \`).join('');
      document.getElementById('recentComments').innerHTML = html;
    }

    // ========== ACTIVITY (for Overview) ==========
    function renderRecentActivity() {
      const recent = activityCache.slice(0, 10);
      if (recent.length === 0) {
        document.getElementById('recentActivity').innerHTML = '<p style="color:#666;">No activity yet.</p>';
        return;
      }
      const html = \`<table style="font-size:12px;">
        <tbody>\${recent.map(a => \`
          <tr>
            <td style="width:120px;color:#666;">\${formatTime(a.timestamp)}</td>
            <td>\${escapeHtml(a.userName)}</td>
            <td><code style="font-size:10px;">\${escapeHtml(a.tripId || '-')}</code></td>
            <td>\${escapeHtml(a.change || '-')}</td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('recentActivity').innerHTML = html;
    }

    // ========== AI SUPPORT SETTINGS ==========
    async function loadAISettings() {
      try {
        const data = await api('/admin/ai-support/status');

        // Update toggles and inputs
        document.getElementById('aiSupportEnabled').checked = data.enabled;
        document.getElementById('aiConfidenceThreshold').value = data.settings.confidenceThreshold;
        document.getElementById('thresholdValue').textContent = data.settings.confidenceThreshold;
        document.getElementById('aiMonthlyLimit').value = data.settings.monthlyLimit;
        document.getElementById('aiAutoSend').checked = data.settings.autoSendEnabled;

        // Update status badge
        const statusEl = document.getElementById('aiSupportStatus');
        if (data.enabled) {
          statusEl.className = 'badge badge-green';
          statusEl.textContent = 'Active';
        } else {
          statusEl.className = 'badge badge-gray';
          statusEl.textContent = 'Disabled';
        }

        // Update stats
        document.getElementById('aiTodayStats').innerHTML =
          \`<span style="color:#3fb950;">\${data.today.autoResolved} auto</span> / \` +
          \`<span style="color:#58a6ff;">\${data.today.queued} queued</span> / \` +
          \`<span style="color:#f85149;">\${data.today.errors} errors</span>\`;

        document.getElementById('aiMonthStats').innerHTML =
          \`\${data.month.tickets} tickets / $\${data.month.cost.toFixed(2)} of $\${data.month.limit}\`;

        document.getElementById('aiQueueStats').innerHTML =
          \`<span style="color:#58a6ff;">\${data.queue.pendingReview} review</span> / \` +
          \`<span style="color:#f85149;">\${data.queue.escalated} escalated</span>\`;

      } catch (e) {
        console.error('Failed to load AI settings:', e);
        document.getElementById('aiSupportStatus').textContent = 'Error';
        document.getElementById('aiSupportStatus').className = 'badge badge-red';
      }
    }

    async function saveAISettings() {
      try {
        const settings = {
          enabled: document.getElementById('aiSupportEnabled').checked,
          confidenceThreshold: parseInt(document.getElementById('aiConfidenceThreshold').value),
          monthlyLimit: parseInt(document.getElementById('aiMonthlyLimit').value),
          autoSendEnabled: document.getElementById('aiAutoSend').checked
        };

        await api('/admin/ai-support/settings', 'POST', settings);

        // Update status badge
        const statusEl = document.getElementById('aiSupportStatus');
        if (settings.enabled) {
          statusEl.className = 'badge badge-green';
          statusEl.textContent = 'Active';
        } else {
          statusEl.className = 'badge badge-gray';
          statusEl.textContent = 'Disabled';
        }
      } catch (e) {
        alert('Failed to save AI settings: ' + e.message);
      }
    }

    // ========== SUPPORT ==========
    let supportCache = [];

    async function loadSupport() {
      try {
        const data = await api('/admin/support');
        supportCache = data.requests || [];
        applySupportFilters();
      } catch (e) {
        document.getElementById('supportTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applySupportFilters() {
      const statusFilter = document.getElementById('supportFilterStatus').value;
      const priorityFilter = document.getElementById('supportFilterPriority').value;

      let filtered = supportCache;
      if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
      if (priorityFilter) filtered = filtered.filter(r => r.priority === priorityFilter);

      document.getElementById('supportCount').textContent = \`(\${filtered.length} of \${supportCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('supportTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No support requests.</p>';
        return;
      }

      const priorityColors = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
      const statusColors = {
        open: 'badge-red',
        in_progress: 'badge-yellow',
        resolved: 'badge-green',
        ai_review: 'badge-blue',
        ai_resolved: 'badge-green',
        escalated: 'badge-red'
      };

      const html = \`<table>
        <thead><tr><th>Time</th><th>User</th><th>Subject</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>\${filtered.map(r => {
          const validScreenshotUrl = safeUrl(r.screenshotUrl);
          return \`
          <tr class="clickable" data-action="view-support" data-ticket-id="\${escapeHtml(r.id)}" style="cursor:pointer;">
            <td style="font-size:11px;color:#666;">\${formatTime(r.timestamp)}</td>
            <td>\${escapeHtml(r.userName || r.userId)}\${r.tripId ? '<br><small style="color:#666;">Trip: ' + escapeHtml(r.tripId) + '</small>' : ''}\${r.adminNotes ? '<br><span class="badge badge-blue" style="font-size:10px;">Has Reply</span>' : ''}</td>
            <td>
              <strong>\${escapeHtml(r.subject)}</strong>
              \${validScreenshotUrl ? '<button class="btn btn-small btn-secondary" data-action="view-screenshot" data-url="' + escapeHtml(validScreenshotUrl) + '" onclick="event.stopPropagation()">View Screenshot</button>' : ''}
              <br><small style="color:#666;max-width:300px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${escapeHtml(r.message)}</small>
            </td>
            <td><span class="badge \${priorityColors[r.priority] || 'badge-gray'}">\${escapeHtml(r.priority)}</span></td>
            <td><span class="badge \${statusColors[r.status] || 'badge-gray'}">\${escapeHtml(r.status)}</span></td>
            <td>
              <select onclick="event.stopPropagation()" data-ticket-id="\${escapeHtml(r.id)}" onchange="updateSupportStatus(this.dataset.ticketId, this.value)" style="padding:4px;font-size:11px;">
                <option value="open" \${r.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in_progress" \${r.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" \${r.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                <option value="ai_review" \${r.status === 'ai_review' ? 'selected' : ''}>AI Review</option>
                <option value="ai_resolved" \${r.status === 'ai_resolved' ? 'selected' : ''}>AI Resolved</option>
                <option value="escalated" \${r.status === 'escalated' ? 'selected' : ''}>Escalated</option>
              </select>
            </td>
          </tr>
        \`}).join('')}</tbody>
      </table>\`;
      document.getElementById('supportTable').innerHTML = html;
    }

    function viewScreenshot(url) {
      // Open screenshot URL in new window
      window.open(url, '_blank');
    }

    let currentSupportTicket = null;

    function viewSupportDetail(ticketId) {
      const ticket = supportCache.find(t => t.id === ticketId);
      if (!ticket) return;

      currentSupportTicket = ticket;
      document.getElementById('supportDetailTitle').textContent = ticket.subject;

      const priorityColors = { high: '#dc3545', medium: '#ffc107', low: '#6c757d' };
      const statusColors = { open: '#dc3545', in_progress: '#ffc107', resolved: '#28a745' };

      document.getElementById('supportDetailContent').innerHTML = \`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div>
            <div style="margin-bottom:10px;"><strong>User:</strong> \${ticket.userName || ticket.userId}</div>
            <div style="margin-bottom:10px;"><strong>Submitted:</strong> \${new Date(ticket.timestamp).toLocaleString()}</div>
            \${ticket.tripId ? '<div style="margin-bottom:10px;"><strong>Trip:</strong> ' + ticket.tripId + '</div>' : ''}
          </div>
          <div>
            <div style="margin-bottom:10px;"><strong>Priority:</strong> <span style="color:\${priorityColors[ticket.priority]};font-weight:600;">\${ticket.priority.toUpperCase()}</span></div>
            <div style="margin-bottom:10px;"><strong>Status:</strong> <span style="color:\${statusColors[ticket.status]};font-weight:600;">\${ticket.status.replace('_', ' ').toUpperCase()}</span></div>
            <div style="margin-bottom:10px;"><strong>Ticket ID:</strong> <code style="font-size:11px;">\${ticket.id}</code></div>
          </div>
        </div>
        <div style="background:#f8f9fa;padding:15px;border-radius:8px;border:1px solid #dee2e6;">
          <strong style="display:block;margin-bottom:10px;">Message:</strong>
          <div style="white-space:pre-wrap;line-height:1.6;">\${ticket.message}</div>
        </div>
        \${ticket.screenshotUrl ? '<div style="margin-top:15px;"><strong>Screenshot:</strong> <a href="' + ticket.screenshotUrl + '" target="_blank">View Image</a></div>' : ''}
      \`;

      document.getElementById('supportAdminNotes').value = ticket.adminNotes || '';
      document.getElementById('supportDetailModal').classList.add('active');
    }

    async function saveSupportNotes() {
      if (!currentSupportTicket) return;

      const notes = document.getElementById('supportAdminNotes').value;
      try {
        await api('/admin/support/' + currentSupportTicket.id, {
          method: 'PUT',
          body: JSON.stringify({ adminNotes: notes })
        });
        alert('Notes saved!');
        loadSupport();
      } catch (e) {
        alert('Error saving notes: ' + e.message);
      }
    }

    async function updateSupportStatus(ticketId, status) {
      try {
        await api('/admin/support/' + ticketId, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        loadSupport();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== BILLING ==========
    let promoCodesCache = [];

    async function loadBillingStats() {
      try {
        const data = await api('/admin/billing-stats');
        document.getElementById('activeSubs').textContent = data.activeSubs || 0;
        document.getElementById('trialingSubs').textContent = data.trialingSubs || 0;
        document.getElementById('pastDueSubs').textContent = data.pastDueSubs || 0;
        document.getElementById('mrr').textContent = '$' + (data.mrr || 0);
      } catch (e) {
        console.error('Failed to load billing stats:', e);
      }
    }

    async function loadPromoCodes() {
      try {
        const data = await api('/admin/promo-codes');
        promoCodesCache = data.codes || [];
        renderPromoCodes();
      } catch (e) {
        document.getElementById('promoCodesTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function renderPromoCodes() {
      if (promoCodesCache.length === 0) {
        document.getElementById('promoCodesTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No promo codes created yet.</p>';
        return;
      }
      const html = \`<table>
        <thead><tr><th>Code</th><th>Discount</th><th>Duration</th><th>Max Uses</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>\${promoCodesCache.map(c => \`
          <tr>
            <td><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">\${c.code}</code></td>
            <td>\${c.percentOff ? c.percentOff + '%' : '$' + c.amountOff} off</td>
            <td>\${c.duration === 'once' ? 'First payment' : c.duration === 'forever' ? 'Forever' : c.duration}</td>
            <td>\${c.maxRedemptions || 'Unlimited'}</td>
            <td style="font-size:11px;color:#666;">\${new Date(c.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-small btn-secondary" onclick="copyPromoCode('\${c.code}')">Copy</button>
              <button class="btn btn-small btn-secondary" onclick="deletePromoCode('\${c.code}')" style="color:#dc3545;">Delete</button>
            </td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('promoCodesTable').innerHTML = html;
    }

    function renderSubscriptions() {
      const usersWithSubs = usersCache.filter(u => u.subscription);
      if (usersWithSubs.length === 0) {
        document.getElementById('subscriptionsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No subscriptions yet.</p>';
        return;
      }
      const statusColors = { active: 'badge-green', trialing: 'badge-blue', past_due: 'badge-red', canceled: 'badge-gray', unpaid: 'badge-yellow' };
      const html = \`<table>
        <thead><tr><th>User</th><th>Agency</th><th>Tier</th><th>Status</th><th>Period End</th><th>Actions</th></tr></thead>
        <tbody>\${usersWithSubs.map(u => \`
          <tr>
            <td>\${u.name}<br><small style="color:#666;">\${u.email}</small></td>
            <td>\${u.agency.name}</td>
            <td>\${u.subscription.tier || 'none'}</td>
            <td><span class="badge \${statusColors[u.subscription.status] || 'badge-gray'}">\${u.subscription.status}</span></td>
            <td style="font-size:11px;">\${u.subscription.currentPeriodEnd ? new Date(u.subscription.currentPeriodEnd).toLocaleDateString() : '-'}</td>
            <td>
              <button class="btn btn-small btn-secondary" onclick="copySubscribeLink('\${u.userId}')">Copy Subscribe Link</button>
            </td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('subscriptionsTable').innerHTML = html;
    }

    function showPromoCodeModal() {
      document.getElementById('promoCodeForm').reset();
      document.getElementById('durationMonthsGroup').style.display = 'none';
      document.getElementById('promoCodeModal').classList.add('active');
    }

    function toggleDurationMonths() {
      const duration = document.getElementById('promoDuration').value;
      document.getElementById('durationMonthsGroup').style.display = duration === 'repeating' ? 'block' : 'none';
    }

    function togglePromoFields() {
      // Future: adjust placeholder or validation based on type
    }

    document.getElementById('promoCodeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('promoName').value;
      const type = document.getElementById('promoType').value;
      const value = parseInt(document.getElementById('promoValue').value);
      const duration = document.getElementById('promoDuration').value;
      const durationInMonths = document.getElementById('promoDurationMonths').value;
      const maxRedemptions = document.getElementById('promoMaxRedemptions').value;

      try {
        const body = {
          name,
          [type === 'percent' ? 'percentOff' : 'amountOff']: value,
          duration,
          ...(duration === 'repeating' && durationInMonths && { durationInMonths: parseInt(durationInMonths) }),
          ...(maxRedemptions && { maxRedemptions: parseInt(maxRedemptions) })
        };
        await api('/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) });
        closeModal();
        loadPromoCodes();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    function copyPromoCode(code) {
      navigator.clipboard.writeText(code);
      alert('Copied: ' + code);
    }

    function copySubscribeLink(userId) {
      const link = window.location.origin + '/subscribe?userId=' + userId;
      navigator.clipboard.writeText(link);
      alert('Copied subscribe link for user');
    }

    async function deletePromoCode(code) {
      if (!confirm('Delete promo code ' + code + '? This will deactivate it in Stripe.')) return;
      try {
        await api('/admin/promo-codes/' + code, { method: 'DELETE' });
        loadPromoCodes();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== MESSAGES ==========
    let broadcastsCache = [];
    let threadsCache = [];
    let currentThread = null;

    async function loadMessages() {
      try {
        const data = await api('/admin/messages');
        broadcastsCache = data.broadcasts || [];
        threadsCache = data.directThreads || [];

        document.getElementById('activeBroadcasts').textContent = data.stats.activeBroadcasts;
        document.getElementById('openThreads').textContent = data.stats.openThreads;
        document.getElementById('unreadReplies').textContent = data.stats.unreadUserReplies;

        renderBroadcasts();
        populateThreadUserFilter();
        applyThreadFilters();
      } catch (e) {
        document.getElementById('broadcastsTable').innerHTML = '<p style="color:#c00;">Error: ' + e.message + '</p>';
      }
    }

    function renderBroadcasts() {
      if (broadcastsCache.length === 0) {
        document.getElementById('broadcastsTable').innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No broadcast announcements. Click "+ New Broadcast" to send one to all users.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Time</th><th>Title</th><th>Priority</th><th>Stats</th><th>Actions</th></tr></thead>
        <tbody>\${broadcastsCache.map(b => \`
          <tr>
            <td style="font-size:11px;">\${formatTime(b.createdAt)}</td>
            <td><strong>\${b.title}</strong><br><small style="color:#666;">\${b.body.length > 80 ? b.body.substring(0, 80) + '...' : b.body}</small></td>
            <td><span class="badge \${b.priority === 'urgent' ? 'badge-red' : 'badge-blue'}">\${b.priority}</span></td>
            <td style="font-size:11px;">\${b.stats.pending} pending / \${b.stats.dismissed} dismissed</td>
            <td><button class="btn btn-small btn-secondary" onclick="deleteBroadcast('\${b.id}')">Delete</button></td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('broadcastsTable').innerHTML = html;
    }

    function populateThreadUserFilter() {
      const select = document.getElementById('threadFilterUser');
      const userIds = [...new Set(threadsCache.map(t => t.userId))];
      select.innerHTML = '<option value="">All Users</option>' +
        userIds.map(uid => {
          const t = threadsCache.find(x => x.userId === uid);
          return \`<option value="\${uid}">\${t?.userName || uid}</option>\`;
        }).join('');
    }

    function applyThreadFilters() {
      const userFilter = document.getElementById('threadFilterUser').value;
      const statusFilter = document.getElementById('threadFilterStatus').value;
      const unreadFilter = document.getElementById('threadFilterUnread').value;

      let filtered = threadsCache;
      if (userFilter) filtered = filtered.filter(t => t.userId === userFilter);
      if (statusFilter) filtered = filtered.filter(t => t.status === statusFilter);
      if (unreadFilter === 'unread') filtered = filtered.filter(t => t.unreadCount > 0);

      renderThreads(filtered);
    }

    function renderThreads(threads) {
      if (threads.length === 0) {
        document.getElementById('threadsTable').innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No message threads. Click "+ New Message" to send a direct message to a user.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>User</th><th>Subject</th><th>Last Message</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>\${threads.map(t => \`
          <tr style="cursor:pointer;" onclick="viewThread('\${t.id}', '\${t.userId}')">
            <td>\${t.userName}\${t.unreadCount > 0 ? '<br><span class="badge badge-red">' + t.unreadCount + ' unread</span>' : ''}</td>
            <td><strong>\${t.subject}</strong><br><small style="color:#666;">\${t.lastMessage?.preview || ''}</small></td>
            <td style="font-size:11px;color:#666;">\${t.lastMessage?.timestamp ? formatTime(t.lastMessage.timestamp) : ''}<br>\${t.lastMessage?.sender === 'user' ? '← User' : '→ Admin'}</td>
            <td><span class="badge \${t.status === 'open' ? 'badge-green' : 'badge-gray'}">\${t.status}</span></td>
            <td><button class="btn btn-small btn-primary" onclick="event.stopPropagation();viewThread('\${t.id}', '\${t.userId}')">View</button></td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('threadsTable').innerHTML = html;
    }

    async function viewThread(threadId, userId) {
      try {
        const data = await api('/admin/messages/thread/' + userId + '/' + threadId);
        currentThread = { ...data.thread, userId };

        document.getElementById('threadDetailSubject').textContent = currentThread.subject + ' (with ' + currentThread.userName + ')';

        const messagesHtml = currentThread.messages.map(m => \`
          <div style="margin-bottom:15px;padding:10px;border-radius:8px;\${m.sender === 'admin' ? 'background:#e3f2fd;margin-left:40px;' : 'background:#fff;margin-right:40px;border:1px solid #ddd;'}">
            <div style="font-size:11px;color:#666;margin-bottom:5px;">
              <strong>\${m.senderName || m.sender}</strong> - \${new Date(m.timestamp).toLocaleString()}
              \${!m.read && m.sender === 'user' ? '<span class="badge badge-red" style="margin-left:5px;">New</span>' : ''}
            </div>
            <div style="white-space:pre-wrap;">\${m.body}</div>
          </div>
        \`).join('');

        document.getElementById('threadMessages').innerHTML = messagesHtml;
        document.getElementById('threadReplyBody').value = '';
        document.getElementById('threadDetailModal').classList.add('active');

        // Mark user messages as read
        await api('/admin/messages/thread/' + userId + '/' + threadId + '/mark-read', { method: 'POST' });
        loadMessages();
      } catch (e) {
        alert('Error loading thread: ' + e.message);
      }
    }

    function showBroadcastModal() {
      document.getElementById('broadcastTitle').value = '';
      document.getElementById('broadcastBody').value = '';
      document.getElementById('broadcastPriority').value = 'normal';
      document.getElementById('broadcastExpires').value = '';
      document.getElementById('broadcastModal').classList.add('active');
    }

    function closeBroadcastModal() {
      document.getElementById('broadcastModal').classList.remove('active');
    }

    async function createBroadcast() {
      const title = document.getElementById('broadcastTitle').value;
      const body = document.getElementById('broadcastBody').value;
      const priority = document.getElementById('broadcastPriority').value;
      const expiresInput = document.getElementById('broadcastExpires').value;

      if (!title || !body) {
        alert('Title and message are required');
        return;
      }

      try {
        await api('/admin/messages/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            title,
            body,
            priority,
            expiresAt: expiresInput ? new Date(expiresInput).toISOString() : null
          })
        });
        closeBroadcastModal();
        loadMessages();
        alert('Broadcast sent to all users!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function deleteBroadcast(broadcastId) {
      if (!confirm('Delete this broadcast? Users who haven\\'t seen it won\\'t receive it.')) return;
      try {
        await api('/admin/messages/broadcast/' + broadcastId, { method: 'DELETE' });
        loadMessages();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    function showDirectMessageModal() {
      // Populate user dropdown
      const select = document.getElementById('messageRecipient');
      select.innerHTML = '<option value="">Select user...</option>' +
        usersCache.map(u => \`<option value="\${u.userId}">\${u.name} (\${u.email || u.userId})</option>\`).join('');
      document.getElementById('messageSubject').value = '';
      document.getElementById('messageBody').value = '';
      document.getElementById('directMessageModal').classList.add('active');
    }

    function closeDirectMessageModal() {
      document.getElementById('directMessageModal').classList.remove('active');
    }

    async function sendDirectMessage() {
      const userId = document.getElementById('messageRecipient').value;
      const subject = document.getElementById('messageSubject').value;
      const body = document.getElementById('messageBody').value;

      if (!userId || !subject || !body) {
        alert('All fields are required');
        return;
      }

      try {
        await api('/admin/messages/direct', {
          method: 'POST',
          body: JSON.stringify({ userId, subject, body })
        });
        closeDirectMessageModal();
        loadMessages();
        alert('Message sent to user!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    function closeThreadDetailModal() {
      document.getElementById('threadDetailModal').classList.remove('active');
    }

    async function sendThreadReply() {
      if (!currentThread) return;

      const body = document.getElementById('threadReplyBody').value;
      if (!body) {
        alert('Please enter a reply message');
        return;
      }

      try {
        await api('/admin/messages/thread/' + currentThread.userId + '/' + currentThread.id, {
          method: 'PUT',
          body: JSON.stringify({ body })
        });
        viewThread(currentThread.id, currentThread.userId);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function closeThread() {
      if (!currentThread) return;
      if (!confirm('Close this thread? The user can still reply to reopen it.')) return;

      try {
        await api('/admin/messages/thread/' + currentThread.userId + '/' + currentThread.id, {
          method: 'PUT',
          body: JSON.stringify({ status: 'closed' })
        });
        closeThreadDetailModal();
        loadMessages();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== KNOWLEDGE BASE ==========
    let approvedKnowledgeCache = { troubleshooting: [], faq: [] };

    async function loadKnowledgeStats() {
      try {
        const stats = await api('/admin/knowledge/stats');
        document.getElementById('kbPendingCount').textContent = stats.pending || 0;
        document.getElementById('kbPendingBadge').textContent = stats.pending || 0;
        document.getElementById('kbTroubleshootingCount').textContent = stats.approved?.troubleshooting || 0;
        document.getElementById('kbFaqCount').textContent = stats.approved?.faq || 0;
        document.getElementById('kbTotalApproved').textContent = stats.approved?.total || 0;
      } catch (e) {
        console.error('Error loading knowledge stats:', e);
      }
    }

    async function loadPendingProposals() {
      try {
        const data = await api('/admin/knowledge/pending');
        const proposals = data.proposals || [];

        if (proposals.length === 0) {
          document.getElementById('kbPendingList').innerHTML = '<p style="color:#8b949e;text-align:center;padding:20px;">No pending proposals</p>';
          return;
        }

        const html = proposals.map(p => \`
          <div class="comment-box" style="margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <span class="badge badge-blue">\${escapeHtml(p.category)}</span>
              <span style="font-size:11px;color:#8b949e;">by \${escapeHtml(p.proposedByName)} on \${new Date(p.proposedAt).toLocaleDateString()}</span>
            </div>
            <h4 style="margin-bottom:8px;color:#f0f6fc;">\${escapeHtml(p.problem)}</h4>
            <p style="color:#c9d1d9;margin-bottom:8px;">\${escapeHtml(p.solution)}</p>
            \${p.context ? \`<p style="font-size:12px;color:#8b949e;font-style:italic;">Context: \${escapeHtml(p.context)}</p>\` : ''}
            <div style="margin-top:12px;display:flex;gap:8px;">
              <button class="btn btn-primary btn-small" onclick="approveProposal('\${escapeJsString(p.id)}')">Approve</button>
              <button class="btn btn-secondary btn-small" onclick="editAndApproveProposal('\${escapeJsString(p.id)}', '\${escapeJsString(p.problem)}', '\${escapeJsString(p.solution)}')">Edit & Approve</button>
              <button class="btn btn-secondary btn-small" onclick="rejectProposal('\${escapeJsString(p.id)}')">Reject</button>
            </div>
          </div>
        \`).join('');

        document.getElementById('kbPendingList').innerHTML = html;
      } catch (e) {
        document.getElementById('kbPendingList').innerHTML = '<p class="error">Error loading proposals: ' + escapeHtml(e.message) + '</p>';
      }
    }

    async function approveProposal(proposalId) {
      if (!confirm('Approve this solution? It will be added to the knowledge base.')) return;
      try {
        await api('/admin/knowledge/review/' + proposalId, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve' })
        });
        loadPendingProposals();
        loadKnowledgeStats();
        loadApprovedKnowledge();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    function editAndApproveProposal(proposalId, problem, solution) {
      const newProblem = prompt('Edit problem description:', problem);
      if (newProblem === null) return;
      const newSolution = prompt('Edit solution:', solution);
      if (newSolution === null) return;

      approveWithEdits(proposalId, newProblem, newSolution);
    }

    async function approveWithEdits(proposalId, problem, solution) {
      try {
        await api('/admin/knowledge/review/' + proposalId, {
          method: 'POST',
          body: JSON.stringify({
            action: 'approve',
            edits: { problem, solution }
          })
        });
        loadPendingProposals();
        loadKnowledgeStats();
        loadApprovedKnowledge();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function rejectProposal(proposalId) {
      if (!confirm('Reject this proposal? It will be removed from the queue.')) return;
      try {
        await api('/admin/knowledge/review/' + proposalId, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject' })
        });
        loadPendingProposals();
        loadKnowledgeStats();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function loadApprovedKnowledge() {
      const category = document.getElementById('kbCategoryFilter').value;
      try {
        const data = await api('/admin/knowledge/approved' + (category ? '?category=' + category : ''));

        if (category) {
          approvedKnowledgeCache[category] = data.items || [];
        } else {
          approvedKnowledgeCache.troubleshooting = data.troubleshooting?.items || [];
          approvedKnowledgeCache.faq = data.faq?.items || [];
        }

        renderApprovedKnowledge();
      } catch (e) {
        document.getElementById('kbApprovedList').innerHTML = '<p class="error">Error loading knowledge: ' + escapeHtml(e.message) + '</p>';
      }
    }

    function filterApprovedKnowledge() {
      renderApprovedKnowledge();
    }

    function renderApprovedKnowledge() {
      const category = document.getElementById('kbCategoryFilter').value;
      const search = document.getElementById('kbSearch').value.toLowerCase();

      let items = [];
      if (category) {
        items = approvedKnowledgeCache[category] || [];
      } else {
        items = [...(approvedKnowledgeCache.troubleshooting || []), ...(approvedKnowledgeCache.faq || [])];
      }

      // Filter by search
      if (search) {
        items = items.filter(item =>
          item.problem.toLowerCase().includes(search) ||
          item.solution.toLowerCase().includes(search)
        );
      }

      if (items.length === 0) {
        document.getElementById('kbApprovedList').innerHTML = '<p style="color:#8b949e;text-align:center;padding:20px;">No approved knowledge entries</p>';
        return;
      }

      const html = items.map(item => \`
        <div class="comment-box" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <span class="badge badge-green">\${escapeHtml(item.category)}</span>
            <button class="btn btn-secondary btn-small" onclick="deleteApprovedKnowledge('\${escapeJsString(item.id)}', '\${escapeJsString(item.category)}')">Delete</button>
          </div>
          <h4 style="margin-bottom:6px;color:#f0f6fc;font-size:14px;">\${escapeHtml(item.problem)}</h4>
          <p style="color:#c9d1d9;font-size:13px;">\${escapeHtml(item.solution)}</p>
          <div style="margin-top:8px;font-size:11px;color:#8b949e;">
            Approved \${new Date(item.approvedAt).toLocaleDateString()} · Used \${item.usageCount || 0} times
          </div>
        </div>
      \`).join('');

      document.getElementById('kbApprovedList').innerHTML = html;
    }

    async function deleteApprovedKnowledge(itemId, category) {
      if (!confirm('Delete this knowledge entry? It will no longer be shown to users.')) return;
      try {
        await api('/admin/knowledge/approved/' + itemId + '?category=' + category, { method: 'DELETE' });
        loadKnowledgeStats();
        loadApprovedKnowledge();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== MAINTENANCE ==========

    async function loadMaintenanceStatus() {
      try {
        const data = await api('/admin/maintenance/status');

        // Update stats cards
        if (data.lastRun) {
          const lastRunDate = new Date(data.lastRun.timestamp);
          document.getElementById('maintLastRun').textContent = lastRunDate.toLocaleString();
          document.getElementById('maintDuration').textContent = data.lastRun.duration + 'ms';
        }

        if (data.globalStats) {
          document.getElementById('maintTotalUsers').textContent = data.globalStats.totalUsers || 0;
          document.getElementById('maintTotalTrips').textContent = data.globalStats.totalTrips || 0;
        }

        // Update details panel
        if (data.lastRun) {
          const tasks = data.lastRun.tasks;
          let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">';

          html += '<div><strong style="color:#58a6ff;">Cleanup Tasks</strong><br>';
          html += 'Telemetry archived: ' + (tasks.telemetryArchive?.archived || 0) + '<br>';
          html += 'Quotas cleaned: ' + (tasks.quotaCleanup?.deleted || 0) + '<br>';
          html += 'Logs cleaned: ' + (tasks.logCleanup?.deleted || 0) + '<br>';
          html += 'Activity cleaned: ' + (tasks.activityCleanup?.deleted || 0) + '</div>';

          html += '<div><strong style="color:#58a6ff;">Index Validation</strong><br>';
          html += 'Trip indexes checked: ' + (tasks.tripIndexValidation?.usersChecked || 0) + ' users<br>';
          html += 'Trip indexes repaired: ' + (tasks.tripIndexValidation?.repaired || 0) + '<br>';
          html += 'Orphaned trips found: ' + (tasks.tripIndexValidation?.orphanedTrips || 0) + '<br>';
          html += 'Comment indexes repaired: ' + (tasks.commentIndexValidation?.repaired || 0) + '</div>';

          html += '</div>';

          if (tasks.globalStats) {
            html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #30363d;">';
            html += '<strong style="color:#58a6ff;">Global Stats</strong><br>';
            html += 'Users: ' + tasks.globalStats.totalUsers + ' | ';
            html += 'Trips: ' + tasks.globalStats.totalTrips + ' | ';
            html += 'Active (7d): ' + tasks.globalStats.activeUsers7d;
            html += '</div>';
          }

          // Global Indexes section
          html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #30363d;">';
          html += '<strong style="color:#58a6ff;">Global Indexes (Admin Dashboard)</strong><br>';
          if (tasks.tripSummariesIndex) {
            const status = tasks.tripSummariesIndex.complete ? '<span style="color:#3fb950;">Complete</span>' : '<span style="color:#d29922;">Building...</span>';
            html += 'Trip Summaries: ' + tasks.tripSummariesIndex.processed + '/' + tasks.tripSummariesIndex.total + ' users ' + status + '<br>';
          }
          if (tasks.userActivityIndex) {
            html += 'User Activity: ' + tasks.userActivityIndex.activeCount + ' active / ' + tasks.userActivityIndex.totalUsers + ' total<br>';
          }
          if (tasks.commentsIndex) {
            html += 'Comments Index: ' + tasks.commentsIndex.tripsWithComments + ' trips with comments';
          }
          html += '</div>';

          document.getElementById('maintDetails').innerHTML = html;
        } else {
          document.getElementById('maintDetails').innerHTML = '<p style="color:#8b949e;">No maintenance runs yet</p>';
        }
      } catch (e) {
        console.error('Error loading maintenance status:', e);
        document.getElementById('maintDetails').innerHTML = '<p class="error">Error loading maintenance status</p>';
      }
    }

    async function loadMaintenanceHistory() {
      try {
        const data = await api('/admin/maintenance/history');

        if (!data.history || data.history.length === 0) {
          document.getElementById('maintHistory').innerHTML = '<p style="color:#8b949e;">No maintenance history available</p>';
          return;
        }

        let html = '<table class="data-table" style="width:100%">';
        html += '<thead><tr><th>Time</th><th>Duration</th><th>Cleanup</th><th>Validation</th><th>Indexes</th></tr></thead>';
        html += '<tbody>';

        for (const run of data.history.slice(0, 20)) {
          const time = new Date(run.timestamp).toLocaleString();
          const cleanup = (run.tasks.telemetryArchive?.archived || 0) +
                         (run.tasks.quotaCleanup?.deleted || 0) +
                         (run.tasks.logCleanup?.deleted || 0) +
                         (run.tasks.activityCleanup?.deleted || 0);
          const validation = (run.tasks.tripIndexValidation?.repaired || 0) +
                         (run.tasks.commentIndexValidation?.repaired || 0);
          const indexStatus = run.tasks.tripSummariesIndex?.complete ? 'OK' :
                             (run.tasks.tripSummariesIndex ? run.tasks.tripSummariesIndex.processed + '/' + run.tasks.tripSummariesIndex.total : '-');

          html += '<tr>';
          html += '<td style="font-size:12px;">' + escapeHtml(time) + '</td>';
          html += '<td>' + run.duration + 'ms</td>';
          html += '<td>' + cleanup + ' cleaned</td>';
          html += '<td>' + validation + ' repaired</td>';
          html += '<td>' + indexStatus + '</td>';
          html += '</tr>';
        }

        html += '</tbody></table>';
        document.getElementById('maintHistory').innerHTML = html;
      } catch (e) {
        console.error('Error loading maintenance history:', e);
        document.getElementById('maintHistory').innerHTML = '<p class="error">Error loading history</p>';
      }
    }

    async function runMaintenanceNow() {
      const btn = document.getElementById('runMaintBtn');
      const status = document.getElementById('maintRunStatus');
      btn.disabled = true;
      status.textContent = 'Running...';

      try {
        const result = await api('/admin/maintenance/run', { method: 'POST' });
        status.textContent = 'Completed in ' + result.result.duration + 'ms';
        status.style.color = '#3fb950';
        loadMaintenanceStatus();
        loadMaintenanceHistory();
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
        status.style.color = '#f85149';
      } finally {
        btn.disabled = false;
        setTimeout(() => { status.textContent = ''; status.style.color = '#8b949e'; }, 5000);
      }
    }

    // ========== MISSION CONTROL ==========
    let missionControlMode = 'live';
    let autoRefreshEnabled = true;
    let pollInterval = null;
    let lastActivityId = null;
    let activityCache_mc = [];

    // Mode tab switching
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        if (!mode) return;

        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.mode-panel').forEach(p => p.style.display = 'none');
        document.getElementById('panel-' + mode).style.display = 'block';

        missionControlMode = mode;

        if (mode === 'stats') loadStatsPanel();
        else if (mode === 'insights') loadInsightsPanel();
      });
    });

    // Auto-refresh toggle
    document.getElementById('autoRefreshToggle').addEventListener('change', function() {
      autoRefreshEnabled = this.checked;
      document.getElementById('refreshStatus').textContent = autoRefreshEnabled ? 'Polling every 3s' : 'Paused';
      if (autoRefreshEnabled) {
        startPolling();
      } else {
        stopPolling();
      }
    });

    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        if (missionControlMode === 'live' && autoRefreshEnabled) {
          loadActivityStream();
        }
      }, 3000);
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    async function loadActivityStream() {
      try {
        const params = new URLSearchParams();
        params.set('limit', '30');
        if (lastActivityId) params.set('since', activityCache_mc[0]?.timestamp || '');

        const data = await api('/admin/activity-stream?' + params.toString());

        // Check for new activities
        const newActivities = data.activities.filter(a =>
          !activityCache_mc.some(c => c.id === a.id)
        );

        if (newActivities.length > 0) {
          // Add new activities at the top
          activityCache_mc = [...newActivities, ...activityCache_mc].slice(0, 50);
          renderActivityBoard(newActivities.map(a => a.id));
        }

        // Update live stats
        updateLiveStats(data);
      } catch (e) {
        console.error('Activity stream error:', e);
      }
    }

    function renderActivityBoard(newIds = []) {
      const rows = activityCache_mc.slice(0, 25).map(a => {
        const isNew = newIds.includes(a.id);
        const isSlow = a.isSlow;
        const hasExpandableDetails = a.metadata?.fieldsChanged?.length > 3 || (a.metadata?.fieldsChanged?.length > 0 && a.metadata?.templateName);

        const tripLink = a.tripId
          ? \`<a href="#" class="trip-link" data-trip-id="\${escapeHtml(a.tripId)}" data-user-id="\${escapeHtml(a.userId)}" style="color:#3b82f6;text-decoration:none;">\${escapeHtml(a.tripId)}</a>\`
          : '-';

        const statusHtml = a.success
          ? '<span class="status-ok">✓ OK</span>'
          : \`<a href="#" class="status-err error-link" data-error-type="\${escapeHtml(a.errorType || 'unknown')}" data-tool="\${escapeHtml(a.tool)}" data-user="\${escapeHtml(a.user)}" data-time="\${escapeHtml(a.time)}" data-trip="\${escapeHtml(a.tripId || '')}">✗ \${escapeHtml(a.errorType || 'error')}</a>\`;

        const slowBadge = isSlow ? '<span class="slow-badge">SLOW</span>' : '';
        const expandIndicator = hasExpandableDetails ? '<span class="expand-indicator">▼</span>' : '';

        // Inline detail from server
        const detailClass = a.errorType ? 'col-detail error' : 'col-detail';
        const detailText = a.detail || '-';

        // Build expandable details row content (for complex metadata)
        let detailsContent = '';
        if (hasExpandableDetails) {
          if (a.metadata?.fieldsChanged?.length > 0) {
            detailsContent += \`<span class="detail-item"><span class="label">All Fields:</span><span class="value">\${escapeHtml(a.metadata.fieldsChanged.join(', '))}</span></span>\`;
          }
          if (a.metadata?.section) {
            detailsContent += \`<span class="detail-item"><span class="label">Section:</span><span class="value">\${escapeHtml(a.metadata.section)}</span></span>\`;
          }
          if (a.metadata?.templateName) {
            detailsContent += \`<span class="detail-item"><span class="label">Template:</span><span class="value">\${escapeHtml(a.metadata.templateName)}</span></span>\`;
          }
          if (a.metadata?.destination) {
            detailsContent += \`<span class="detail-item"><span class="label">Destination:</span><span class="value">\${escapeHtml(a.metadata.destination)}</span></span>\`;
          }
          detailsContent += \`<span class="detail-item"><span class="label">Duration:</span><span class="value">\${a.durationMs}ms</span></span>\`;
        }

        return \`
          <div class="board-row \${a.ageClass}\${isNew ? ' new' : ''}\${isSlow ? ' slow' : ''}\${hasExpandableDetails ? ' expandable' : ''}" data-id="\${a.id}">
            <span class="col-time">\${escapeHtml(a.time)}</span>
            <span class="col-user">\${escapeHtml(a.user).substring(0, 11)}\${expandIndicator}</span>
            <span class="col-action"><span>\${escapeHtml(a.action)}</span></span>
            <span class="col-trip">\${tripLink}</span>
            <span class="\${detailClass}" title="\${escapeHtml(detailText)}">\${escapeHtml(detailText)}</span>
            <span class="col-dur">\${escapeHtml(a.durationDisplay || '-')}\${slowBadge}</span>
            <span class="col-status">\${statusHtml}</span>
          </div>
          \${detailsContent ? \`<div class="board-row-details" data-for="\${a.id}">\${detailsContent}</div>\` : ''}
        \`;
      }).join('');

      document.getElementById('activityRows').innerHTML = rows || '<div style="padding:40px;text-align:center;color:#666;">No activity yet</div>';

      // Add click handlers for expandable rows
      document.querySelectorAll('#activityRows .board-row.expandable').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.trip-link') || e.target.closest('.error-link')) return;
          const id = row.dataset.id;
          const details = document.querySelector(\`.board-row-details[data-for="\${id}"]\`);
          if (details) {
            details.classList.toggle('expanded');
            const indicator = row.querySelector('.expand-indicator');
            if (indicator) indicator.textContent = details.classList.contains('expanded') ? '▲' : '▼';
          }
        });
      });

      // Add click handlers for trip links
      document.querySelectorAll('#activityRows .trip-link').forEach(link => {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tripId = link.dataset.tripId;
          const userId = link.dataset.userId;
          const publishedUrl = 'https://somotravel.us/trips/' + tripId + '.html';
          try {
            const res = await fetch(publishedUrl, { method: 'HEAD' });
            if (res.ok) {
              window.open(publishedUrl, '_blank');
              return;
            }
          } catch {}
          viewTripDetail(userId, tripId);
        });
      });

      // Add click handlers for error links
      document.querySelectorAll('#activityRows .error-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const errorType = link.dataset.errorType;
          const tool = link.dataset.tool;
          const user = link.dataset.user;
          const time = link.dataset.time;
          const trip = link.dataset.trip;
          alert(\`Error Details\\n\\nType: \${errorType}\\nTool: \${tool}\\nUser: \${user}\\nTime: \${time}\${trip ? '\\nTrip: ' + trip : ''}\\n\\nCommon causes:\\n- validation_error: Invalid input data\\n- not_found: Trip or resource not found\\n- auth_error: Permission denied\\n- timeout: Operation took too long\`);
        });
      });
    }

    function updateLiveStats(data) {
      const liveStats = data.liveStats || {};

      // Update main stats cards
      document.getElementById('liveCallsToday').textContent = liveStats.totalCallsToday || 0;
      document.getElementById('liveCallsSub').textContent = \`\${liveStats.uniqueUsersToday || 0} unique users\`;

      const activeUsers = new Set(activityCache_mc.filter(a => Date.now() - new Date(a.timestamp).getTime() < 3600000).map(a => a.userId)).size;
      document.getElementById('liveActiveUsers').textContent = activeUsers;
      document.getElementById('liveUsersSub').textContent = 'in last hour';

      const avgResponse = activityCache_mc.length > 0
        ? Math.round(activityCache_mc.slice(0, 20).reduce((sum, a) => sum + (a.durationMs || 0), 0) / Math.min(activityCache_mc.length, 20))
        : 0;
      document.getElementById('liveAvgResponse').textContent = avgResponse + 'ms';
      document.getElementById('liveP95').textContent = \`P95: \${liveStats.p95Threshold || 0}ms\`;
      document.getElementById('liveP95').className = liveStats.p95Threshold > 1000 ? 'sub-value highlight' : 'sub-value';

      const errors = activityCache_mc.filter(a => !a.success).length;
      const errorRate = activityCache_mc.length > 0 ? ((errors / activityCache_mc.length) * 100).toFixed(1) : '0';
      document.getElementById('liveErrorRate').textContent = errorRate + '%';
      const totalErrors = Object.values(liveStats.errorBreakdown || {}).reduce((a, b) => a + b, 0);
      document.getElementById('liveErrorsSub').textContent = \`\${totalErrors} errors today\`;

      // Render sidebar panels
      renderHourlyHeatmap(liveStats.hourlyBreakdown || {});
      renderErrorBreakdown(liveStats.errorBreakdown || {});
      renderToolDistribution(liveStats.toolDistribution || {});
      renderResponseSizes(liveStats.heavyTools || [], liveStats.avgBytesPerCall || 0);
      renderRecentErrors(data.recentErrors || []);
    }

    function renderHourlyHeatmap(hourlyData) {
      const maxCount = Math.max(...Object.values(hourlyData).map(h => h.count || 0), 1);
      let html = '';

      for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        const data = hourlyData[hour] || { count: 0, uniqueUsers: [] };
        const count = data.count || 0;
        const level = count === 0 ? 0 : Math.min(5, Math.ceil((count / maxCount) * 5));
        const users = data.uniqueUsers?.length || 0;
        const hourLabel = i === 0 ? '12am' : i < 12 ? \`\${i}am\` : i === 12 ? '12pm' : \`\${i - 12}pm\`;

        html += \`<div class="heatmap-cell level-\${level}" title="\${hourLabel}: \${count} calls, \${users} users">\${count || ''}</div>\`;
      }

      document.getElementById('hourlyHeatmap').innerHTML = html;
    }

    function renderErrorBreakdown(errorData) {
      // Build richer error data from activity cache - group by tool + error type
      const errorsByTool = {};
      activityCache_mc.filter(a => !a.success).forEach(a => {
        const tool = a.tool || 'unknown';
        const errType = a.errorType || 'error';
        const key = tool;
        if (!errorsByTool[key]) {
          errorsByTool[key] = { tool, count: 0, types: {}, users: new Set() };
        }
        errorsByTool[key].count++;
        errorsByTool[key].types[errType] = (errorsByTool[key].types[errType] || 0) + 1;
        errorsByTool[key].users.add(a.userId);
      });

      const entries = Object.values(errorsByTool).sort((a, b) => b.count - a.count);

      if (entries.length === 0) {
        document.getElementById('errorBreakdown').innerHTML = '<div style="color:#22c55e;text-align:center;padding:10px;font-size:11px;">✓ No errors</div>';
        return;
      }

      const toolNames = {
        get_context: 'Context', list_trips: 'List', read_trip: 'Read', save_trip: 'Save',
        patch_trip: 'Update', preview_publish: 'Preview', publish_trip: 'Publish',
        validate_trip: 'Validate', get_comments: 'Comments', read_trip_section: 'Section',
        get_prompt: 'Prompt', get_subscription: 'Subscribe', youtube_search: 'YouTube'
      };

      const maxCount = Math.max(...entries.map(e => e.count));
      const html = entries.slice(0, 5).map(entry => {
        const width = Math.max(8, (entry.count / maxCount) * 100);
        const toolName = toolNames[entry.tool] || entry.tool.replace(/_/g, ' ').substring(0, 12);
        const topError = Object.entries(entry.types).sort((a, b) => b[1] - a[1])[0];
        const errLabel = topError ? topError[0].replace(/_/g, ' ') : '';
        const userCount = entry.users.size;

        return \`
          <div class="error-bar" title="\${entry.tool}: \${entry.count} errors from \${userCount} user(s)\\nTop error: \${errLabel}">
            <div class="error-info">
              <span class="tool-name">\${escapeHtml(toolName)}</span>
              <span class="error-type">\${escapeHtml(errLabel)}</span>
            </div>
            <div class="bar-container"><div class="bar not_found" style="width:\${width}%"></div></div>
            <span class="count">\${entry.count}</span>
          </div>
        \`;
      }).join('');

      document.getElementById('errorBreakdown').innerHTML = html;
    }

    function renderToolDistribution(toolData) {
      const entries = Object.entries(toolData).sort((a, b) => b[1].count - a[1].count);
      if (entries.length === 0) {
        document.getElementById('toolDistribution').innerHTML = '<div style="color:#6b7280;text-align:center;padding:10px;font-size:11px;">No data yet</div>';
        return;
      }

      const maxCount = Math.max(...entries.map(e => e[1].count));
      const toolNames = {
        get_context: 'Context', list_trips: 'List', read_trip: 'Read', save_trip: 'Save',
        patch_trip: 'Update', preview_publish: 'Preview', publish_trip: 'Publish',
        validate_trip: 'Validate', get_comments: 'Comments', read_trip_section: 'Section'
      };

      const html = entries.slice(0, 8).map(([tool, data]) => {
        const width = Math.max(5, (data.count / maxCount) * 100);
        const name = toolNames[tool] || tool.replace(/_/g, ' ').substring(0, 10);
        return \`
          <div class="tool-bar" title="\${escapeHtml(tool)}: \${data.count} calls, \${data.successRate}% success, avg \${data.avgMs}ms">
            <span class="name">\${escapeHtml(name)}</span>
            <div class="bar-container"><div class="bar" style="width:\${width}%"></div></div>
            <span class="count">\${data.count}</span>
          </div>
        \`;
      }).join('');

      document.getElementById('toolDistribution').innerHTML = html;
    }

    function renderResponseSizes(heavyTools, avgBytesPerCall) {
      if (!heavyTools || heavyTools.length === 0) {
        document.getElementById('responseSizes').innerHTML = '<div style="color:#8b949e;text-align:center;padding:10px;font-size:11px;">Collecting data...</div>';
        return;
      }

      const formatBytes = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      };

      const toolNames = {
        get_context: 'Context', list_trips: 'List', read_trip: 'Read', save_trip: 'Save',
        patch_trip: 'Update', preview_publish: 'Preview', publish_trip: 'Publish',
        validate_trip: 'Validate', get_comments: 'Comments', read_trip_section: 'Section',
        get_prompt: 'Prompt', list_templates: 'Templates'
      };

      const maxBytes = Math.max(...heavyTools.map(t => t.avgBytes));
      const html = heavyTools.map(t => {
        const width = Math.max(5, (t.avgBytes / maxBytes) * 100);
        const name = toolNames[t.tool] || t.tool.replace(/_/g, ' ').substring(0, 10);
        const tokens = Math.round(t.avgBytes / 4);
        return \`
          <div class="size-bar" title="\${escapeHtml(t.tool)}: ~\${tokens} tokens avg">
            <span class="name">\${escapeHtml(name)}</span>
            <div class="bar-container"><div class="bar" style="width:\${width}%"></div></div>
            <span class="size">\${formatBytes(t.avgBytes)}</span>
          </div>
        \`;
      }).join('');

      const avgDisplay = avgBytesPerCall > 0 ? \`<div style="color:#8b949e;font-size:10px;margin-top:8px;text-align:center;">Avg: \${formatBytes(avgBytesPerCall)}/call (~\${Math.round(avgBytesPerCall/4)} tokens)</div>\` : '';

      document.getElementById('responseSizes').innerHTML = html + avgDisplay;
    }

    function renderRecentErrors(errors) {
      document.getElementById('errorCountBadge').textContent = errors.length;

      if (errors.length === 0) {
        document.getElementById('recentErrorsList').innerHTML = '<div style="color:#22c55e;text-align:center;padding:10px;font-size:11px;">No recent errors</div>';
        return;
      }

      const html = errors.map(err => \`
        <div class="error-item">
          <div class="error-header">
            <span class="error-type">\${escapeHtml(err.errorType || 'unknown')}</span>
            <span class="error-time">\${escapeHtml(err.time)} · \${escapeHtml(err.ageDisplay)}</span>
          </div>
          <div class="error-detail">
            <strong>\${escapeHtml(err.action)}</strong> by \${escapeHtml(err.user)}\${err.tripId ? \` on \${escapeHtml(err.tripId)}\` : ''}
          </div>
        </div>
      \`).join('');

      document.getElementById('recentErrorsList').innerHTML = html;
    }

    async function loadStatsPanel() {
      const period = document.getElementById('statsPeriod').value;
      try {
        const data = await api('/admin/metrics-summary?period=' + period);

        let toolsHtml = data.tools.map(t => \`
          <tr>
            <td>\${escapeHtml(t.displayName)}</td>
            <td>\${t.count}</td>
            <td>\${t.successRate}%</td>
            <td>\${t.avgDurationMs}ms</td>
            <td>\${t.p95DurationMs}ms</td>
          </tr>
        \`).join('');

        let topUsersHtml = data.topUsers.map(u => \`
          <tr>
            <td>\${escapeHtml(u.displayName)}</td>
            <td>\${u.count} calls</td>
          </tr>
        \`).join('');

        document.getElementById('statsContent').innerHTML = \`
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Total Calls</div><div class="value">\${data.overview.totalCalls}</div></div>
            <div class="stat-card"><div class="label">Unique Users</div><div class="value">\${data.overview.uniqueUsers}</div></div>
            <div class="stat-card"><div class="label">Error Rate</div><div class="value">\${data.overview.errorRate}%</div></div>
            <div class="stat-card"><div class="label">Avg Response</div><div class="value">\${data.overview.avgDurationMs}ms</div></div>
            <div class="stat-card"><div class="label">Peak Hour</div><div class="value">\${escapeHtml(data.overview.peakHour)}</div></div>
          </div>

          <h3 style="margin:20px 0 10px;">Tool Usage</h3>
          <table>
            <thead><tr><th>Tool</th><th>Calls</th><th>Success</th><th>Avg Time</th><th>P95</th></tr></thead>
            <tbody>\${toolsHtml}</tbody>
          </table>

          <h3 style="margin:20px 0 10px;">Top Users</h3>
          <table>
            <thead><tr><th>User</th><th>Activity</th></tr></thead>
            <tbody>\${topUsersHtml}</tbody>
          </table>
        \`;
      } catch (e) {
        document.getElementById('statsContent').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    async function loadInsightsPanel() {
      try {
        const data = await api('/admin/insights');

        const scoreClass = data.healthScore >= 80 ? 'good' : data.healthScore >= 50 ? 'warning' : 'bad';

        const recommendationsHtml = data.recommendations.map(r => \`
          <div class="recommendation \${r.type}">
            <div class="title">\${escapeHtml(r.title)}</div>
            <div class="message">\${escapeHtml(r.message)}</div>
            \${r.action ? '<div class="action">' + escapeHtml(r.action) + '</div>' : ''}
          </div>
        \`).join('') || '<p style="color:#666;">No recommendations at this time.</p>';

        const atRiskHtml = data.atRiskUsers.map(u => \`
          <tr>
            <td>\${escapeHtml(u.displayName)}</td>
            <td>\${escapeHtml(u.lastSeenFormatted)}</td>
            <td>\${u.daysSinceActive} days</td>
          </tr>
        \`).join('') || '<tr><td colspan="3" style="color:#666;text-align:center;">No at-risk users</td></tr>';

        // Create detailed user segment cards with user lists
        const segmentsHtml = Object.entries(data.userSegments).map(([key, seg]) => {
          const userList = seg.users && seg.users.length > 0
            ? seg.users.map(u => \`<div style="font-size:11px;padding:2px 0;border-bottom:1px solid #eee;"><span style="color:#333;">\${escapeHtml(u.displayName || u.userId)}</span> <span style="color:#999;float:right;">\${u.count} calls</span></div>\`).join('')
            : '<div style="font-size:11px;color:#999;">No users</div>';
          return \`
            <div class="stat-card" style="min-height:140px;">
              <div class="label">\${escapeHtml(seg.label)}</div>
              <div class="value" style="color:\${key === 'power' ? '#22c55e' : key === 'dormant' ? '#f97316' : '#3b82f6'}">\${seg.count}</div>
              <div style="font-size:10px;color:#666;margin-bottom:8px;">\${escapeHtml(seg.description)}</div>
              <div style="max-height:80px;overflow-y:auto;">\${userList}</div>
            </div>
          \`;
        }).join('');

        // Create power users leaderboard
        const powerUsers = data.userSegments.power?.users || [];
        const regularUsers = data.userSegments.regular?.users || [];
        const topUsers = [...powerUsers, ...regularUsers].slice(0, 10);
        const leaderboardHtml = topUsers.length > 0 ? \`
          <table style="font-size:12px;">
            <thead><tr><th>#</th><th>User</th><th>Calls</th><th>Status</th></tr></thead>
            <tbody>
              \${topUsers.map((u, i) => \`
                <tr>
                  <td style="width:30px;font-weight:bold;color:\${i < 3 ? '#f59e0b' : '#666'};">\${i + 1}</td>
                  <td>\${escapeHtml(u.displayName || u.userId)}</td>
                  <td style="font-weight:600;">\${u.count}</td>
                  <td><span class="badge \${u.count >= 50 ? 'badge-green' : 'badge-blue'}">\${u.count >= 50 ? 'Power' : 'Regular'}</span></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \` : '<p style="color:#666;">No active users this week.</p>';

        document.getElementById('insightsContent').innerHTML = \`
          <div class="health-score">
            <div class="score \${scoreClass}">\${data.healthScore}</div>
            <div>
              <div class="label">System Health Score</div>
              <div style="font-size:12px;color:#666;margin-top:4px;">
                Trend: <span style="color:\${data.trends.direction === 'up' ? '#22c55e' : data.trends.direction === 'down' ? '#ef4444' : '#666'}">\${data.trends.changeFormatted}</span> vs yesterday
              </div>
            </div>
          </div>

          <h3 style="margin-bottom:15px;">Recommendations</h3>
          \${recommendationsHtml}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">
            <div>
              <h3 style="margin-bottom:10px;">Top Users This Week</h3>
              \${leaderboardHtml}
            </div>
            <div>
              <h3 style="margin-bottom:10px;">At-Risk Users</h3>
              <table style="font-size:12px;">
                <thead><tr><th>User</th><th>Last Active</th><th>Inactive</th></tr></thead>
                <tbody>\${atRiskHtml}</tbody>
              </table>
            </div>
          </div>

          <h3 style="margin:20px 0 10px;">User Segments</h3>
          <div class="stats-grid">\${segmentsHtml}</div>
        \`;
      } catch (e) {
        document.getElementById('insightsContent').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    // Start Mission Control when tab is shown
    function initMissionControl() {
      loadActivityStream();
      startPolling();
    }

    // ========== INIT ==========
    async function init() {
      await Promise.all([loadStats(), loadUsers(), loadActivity(), loadTrips(), loadComments(), loadSupport(), loadAISettings(), loadBillingStats(), loadPromoCodes(), loadMessages(), loadKnowledgeStats(), loadPendingProposals(), loadApprovedKnowledge(), loadMaintenanceStatus(), loadMaintenanceHistory()]);
      renderRecentActivity();
      renderSubscriptions();
      initMissionControl();
    }
    init();
  </script>
</body>
</html>`;
