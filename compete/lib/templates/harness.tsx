/**
 * React Performance Test Harness
 *
 * This file is dynamically modified by the Vite server to import
 * the component under test and expose performance metrics.
 */

import React, { Profiler, useState, useCallback, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// Component import is injected by vite-server.ts
// @ts-ignore - Dynamic import placeholder
import { default as Component } from '__COMPONENT_PATH__'

// Props are injected by vite-server.ts
// @ts-ignore - Dynamic props placeholder
const componentProps = __COMPONENT_PROPS__

// Performance tracking
interface RenderInfo {
  id: string
  phase: 'mount' | 'update'
  actualDuration: number
  baseDuration: number
  startTime: number
  commitTime: number
}

interface PerfData {
  renders: RenderInfo[]
  fps: number[]
  startTime: number
  endTime: number
}

declare global {
  interface Window {
    __PERF_DATA__: PerfData
    __START_PERF_TEST__: () => void
    __STOP_PERF_TEST__: () => PerfData
    __READY__: boolean
  }
}

// Initialize performance data
window.__PERF_DATA__ = {
  renders: [],
  fps: [],
  startTime: 0,
  endTime: 0,
}

// FPS monitoring
let fpsFrameId: number | null = null
let lastFrameTime = 0

function startFpsMonitoring() {
  lastFrameTime = performance.now()

  function measureFrame(currentTime: number) {
    const delta = currentTime - lastFrameTime
    if (delta > 0) {
      const fps = 1000 / delta
      window.__PERF_DATA__.fps.push(fps)
    }
    lastFrameTime = currentTime
    fpsFrameId = requestAnimationFrame(measureFrame)
  }

  fpsFrameId = requestAnimationFrame(measureFrame)
}

function stopFpsMonitoring() {
  if (fpsFrameId !== null) {
    cancelAnimationFrame(fpsFrameId)
    fpsFrameId = null
  }
}

// Profiler callback
function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  window.__PERF_DATA__.renders.push({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  })
}

// Test controls exposed to Playwright
window.__START_PERF_TEST__ = () => {
  window.__PERF_DATA__ = {
    renders: [],
    fps: [],
    startTime: performance.now(),
    endTime: 0,
  }
  startFpsMonitoring()
}

window.__STOP_PERF_TEST__ = () => {
  stopFpsMonitoring()
  window.__PERF_DATA__.endTime = performance.now()
  return window.__PERF_DATA__
}

// Wrapped component with Profiler
function TestHarness() {
  return (
    <Profiler id="component-under-test" onRender={onRenderCallback}>
      <Component {...componentProps} />
    </Profiler>
  )
}

// Mount the app
const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <TestHarness />
  </React.StrictMode>
)

// Signal ready
window.__READY__ = true
