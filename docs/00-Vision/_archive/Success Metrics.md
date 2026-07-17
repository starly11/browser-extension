# Success Metrics

## Product-Level Metrics
- **Time to first value**: minutes from install to first successful automatically-attached-file answer. Target: under 3 minutes.
- **Manual file attachment rate**: how often users still manually attach files despite semantic attachment being available. Target: trending toward near-zero for supported project types.
- **Permission trust signal**: % of users who leave default permissions at "Ask Every Time" vs. upgrading to "Allowed" over time — a proxy for growing trust, not a vanity metric to be gamed.
- **Adapter break rate**: number of adapter failures per provider per month due to UI changes. Target: adapter failures degrade to Manual mode with zero silent wrong answers — a "graceful degradation" rate of 100%.
- **Task recovery rate**: % of interrupted tasks (crash, tab close) that are either resumed or clearly marked abandoned, with 0% silently lost.

## Engineering-Level Metrics
- **Contract stability**: number of Planner/Worker/Tool Protocol breaking changes per quarter. Target: 0 after v1 freeze — only adapters should need to change in response to provider UI changes.
- **Time to add a new tool**: from spec to working tool behind the Tool Protocol, without touching Runtime core. Target: under 1 day for a simple tool.
- **Time to add a new adapter**: for a new AI provider, implementing the fixed adapter interface. Target: under 1 week for a well-behaved provider UI.

## What We Explicitly Do Not Optimize For
- Raw automation speed at the cost of permission friction — a fast tool that silently oversteps trust is a failure, not a success, per Design Principles.
