import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BreadcrumbSlotState {
    element: HTMLElement | null;
    setElement: (element: HTMLElement | null) => void;
}

const SlotContext = createContext<BreadcrumbSlotState | null>(null);

/** Lets a page put its breadcrumb in the header, next to the wordmark, without the header knowing the page. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
    const [element, setElement] = useState<HTMLElement | null>(null);

    return <SlotContext.Provider value={{ element, setElement }}>{children}</SlotContext.Provider>;
}

/** Where the header shows the page's breadcrumb; takes no room when the page has none. */
export function BreadcrumbSlot() {
    const slot = useContext(SlotContext);

    return <div ref={slot?.setElement} className="order-last min-w-0 basis-full empty:hidden md:order-none md:max-w-80 md:basis-auto md:shrink" />;
}

/** Renders its children in the header's breadcrumb slot; takes `enabled={false}` to render nothing there. */
export function HeaderBreadcrumb({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
    const element = useContext(SlotContext)?.element;

    if (!enabled || !element) return null;

    return createPortal(children, element);
}
