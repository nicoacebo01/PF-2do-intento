import React, { useState, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { InformationCircleIcon } from './Icons';

// FIX: Update HelpTooltipProps to accept optional children.
interface HelpTooltipProps {
  text: string;
  children?: React.ReactNode;
}

// FIX: Update HelpTooltip to render children if provided, otherwise render the default icon.
// This makes the component more flexible and fixes usage in RiskHeatmap.tsx.
// FIX: Implemented a React Portal to render the tooltip at the document body level.
// This solves z-index and stacking context issues, ensuring the tooltip always appears on top of other elements.
const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, children }) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipId = useId();

    const showTooltip = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top, // Position relative to viewport top
                left: rect.left + rect.width / 2, // Center horizontally
            });
            setVisible(true);
        }
    }, []);

    const hideTooltip = useCallback(() => {
        setVisible(false);
    }, []);

    // The Portal component renders the tooltip content at the end of `document.body`
    const TooltipPortal = () => {
        return createPortal(
            <div
                id={tooltipId}
                style={{ 
                    top: `${position.top}px`, 
                    left: `${position.left}px`,
                    zIndex: 9999, // Ensure it's on top of other elements
                }}
                className="absolute w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg transform -translate-x-1/2 -translate-y-full -mt-2 pointer-events-none"
                role="tooltip"
            >
                <p className="whitespace-pre-wrap">{text}</p>
                <div
                    className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800"
                ></div>
            </div>,
            document.body
        );
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                className="flex items-center"
                aria-describedby={visible ? tooltipId : undefined}
                tabIndex={0} // Make it focusable
            >
                {children || <InformationCircleIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-pointer" />}
            </div>
            {visible && <TooltipPortal />}
        </>
    );
};

export default HelpTooltip;
