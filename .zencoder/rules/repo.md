---
description: Repository Information Overview
alwaysApply: true
---

# Big-Moove-Find Information

## Summary
A Next.js application for real-time market data analysis and visualization. The project connects to Upstox's market data feed via WebSocket, processes the data to detect significant market movements, and displays alerts and visualizations on a dashboard.

## Structure
- **app/**: Next.js application routes and pages
- **components/**: React components including UI elements and visualization components
- **lib/**: Core functionality modules
  - **analytics/**: Market data analysis algorithms
  - **client/**: Client-side data handling
  - **feed/**: WebSocket feed connection and data processing
  - **stores/**: State management using Zustand

## Language & Runtime
**Language**: TypeScript
**Version**: ES2017 target
**Framework**: Next.js 15.5.4
**React**: 19.1.0
**Build System**: Next.js with Turbopack
**Package Manager**: pnpm (based on lock file)

## Dependencies
**Main Dependencies**:
- **next**: 15.5.4 - React framework
- **react**: 19.1.0 - UI library
- **protobufjs**: 7.5.4 - Protocol buffers for binary data handling
- **ws**: 8.18.3 - WebSocket client
- **zustand**: 5.0.8 - State management
- **framer-motion**: 12.23.24 - Animation library
- **@radix-ui/react-***: UI component primitives

**Development Dependencies**:
- **typescript**: 5.x - Type checking
- **eslint**: 9.x - Code linting
- **tailwindcss**: 4.x - CSS framework

## Build & Installation
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start
```

## Main Components

### Market Data Feed
The application connects to Upstox's market data feed using WebSockets. The connection is managed in `lib/feed/server-ws.ts`, which handles:
- Authentication with Upstox API
- WebSocket connection management
- Binary data decoding
- Feed subscription management

### Big Move Detection
The core analytics functionality is in `lib/analytics/BigMoveDetector.ts`, which:
- Analyzes market data for significant movements
- Calculates scores based on volume, price range, order book, and options Greeks
- Generates alerts with different severity levels
- Provides detailed signals about market conditions

### Dashboard UI
The dashboard (`app/dashboard/page.tsx`) displays:
- Real-time market alerts
- Heatmap visualization of top movers
- Summary statistics
- Connection status indicators

## Testing
**Test Files**: Located in `lib/tests/`
**Test Approach**: Manual testing scripts
**Run Command**:
```bash
# Run complete workflow test
ts-node lib/tests/test_complete_workflow.ts
```