import React, { useState, useEffect, useRef } from "react";

/**
 * Custom HOC to provide container width to components.
 * Replaces react-grid-layout's WidthProvider which has build-time resolution issues in Vite/v2.
 */
export function withWidth<P extends { width?: number }>(
  ComposedComponent: React.ComponentType<P>,
): React.FC<
  Omit<P, "width"> & {
    measureBeforeMount?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
> {
  return function WidthProviderWrapper(props) {
    const {
      measureBeforeMount = false,
      className,
      style,
      children,
      ...rest
    } = props;
    const [width, setWidth] = useState(1280);
    const [mounted, setMounted] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      const node = elementRef.current;
      if (!node) return;

      const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          const newWidth = entries[0].contentRect.width;
          if (newWidth > 0) {
            setWidth(newWidth);
          }
        }
      });

      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    }, [mounted]);

    if (measureBeforeMount && !mounted) {
      return <div className={className} style={style} ref={elementRef} />;
    }

    return (
      <div
        className={className}
        style={{ ...style, width: "100%" }}
        ref={elementRef}
      >
        <ComposedComponent {...(rest as unknown as P)} width={width}>
          {children}
        </ComposedComponent>
      </div>
    );
  };
}
