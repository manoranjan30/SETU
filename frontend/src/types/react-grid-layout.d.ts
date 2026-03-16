declare module "react-grid-layout" {
  import * as React from "react";

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
    moved?: boolean;
    isBounded?: boolean;
  }

  export interface Layouts {
    [P: string]: Layout[];
  }

  export interface ResponsiveProps {
    className?: string;
    style?: React.CSSProperties;
    width?: number;
    autoSize?: boolean;
    cols?: { [P: string]: number };
    breakpoints?: { [P: string]: number };
    layouts?: Layouts;
    margin?: [number, number] | { [P: string]: [number, number] };
    containerPadding?: [number, number] | { [P: string]: [number, number] };
    rowHeight?: number;
    compactType?: "vertical" | "horizontal" | null;
    isDraggable?: boolean;
    isResizable?: boolean;
    isBounded?: boolean;
    draggableCancel?: string;
    draggableHandle?: string;
    isDroppable?: boolean;
    preventCollision?: boolean;
    useCSSTransforms?: boolean;
    transformScale?: number;
    allowOverlap?: boolean;
    onLayoutChange?: (currentLayout: Layout[], allLayouts: Layouts) => void;
    onBreakpointChange?: (newBreakpoint: string, newCols: number) => void;
    onDragStart?: (...args: any[]) => void;
    onDrag?: (...args: any[]) => void;
    onDragStop?: (...args: any[]) => void;
    onResizeStart?: (...args: any[]) => void;
    onResize?: (...args: any[]) => void;
    onResizeStop?: (...args: any[]) => void;
    onDrop?: (layout: Layout[], item: Layout, e: Event) => void;
    children?: React.ReactNode;
  }

  export const Responsive: React.ComponentType<ResponsiveProps>;

  export interface WidthProviderProps {
    measureBeforeMount?: boolean;
  }

  export function WidthProvider<P>(
    component: React.ComponentType<P>,
  ): React.ComponentType<P & WidthProviderProps>;

  const GridLayout: React.ComponentType<any>;
  export default GridLayout;
}

declare module "react-grid-layout/legacy" {
  export {
    Responsive,
    WidthProvider,
    Layout,
    Layouts,
    ResponsiveProps,
    WidthProviderProps,
  } from "react-grid-layout";

  export default function ReactGridLayout(props: any): any;
}

declare module "react-grid-layout/css/styles.css" {}
