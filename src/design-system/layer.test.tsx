import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CollapseProvider,
  DirectionProvider,
  LayerProvider,
  ResizableProvider,
  useCollapsed,
  useLayer,
  useOwnSecondaryLayer,
  useResizable,
  useSecondaryDirection,
} from './layer'

function LayerProbe({ label }: { label: string }) {
  const layer = useLayer()
  return <div data-testid={label}>{layer}</div>
}

function SecondaryProbe({ label, children }: { label: string; children?: React.ReactNode }) {
  const layer = useOwnSecondaryLayer()
  return (
    <LayerProvider value={layer}>
      <div data-testid={`${label}-layer`}>{layer}</div>
      {children}
    </LayerProvider>
  )
}

describe('layer propagation', () => {
  it('defaults a standalone Primary (no enclosing Secondary) to layer 0', () => {
    render(<LayerProbe label="standalone" />)
    expect(screen.getByTestId('standalone')).toHaveTextContent('0')
  })

  it('puts a root Secondary at layer 0', () => {
    render(<SecondaryProbe label="root" />)
    expect(screen.getByTestId('root-layer')).toHaveTextContent('0')
  })

  it('gives a Primary the same layer as its nearest enclosing Secondary', () => {
    render(
      <SecondaryProbe label="root">
        <LayerProbe label="primary" />
      </SecondaryProbe>,
    )
    expect(screen.getByTestId('primary')).toHaveTextContent('0')
  })

  it('increments layer for each level of Secondary nesting', () => {
    render(
      <SecondaryProbe label="root">
        <SecondaryProbe label="nested">
          <LayerProbe label="primary" />
        </SecondaryProbe>
      </SecondaryProbe>,
    )
    expect(screen.getByTestId('root-layer')).toHaveTextContent('0')
    expect(screen.getByTestId('nested-layer')).toHaveTextContent('1')
    expect(screen.getByTestId('primary')).toHaveTextContent('1')
  })
})

function CollapseProbe() {
  const collapsed = useCollapsed()
  return <div data-testid="collapsed">{String(collapsed)}</div>
}

describe('collapse propagation', () => {
  it('defaults to not collapsed', () => {
    render(<CollapseProbe />)
    expect(screen.getByTestId('collapsed')).toHaveTextContent('false')
  })

  it('is isolated per Secondary subtree', () => {
    render(
      <CollapseProvider value={true}>
        <CollapseProbe />
        <CollapseProvider value={false}>
          <CollapseProbe />
        </CollapseProvider>
      </CollapseProvider>,
    )
    const [outer, inner] = screen.getAllByTestId('collapsed')
    expect(outer).toHaveTextContent('true')
    expect(inner).toHaveTextContent('false')
  })
})

function DirectionProbe() {
  const direction = useSecondaryDirection()
  return <div data-testid="direction">{direction}</div>
}

describe('direction propagation', () => {
  it('defaults to row', () => {
    render(<DirectionProbe />)
    expect(screen.getByTestId('direction')).toHaveTextContent('row')
  })

  it('reflects the nearest enclosing Secondary direction', () => {
    render(
      <DirectionProvider value="column">
        <DirectionProbe />
      </DirectionProvider>,
    )
    expect(screen.getByTestId('direction')).toHaveTextContent('column')
  })
})

function ResizableProbe() {
  const resizable = useResizable()
  return <div data-testid="resizable">{String(resizable)}</div>
}

describe('resizable capability propagation', () => {
  it('defaults to false — a Primary is not resizable unless granted', () => {
    render(<ResizableProbe />)
    expect(screen.getByTestId('resizable')).toHaveTextContent('false')
  })

  it('reflects the nearest enclosing Secondary granting it', () => {
    render(
      <ResizableProvider value={true}>
        <ResizableProbe />
      </ResizableProvider>,
    )
    expect(screen.getByTestId('resizable')).toHaveTextContent('true')
  })
})
